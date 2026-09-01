// Seat-by-seat preflop action-tree walker for the Range Matrix page.
//
// Every seat is hero: since hero's history covers every position across
// many different hands, we have real aggregate stats for hero acting from
// ANY seat facing ANY recorded situation - not just one fixed "hero
// position" with opponents filled in around it. So the sequence bar walks
// the whole hand in real action order, and at every step the numbers shown
// are hero's own historical fold/call/raise split for being in that exact
// seat facing that exact situation.
//
// This replays real no-limit hold'em action rules: action starts at UTG
// (first to act preflop) and proceeds clockwise; a raise reopens the action
// to every other live (non-folded) seat, in order starting right after the
// raiser, ending back at the raiser's own seat (who doesn't need to act
// again unless someone re-raises after them, which starts a new round the
// same way). This is what lets a seat reappear later in the sequence (e.g.
// BTN opens, gets 3-bet, and BTN's own facing-the-3-bet decision is a
// second, later card) - mirrors the reference mockup showing BTN and BB
// twice.

import { scenarioForLevel, SEATS_BY_SIZE } from './handGrid';

// `path` is an ordered array of already-decided steps:
// { position, scenario, facingPosition, action }. `seats` is the acting
// order for the table size in view (SEATS_BY_SIZE[6|7|8|9]) - defaults to
// 6-max when omitted. Returns either { complete: true, folded } once the
// hand's preflop action is settled (one seat left live, or a betting round
// closes with no new raise), or { complete: false, folded, openSeats }
// where openSeats is every seat still to act in the CURRENT round, in
// order - all of them share the same scenario/facingPosition, since a
// betting round is exactly "everyone responding to the same last raise" (or
// to nothing yet, at level 0). Exposing the whole round (not just the next
// seat) is what lets the UI show every position UTG->BB up front and skip
// straight to e.g. "BTN raises": the caller auto-fills fold for whichever
// openSeats entries come before the one actually clicked.
export function computeWalk(path, seats = SEATS_BY_SIZE[6]) {
  const folded = new Set();
  let toAct = [...seats];
  let i = 0;
  let level = 0;
  let facingPosition = null;

  for (const step of path) {
    if (step.action === 'fold') folded.add(step.position);

    if (step.action === 'raise') {
      const raiserIdx = seats.indexOf(step.position);
      const rotated = [...seats.slice(raiserIdx + 1), ...seats.slice(0, raiserIdx)];
      toAct = rotated.filter(s => !folded.has(s));
      i = 0;
      level++;
      facingPosition = step.position;
      if (toAct.length === 0) return { complete: true, folded };
      continue;
    }

    i++;
    if (i >= toAct.length) return { complete: true, folded };
  }

  // No extra "only one live seat left" check needed here: every genuine
  // completion case (everyone folds to an uncontested raiser, or a round
  // closes with no new raise) is already caught inside the loop above via
  // the post-raise empty-toAct check or the i >= toAct.length check. A
  // seat being the sole survivor of a string of folds with no raise yet
  // (e.g. everyone folds to BB) is NOT complete - that seat still has a
  // real, un-acted-on decision (BB's free option).

  const scenario = scenarioForLevel(level);
  const roundFacingPosition = level === 0 ? null : facingPosition;

  return {
    complete: false,
    folded,
    openSeats: toAct.slice(i).map(position => ({ position, scenario, facingPosition: roundFacingPosition }))
  };
}

// stats.preflopMatrix[tableSize][scenario][position] (rfi) or
// [scenario][position][facingPosition] (everything else) - the flat
// { [token]: cell } slice for one node, or null if hero has no recorded
// hands there. `matrixRoot` is already the tableSize-sliced object
// (stats.preflopMatrix['6'|'7'|'8']).
export function getMatrixBucket(matrixRoot, scenario, position, facingPosition) {
  if (!matrixRoot || !position) return null;
  if (scenario === 'rfi') return matrixRoot.rfi?.[position] || null;
  return matrixRoot[scenario]?.[position]?.[facingPosition] || null;
}

// Aggregates fold/call/raise/total across every hand token in a bucket -
// the overall rate for a node (e.g. "UTG's RFI: fold 62% / call 8% / raise
// 30%"), as opposed to the grid's per-hand-token breakdown.
export function summarizeBucket(tokens) {
  let fold = 0, call = 0, raise = 0, total = 0;
  for (const c of Object.values(tokens || {})) {
    fold += c.fold; call += c.call; raise += c.raise; total += c.total;
  }
  const pct = n => total > 0 ? Math.round((n / total) * 1000) / 10 : 0;
  return { fold, call, raise, total, foldPct: pct(fold), callPct: pct(call), raisePct: pct(raise) };
}
