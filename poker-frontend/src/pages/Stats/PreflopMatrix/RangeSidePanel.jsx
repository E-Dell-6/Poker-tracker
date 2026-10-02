import { X } from 'lucide-react';
import { ACTIONS, formatHandCount } from './rangeDisplay';
import '../MatrixTableCard.css'; // .matrix-table-card
import './RangeSidePanel.css';

// Stacked fold/call/raise bar plus one row per action. `stats` is either an
// API cell or a whole-node summarizeBucket() - both carry fold/call/raise
// counts and the *Pct keys (see rangeDisplay.js's ACTIONS).
function ActionBreakdown({ stats }) {
  return (
    <div className="pfm-breakdown">
      <div className="pfm-breakdown-bar">
        {ACTIONS.map(a => (
          stats[a.pctKey] > 0
            ? <div key={a.key} style={{ flexGrow: stats[a.pctKey], background: a.color }} />
            : null
        ))}
      </div>
      {ACTIONS.map(a => (
        <div key={a.key} className="pfm-breakdown-row">
          <span className="pfm-breakdown-dot" style={{ background: a.color }} />
          <span className="pfm-breakdown-label">{a.label}</span>
          <span className="pfm-breakdown-pct">{stats[a.pctKey].toFixed(1)}%</span>
          <span className="pfm-breakdown-count">{stats[a.key].toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

// The hand under the cursor, or the pinned one once the cursor leaves the
// grid (see HandMatrix.jsx) - what the floating tooltip used to show, given
// a fixed home next to the grid instead.
function HandDetail({ token, cell, isPinned, minSampleSize, onUnpin }) {
  if (!token) {
    return <p className="pfm-panel-hint">Hover a hand to see its numbers - click to pin it.</p>;
  }

  const hasData = !!cell && cell.total > 0;
  return (
    <>
      <div className="pfm-hand-header">
        <span className="pfm-hand-token">{token}</span>
        {isPinned && (
          <button type="button" className="pfm-unpin-btn" onClick={onUnpin}>
            <X size={12} /> Unpin
          </button>
        )}
      </div>
      {hasData ? (
        <>
          <ActionBreakdown stats={cell} />
          <p className="pfm-panel-meta">
            n = {cell.total}
            {cell.confidence && ` · ${cell.confidence} confidence`}
          </p>
          {cell.total < minSampleSize && (
            <p className="pfm-panel-meta">Below your {minSampleSize}-hand min sample - its bars are hidden in the grid.</p>
          )}
        </>
      ) : (
        <p className="pfm-panel-hint">No hands recorded</p>
      )}
    </>
  );
}

// The right-hand column beside the grid: which spot the grid is reading
// and hero's overall split there, the hovered/pinned hand's numbers, and
// the grid's display settings. `spotLabel` is the only place the selected
// spot is named on the page (e.g. "BTN · vs Open (UTG)") - the matching
// line card is highlighted too, but can be scrolled out of view on a long
// line. Stacks under the grid on a narrow page (see PreflopMatrixPage.css).
export function RangeSidePanel({
  spotLabel, summary,
  handToken, handCell, isPinned, onUnpin,
  minSampleSize, setMinSampleSize
}) {
  return (
    <aside className="matrix-table-card pfm-panel">
      <section className="pfm-panel-section">
        <span className="pfm-panel-eyebrow">Selected spot</span>
        <h3 className="pfm-panel-spot">{spotLabel ?? '—'}</h3>
        {summary && summary.total > 0 ? (
          <>
            <ActionBreakdown stats={summary} />
            <p className="pfm-panel-meta">{formatHandCount(summary.total)}</p>
          </>
        ) : (
          <p className="pfm-panel-hint">No hands recorded for this spot</p>
        )}
      </section>

      <section className="pfm-panel-section pfm-panel-section--hand">
        <span className="pfm-panel-eyebrow">Hand</span>
        <HandDetail token={handToken} cell={handCell} isPinned={isPinned} minSampleSize={minSampleSize} onUnpin={onUnpin} />
      </section>

      <section className="pfm-panel-section">
        <span className="pfm-panel-eyebrow">Display</span>
        <label className="pfm-panel-label" htmlFor="pfm-sample-size">
          Min sample size: <strong>{minSampleSize}</strong> hands
        </label>
        <input
          id="pfm-sample-size"
          type="range"
          min="0"
          max="50"
          step="1"
          value={minSampleSize}
          onChange={e => setMinSampleSize(Number(e.target.value))}
          className="pfm-sample-slider"
        />
      </section>
    </aside>
  );
}

export default RangeSidePanel;
