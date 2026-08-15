import { useEffect, useState } from 'react';
import './PositionalStats.css';

const POSITION_ORDER = ['BTN', 'BTN/SB', 'SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO'];

function sortPositions(positions) {
  return [...positions].sort((a, b) => {
    const ia = POSITION_ORDER.indexOf(a);
    const ib = POSITION_ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
}

const POSITION_COLUMNS = [
  ['vpip', 'VPIP'],
  ['pfr', 'PFR'],
  ['open', 'Open'],
  ['steal', 'Steal'],
  ['threeBet', '3-Bet'],
  ['foldTo3Bet', 'Fold to 3B'],
  ['fourBet', '4-Bet'],
  ['foldTo4Bet', 'Fold to 4B'],
  ['cbFlop', 'C-Bet Flop'],
  ['foldToCbFlop', 'Fold to CB'],
  ['wtsd', 'WTSD'],
  ['wwsf', 'WWSF']
];

function RateCell({ rate }) {
  if (!rate || rate.opportunities === 0) {
    return <td className="pos-cell pos-cell--empty">—</td>;
  }
  return (
    <td className="pos-cell">
      <div className="pos-cell-pct">{rate.pct}%</div>
      <div className="pos-cell-sample">{rate.made}/{rate.opportunities}</div>
    </td>
  );
}

function MatrixCell({ stat, mode }) {
  if (!stat || stat.faced === 0) {
    return <td className="pos-cell pos-cell--empty">—</td>;
  }
  const value = mode === 'defend' ? stat.defendPct : mode === 'raise' ? stat.raisePct : stat.foldPct;
  return (
    <td className="pos-cell">
      <div className="pos-cell-pct">{value}%</div>
      <div className="pos-cell-sample">n={stat.faced}</div>
    </td>
  );
}

function Matrix({ title, description, matrix, positions, modes, activeMode, onModeChange, rowLabel }) {
  const attackers = sortPositions(Object.keys(matrix || {}));
  if (attackers.length === 0) return null;

  return (
    <div className="pos-matrix">
      <div className="pos-matrix-header">
        <h4>{title}</h4>
        <div className="pos-mode-toggle">
          {modes.map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`pos-mode-btn ${activeMode === key ? 'active' : ''}`}
              onClick={() => onModeChange(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <p className="pos-matrix-desc">{description}</p>
      <div className="pos-table-wrap">
        <table className="pos-table">
          <thead>
            <tr>
              <th>{rowLabel}</th>
              {positions.map(p => <th key={p}>{p}</th>)}
            </tr>
          </thead>
          <tbody>
            {attackers.map(attacker => (
              <tr key={attacker}>
                <th>{attacker}</th>
                {positions.map(responder => (
                  <MatrixCell key={responder} stat={matrix[attacker]?.[responder]} mode={activeMode} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// `positional` is the object produced by statsEngine.js's finalizePositional:
// { "<tableSize>": { positions: {...}, vsOpen: {...}, vs3Bet: {...} } }
export function PositionalStats({ positional }) {
  const sizes = Object.keys(positional || {})
    .map(Number)
    .filter(n => !Number.isNaN(n))
    .sort((a, b) => b - a);

  const [activeSize, setActiveSize] = useState(null);
  const [vsOpenMode, setVsOpenMode] = useState('defend');
  const [vs3BetMode, setVs3BetMode] = useState('defend');

  // Keep the selected tab valid as `positional` loads/changes (e.g. after
  // a recompute adds/removes a table-size bucket).
  useEffect(() => {
    setActiveSize(prev => (prev !== null && sizes.includes(prev) ? prev : (sizes[0] ?? null)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(sizes)]);

  if (!positional || sizes.length === 0 || activeSize === null) {
    return (
      <div className="positional-stats-section">
        <h3 className="section-title">Positional Breakdown</h3>
        <div className="stats-placeholder">
          Not enough hands with identifiable seating yet to break stats down by position.
        </div>
      </div>
    );
  }

  const bucket = positional[activeSize] || { positions: {}, vsOpen: {}, vs3Bet: {} };
  const positions = sortPositions(Object.keys(bucket.positions || {}));

  return (
    <div className="positional-stats-section">
      <div className="stats-header">
        <h3 className="section-title">Positional Breakdown</h3>
        <div className="pos-size-tabs">
          {sizes.map(size => (
            <button
              key={size}
              type="button"
              className={`pos-size-tab ${activeSize === size ? 'active' : ''}`}
              onClick={() => setActiveSize(size)}
            >
              {size}-handed
            </button>
          ))}
        </div>
      </div>

      <div className="pos-table-wrap">
        <table className="pos-table">
          <thead>
            <tr>
              <th>Position</th>
              {POSITION_COLUMNS.map(([key, label]) => <th key={key}>{label}</th>)}
            </tr>
          </thead>
          <tbody>
            {positions.map(pos => (
              <tr key={pos}>
                <th>{pos}</th>
                {POSITION_COLUMNS.map(([key]) => (
                  <RateCell key={key} rate={bucket.positions[pos]?.[key]} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Matrix
        title="Facing an Open"
        description="Row = the position that opened. Column = your position responding to it. Defend = called or raised; 3-Bet = raised; Fold = folded."
        matrix={bucket.vsOpen}
        positions={positions}
        rowLabel="Opener →"
        modes={[['defend', 'Defend %'], ['raise', '3-Bet %'], ['fold', 'Fold %']]}
        activeMode={vsOpenMode}
        onModeChange={setVsOpenMode}
      />

      <Matrix
        title="Facing a 3-Bet"
        description="Row = the position that 3-bet you. Column = your position (the original opener) responding. Defend = called or 4-bet; 4-Bet = raised; Fold = folded."
        matrix={bucket.vs3Bet}
        positions={positions}
        rowLabel="3-Bettor →"
        modes={[['defend', 'Defend %'], ['raise', '4-Bet %'], ['fold', 'Fold %']]}
        activeMode={vs3BetMode}
        onModeChange={setVs3BetMode}
      />
    </div>
  );
}

export default PositionalStats;