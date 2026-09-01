import { useState } from 'react';
import { Settings, X } from 'lucide-react';
import { Tabs } from '../../../components/ui/Tabs';
import { TIME_FILTERS } from '../../../hooks/useHeroStats';
import { HERO_POSITIONS } from '../../../utils/handGrid';
import './PreflopMatrixControls.css';

const SCENARIO_TABS = [
  { key: 'rfi', label: 'RFI' },
  { key: 'vsOpen', label: 'vs Open' },
  { key: 'vs3Bet', label: 'vs 3-Bet' }
];

// "Hero position" means something different per scenario (see
// statsEngine.js's classifyHeroPreflopMatrixDecision) - this caption keeps
// that from being silently misread.
const SCENARIO_CAPTION = {
  rfi: null,
  vsOpen: 'Hero position is the player defending against the open below.',
  vs3Bet: 'Hero position is the original opener now facing this 3-bet - not the 3-bettor.'
};

export function PreflopMatrixControls({
  scenario, setScenario,
  heroPosition, setHeroPosition,
  facingPosition, setFacingPosition, facingOptions,
  stakesFilter, setStakesFilter, stakesOptions,
  daysFilter, setDaysFilter,
  minSampleSize, setMinSampleSize
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="pfm-controls">
      <div className="pfm-controls-row">
        <Tabs options={SCENARIO_TABS} active={scenario} onChange={setScenario} />
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

      <Tabs options={HERO_POSITIONS} active={heroPosition} onChange={setHeroPosition} />

      {scenario !== 'rfi' && (
        <div className="pfm-facing-row">
          <span className="pfm-facing-label">Facing</span>
          {facingOptions.length > 0 ? (
            <Tabs options={facingOptions} active={facingPosition} onChange={setFacingPosition} />
          ) : (
            <span className="pfm-facing-empty">No hands recorded for this position yet.</span>
          )}
        </div>
      )}

      {SCENARIO_CAPTION[scenario] && <p className="pfm-caption">{SCENARIO_CAPTION[scenario]}</p>}

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
