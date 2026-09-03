import { describe, it, expect, vi, beforeEach } from 'vitest';

// The resolver replaces ~100k sequential findOne calls with a Map, so what
// matters is that it resolves names IDENTICALLY to the findOrCreatePerson
// loop it replaces - same case-insensitive matching, same skip rules, same
// first-seen-casing-wins behavior - while doing far fewer queries. The
// query COUNT is asserted too, since that's the entire point.

const mockPerson = {
  find: vi.fn(),
  insertMany: vi.fn(),
};

vi.mock('../model/People.js', () => ({ default: mockPerson }));

const { createPersonResolver } = await import('../services/personResolver.js');
const { QUOTA } = await import('../config/limits.js');

let nextId = 0;
const id = () => `id-${++nextId}`;

function stubExisting(names) {
  mockPerson.find.mockReturnValue({
    select: () => ({ lean: async () => names.map(n => ({ _id: `existing-${n.toLowerCase()}`, name: n })) }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  nextId = 0;
  stubExisting([]);
  mockPerson.insertMany.mockImplementation(async (docs) =>
    docs.map(d => ({ _id: id(), userId: d.userId, name: d.name }))
  );
});

const hand = (...players) => ({ players });

describe('createPersonResolver', () => {
  it('loads the user\'s people exactly once, no matter how many files it handles', async () => {
    const resolver = await createPersonResolver('u1');
    await resolver.attach([hand({ name: 'Alice' })]);
    await resolver.attach([hand({ name: 'Bob' })]);
    await resolver.attach([hand({ name: 'Alice' })]);

    // One find for the whole job - this is the N+1 removal.
    expect(mockPerson.find).toHaveBeenCalledTimes(1);
    // And Alice is only created once, on the file that first saw her.
    expect(mockPerson.insertMany).toHaveBeenCalledTimes(2);
  });

  it('matches existing people case-insensitively, like findOrCreatePerson did', async () => {
    stubExisting(['AlexSexy']);
    const resolver = await createPersonResolver('u1');
    const hands = [hand({ name: 'alexsexy' }), hand({ name: 'ALEXSEXY' }), hand({ name: '  AlexSexy  ' })];
    await resolver.attach(hands);

    // All three resolve to the one existing Person; nothing new is created.
    expect(mockPerson.insertMany).not.toHaveBeenCalled();
    for (const h of hands) {
      expect(h.players[0].personId).toBe('existing-alexsexy');
    }
  });

  it('creates one Person for a name appearing many times across a batch', async () => {
    const resolver = await createPersonResolver('u1');
    const hands = Array.from({ length: 50 }, () => hand({ name: 'Grinder99' }));
    await resolver.attach(hands);

    expect(mockPerson.insertMany).toHaveBeenCalledTimes(1);
    expect(mockPerson.insertMany.mock.calls[0][0]).toHaveLength(1);
    const assigned = new Set(hands.map(h => h.players[0].personId));
    expect(assigned.size).toBe(1);
  });

  it('treats different casings within one batch as the same new person', async () => {
    const resolver = await createPersonResolver('u1');
    const hands = [hand({ name: 'Villain' }), hand({ name: 'villain' })];
    await resolver.attach(hands);

    expect(mockPerson.insertMany.mock.calls[0][0]).toHaveLength(1);
    // First-seen casing is what gets stored.
    expect(mockPerson.insertMany.mock.calls[0][0][0].name).toBe('Villain');
    expect(hands[0].players[0].personId).toBe(hands[1].players[0].personId);
  });

  it('skips hero, sitting-out, and already-linked players', async () => {
    const resolver = await createPersonResolver('u1');
    const h = hand(
      { name: 'Hero', isHero: true },
      { name: 'Idle', isSittingOut: true },
      { name: 'Relinked', personId: 'manually-set' },
      { name: 'Fresh' },
    );
    await resolver.attach([h]);

    expect(h.players[0].personId).toBeUndefined();
    expect(h.players[1].personId).toBeUndefined();
    // A manual re-link must never be clobbered by a re-import.
    expect(h.players[2].personId).toBe('manually-set');
    expect(h.players[3].personId).toBeTruthy();
    expect(mockPerson.insertMany.mock.calls[0][0].map(d => d.name)).toEqual(['Fresh']);
  });

  it('tolerates a hand with no players array', async () => {
    const resolver = await createPersonResolver('u1');
    await expect(resolver.attach([{}, hand({ name: 'A' })])).resolves.not.toThrow();
  });

  it('refuses a job that would mint more than the per-job person cap', async () => {
    const resolver = await createPersonResolver('u1');
    const tooMany = Array.from({ length: QUOTA.NEW_PERSONS_PER_JOB + 1 }, (_, i) => hand({ name: `p${i}` }));

    await expect(resolver.attach(tooMany)).rejects.toThrow(/over the limit/);
    expect(mockPerson.insertMany).not.toHaveBeenCalled();
  });

  it('counts created people cumulatively across files toward the cap', async () => {
    const resolver = await createPersonResolver('u1');
    const half = Math.floor(QUOTA.NEW_PERSONS_PER_JOB / 2);
    await resolver.attach(Array.from({ length: half }, (_, i) => hand({ name: `a${i}` })));
    expect(resolver.createdCount).toBe(half);

    // A second file pushing the running total past the cap must fail even
    // though it is individually small enough.
    await expect(
      resolver.attach(Array.from({ length: half + 5 }, (_, i) => hand({ name: `b${i}` })))
    ).rejects.toThrow(/over the limit/);
  });

  it('prefers the first of two pre-existing rows differing only in case', async () => {
    // Nothing enforced Person uniqueness before, so this state exists in
    // real data. It must resolve deterministically.
    stubExisting(['Fish', 'FISH']);
    const resolver = await createPersonResolver('u1');
    const h = hand({ name: 'fish' });
    await resolver.attach([h]);
    expect(h.players[0].personId).toBe('existing-fish');
    expect(mockPerson.insertMany).not.toHaveBeenCalled();
  });
});
