import { describe, it, expect, vi, beforeEach } from 'vitest';

// Per-hand dedup is what stops a re-exported session from silently
// double-counting every shared hand in the user's stats - the file-hash
// check only catches byte-identical re-uploads, which a fresh export never
// is. The subtle part is reading Mongo's E11000 write-error shape to learn
// WHICH hands collided, so that's what these tests pin down.

const mockHandLedger = { insertMany: vi.fn(), find: vi.fn(), deleteMany: vi.fn() };
vi.mock('../model/HandLedger.js', () => ({ default: mockHandLedger }));
vi.mock('../model/Session.js', () => ({ default: { findOne: vi.fn(), updateOne: vi.fn(), find: vi.fn() } }));
vi.mock('../model/User.js', () => ({ default: { updateOne: vi.fn() } }));

const { partitionAlreadyImported, claimHandIds } = await import('../services/handImportPipeline.js');

// Mimics the driver's unordered-insert failure: a BulkWriteError carrying
// one writeErrors entry per rejected row, each with the row's index.
function duplicateKeyError(indexes) {
  const err = new Error('E11000 duplicate key error');
  err.code = 11000;
  err.writeErrors = indexes.map(index => ({ code: 11000, index }));
  return err;
}

const hands = (...ids) => ids.map((handId, i) => ({ handId, handIndex: i + 1 }));

// partitionAlreadyImported is now a read: whatever handIds this returns are
// the ones already recorded for the user.
function ledgerHolds(...handIds) {
  mockHandLedger.find.mockReturnValue({
    select: () => ({ lean: async () => handIds.map(handId => ({ handId })) }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  ledgerHolds();
  mockHandLedger.insertMany.mockResolvedValue([]);
});

describe('partitionAlreadyImported', () => {
  it('returns every hand when nothing has been imported before', async () => {
    const input = hands('a', 'b', 'c');
    const { fresh, duplicateCount } = await partitionAlreadyImported('u1', input, 's1');
    expect(fresh).toHaveLength(3);
    expect(duplicateCount).toBe(0);
  });

  it('only reads - it must not claim ids before the hands are durable', async () => {
    // This is the fix for a verified data-loss bug: claiming first meant a
    // crash between the claim and session.save() left rows asserting the
    // user had hands that were never stored, permanently blocking them.
    await partitionAlreadyImported('u1', hands('a', 'b'));
    expect(mockHandLedger.insertMany).not.toHaveBeenCalled();
    expect(mockHandLedger.find).toHaveBeenCalledWith({ userId: 'u1', handId: { $in: ['a', 'b'] } });
  });

  it('drops only the hands already recorded, keeping the rest', async () => {
    // The real overlapping-export case: a fresh export of the same session
    // plus a few new hands at the end.
    ledgerHolds('a', 'b', 'd');
    const { fresh, duplicateCount } = await partitionAlreadyImported('u1', hands('a', 'b', 'c', 'd', 'e'));

    expect(fresh.map(h => h.handId)).toEqual(['c', 'e']);
    expect(duplicateCount).toBe(3);
  });

  it('reports every hand as duplicate when a file is a pure re-export', async () => {
    ledgerHolds('a', 'b', 'c');
    const { fresh, duplicateCount } = await partitionAlreadyImported('u1', hands('a', 'b', 'c'));
    expect(fresh).toHaveLength(0);
    expect(duplicateCount).toBe(3);
  });

  it('bypasses the ledger entirely for hands with no site hand id', async () => {
    // Every PokerNow hand takes this path - that format has no hand id, so
    // a unique index would collapse them all into one row.
    const input = [{ handId: null }, { handId: undefined }, {}];
    const { fresh, duplicateCount } = await partitionAlreadyImported('u1', input);

    expect(mockHandLedger.find).not.toHaveBeenCalled();
    expect(fresh).toHaveLength(3);
    expect(duplicateCount).toBe(0);
  });

  it('keeps id-less hands while still deduping the ones that have ids', async () => {
    ledgerHolds('dup');
    const input = [{ handId: 'dup' }, { handId: null }, { handId: 'new' }];
    const { fresh } = await partitionAlreadyImported('u1', input);
    expect(fresh.map(h => h.handId)).toEqual([null, 'new']);
  });

  it('chunks the lookup so one huge file does not build a giant $in', async () => {
    const many = hands(...Array.from({ length: 2500 }, (_, i) => `h${i}`));
    await partitionAlreadyImported('u1', many);
    expect(mockHandLedger.find).toHaveBeenCalledTimes(3); // 1000 + 1000 + 500
  });
});

describe('claimHandIds', () => {
  it('records a row per hand against the session that now holds them', async () => {
    await claimHandIds('u1', hands('a', 'b'), 'sess-9');
    expect(mockHandLedger.insertMany).toHaveBeenCalledWith(
      [
        { userId: 'u1', handId: 'a', sessionId: 'sess-9' },
        { userId: 'u1', handId: 'b', sessionId: 'sess-9' },
      ],
      { ordered: false }
    );
  });

  it('skips hands with no site hand id', async () => {
    await claimHandIds('u1', [{ handId: null }, {}], 's1');
    expect(mockHandLedger.insertMany).not.toHaveBeenCalled();
  });

  it('tolerates duplicate-key errors, since the row already existing is the desired state', async () => {
    mockHandLedger.insertMany.mockRejectedValue(duplicateKeyError([0]));
    await expect(claimHandIds('u1', hands('a'), 's1')).resolves.not.toThrow();
  });

  it('rethrows a genuine write failure', async () => {
    const err = new Error('connection reset');
    err.writeErrors = [{ code: 121, index: 0 }];
    mockHandLedger.insertMany.mockRejectedValue(err);
    await expect(claimHandIds('u1', hands('a'), 's1')).rejects.toThrow('connection reset');
  });

  it('tolerates duplicates reported nested under result.result', async () => {
    const err = new Error('E11000');
    err.result = { result: { writeErrors: [{ code: 11000, index: 0 }] } };
    mockHandLedger.insertMany.mockRejectedValue(err);
    await expect(claimHandIds('u1', hands('a'), 's1')).resolves.not.toThrow();
  });
});
