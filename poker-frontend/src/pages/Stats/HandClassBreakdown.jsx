import { useRef, useState } from 'react';
import { MousePointerClick, X } from 'lucide-react';
import { Table, TableHead, TableBody, TableRow, TableCell } from '../../components/ui/Table';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import {
  CATEGORY_ORDER, CATEGORY_LABEL, CONTEXT_ORDER,
  sortHandEntries, ProfitValue, RateValue, PositionBadges, Toggle, toggleInSet
} from './handClassShared';
import { HandClassLeaks } from './HandClassLeaks';
import './HandClassBreakdown.css';

// Same breakpoint as the app shell's drawer: at or under it the detail
// panel opens in a dialog instead of beside the table.
const NARROW = '(width <= 900px)';

// A small diverging bar next to each bb/100 figure: it grows right from the
// centre line when positive, left when negative, scaled to the largest
// |bb/100| on screen. Purely visual - the number beside it carries the
// value, so it's hidden from screen readers.
function WinRateBar({ bb100, max }) {
  const width = bb100 == null || !max ? 0 : Math.min(1, Math.abs(bb100) / max) * 50;
  return (
    <span className="hcb-bar" aria-hidden="true">
      {width > 0 && (
        <span
          className={`hcb-bar-fill ${bb100 >= 0 ? 'hcb-bar-fill--pos' : 'hcb-bar-fill--neg'}`}
          style={{ width: `${width}%` }}
        />
      )}
    </span>
  );
}

function RateCell({ bucket, max }) {
  return (
    <span className="hcb-rate-cell">
      <RateValue bucket={bucket} />
      <WinRateBar bb100={bucket?.hands ? bucket.bb100 : null} max={max} />
    </span>
  );
}

