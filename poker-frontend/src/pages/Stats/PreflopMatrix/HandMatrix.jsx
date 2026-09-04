import { useState } from 'react';
import { RANKS, handToken } from '../../../utils/handGrid';
import '../MatrixTableCard.css'; // .matrix-table-card/.matrix-table-header/.section-title
import './HandMatrix.css';

const ACTIONS = [
  { key: 'fold', label: 'Fold', pctKey: 'foldPct', color: 'var(--color-action-fold)' },
  { key: 'call', label: 'Call', pctKey: 'callPct', color: 'var(--color-action-call)' },
  { key: 'raise', label: 'Raise', pctKey: 'raisePct', color: 'var(--color-action-raise)' }
];

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

function Tooltip({ active }) {
  if (!active) return null;
  const { token, cell, x, y } = active;
  return (
    <div className="hm-tooltip" style={{ left: x, top: y }}>
      <div className="hm-tooltip-token">{token}</div>
      {!cell || cell.total === 0 ? (
        <div className="hm-tooltip-empty">No hands recorded</div>
      ) : (
        <>
          <div className="hm-tooltip-row">
            {ACTIONS.map(a => (
              <span key={a.key} className="hm-tooltip-stat">
                <span className="hm-tooltip-dot" style={{ background: a.color }} />
                {a.label} {cell[a.pctKey]}%
              </span>
            ))}
          </div>
          <div className="hm-tooltip-n">n = {cell.total}</div>
        </>
      )}
    </div>
  );
}

// 13x13 range-matrix grid: rows/cols both ordered A-K-Q-J-T-9...2 (RANKS).
// Diagonal = pocket pairs, upper-right triangle = suited, lower-left =
// offsuit - see handGrid.js's handToken. `data` is the already-resolved
// flat { [token]: cell } slice for whatever hero-position/scenario/facing-
// position combination the page has selected - this component itself is
// scenario-agnostic, and takes `subtitle` as a pre-formatted string rather
// than a node to keep it that way. `cell` shape: {fold,call,raise,total,
// foldPct,callPct,raisePct,confidence} (see statsEngine.js's finalizeMatrixCell) or
// undefined for a hand hero has never held in this slice. Owns its own
// `.matrix-table-card` chrome (title/legend/empty state) - same convention
// every other Study card follows (BoardTexture, the position matrices,
// HandClassBreakdown) - rather than a bare grid with no title the way this
// used to render.
export function HandMatrix({ data, minSampleSize, subtitle }) {
  const [active, setActive] = useState(null);
  const hasAnyData = data && Object.keys(data).length > 0;

  const openTooltip = (e, token, cell) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setActive({ token, cell, x: rect.left + rect.width / 2, y: rect.top });
  };
  const closeTooltip = () => setActive(null);
  // Hover opens it on desktop (onMouseEnter above); click toggles it, which
  // is what serves touch devices (no hover events there) - clicking an
  // already-hover-opened cell on desktop just closes it again, which is a
  // reasonable side effect rather than a bug.
  const toggleTooltip = (e, token, cell) => {
    if (active?.token === token) closeTooltip();
    else openTooltip(e, token, cell);
  };

  return (
    <div className="matrix-table-card hand-matrix-card">
      <div className="matrix-table-header">
        <div className="hm-title-group">
          <h3 className="section-title">Preflop Range Matrix</h3>
          {/* Which sequence card the grid is reading (see
              PreflopMatrixPage.jsx's nodeLabel) - the selected card is
              highlighted in the bar above, but that card can be scrolled
              out of view on a long line. */}
          {subtitle && <span className="matrix-table-sub">{subtitle}</span>}
        </div>
        <Legend />
      </div>

      {!hasAnyData ? (
        <div className="study-status-container">
          <h2>No hands recorded</h2>
          <p>Hero has no tracked hands for this seat/situation yet.</p>
        </div>
      ) : (
        <div className="hand-matrix-wrap">
          <div className="hand-matrix">
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
                  belowThreshold ? 'hm-cell--below-threshold' : ''
                ].filter(Boolean).join(' ');

                return (
                  <div
                    key={token}
                    className={cellClass}
                    onMouseEnter={e => openTooltip(e, token, cell)}
                    onMouseLeave={closeTooltip}
                    onClick={e => toggleTooltip(e, token, cell)}
                  >
                    <span className="hm-cell-token">{token}</span>
                    {!belowThreshold && <ActionBars cell={cell} />}
                  </div>
                );
              })
            ))}
          </div>
          <Tooltip active={active} />
        </div>
      )}
    </div>
  );
}

export default HandMatrix;
