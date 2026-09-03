import { useState } from 'react';
import { useStudyContext } from '../StudyLayout';
import { HandMatrix } from './HandMatrix';
import { PreflopMatrixControls } from './PreflopMatrixControls';
import { PreflopPositionMatrix } from '../PreflopPositionMatrix';
import { computeWalk, getMatrixBucket } from '../../../utils/preflopWalk';
import { SEATS_BY_SIZE } from '../../../utils/handGrid';
import './PreflopMatrixPage.css';

export function PreflopMatrixPage() {
  const { stats } = useStudyContext();

  // Every seat is hero: since hero's tracked hands cover every position,
  // `path` walks the whole hand in real action order (see preflopWalk.js),
  // and at each step we're looking up hero's own real fold/call/raise
  // split for having been in that seat facing that exact situation - not a
  // fixed "hero position" with opponents faked in around it.
  const [path, setPath] = useState([]);
  const [tableSize, setTableSize] = useState(6);
  const [minSampleSize, setMinSampleSize] = useState(0);

  // The backend aggregates preflopMatrix for 6/7/8/9-handed tables (see
  // statsEngine.js's tableSize gate) - switching sizes changes the whole
  // acting order (UTG+1/UTG+2 appear at 7/8/9-handed), so the in-progress
  // walk can't carry over and gets reset.
  const matrixRoot = stats.preflopMatrix?.[String(tableSize)];
  const seats = SEATS_BY_SIZE[tableSize];
  const walk = computeWalk(path, seats);

  function setTableSizeAndReset(size) {
    setTableSize(size);
    setPath([]);
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
    setPath([...truncated, { ...w.openSeats[0], action }]);
  }

  // Commits `action` for `position`, one of the CURRENT round's openSeats -
  // every position UTG->BB in that round is shown and clickable at once
  // (see PreflopMatrixControls), so picking one that isn't the very next
  // seat (e.g. clicking BTN's Raise while UTG/HJ/CO are still undecided)
  // auto-fills fold for whichever open seats come before it, exactly as if
  // hero had clicked each one individually.
  function commitOpenSeat(position, action) {
    const idx = walk.openSeats.findIndex(s => s.position === position);
    if (idx === -1) return;
    const autoFolds = walk.openSeats.slice(0, idx).map(s => ({ ...s, action: 'fold' }));
    const chosen = { ...walk.openSeats[idx], action };
    setPath([...path, ...autoFolds, chosen]);
  }

  function resetWalk() {
    setPath([]);
  }

  // The node currently being displayed in the grid above: the nearest open
  // decision if the hand isn't settled yet, otherwise whatever was decided
  // last.
  const displayNode = !walk.complete ? walk.openSeats[0] : path[path.length - 1];
  const gridData = displayNode ? getMatrixBucket(matrixRoot, displayNode.scenario, displayNode.position, displayNode.facingPosition) : null;

  return (
    <div className="pfm-page">
      <p className="pfm-lead">Walk any preflop line - every card is hero's own history for that seat</p>

      <PreflopMatrixControls
        path={path}
        openSeats={!walk.complete ? walk.openSeats : []}
        complete={walk.complete}
        onRedoStep={redoStep}
        onCommitOpenSeat={commitOpenSeat}
        onReset={resetWalk}
        tableSize={tableSize} setTableSize={setTableSizeAndReset}
        minSampleSize={minSampleSize} setMinSampleSize={setMinSampleSize}
      />

      <div className="pfm-grid-wrap">
        {!gridData || Object.keys(gridData).length === 0 ? (
          <div className="study-status-container">
            <h2>No hands recorded</h2>
            <p>Hero has no tracked hands for this seat/situation yet.</p>
          </div>
        ) : (
          <HandMatrix data={gridData} minSampleSize={minSampleSize} />
        )}
      </div>

      <PreflopPositionMatrix positional={stats.positional} />
    </div>
  );
}

export default PreflopMatrixPage;
