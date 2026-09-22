import { describe, it, expect, vi, beforeEach } from 'vitest';

// The accent key a user picks is written into a data-attribute that CSS
// selects on, so this endpoint is the boundary between user input and the
// stylesheet. What matters here is that nothing but a known key from a fixed
// list can ever get stored - not that a denylist happens to catch today's
// obvious payloads.

const mockUser = { findById: vi.fn(), findByIdAndUpdate: vi.fn() };
const mockSession = { countDocuments: vi.fn() };
vi.mock('../model/User.js', () => ({ default: mockUser }));
vi.mock('../model/Session.js', () => ({ default: mockSession }));

const { updatePreferences, getUserData } = await import('../controllers/userController.js');
const { DEFAULT_PREFERENCES, ACCENT_KEYS, THEME_KEYS } = await import('../config/preferences.js');

function mockRes() {
  return { json: vi.fn(function (body) { this.body = body; return this; }) };
}

function stubUpdate(preferences) {
  mockUser.findByIdAndUpdate.mockReturnValue({
    select: () => ({ lean: async () => (preferences === null ? null : { preferences }) }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  stubUpdate({ theme: 'dark', accent: 'teal' });
});

describe('updatePreferences', () => {
  it('accepts every key the schema enum allows', async () => {
    for (const accent of ACCENT_KEYS) {
      stubUpdate({ theme: 'dark', accent });
      const res = mockRes();
      await updatePreferences({ userId: 'u1', body: { accent } }, res);
      expect(res.body.success).toBe(true);
    }
    for (const theme of THEME_KEYS) {
      stubUpdate({ theme, accent: 'orange' });
      const res = mockRes();
      await updatePreferences({ userId: 'u1', body: { theme } }, res);
      expect(res.body.success).toBe(true);
    }
  });

  it('refuses a color string instead of a key, however it is dressed up', async () => {
    const payloads = [
      { accent: '#ff0000' },
      { accent: 'red; background: url(https://evil.example/x)' },
      { accent: 'var(--color-bg)' },
      { accent: 'ORANGE' },   // enum is case-sensitive
      { accent: 123 },
      { accent: null },
      { theme: 'neon' },
    ];
    for (const body of payloads) {
      const res = mockRes();
      await updatePreferences({ userId: 'u1', body }, res);
      expect(res.body).toEqual({ success: false, message: 'Invalid preferences' });
    }
    expect(mockUser.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('drops an unknown key rather than storing it alongside a valid one', async () => {
    const res = mockRes();
    await updatePreferences({ userId: 'u1', body: { accent: 'teal', isAdmin: true } }, res);
    expect(res.body.success).toBe(true);
    const [, update] = mockUser.findByIdAndUpdate.mock.calls[0];
    expect(update).toEqual({ $set: { 'preferences.accent': 'teal' } });
  });

  it('never lets the userId userAuth injects into req.body reach the patch', async () => {
    // userAuth sets req.body.userId on every authenticated request, so the
    // body always carries a key this endpoint must ignore.
    const res = mockRes();
    await updatePreferences({ userId: 'u1', body: { userId: 'u1', accent: 'rose' } }, res);
    const [id, update] = mockUser.findByIdAndUpdate.mock.calls[0];
    expect(id).toBe('u1');
    expect(update).toEqual({ $set: { 'preferences.accent': 'rose' } });
  });

  it('writes a dotted path so setting one field cannot clobber the other', async () => {
    const res = mockRes();
    await updatePreferences({ userId: 'u1', body: { accent: 'blue' } }, res);
    const [, update] = mockUser.findByIdAndUpdate.mock.calls[0];
    expect(update.$set).not.toHaveProperty('preferences');
    expect(update.$set).toEqual({ 'preferences.accent': 'blue' });
    expect(res.body.success).toBe(true);
  });

  it('refuses a body carrying nothing it recognises', async () => {
    for (const body of [{}, { userId: 'u1' }, null, 'accent=teal', ['teal']]) {
      const res = mockRes();
      await updatePreferences({ userId: 'u1', body }, res);
      expect(res.body.success).toBe(false);
    }
    expect(mockUser.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('reads req.userId, not req.body.userId', async () => {
    const res = mockRes();
    await updatePreferences({ userId: 'u1', body: { userId: 'attacker', accent: 'lime' } }, res);
    expect(mockUser.findByIdAndUpdate.mock.calls[0][0]).toBe('u1');
    expect(res.body.success).toBe(true);
  });

  it('refuses a request with no authenticated user', async () => {
    for (const req of [{ body: { accent: 'teal' } }, { userId: '  ', body: { accent: 'teal' } }]) {
      const res = mockRes();
      await updatePreferences(req, res);
      expect(res.body).toEqual({ success: false, message: 'Not Authorized' });
    }
    expect(mockUser.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('answers with a message instead of a rejected promise when Mongo fails', async () => {
    mockUser.findByIdAndUpdate.mockImplementation(() => { throw new Error('no primary'); });
    const res = mockRes();
    await expect(updatePreferences({ userId: 'u1', body: { accent: 'teal' } }, res)).resolves.not.toThrow();
    expect(res.body.success).toBe(false);
  });
});

describe('getUserData', () => {
  it('fills in defaults for an account written before preferences existed', async () => {
    // The field has a schema default, but documents predating it have no
    // `preferences` key at all - the frontend would then read undefined and
    // paint an unstyled page.
    mockUser.findById.mockResolvedValue({ name: 'Ann', email: 'a@b.co', isAccountVerified: true });
    const res = mockRes();
    await getUserData({ body: { userId: 'u1' } }, res);
    expect(res.body.userData.preferences).toEqual(DEFAULT_PREFERENCES);
  });

  it('returns the email, so the app can show which account is signed in', async () => {
    mockUser.findById.mockResolvedValue({
      name: 'Ann', email: 'a@b.co', isAccountVerified: false, preferences: { theme: 'dark', accent: 'lime' },
    });
    const res = mockRes();
    await getUserData({ body: { userId: 'u1' } }, res);
    expect(res.body.userData).toEqual({
      name: 'Ann',
      email: 'a@b.co',
      isAccountVerified: false,
      preferences: { theme: 'dark', accent: 'lime' },
    });
  });

  it('never returns the password hash', async () => {
    mockUser.findById.mockResolvedValue({
      name: 'Ann', email: 'a@b.co', password: '$2a$10$hash', isAccountVerified: true,
    });
    const res = mockRes();
    await getUserData({ body: { userId: 'u1' } }, res);
    expect(res.body.userData).not.toHaveProperty('password');
  });
});
