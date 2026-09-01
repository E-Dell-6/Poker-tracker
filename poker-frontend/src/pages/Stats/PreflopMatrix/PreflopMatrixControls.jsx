import { useEffect, useRef, useState, useCallback } from 'react';
import { Settings, X, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { Tabs } from '../../../components/ui/Tabs';
import { TIME_FILTERS } from '../../../hooks/useHeroStats';
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
// exact seat facing this exact situation. Every row is clickable, since
// whichever action gets picked is itself backed by real hero hands (that's
// what the NEXT node's lookup is built from). `chosen` is the action
// already picked for this node (undefined for a still-open card).
function NodeCard({ position, chosen, isOpen, onPick }) {
  return (
    <div className={`pfm-node-card ${isOpen ? 'active' : ''}`}>
      <div className="pfm-node-header">
        <span className="pfm-node-title">{position}</span>
      </div>
      <div className="pfm-node-actions">
        {ACTIONS.map(a => (
          <button
            key={a.key}
            type="button"
            className={`pfm-node-action ${chosen === a.key ? 'pfm-node-action--chosen' : ''}`}
            style={chosen === a.key ? { background: `color-mix(in srgb, ${a.color} 22%, transparent)`, borderColor: a.color } : undefined}
            onClick={() => onPick(a.key)}
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
  path, openSeats, complete, onRedoStep, onCommitOpenSeat, onReset,
  tableSize, setTableSize,
  stakesFilter, setStakesFilter, stakesOptions,
  daysFilter, setDaysFilter,
  minSampleSize, setMinSampleSize
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="pfm-controls">
      <div className="pfm-controls-row">
        <ScrollableRow>
          {path.map((step, i) => (
            <NodeCard
              key={i}
              position={step.position}
              chosen={step.action}
              isOpen={false}
              onPick={action => onRedoStep(i, action)}
            />
          ))}
          {/* Every seat still to act this round, UTG->BB, shown and
              clickable at once - clicking one that isn't the very next
              (e.g. BTN's Raise while UTG/HJ/CO are still undecided)
              auto-folds whichever open seats come before it (see
              PreflopMatrixPage.jsx's commitOpenSeat). */}
          {openSeats.map(seat => (
            <NodeCard
              key={seat.position}
              position={seat.position}
              chosen={undefined}
              isOpen
              onPick={action => onCommitOpenSeat(seat.position, action)}
            />
          ))}
          {complete && (
            <div className="pfm-node-card pfm-node-card--done">
              <span>Hand complete</span>
            </div>
          )}
        </ScrollableRow>
        <Tabs options={TABLE_SIZES.map(n => ({ key: n, label: `${n}-max` }))} active={tableSize} onChange={setTableSize} />
        <button type="button" className="pfm-gear-btn" onClick={onReset} aria-label="Restart from UTG" title="Restart from UTG">
          <RotateCcw size={16} />
        </button>
        <button
          type="button"
          className={`pfm-gear-btn ${settingsOpen ? 'active' : ''}`}
          onClick={() => setSettingsOpen(o => !o)}
          aria-label="Filters"
          title="Filters"
        >
          <Settings size={16} />
        </button>
      </div>

      {settingsOpen && (
        <div className="pfm-settings-panel">
          <div className="pfm-settings-header">
            <span className="pfm-settings-title">Filters</span>
            <button type="button" className="pfm-settings-close" onClick={() => setSettingsOpen(false)} aria-label="Close">
              <X size={14} />
            </button>
          </div>

          <div className="pfm-settings-field">
            <label className="pfm-settings-label" htmlFor="pfm-stakes">Stakes</label>
            <select
              id="pfm-stakes"
              className="study-filter-select"
              value={stakesFilter}
              onChange={e => setStakesFilter(e.target.value)}
            >
              <option value="">All stakes</option>
              {stakesOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="pfm-settings-field">
            <span className="pfm-settings-label">Date range</span>
            <Tabs options={TIME_FILTERS} active={daysFilter} onChange={setDaysFilter} />
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
