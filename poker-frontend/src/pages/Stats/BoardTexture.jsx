import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer } from 'recharts';
import { Table, TableHead, TableBody, TableRow, TableCell } from '../../components/ui/Table';
import {
  CONTEXT_ORDER, sortHandEntries, ProfitValue, RateValue, Toggle, toggleInSet
} from './handClassShared';
import { TEXTURE_TAG_ORDER, TEXTURE_TAG_LABEL, ACTION_MIX_ORDER, actionMixSummary, sizingSummary } from './boardTextureShared';
import './MatrixTableCard.css'; // .matrix-table-card/.matrix-table-header/.matrix-table-sub
import './BoardTexture.css';

const CONTEXT_LABEL = Object.fromEntries(CONTEXT_ORDER);

// Same chart-styling constants HandClassBreakdown.jsx uses, duplicated
// (not exported/shared) since they're small and specific to this one chart.
const AXIS_TICK = { fontSize: 11, fill: 'var(--color-text-muted)' };
const TOOLTIP_STYLE = {
  background: 'var(--color-bg-elevated)',
  border: '1px solid var(--color-border)',
  borderRadius: 8,
  fontSize: 12,
  color: 'var(--color-text)'
};
const TOOLTIP_TEXT_STYLE = { color: 'var(--color-text)' };
const ACTIVE_BAR = { stroke: 'var(--color-accent)', strokeWidth: 2, fillOpacity: 0.9 };

