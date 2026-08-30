import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer } from 'recharts';
import { Table, TableHead, TableBody, TableRow, TableCell } from '../../components/ui/Table';
import { formatSignedMajorUnits } from '../../utils/formatMoney';
import './HandClassBreakdown.css';

const CATEGORY_ORDER = [
  ['pocketPairs', 'Pocket pairs'],
  ['axSuited', 'Ax suited'],
  ['suitedBroadway', 'Suited broadway'],
  ['suitedConnectors', 'Suited connectors'],
  ['offsuitBroadway', 'Offsuit broadway'],
  ['offsuitGappers', 'Offsuit gappers'],
  ['other', 'Other']
];

const CONTEXT_ORDER = [
  ['open', 'Open'],
  ['threeBet', '3-Bet'],
  ['fourBet', '4-Bet'],
  ['coldCall', 'Cold Call'],
  ['limp', 'Limp'],
  ['checkedOption', 'Checked Option'],
  ['foldTo3Bet', 'Fold to 3-Bet'],
  ['foldTo4Bet', 'Fold to 4-Bet'],
  ['foldPreflop', 'Fold Preflop']
];

const POSITION_ORDER = ['BTN', 'BTN/SB', 'SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO'];
function sortPositions(positions) {
  return [...positions].sort((a, b) => {
    const ia = POSITION_ORDER.indexOf(a);
    const ib = POSITION_ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
}

const AXIS_TICK = { fontSize: 11, fill: 'var(--color-text-muted)' };
const TOOLTIP_STYLE = {
  background: 'var(--color-bg-elevated)',
  border: '1px solid var(--color-border)',
  borderRadius: 8,
  fontSize: 12,
  color: 'var(--color-text)'
};
// recharts' Tooltip only applies `contentStyle`'s color to the outer
// wrapper div - the label/item text nodes inside get their own default
// (near-black) color unless these are set explicitly too.
const TOOLTIP_TEXT_STYLE = { color: 'var(--color-text)' };
// Highlights the hovered bar itself (via recharts' `activeBar`) instead of
// the default `cursor` rectangle, which spans the full category band -
// wider/taller than the bar and visually disconnected from its shape.
const ACTIVE_BAR = { stroke: 'var(--color-accent)', strokeWidth: 2, fillOpacity: 0.9 };

function ProfitValue({ bucket }) {
  if (!bucket || bucket.hands === 0) return <span className="hcb-value-empty">—</span>;
  // Unlike bb100 (null when a bucket mixes currencies or has no bb-size
  // data), totalProfitLoss is always a real number - it's already
  // normalized to major units per-hand before summing (see
  // statsEngine.js's bumpProfit). The only genuine "nothing to show" case
  // left is a bucket with hands but literally no profit data recorded.
  if (bucket.handsWithProfitData === 0) return <span className="hcb-value-empty">n/a</span>;
  return (
    <span className={`hcb-value-mono ${bucket.totalProfitLoss >= 0 ? 'hcb-value-pos' : 'hcb-value-neg'}`}>
      {formatSignedMajorUnits(bucket.totalProfitLoss, bucket.currency)}
    </span>
  );
}

function Toggle({ expanded }) {
  return <ChevronRight size={14} className={`hcb-toggle ${expanded ? 'hcb-toggle--expanded' : ''}`} />;
}

function toggleInSet(set, key) {
  const next = new Set(set);
  if (next.has(key)) next.delete(key); else next.add(key);
  return next;
}

// Three-level drill-down over stats.byHandClass/byHandClassCategory (see
// statsEngine.js's handClass-related helpers): category -> specific hand
// -> preflop context -> position, each carrying its own net $ won/lost figure.
// Rows are built as one flat list (not real nested <table>s, which can't
// live inside a <tbody> row) with expand state kept as three Sets of keys.
export function HandClassBreakdown({ byHandClass, byHandClassCategory }) {
  const [expandedCategories, setExpandedCategories] = useState(new Set());
  const [expandedHands, setExpandedHands] = useState(new Set());
  const [expandedContexts, setExpandedContexts] = useState(new Set());

  const categoriesWithData = CATEGORY_ORDER.filter(([key]) => (byHandClassCategory?.[key]?.hands ?? 0) > 0);
  if (categoriesWithData.length === 0) return null;

  const chartData = categoriesWithData.map(([key, label]) => ({
    key, label,
    totalProfitLoss: byHandClassCategory[key].totalProfitLoss ?? 0,
    currency: byHandClassCategory[key].currency
  }));

  const rows = [];
  for (const [catKey, catLabel] of categoriesWithData) {
    const catData = byHandClassCategory[catKey];
    const catExpanded = expandedCategories.has(catKey);
    rows.push(
      <TableRow
        key={catKey}
        className="hcb-row hcb-row--category"
        onClick={() => setExpandedCategories(toggleInSet(expandedCategories, catKey))}
      >
        <TableCell><Toggle expanded={catExpanded} /><strong>{catLabel}</strong></TableCell>
        <TableCell align="right"><span className="hcb-value-mono">{catData.hands}</span></TableCell>
        <TableCell align="right"><ProfitValue bucket={catData} /></TableCell>
      </TableRow>
    );

    if (!catExpanded) continue;

    const handEntries = Object.entries(byHandClass || {})
      .filter(([, v]) => v.category === catKey && v.hands > 0)
      .sort((a, b) => b[1].hands - a[1].hands);

    for (const [token, handData] of handEntries) {
      const handExpanded = expandedHands.has(token);
      rows.push(
        <TableRow
          key={token}
          className="hcb-row hcb-row--hand"
          onClick={() => setExpandedHands(toggleInSet(expandedHands, token))}
        >
          <TableCell><span className="hcb-indent-1"><Toggle expanded={handExpanded} />{token}</span></TableCell>
          <TableCell align="right"><span className="hcb-value-mono">{handData.hands}</span></TableCell>
          <TableCell align="right"><ProfitValue bucket={handData} /></TableCell>
        </TableRow>
      );

      if (!handExpanded) continue;

      for (const [ctxKey, ctxLabel] of CONTEXT_ORDER) {
        const ctxData = handData.contexts?.[ctxKey];
        if (!ctxData || ctxData.hands === 0) continue;
        const ctxRowKey = `${token}::${ctxKey}`;
        const ctxExpanded = expandedContexts.has(ctxRowKey);
        const positions = sortPositions(Object.keys(ctxData.byPosition || {}));
        rows.push(
          <TableRow
            key={ctxRowKey}
            className="hcb-row hcb-row--context"
            onClick={() => positions.length > 0 && setExpandedContexts(toggleInSet(expandedContexts, ctxRowKey))}
          >
            <TableCell>
              <span className="hcb-indent-2">
                {positions.length > 0 ? <Toggle expanded={ctxExpanded} /> : <span className="hcb-toggle-spacer" />}
                {ctxLabel}
              </span>
            </TableCell>
            <TableCell align="right"><span className="hcb-value-mono">{ctxData.hands}</span></TableCell>
            <TableCell align="right"><ProfitValue bucket={ctxData} /></TableCell>
          </TableRow>
        );

        if (!ctxExpanded) continue;

        for (const pos of positions) {
          const posData = ctxData.byPosition[pos];
          rows.push(
            <TableRow key={`${ctxRowKey}::${pos}`} className="hcb-row hcb-row--position">
              <TableCell><span className="hcb-indent-3">{pos}</span></TableCell>
              <TableCell align="right"><span className="hcb-value-mono">{posData.hands}</span></TableCell>
              <TableCell align="right"><ProfitValue bucket={posData} /></TableCell>
            </TableRow>
          );
        }
      }
    }
  }

  return (
    <div className="matrix-table-card hand-class-breakdown">
      <div className="matrix-table-header">
        <h3 className="section-title">Win rate by hand class</h3>
        <span className="matrix-table-sub">Net $ won/lost · played hands only</span>
      </div>

      <ResponsiveContainer width="100%" height={Math.max(140, categoriesWithData.length * 36)}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 24 }}>
          <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} width={110} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            itemStyle={TOOLTIP_TEXT_STYLE}
            labelStyle={TOOLTIP_TEXT_STYLE}
            cursor={false}
            formatter={(v, name, props) => [formatSignedMajorUnits(v, props?.payload?.currency), 'Net won/lost']}
          />
          <Bar dataKey="totalProfitLoss" radius={[0, 4, 4, 0]} activeBar={ACTIVE_BAR}>
            {chartData.map(d => <Cell key={d.key} fill={d.totalProfitLoss >= 0 ? 'var(--color-positive)' : 'var(--color-negative)'} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <Table>
        <TableHead>
          <TableCell header>Hand class</TableCell>
          <TableCell header align="right">Hands</TableCell>
          <TableCell header align="right">Net $</TableCell>
        </TableHead>
        <TableBody>{rows}</TableBody>
      </Table>
      <p className="hcb-note">
        Click a category for individual hands, a hand for its preflop actions, an action for its position split.
      </p>
    </div>
  );
}

export default HandClassBreakdown;
