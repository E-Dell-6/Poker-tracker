import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer } from 'recharts';
import { Table, TableHead, TableBody, TableRow, TableCell } from '../../components/ui/Table';
import {
  CATEGORY_ORDER, CATEGORY_LABEL, CONTEXT_ORDER,
  sortHandEntries, ProfitValue, RateValue, PositionBadges, Toggle, toggleInSet
} from './handClassShared';
import { HandClassLeaks } from './HandClassLeaks';
import './HandClassBreakdown.css';

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

// Detail panel for one specific hand - shows its preflop-context breakdown,
// with every position shown as an inline badge (see handClassShared's
// PositionBadges) instead of a further click-to-expand level.
function HandDetailPanel({ token, handData, onClose }) {
  const contexts = CONTEXT_ORDER
    .map(([key, label]) => [key, label, handData.contexts?.[key]])
    .filter(([, , ctxData]) => ctxData && ctxData.hands > 0);

  return (
    <div className="hcb-detail-panel">
      <div className="hcb-detail-header">
        <div className="hcb-detail-title">
          <span className="hcb-detail-token">{token}</span>
          <span className="hcb-detail-category">{CATEGORY_LABEL[handData.category]}</span>
        </div>
        <div className="hcb-detail-summary">
          <span>{handData.hands} hands</span>
          <RateValue bucket={handData} />
          <ProfitValue bucket={handData} />
        </div>
        <button type="button" className="hcb-detail-close" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
      </div>

      {contexts.length === 0 ? (
        <p className="hcb-detail-empty">No preflop-action breakdown recorded for this hand.</p>
      ) : (
        <div className="hcb-detail-contexts">
          {contexts.map(([ctxKey, ctxLabel, ctxData]) => (
            <div key={ctxKey} className="hcb-detail-context">
              <div className="hcb-detail-context-row">
                <span className="hcb-detail-context-label">{ctxLabel}</span>
                <span className="hcb-detail-context-hands">{ctxData.hands}h</span>
                <RateValue bucket={ctxData} />
                <ProfitValue bucket={ctxData} />
              </div>
              <PositionBadges ctxData={ctxData} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Two-level table over stats.byHandClass/byHandClassCategory (see
// statsEngine.js's handClass-related helpers): category -> specific hand,
// each carrying its own bb/100 win rate and net $ figure. Clicking a hand
// (here or in the Biggest Leaks list above) opens a detail panel below the
// table with its preflop-context/position breakdown, instead of drilling
// further into the table itself.
export function HandClassBreakdown({ byHandClass, byHandClassCategory }) {
  const [expandedCategories, setExpandedCategories] = useState(new Set());
  const [selectedHand, setSelectedHand] = useState(null);
  const detailPanelRef = useRef(null);

  const categoriesWithData = CATEGORY_ORDER.filter(([key]) => (byHandClassCategory?.[key]?.hands ?? 0) > 0);

  const selectedHandData = selectedHand ? byHandClass?.[selectedHand] : null;

  // Brings the detail panel into view when it's (re)opened - matters most
  // when it was triggered from a Biggest Leaks row, which can be far above
  // the table the panel renders below.
  useEffect(() => {
    if (selectedHandData) detailPanelRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
  }, [selectedHand, selectedHandData]);

  if (categoriesWithData.length === 0) return null;

  function handleSelectHand(token) {
    const handData = byHandClass?.[token];
    if (handData) setExpandedCategories(prev => new Set(prev).add(handData.category));
    setSelectedHand(token);
  }

  const chartData = categoriesWithData.map(([key, label]) => ({
    key, label,
    bb100: byHandClassCategory[key].bb100 ?? 0,
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
        <TableCell align="right"><RateValue bucket={catData} /></TableCell>
        <TableCell align="right"><ProfitValue bucket={catData} /></TableCell>
      </TableRow>
    );

    if (!catExpanded) continue;

    const handEntries = sortHandEntries(
      catKey,
      Object.entries(byHandClass || {}).filter(([, v]) => v.category === catKey && v.hands > 0)
    );

    for (const [token, handData] of handEntries) {
      rows.push(
        <TableRow
          key={token}
          className={`hcb-row hcb-row--hand ${token === selectedHand ? 'hcb-row--hand--selected' : ''}`}
          onClick={() => setSelectedHand(token === selectedHand ? null : token)}
        >
          <TableCell><span className="hcb-indent-1">{token}</span></TableCell>
          <TableCell align="right"><span className="hcb-value-mono">{handData.hands}</span></TableCell>
          <TableCell align="right"><RateValue bucket={handData} /></TableCell>
          <TableCell align="right"><ProfitValue bucket={handData} /></TableCell>
        </TableRow>
      );
    }
  }

  return (
    <>
      <HandClassLeaks byHandClass={byHandClass} onSelectHand={handleSelectHand} />

      <div className="matrix-table-card hand-class-breakdown">
        <div className="matrix-table-header">
          <h3 className="section-title">Win rate by hand class</h3>
          <span className="matrix-table-sub">bb/100 · played hands only</span>
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
              formatter={v => [`${v >= 0 ? '+' : ''}${v.toFixed(1)} bb/100`, 'Win rate']}
            />
            <Bar dataKey="bb100" radius={[0, 4, 4, 0]} activeBar={ACTIVE_BAR}>
              {chartData.map(d => <Cell key={d.key} fill={d.bb100 >= 0 ? 'var(--color-positive)' : 'var(--color-negative)'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        <Table>
          <TableHead>
            <TableCell header>Hand class</TableCell>
            <TableCell header align="right">Hands</TableCell>
            <TableCell header align="right">bb/100</TableCell>
            <TableCell header align="right">Net $</TableCell>
          </TableHead>
          <TableBody>{rows}</TableBody>
        </Table>
        <p className="hcb-note">Click a category for individual hands, a hand for its preflop-action and position breakdown.</p>

        {selectedHandData && (
          <div ref={detailPanelRef}>
            <HandDetailPanel token={selectedHand} handData={selectedHandData} onClose={() => setSelectedHand(null)} />
          </div>
        )}
      </div>
    </>
  );
}

export default HandClassBreakdown;
