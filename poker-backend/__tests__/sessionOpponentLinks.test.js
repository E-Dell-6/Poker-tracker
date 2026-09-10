import { describe, it, expect, vi, beforeEach } from 'vitest';

// updateSession is the only path that can attach a Person to an ALREADY
// IMPORTED session's seats - the Edit Session modal's opponent picker.
// Before this existed the modal renamed opponents and dropped the chosen
// personId on the floor, so the link vanished on reopen and the linked
// player's stats were never computed. What matters here is that the link
// reaches player.personId, that renames and links stay keyed on the name
// the client sent (not on each other's output), and that BOTH the person
// losing hands and the person gaining them get recomputed.

const mockSession = { findOne: vi.fn() };
const mockPerson = { find: vi.fn() };
const mockRecompute = vi.fn();

vi.mock('../model/Session.js', () => ({ default: mockSession }));
vi.mock('../model/People.js', () => ({ default: mockPerson }));
vi.mock('../model/HandLedger.js', () => ({ default: {} }));
vi.mock('../model/User.js', () => ({ default: {} }));
vi.mock('../services/statsService.js', () => ({
  recomputeStatsForPerson: (...args) => mockRecompute(...args),
}));

const { updateSession } = await import('../services/sessionService.js');

const USER = '507f1f77bcf86cd799439001';
const ALICE = '507f1f77bcf86cd799439011'; // auto-created on import
const BOB = '507f1f77bcf86cd799439012';   // the starred person being linked
const STRANGER = '507f1f77bcf86cd799439013'; // exists, but not this user's

// Only ALICE and BOB belong to USER - the ownership query filters STRANGER
// out the same way Mongo would.
function stubOwnedPeople() {
  mockPerson.find.mockImplementation((query) => ({
    select: () => ({
      lean: async () => (query._id?.$in ?? [])
        .filter(id => id === ALICE || id === BOB)
        .map(id => ({ _id: id })),
    }),
  }));
}

function stubSession(hands) {
  const session = {
    hands,
    markModified: vi.fn(),
    save: vi.fn(async () => session),
  };
  mockSession.findOne.mockResolvedValue(session);
  return session;
}

// Two hands, both seating hero plus "AlexSexy" (linked to the auto-created
// ALICE) and an untouched third player.
function twoHands() {
  const seat = (name, extra = {}) => ({ name, personId: null, ...extra });
  return [
    {
      players: [
        seat('Hero', { isHero: true }),
        seat('AlexSexy', { personId: ALICE }),
        seat('Someone', { personId: STRANGER }),
      ],
      winners: ['AlexSexy'],
      actions: [{ player: 'AlexSexy', type: 'raise' }, { player: 'Hero', type: 'fold' }],
    },
    {
      players: [seat('Hero', { isHero: true }), seat('AlexSexy', { personId: ALICE })],
      winners: ['Hero'],
      actions: [{ player: 'AlexSexy', type: 'call' }],
    },
  ];
}

const seatNamed = (session, handIndex, name) =>
  session.hands[handIndex].players.find(p => p.name === name);

beforeEach(() => {
  vi.clearAllMocks();
  stubOwnedPeople();
});

describe('updateSession opponent links', () => {
  it('writes the chosen personId onto every seat with that name, in every hand', async () => {
    const session = stubSession(twoHands());

    await updateSession(USER, 'sess1', { opponentLinks: { AlexSexy: BOB } });

    expect(String(seatNamed(session, 0, 'AlexSexy').personId)).toBe(BOB);
    expect(String(seatNamed(session, 1, 'AlexSexy').personId)).toBe(BOB);
    expect(session.markModified).toHaveBeenCalledWith('hands');
    expect(session.save).toHaveBeenCalled();
  });

  it('leaves hero and unrelated seats alone', async () => {
    const session = stubSession(twoHands());

    await updateSession(USER, 'sess1', { opponentLinks: { AlexSexy: BOB, Hero: BOB } });

    expect(seatNamed(session, 0, 'Hero').personId).toBeNull();
    expect(String(seatNamed(session, 0, 'Someone').personId)).toBe(STRANGER);
  });

  it('applies a rename and a link in the same save, both keyed on the original name', async () => {
    const session = stubSession(twoHands());

    await updateSession(USER, 'sess1', {
      opponentRenames: { AlexSexy: 'Bob' },
      opponentLinks: { AlexSexy: BOB },
    });

    // The rename must not run first - the link lookup would then be
    // searching for a name that no longer exists on the seat.
    expect(String(seatNamed(session, 0, 'Bob').personId)).toBe(BOB);
    expect(session.hands[0].winners).toEqual(['Bob']);
    expect(session.hands[0].actions[0].player).toBe('Bob');
    expect(session.hands[1].actions[0].player).toBe('Bob');
  });

  it('clears personId when the link is null (an explicit unlink)', async () => {
    const session = stubSession(twoHands());

    await updateSession(USER, 'sess1', { opponentLinks: { AlexSexy: null } });

    expect(seatNamed(session, 0, 'AlexSexy').personId).toBeNull();
    expect(mockRecompute).toHaveBeenCalledWith(USER, ALICE);
  });

  it('recomputes both the person losing the hands and the one gaining them, once each', async () => {
    stubSession(twoHands());

    await updateSession(USER, 'sess1', { opponentLinks: { AlexSexy: BOB } });

    expect(mockRecompute).toHaveBeenCalledTimes(2);
    expect(mockRecompute.mock.calls.map(c => c[1]).sort()).toEqual([ALICE, BOB].sort());
  });

  it('ignores a personId that is not this user\'s, leaving the existing link intact', async () => {
    const session = stubSession(twoHands());

    await updateSession(USER, 'sess1', { opponentLinks: { AlexSexy: STRANGER } });

    expect(String(seatNamed(session, 0, 'AlexSexy').personId)).toBe(ALICE);
    expect(mockRecompute).not.toHaveBeenCalled();
  });

  it('ignores a malformed personId without querying for it', async () => {
    const session = stubSession(twoHands());

    await updateSession(USER, 'sess1', { opponentLinks: { AlexSexy: 'not-an-object-id' } });

    expect(String(seatNamed(session, 0, 'AlexSexy').personId)).toBe(ALICE);
    expect(mockPerson.find).not.toHaveBeenCalled();
    expect(mockRecompute).not.toHaveBeenCalled();
  });

  it('recomputes nothing when a save only touches scalar fields', async () => {
    const session = stubSession(twoHands());

    await updateSession(USER, 'sess1', { gameType: 'PLO', totalProfit: 42, starred: true });

    expect(session.gameType).toBe('PLO');
    expect(session.totalProfit).toBe(42);
    expect(session.starred).toBe(true);
    expect(session.markModified).not.toHaveBeenCalled();
    expect(mockRecompute).not.toHaveBeenCalled();
  });

  it('returns null for a session that is not this user\'s', async () => {
    mockSession.findOne.mockResolvedValue(null);

    await expect(updateSession(USER, 'sess1', { opponentLinks: { AlexSexy: BOB } })).resolves.toBeNull();
  });
});
