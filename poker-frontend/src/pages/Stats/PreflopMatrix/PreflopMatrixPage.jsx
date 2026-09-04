import { useState } from 'react';
import { useStudyContext } from '../StudyLayout';
import { HandMatrix } from './HandMatrix';
import { PreflopMatrixControls } from './PreflopMatrixControls';
import { PreflopPositionMatrix } from '../PreflopPositionMatrix';
import { computeWalk, getMatrixBucket } from '../../../utils/preflopWalk';
import { SEATS_BY_SIZE, labelForScenario } from '../../../utils/handGrid';
import './PreflopMatrixPage.css';

// "BTN · vs Open (UTG)" / "UTG · RFI" - what the grid below is currently
// showing, so a selected card that's scrolled out of view still says what
// you're looking at.
function nodeLabel(node) {
  if (!node) return null;
  const scenario = labelForScenario(node.scenario);
  return `${node.position} · ${scenario}${node.facingPosition ? ` (${node.facingPosition})` : ''}`;
}

export function PreflopMatrixPage() {
  const { stats } = useStudyContext();

  // Every seat is hero: since hero's tracked hands cover every position,
  // `path` walks the whole hand in real action order (see preflopWalk.js),
  // and at each step we're looking up hero's own real fold/call/raise
  // split for having been in that seat facing that exact situation - not a
  // fixed "hero position" with opponents faked in around it.
  const [path, setPath] = useState([]);
  // Which sequence card the grid is showing, or null for "follow the
  // frontier" (see `frontierId` below). Only ever set by an explicit click
  // on a card; every path change clears it back to null so committing an
  // action walks forward on its own, the way it did before cards became
  // selectable.
  const [selectedId, setSelectedId] = useState(null);
  const [tableSize, setTableSize] = useState(6);
  const [minSampleSize, setMinSampleSize] = useState(0);

  // The backend aggregates preflopMatrix for 6/7/8/9-handed tables (see
  // statsEngine.js's tableSize gate) - switching sizes changes the whole
  // acting order (UTG+1/UTG+2 appear at 7/8/9-handed), so the in-progress
  // walk can't carry over and gets reset.
  const matrixRoot = stats.preflopMatrix?.[String(tableSize)];
  const seats = SEATS_BY_SIZE[tableSize];
  const walk = computeWalk(path, seats);
  const openSeats = walk.complete ? [] : walk.openSeats;

  // Every card in the sequence bar as one ordered list: the decisions
  // already committed, then whichever seats are still to act this round.
  // `id` only has to stay stable while a card is on screen, which is all
  // the selection below needs - a path change resets the selection anyway.
  const nodes = [
    ...path.map((step, index) => ({ ...step, id: `step-${index}`, index, decided: true })),
    ...openSeats.map(seat => ({ ...seat, id: `open-${seat.position}`, decided: false }))
  ];

  // Default selection: the nearest still-open decision, or the last thing
  // decided once the hand is settled. Falling back to it (rather than
  // holding a stale id) is what makes the bar auto-advance after a click.
  const frontierId = openSeats.length > 0
    ? `open-${openSeats[0].position}`
    : nodes[nodes.length - 1]?.id ?? null;
  const activeId = nodes.some(n => n.id === selectedId) ? selectedId : frontierId;
  const displayNode = nodes.find(n => n.id === activeId) || null;

  function setPathAndFollow(next) {
    setPath(next);
    setSelectedId(null);
  }

  function setTableSizeAndReset(size) {
    setTableSize(size);
    setPathAndFollow([]);
  }

  // Re-decides an already-committed step at `index`: truncates the path to
  // just before it and re-commits with the new action. Always operates on
  // that round's very first open seat (by construction - nothing before
  // `index` changed, so replaying up to it reproduces the same round), so
  // no auto-fold is needed here the way commitOpenSeat below needs it.
  function redoStep(index, action) {
    const truncated = path.slice(0, index);
    const w = computeWalk(truncated, seats);
    if (w.complete) return;
    setPathAndFollow([...truncated, { ...w.openSeats[0], action }]);
  }

  // Commits `action` for `position`, one of the CURRENT round's openSeats -
  // every position UTG->BB in that round is shown and clickable at once
  // (see PreflopMatrixControls), so picking one that isn't the very next
  // seat (e.g. clicking BTN's Raise while UTG/HJ/CO are still undecided)
  // auto-fills fold for whichever open seats come before it, exactly as if
  // hero had clicked each one individually.
  function commitOpenSeat(position, action) {
    const idx = openSeats.findIndex(s => s.position === position);
    if (idx === -1) return;
    const autoFolds = openSeats.slice(0, idx).map(s => ({ ...s, action: 'fold' }));
    const chosen = { ...openSeats[idx], action };
    setPathAndFollow([...path, ...autoFolds, chosen]);
  }

  // Picking an action always advances the line; picking the card itself
  // only changes which node the grid is reading, leaving the line alone.
  function pickAction(node, action) {
    if (node.decided) redoStep(node.index, action);
    else commitOpenSeat(node.position, action);
  }

  function resetWalk() {
    setPathAndFollow([]);
  }

  const gridData = displayNode
    ? getMatrixBucket(matrixRoot, displayNode.scenario, displayNode.position, displayNode.facingPosition)
    : null;

  return (
    <div className="pfm-page">
      <p className="pfm-lead">Walk any preflop line - every card is hero's own history for that seat</p>

      <PreflopMatrixControls
        nodes={nodes}
        activeId={activeId}
        complete={walk.complete}
        onSelectNode={setSelectedId}
        onPickAction={pickAction}
        onReset={resetWalk}
        tableSize={tableSize} setTableSize={setTableSizeAndReset}
        minSampleSize={minSampleSize} setMinSampleSize={setMinSampleSize}
      />

      <div className="pfm-grid-wrap">
        <HandMatrix data={gridData} minSampleSize={minSampleSize} subtitle={nodeLabel(displayNode)} />
      </div>

      <PreflopPositionMatrix positional={stats.positional} />
    </div>
  );
}

export default PreflopMatrixPage;
