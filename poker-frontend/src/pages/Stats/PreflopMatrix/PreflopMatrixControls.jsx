import { useEffect, useRef, useState, useCallback } from 'react';
import { Settings, X, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { Tabs } from '../../../components/ui/Tabs';
import { TABLE_SIZES } from '../../../utils/handGrid';
import './PreflopMatrixControls.css';

const ACTIONS = [
  { key: 'fold', label: 'Fold', color: 'var(--color-action-fold)' },
  { key: 'call', label: 'Call', color: 'var(--color-action-call)' },
  { key: 'raise', label: 'Raise', color: 'var(--color-action-raise)' }
];

// One seat's decision node: header is JUST the position (no "vs X" / bet-
// level text - the card's place in the sequence already says what it's
// facing), then hero's own fold/call/raise options for having been in this
// exact seat facing this exact situation.
//
// The card has two independent click targets, same as GTOWizard's node bar:
// clicking the CARD selects it, pointing the range grid at that seat's
// numbers without touching the line; clicking one of the three ACTION rows
// commits/re-commits that decision and lets the line walk on. Every action
// is clickable (not just the chosen one), since whichever gets picked is
// itself backed by real hero hands - that's what the next node's lookup is
// built from.
//
// The card body is a plain div rather than a <button> because it contains
// the action buttons, and nesting buttons is invalid HTML - the title is
// the real focusable control, so selecting a node works from the keyboard
// too.
function NodeCard({ node, isActive, onSelect, onPick }) {
  const className = [
    'pfm-node-card',
    node.decided ? 'pfm-node-card--decided' : 'pfm-node-card--open',
    isActive ? 'pfm-node-card--active' : ''
  ].filter(Boolean).join(' ');

  return (
    <div className={className} onClick={onSelect}>
      <div className="pfm-node-header">
        <button
          type="button"
          className="pfm-node-title"
          aria-pressed={isActive}
          title={`Show ${node.position}'s range`}
          onClick={e => { e.stopPropagation(); onSelect(); }}
        >
          {node.position}
        </button>
      </div>
      <div className="pfm-node-actions">
        {ACTIONS.map(a => (
          <button
            key={a.key}
            type="button"
            className={`pfm-node-action ${node.action === a.key ? 'pfm-node-action--chosen' : ''}`}
            style={node.action === a.key ? { background: `color-mix(in srgb, ${a.color} 22%, transparent)`, borderColor: a.color } : undefined}
            onClick={e => { e.stopPropagation(); onPick(a.key); }}
          >
            <span className="pfm-node-action-dot" style={{ background: a.color }} />
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// Horizontally-scrolling row that shows a left/right chevron only when
// there's actually more content to scroll to in that direction - re-checked
// on scroll and on resize (a narrower window, or more cards being added to
// the sequence, can each turn overflow on or off).
function ScrollableRow({ children }) {
  const ref = useRef(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    update();
    const el = ref.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    el.addEventListener('scroll', update, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener('scroll', update);
    };
    // Re-measure whenever the row's content changes (new cards appended).
  }, [children, update]);

  const scrollByCard = dir => ref.current?.scrollBy({ left: dir * 160, behavior: 'smooth' });

  return (
    <div className="pfm-scroll-wrap">
      {canLeft && (
        <button type="button" className="pfm-scroll-btn pfm-scroll-btn--left" onClick={() => scrollByCard(-1)} aria-label="Scroll left">
          <ChevronLeft size={16} />
        </button>
      )}
      <div className="pfm-card-row" ref={ref}>
        {children}
      </div>
      {canRight && (
        <button type="button" className="pfm-scroll-btn pfm-scroll-btn--right" onClick={() => scrollByCard(1)} aria-label="Scroll right">
          <ChevronRight size={16} />
        </button>
      )}
    </div>
  );
}

export function PreflopMatrixControls({
  nodes, activeId, complete, onSelectNode, onPickAction, onReset,
  tableSize, setTableSize,
  minSampleSize, setMinSampleSize
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="pfm-controls">
      <div className="pfm-controls-row">
        <ScrollableRow>
          {/* The committed decisions followed by every seat still to act
              this round, UTG->BB, all shown and clickable at once -
              picking an action on one that isn't the very next seat (e.g.
              BTN's Raise while UTG/HJ/CO are still undecided) auto-folds
              whichever open seats come before it (see
              PreflopMatrixPage.jsx's commitOpenSeat). */}
          {nodes.map(node => (
            <NodeCard
              key={node.id}
              node={node}
              isActive={node.id === activeId}
              onSelect={() => onSelectNode(node.id)}
              onPick={action => onPickAction(node, action)}
            />
          ))}
          {complete && (
            <div className="pfm-node-card pfm-node-card--done">
              <span>Hand complete</span>
            </div>
          )}
        </ScrollableRow>
      </div>

      {/* Table size + the two panel-wide actions, on their own row under
          the seat cards rather than crowded in beside them - the card row
          spans the full page width now (see PreflopMatrixPage.css), which
          left these squeezed against the far edge. */}
      <div className="pfm-controls-toolbar">
        <Tabs options={TABLE_SIZES.map(n => ({ key: n, label: `${n}-max` }))} active={tableSize} onChange={setTableSize} />
        <button type="button" className="pfm-gear-btn" onClick={onReset} aria-label="Restart from UTG" title="Restart from UTG">
          <RotateCcw size={16} />
        </button>
        <button
          type="button"
          className={`pfm-gear-btn ${settingsOpen ? 'active' : ''}`}
          onClick={() => setSettingsOpen(o => !o)}
          aria-label="Display settings"
          title="Display settings"
        >
          <Settings size={16} />
        </button>
      </div>

      {settingsOpen && (
        <div className="pfm-settings-panel">
          <div className="pfm-settings-header">
            <span className="pfm-settings-title">Display</span>
            <button type="button" className="pfm-settings-close" onClick={() => setSettingsOpen(false)} aria-label="Close">
              <X size={14} />
            </button>
          </div>

          <div className="pfm-settings-field">
            <label className="pfm-settings-label" htmlFor="pfm-sample-size">
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
          </div>
        </div>
      )}
    </div>
  );
}

export default PreflopMatrixControls;
