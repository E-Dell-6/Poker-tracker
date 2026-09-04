import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// A share link is an unauthenticated URL, so its TTL is the whole of its
// access control after the fact. The Mongo TTL index can't be what these
// tests pin - it sweeps on its own schedule and is absent entirely if it
// was never built - so what's checked here is that the controller refuses
// an expired doc on its own.

const mockSharedHand = {
  findOne: vi.fn(),
  create: vi.fn(),
  deleteOne: vi.fn(),
  findOneAndDelete: vi.fn(),
};
vi.mock('../model/sharedHand.js', () => ({ default: mockSharedHand }));

const { getSharedHand, createShareLink } = await import('../controllers/shareController.js');
const { SHARE } = await import('../config/limits.js');

const TTL_MS = SHARE.LINK_TTL_SECONDS * 1000;
const NOW = new Date('2026-09-04T12:00:00Z').getTime();

function mockRes() {
  const res = { statusCode: 200, body: null };
  res.status = vi.fn((code) => { res.statusCode = code; return res; });
  res.json = vi.fn((body) => { res.body = body; return res; });
  return res;
}

const doc = (ageMs, extra = {}) => ({
  _id: 'doc1',
  shareId: 'abc123',
  createdAt: new Date(NOW - ageMs),
  hand: { _id: 'h1' },
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  mockSharedHand.deleteOne.mockResolvedValue({ deletedCount: 1 });
  mockSharedHand.create.mockResolvedValue({});
});

afterEach(() => {
  vi.useRealTimers();
});

describe('getSharedHand', () => {
  it('serves a link that is still inside its TTL', async () => {
    mockSharedHand.findOne.mockResolvedValue(doc(TTL_MS - 1000));
    const res = mockRes();
    await getSharedHand({ params: { shareId: 'abc123' } }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ hand: { _id: 'h1' } });
  });

  it('refuses a doc the TTL sweep has not caught up with yet', async () => {
    mockSharedHand.findOne.mockResolvedValue(doc(TTL_MS + 1000));
    const res = mockRes();
    await getSharedHand({ params: { shareId: 'abc123' } }, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toMatch(/expired/i);
    // Same 404 as an unknown id: whether a link ever existed is not
    // something an anonymous caller needs told.
    expect(res.body).not.toHaveProperty('hand');
  });

  it('deletes the expired doc it refused', async () => {
    mockSharedHand.findOne.mockResolvedValue(doc(TTL_MS + 1000));
    await getSharedHand({ params: { shareId: 'abc123' } }, mockRes());

    expect(mockSharedHand.deleteOne).toHaveBeenCalledWith({ _id: 'doc1' });
  });

  it('still refuses when deleting the expired doc fails', async () => {
    mockSharedHand.findOne.mockResolvedValue(doc(TTL_MS + 1000));
    mockSharedHand.deleteOne.mockRejectedValue(new Error('mongo down'));
    const res = mockRes();
    await getSharedHand({ params: { shareId: 'abc123' } }, res);

    expect(res.statusCode).toBe(404);
  });

  it('refuses a legacy doc with no createdAt rather than serving it forever', async () => {
    mockSharedHand.findOne.mockResolvedValue(doc(0, { createdAt: undefined }));
    const res = mockRes();
    await getSharedHand({ params: { shareId: 'abc123' } }, res);

    expect(res.statusCode).toBe(404);
  });
});

describe('createShareLink', () => {
  const req = { body: { userId: 'u1', hand: { _id: 'h1' } } };

  it('reuses a live link rather than minting a second one', async () => {
    mockSharedHand.findOne.mockResolvedValue(doc(TTL_MS - 1000));
    const res = mockRes();
    await createShareLink(req, res);

    expect(res.body).toEqual({ shareId: 'abc123' });
    expect(mockSharedHand.create).not.toHaveBeenCalled();
  });

  it('replaces an expired link instead of handing back a dead id', async () => {
    mockSharedHand.findOne.mockResolvedValue(doc(TTL_MS + 1000));
    const res = mockRes();
    await createShareLink(req, res);

    expect(mockSharedHand.deleteOne).toHaveBeenCalledWith({ _id: 'doc1' });
    expect(mockSharedHand.create).toHaveBeenCalled();
    expect(res.statusCode).toBe(201);
    expect(res.body.shareId).not.toBe('abc123');
  });

  it('starts the new link at full lifetime, not the old one', async () => {
    mockSharedHand.findOne.mockResolvedValue(doc(TTL_MS + 1000));
    await createShareLink(req, mockRes());

    // createdAt is left to the schema default, so the fresh doc gets now.
    const created = mockSharedHand.create.mock.calls[0][0];
    expect(created).not.toHaveProperty('createdAt');
  });
});