// Detail panel for one texture-tag + preflop-context combo - answers "what
// hands was I doing this with", the one dimension not already visible in
// the two inline table levels above it.
function TextureContextDetailPanel({ tagLabel, ctxLabel, ctxData, onClose }) {
  const handEntries = sortHandEntries(null, Object.entries(ctxData.handClasses || {}).filter(([, v]) => v.hands > 0));

  return (
    <div className="bt-detail-panel">
      <div className="bt-detail-header">
        <div className="bt-detail-title">
          <span className="bt-detail-tag">{tagLabel}</span>
          <span className="bt-detail-context">{ctxLabel}</span>
        </div>
        <div className="bt-detail-summary">
          <span>{ctxData.hands} hands</span>
          <RateValue bucket={ctxData} />
          <ProfitValue bucket={ctxData} />
        </div>
        <button type="button" className="bt-detail-close" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
      </div>

      <div className="bt-detail-mix">
        {ACTION_MIX_ORDER.map(([key, label]) => {
          const stat = ctxData.actionMix?.[key];
          if (!stat || stat.count === 0) return null;
          return (
            <span key={key} className="bt-detail-mix-item">
              {label} <strong>{stat.pct}%</strong>
              <span className="bt-detail-mix-count">({stat.count})</span>
            </span>
          );
        })}
        {sizingSummary(ctxData.sizing) && (
          <span className="bt-detail-mix-item bt-detail-sizing">
            Avg size <strong>{sizingSummary(ctxData.sizing)}</strong>
            <span className="bt-detail-mix-count">({ctxData.sizing.sampleSize} bets)</span>
          </span>
        )}
      </div>

      {handEntries.length === 0 ? (
        <p className="bt-detail-empty">No hand-class data recorded for this texture/context.</p>
      ) : (
        <Table className="bt-detail-table">
          <TableHead>
            <TableCell header>Hand</TableCell>
            <TableCell header align="right">Hands</TableCell>
            <TableCell header align="right">bb/100</TableCell>
            <TableCell header align="right">Net $</TableCell>
          </TableHead>
          <TableBody>
            {handEntries.map(([token, data]) => (
              <TableRow key={token}>
                <TableCell><span className="hcb-value-mono">{token}</span></TableCell>
                <TableCell align="right"><span className="hcb-value-mono">{data.hands}</span></TableCell>
                <TableCell align="right"><RateValue bucket={data} /></TableCell>
                <TableCell align="right"><ProfitValue bucket={data} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

// Two-level table over stats.byBoardTexture (see statsEngine.js's
// finalizeBoardTextureMap): texture tag -> preflop context, each carrying
// its own bb/100, net $, action mix (how hero bet/checked/raised) and avg
// bet sizing. Clicking a context row opens a detail panel below the table
// with that tag+context's hand-class breakdown ("what hands"), mirroring
// HandClassBreakdown's click-to-open-panel pattern rather than a third
// inline expand level, which would make the table too deep/cramped.
export function BoardTexture({ byBoardTexture }) {
  const [expandedTags, setExpandedTags] = useState(new Set());
  const [selected, setSelected] = useState(null); // { tagKey, ctxKey }
  const detailPanelRef = useRef(null);

  const tagsWithData = TEXTURE_TAG_ORDER.filter(([key]) => (byBoardTexture?.[key]?.hands ?? 0) > 0);

  const selectedTagData = selected ? byBoardTexture?.[selected.tagKey] : null;
  const selectedCtxData = selectedTagData ? selectedTagData.contexts?.[selected.ctxKey] : null;

  useEffect(() => {
    if (selectedCtxData) detailPanelRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
  }, [selected, selectedCtxData]);

  if (tagsWithData.length === 0) return null;

  function handleSelectContext(tagKey, ctxKey) {
    const isSelected = selected?.tagKey === tagKey && selected?.ctxKey === ctxKey;
    setSelected(isSelected ? null : { tagKey, ctxKey });
  }

  const chartData = tagsWithData.map(([key, label]) => ({
    key, label,
    bb100: byBoardTexture[key].bb100 ?? 0,
    currency: byBoardTexture[key].currency
  }));

  const rows = [];
  for (const [tagKey, tagLabel] of tagsWithData) {
    const tagData = byBoardTexture[tagKey];
    const tagExpanded = expandedTags.has(tagKey);
    rows.push(
      <TableRow
        key={tagKey}
        className="bt-row bt-row--tag"
        onClick={() => setExpandedTags(toggleInSet(expandedTags, tagKey))}
      >
        <TableCell><Toggle expanded={tagExpanded} /><strong>{tagLabel}</strong></TableCell>
        <TableCell align="right"><span className="hcb-value-mono">{tagData.hands}</span></TableCell>
        <TableCell align="right"><RateValue bucket={tagData} /></TableCell>
        <TableCell align="right"><ProfitValue bucket={tagData} /></TableCell>
        <TableCell className="bt-mix-cell">{actionMixSummary(tagData.actionMix) ?? <span className="hcb-value-empty">—</span>}</TableCell>
        <TableCell align="right">{sizingSummary(tagData.sizing) ?? <span className="hcb-value-empty">—</span>}</TableCell>
      </TableRow>
    );

    if (!tagExpanded) continue;

    const contexts = CONTEXT_ORDER
      .map(([key, label]) => [key, label, tagData.contexts?.[key]])
      .filter(([, , ctxData]) => ctxData && ctxData.hands > 0);

    for (const [ctxKey, ctxLabel, ctxData] of contexts) {
      const isSelected = selected?.tagKey === tagKey && selected?.ctxKey === ctxKey;
      rows.push(
        <TableRow
          key={`${tagKey}__${ctxKey}`}
          className={`bt-row bt-row--context ${isSelected ? 'bt-row--context--selected' : ''}`}
          onClick={() => handleSelectContext(tagKey, ctxKey)}
        >
          <TableCell><span className="bt-indent-1">{ctxLabel}</span></TableCell>
          <TableCell align="right"><span className="hcb-value-mono">{ctxData.hands}</span></TableCell>
          <TableCell align="right"><RateValue bucket={ctxData} /></TableCell>
          <TableCell align="right"><ProfitValue bucket={ctxData} /></TableCell>
          <TableCell className="bt-mix-cell">{actionMixSummary(ctxData.actionMix) ?? <span className="hcb-value-empty">—</span>}</TableCell>
          <TableCell align="right">{sizingSummary(ctxData.sizing) ?? <span className="hcb-value-empty">—</span>}</TableCell>
        </TableRow>
      );
    }
  }

  return (
    <div className="matrix-table-card board-texture">
      <div className="matrix-table-header">
        <h3 className="section-title">Board Texture</h3>
        <span className="matrix-table-sub">bb/100 · flop hands only</span>
      </div>

      <ResponsiveContainer width="100%" height={Math.max(120, tagsWithData.length * 34)}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 24 }}>
          <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} width={90} />
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
          <TableCell header>Texture</TableCell>
          <TableCell header align="right">Hands</TableCell>
          <TableCell header align="right">bb/100</TableCell>
          <TableCell header align="right">Net $</TableCell>
          <TableCell header>Action Mix</TableCell>
          <TableCell header align="right">Avg Size</TableCell>
        </TableHead>
        <TableBody>{rows}</TableBody>
      </Table>
      <p className="hcb-note">Click a texture for its preflop-action breakdown, an action row for hand-by-hand detail.</p>

      {selectedCtxData && (
        <div ref={detailPanelRef}>
          <TextureContextDetailPanel
            tagLabel={TEXTURE_TAG_LABEL[selected.tagKey]}
            ctxLabel={CONTEXT_LABEL[selected.ctxKey]}
            ctxData={selectedCtxData}
            onClose={() => setSelected(null)}
          />
        </div>
      )}
    </div>
  );
}

export default BoardTexture;
