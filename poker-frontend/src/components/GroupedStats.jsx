import { useEffect, useState } from 'react';
import './PositionalStats.css';
import { formatSignedMajorUnits } from '../utils/formatMoney';
import { confidenceModifier } from '../utils/confidence';

// Same rate-stat set statsEngine.js's newGroupStats() tracks per bucket -
// a curated subset (not every field) so the grid stays readable.
const GROUP_STAT_COLUMNS = [
  ['vpip', 'VPIP'],
  ['pfr', 'PFR'],
  ['threeBet', '3-Bet'],
  ['foldTo3Bet', 'Fold to 3B'],
  ['cbFlop', 'C-Bet Flop'],
  ['foldToCbFlop', 'Fold to CB'],
  ['checkRaise', 'Check-Raise'],
  ['wtsd', 'WTSD'],
  ['wwsf', 'WWSF']
];

// newTextureStats() only tracks these three - the stats that actually
// depend on flop texture (see statsEngine.js/flopTexture.js).
const TEXTURE_STAT_COLUMNS = [
  ['cbFlop', 'C-Bet Flop'],
  ['foldToCbFlop', 'Fold to CB'],
  ['checkRaise', 'Check-Raise']
];

const STACK_DEPTH_ORDER = ['short', 'mid', 'deep'];
const STACK_DEPTH_LABELS = { short: 'Short (<40bb)', mid: 'Mid (40-100bb)', deep: 'Deep (>100bb)' };

const TEXTURE_ORDER = ['dry', 'semi-wet', 'wet'];
const TEXTURE_LABELS = { dry: 'Dry', 'semi-wet': 'Semi-Wet', wet: 'Wet' };

const DIMENSIONS = [
  { key: 'stakes', label: 'Stakes' },
  { key: 'stackDepth', label: 'Stack Depth' },
  { key: 'flopTexture', label: 'Flop Texture' }
];

function RateCell({ label, rate }) {
  if (!rate || rate.opportunities === 0) {
    return (
      <div className="stat-box stat-box--empty">
        <div className="stat-label">{label}</div>
        <div className="stat-value">—</div>
        <div className="stat-sample">no data</div>
      </div>
    );
  }
  const modifier = confidenceModifier(rate);
  return (
    <div className={`stat-box ${modifier ? `stat-box--${modifier}` : ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{rate.pct}%</div>
      <div className="stat-sample">{rate.made}/{rate.opportunities}</div>
    </div>
  );
}

function labelForKey(dimension, key) {
  if (dimension === 'stackDepth') return STACK_DEPTH_LABELS[key] ?? key;
  if (dimension === 'flopTexture') return TEXTURE_LABELS[key] ?? key;
  return key;
}

// `byStakes`/`byStackDepth`/`byFlopTexture` are the objects statsEngine.js's
// finalize() produces (see newGroupStats()/newTextureStats()/
// finalizeGroupMap()). Lets the viewer flip between slicing by stakes,
// effective-stack depth, or flop texture - one tab bar for the dimension
// and a second for which value within it - reuses PositionalStats.css's
// tab/table styling rather than introducing a new visual language for
// what's structurally the same kind of "pick a bucket, see its stat line" UI.
export function GroupedStats({ byStakes, byStackDepth, byFlopTexture }) {
  const keysByDimension = {
    stakes: Object.keys(byStakes || {}),
    stackDepth: STACK_DEPTH_ORDER.filter(k => byStackDepth?.[k]),
    flopTexture: TEXTURE_ORDER.filter(k => byFlopTexture?.[k])
  };
  const mapByDimension = { stakes: byStakes, stackDepth: byStackDepth, flopTexture: byFlopTexture };

  const availableDimensions = DIMENSIONS.filter(d => keysByDimension[d.key].length > 0);

  const [dimension, setDimension] = useState(availableDimensions[0]?.key ?? 'stakes');
  const [activeKey, setActiveKey] = useState(null);

  const keys = keysByDimension[dimension] || [];

  useEffect(() => {
    setActiveKey(prev => (prev !== null && keys.includes(prev) ? prev : (keys[0] ?? null)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dimension, JSON.stringify(keys)]);

  if (availableDimensions.length === 0) return null;

  const bucket = activeKey != null ? mapByDimension[dimension]?.[activeKey] : null;
  // Only stakes/stack-depth buckets track profitability - see
  // finalizeGroupStats' hasProfitFields check in statsEngine.js. A flop-
  // texture slice doesn't attribute a whole hand's profit to one street.
  const showsProfit = bucket && dimension !== 'flopTexture';
  const columns = dimension === 'flopTexture' ? TEXTURE_STAT_COLUMNS : GROUP_STAT_COLUMNS;

  return (
    <div className="positional-stats-section">
      <div className="pos-section-header">
        <span className="pos-glyph" aria-hidden="true">♣</span>
        <h3 className="section-title">By Stakes / Stack Depth / Texture</h3>
        <span className="pos-rule" />
      </div>

      <div className="pos-size-tabs">
        {DIMENSIONS.map(d => (
          <button
            key={d.key}
            type="button"
            className={`pos-size-tab ${dimension === d.key ? 'active' : ''}`}
            disabled={keysByDimension[d.key].length === 0}
            onClick={() => setDimension(d.key)}
          >
            {d.label}
          </button>
        ))}
      </div>

      <div className="pos-size-tabs" style={{ marginTop: '0.5rem' }}>
        {keys.map(key => (
          <button
            key={key}
            type="button"
            className={`pos-size-tab ${activeKey === key ? 'active' : ''}`}
            onClick={() => setActiveKey(key)}
          >
            {labelForKey(dimension, key)}
          </button>
        ))}
      </div>

      {bucket && (
        <div className="stats-grid" style={{ marginTop: '0.75rem' }}>
          {showsProfit && (
            <>
              <div className="stat-box">
                <div className="stat-label">Net Won</div>
                <div className="stat-value">
                  {bucket.currency
                    ? formatSignedMajorUnits(bucket.totalProfitLoss, bucket.currency)
                    : `${bucket.totalProfitLoss >= 0 ? '+' : ''}${bucket.totalProfitLoss} (mixed currencies)`}
                </div>
                <div className="stat-sample">{bucket.handsWithProfitData} hands w/ data</div>
              </div>
              <div className="stat-box">
                <div className="stat-label">BB/100</div>
                <div className="stat-value">{bucket.bb100 ?? '—'}</div>
              </div>
            </>
          )}
          {columns.map(([key, label]) => (
            <RateCell key={key} label={label} rate={bucket[key]} />
          ))}
        </div>
      )}
    </div>
  );
}

export default GroupedStats;