// One hand's breakdown by preflop action, each with its positions as
// inline badges (see handClassShared's PositionBadges). Shown beside the
// table on wide screens and inside a Modal on narrow ones - there the
// Modal's own title and close button replace this header.
function HandDetailPanel({ token, handData, onClose, inModal = false }) {
  const contexts = CONTEXT_ORDER
    .map(([key, label]) => [key, label, handData.contexts?.[key]])
    .filter(([, , ctxData]) => ctxData && ctxData.hands > 0);

  return (
    <div className="hcb-detail-panel">
      {!inModal && (
        <div className="hcb-detail-header">
          <div>
            <div className="hcb-detail-token">{token}</div>
            <div className="hcb-detail-category">{CATEGORY_LABEL[handData.category]}</div>
          </div>
          <Button variant="ghost" size="sm" icon={X} aria-label="Close" onClick={onClose} />
        </div>
      )}

      <dl className="hcb-detail-summary">
        <div>
          <dt>Hands</dt>
          <dd className="hcb-value-mono">{handData.hands}</dd>
        </div>
        <div>
          <dt>bb/100</dt>
          <dd><RateValue bucket={handData} /></dd>
        </div>
        <div>
          <dt>Net</dt>
          <dd><ProfitValue bucket={handData} /></dd>
        </div>
      </dl>

      <h3 className="hcb-detail-section">By preflop action</h3>
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
// each with its bb/100 win rate (plus a bar) and net $. Clicking a hand -
// here or in Biggest Leaks above - shows its breakdown in the side panel.
export function HandClassBreakdown({ byHandClass, byHandClassCategory }) {
  const [expandedCategories, setExpandedCategories] = useState(new Set());
  const [selectedHand, setSelectedHand] = useState(null);
  const workspaceRef = useRef(null);
  const narrow = useMediaQuery(NARROW);

  const categoriesWithData = CATEGORY_ORDER.filter(([key]) => (byHandClassCategory?.[key]?.hands ?? 0) > 0);
  if (categoriesWithData.length === 0) return null;

  const selectedHandData = selectedHand ? byHandClass?.[selectedHand] : null;

  // From Biggest Leaks: open the hand's category and, on wide screens,
  // bring the table + panel into view (they can be far below the leak).
  function handleSelectHand(token) {
    const handData = byHandClass?.[token];
    if (handData) setExpandedCategories(prev => new Set(prev).add(handData.category));
    setSelectedHand(token);
    if (!narrow) workspaceRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }

  // Rows on screen, so bars are scaled against what's actually visible.
  const visible = [];
  for (const [catKey, catLabel] of categoriesWithData) {
    visible.push({ kind: 'category', key: catKey, label: catLabel, data: byHandClassCategory[catKey] });
    if (!expandedCategories.has(catKey)) continue;
    const handEntries = sortHandEntries(
      catKey,
      Object.entries(byHandClass || {}).filter(([, v]) => v.category === catKey && v.hands > 0)
    );
    for (const [token, handData] of handEntries) {
      visible.push({ kind: 'hand', key: token, label: token, data: handData });
    }
  }
  const maxRate = Math.max(0, ...visible.map(row => Math.abs(row.data.bb100 ?? 0)));

  const rows = visible.map(row => (row.kind === 'category' ? (
    <TableRow
      key={row.key}
      className="hcb-row hcb-row--category"
      onClick={() => setExpandedCategories(toggleInSet(expandedCategories, row.key))}
    >
      <TableCell><Toggle expanded={expandedCategories.has(row.key)} />{row.label}</TableCell>
      <TableCell align="right"><span className="hcb-value-mono">{row.data.hands}</span></TableCell>
      <TableCell align="right"><RateCell bucket={row.data} max={maxRate} /></TableCell>
      <TableCell align="right"><ProfitValue bucket={row.data} /></TableCell>
    </TableRow>
  ) : (
    <TableRow
      key={row.key}
      className={`hcb-row hcb-row--hand ${row.key === selectedHand ? 'hcb-row--hand--selected' : ''}`}
      onClick={() => setSelectedHand(row.key === selectedHand ? null : row.key)}
    >
      <TableCell><span className="hcb-hand-token">{row.label}</span></TableCell>
      <TableCell align="right"><span className="hcb-value-mono">{row.data.hands}</span></TableCell>
      <TableCell align="right"><RateCell bucket={row.data} max={maxRate} /></TableCell>
      <TableCell align="right"><ProfitValue bucket={row.data} /></TableCell>
    </TableRow>
  )));

  const closePanel = () => setSelectedHand(null);

  return (
    <>
      <HandClassLeaks byHandClass={byHandClass} onSelectHand={handleSelectHand} />

      <div className="hcb-workspace" ref={workspaceRef}>
        <Card className="hand-class-breakdown">
          <CardHeader
            title="Win rate by hand class"
            subtitle="bb/100 on hands you played. Open a category to see its hands; pick a hand for its breakdown."
          />
          <Table>
            <TableHead>
              <TableCell header>Hand class</TableCell>
              <TableCell header align="right">Hands</TableCell>
              <TableCell header align="right">bb/100</TableCell>
              <TableCell header align="right">Net $</TableCell>
            </TableHead>
            <TableBody>{rows}</TableBody>
          </Table>
        </Card>

        {!narrow && (
          <aside className="hcb-side">
            {selectedHandData ? (
              <Card>
                <HandDetailPanel token={selectedHand} handData={selectedHandData} onClose={closePanel} />
              </Card>
            ) : (
              <Card className="hcb-panel-placeholder">
                <MousePointerClick size={20} aria-hidden="true" />
                <p>Pick a hand to see how it plays by preflop action and position.</p>
              </Card>
            )}
          </aside>
        )}
      </div>

      {narrow && (
        <Modal
          open={Boolean(selectedHandData)}
          onClose={closePanel}
          title={selectedHand}
          description={selectedHandData ? CATEGORY_LABEL[selectedHandData.category] : undefined}
        >
          {selectedHandData && (
            <HandDetailPanel token={selectedHand} handData={selectedHandData} onClose={closePanel} inModal />
          )}
        </Modal>
      )}
    </>
  );
}

export default HandClassBreakdown;
