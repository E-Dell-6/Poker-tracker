import { RANKS, handToken } from '../../../utils/handGrid';
import { ACTIONS } from './rangeDisplay';
import '../MatrixTableCard.css'; // .matrix-table-card/.matrix-table-header/.section-title
import './HandMatrix.css';

function ActionBars({ cell }) {
  if (!cell || cell.total === 0) return null;
  return (
    <div className="hm-bars">
      {ACTIONS.map(a => (
        cell[a.pctKey] > 0
          ? <div key={a.key} className="hm-bar" style={{ flexGrow: cell[a.pctKey], background: a.color }} />
          : null
      ))}
    </div>
  );
}

// Same dot-legend convention as EVGraph.jsx's Actual/All-in EV legend -
// explains the bar colors inline instead of only on hover/tap.
function Legend() {
  return (
    <div className="hm-legend">
      {ACTIONS.map(a => (
        <span key={a.key} className="hm-legend-item">
          <span className="hm-legend-dot" style={{ background: a.color }} />
          {a.label}
        </span>
      ))}
    </div>
  );
}

// 13x13 range-matrix grid: rows/cols both ordered A-K-Q-J-T-9...2 (RANKS).
// Diagonal = pocket pairs, upper-right triangle = suited, lower-left =
// offsuit - see handGrid.js's handToken. `data` is the already-resolved
// flat { [token]: cell } slice for whatever hero-position/scenario/facing-
// position combination the page has selected - this component itself is
// scenario-agnostic. `cell` shape: {fold,call,raise,total,foldPct,callPct,
// raisePct,confidence} (see statsEngine.js's finalizeMatrixCell) or
// undefined for a hand hero has never held in this slice. Owns its own
// `.matrix-table-card` chrome (title/legend/empty state) - same convention
// every other Study card follows (BoardTexture, the position matrices,
// HandClassBreakdown).
//
// Which spot the grid is reading, and the numbers for the hand under the
// cursor, are shown in the side panel next to it (RangeSidePanel) rather
// than here - so hover and pin are only reported up: hovering a cell
// previews it there, clicking pins it (clicking the pinned cell again
// unpins it), which is also what serves touch devices with no hover.
export function HandMatrix({ data, minSampleSize, pinnedToken, onHoverHand, onTogglePin }) {
  const hasAnyData = data && Object.keys(data).length > 0;

  return (
    <div className="matrix-table-card hand-matrix-card">
      <div className="matrix-table-header">
        <h3 className="section-title">Preflop Range Matrix</h3>
        <Legend />
      </div>

      {!hasAnyData ? (
        <div className="study-status-container">
          <h2>No hands recorded</h2>
          <p>Hero has no tracked hands for this seat/situation yet.</p>
        </div>
      ) : (
        // One leave handler for the whole grid rather than one per cell:
        // moving between two cells then goes straight from one hovered
        // token to the next, instead of flashing back to nothing in between.
        <div className="hand-matrix" onMouseLeave={() => onHoverHand(null)}>
          {RANKS.map(rowRank => (
            RANKS.map(colRank => {
              const token = handToken(rowRank, colRank);
              const cell = data?.[token];
              const hasData = !!cell && cell.total > 0;
              const belowThreshold = hasData && cell.total < minSampleSize;
              const cellClass = [
                'hm-cell',
                rowRank === colRank ? 'hm-cell--pair' : (RANKS.indexOf(rowRank) < RANKS.indexOf(colRank) ? 'hm-cell--suited' : 'hm-cell--offsuit'),
                !hasData ? 'hm-cell--empty' : '',
                belowThreshold ? 'hm-cell--below-threshold' : '',
                token === pinnedToken ? 'hm-cell--pinned' : ''
              ].filter(Boolean).join(' ');

              return (
                <div
                  key={token}
                  className={cellClass}
                  onMouseEnter={() => onHoverHand(token)}
                  onClick={() => onTogglePin(token)}
                >
                  <span className="hm-cell-token">{token}</span>
                  {!belowThreshold && <ActionBars cell={cell} />}
                </div>
              );
            })
          ))}
        </div>
      )}
    </div>
  );
}

export default HandMatrix;
