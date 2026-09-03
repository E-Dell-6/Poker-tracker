import { useMemo, useState } from 'react';
import { CATEGORY_LABEL, CONTEXT_ORDER, ProfitValue, RateValue, PositionBadges } from './handClassShared';
import './MatrixTableCard.css'; // .matrix-table-card/.matrix-table-header/.matrix-table-sub
import './HandClassLeaks.css';

// Reuses confidence.js's "low" cutoff - only surface a hand/action combo
// once there's enough sample to trust it, not a 2-hand fluke.
const LEAK_MIN_HANDS = 30;
const LEAK_LIMIT = 15;

function computeLeaks(byHandClass, contextFilter) {
  const leaks = [];
  // Combos that clear the sample floor regardless of sign - lets the empty
  // state distinguish "no data yet" from "nothing here is actually a leak".
  let qualifying = 0;
  for (const [token, handData] of Object.entries(byHandClass || {})) {
    for (const [ctxKey, ctxLabel] of CONTEXT_ORDER) {
      if (contextFilter !== 'all' && ctxKey !== contextFilter) continue;
      const ctxData = handData.contexts?.[ctxKey];
      if (!ctxData || ctxData.hands < LEAK_MIN_HANDS || ctxData.handsWithProfitData === 0) continue;
      qualifying++;
      if (ctxData.totalProfitLoss >= 0) continue;
      leaks.push({ token, category: handData.category, ctxKey, ctxLabel, ctxData });
    }
  }
  leaks.sort((a, b) => a.ctxData.totalProfitLoss - b.ctxData.totalProfitLoss);
  return { leaks: leaks.slice(0, LEAK_LIMIT), qualifying };
}

// Ranked, cross-hand view of the worst-performing hand/preflop-action spots
// - the direct answer to "which hands are costing me money from an open vs.
// a 3-bet vs. calling one of these, and from what positions", instead of
// requiring a click into every hand class one at a time.
export function HandClassLeaks({ byHandClass, onSelectHand }) {
  const [contextFilter, setContextFilter] = useState('all');
  const { leaks, qualifying } = useMemo(
    () => computeLeaks(byHandClass, contextFilter),
    [byHandClass, contextFilter]
  );

  return (
    <div className="matrix-table-card hand-class-leaks">
      <div className="matrix-table-header">
        <h3 className="section-title">Biggest leaks</h3>
        <select
          className="hcl-context-select"
          value={contextFilter}
          onChange={e => setContextFilter(e.target.value)}
          aria-label="Filter leaks by preflop action"
        >
          <option value="all">All actions</option>
          {CONTEXT_ORDER.map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {leaks.length === 0 ? (
        <p className="hcl-empty">
          {qualifying === 0
            ? 'Not enough hands yet in any single hand/action combo (need 30+) to surface reliable leaks.'
            : 'No losing spots found — every hand/action combo with enough hands is break-even or profitable.'}
        </p>
      ) : (
        <div className="hcl-list">
          {leaks.map((leak, i) => (
            <div
              key={`${leak.token}::${leak.ctxKey}`}
              className="hcl-row"
              onClick={() => onSelectHand(leak.token)}
            >
              <div className="hcl-row-head">
                <span className="hcl-rank">{i + 1}</span>
                <span className="hcl-token">{leak.token}</span>
                <span className="hcl-category">{CATEGORY_LABEL[leak.category]}</span>
                <span className="hcl-context-tag">{leak.ctxLabel}</span>
                <span className="hcl-hands">{leak.ctxData.hands}h</span>
                <RateValue bucket={leak.ctxData} />
                <ProfitValue bucket={leak.ctxData} />
              </div>
              <PositionBadges ctxData={leak.ctxData} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default HandClassLeaks;
