import { useEffect, useState } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import '../../components/PositionalStats.css'; // shared .pos-size-tabs/.pos-size-tab classes (see EVGraph.jsx's own cross-import for the same precedent)
import './StudyCharts.css';

const POSITION_ORDER = ['BTN', 'BTN/SB', 'SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO'];
function sortPositions(positions) {
  return [...positions].sort((a, b) => {
    const ia = POSITION_ORDER.indexOf(a);
    const ib = POSITION_ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
}

// Total hands across every position in a table-size bucket - not rolled up
// server-side (positional[size] has no top-level hand count, only each
// position does), used to default to the size the player actually played
// most rather than just the largest size ever seen (see the module comment
// on StudyCharts below for why that distinction matters).
function bucketHandCount(bucket) {
  return Object.values(bucket?.positions || {}).reduce((sum, p) => sum + (p.hands || 0), 0);
}

function mostPopulousSize(positional, sizes) {
  if (sizes.length === 0) return null;
  return sizes.reduce((best, size) =>
    bucketHandCount(positional[size]) > bucketHandCount(positional[best]) ? size : best
  , sizes[0]);
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
// (near-black) color unless these are set explicitly too, which is why
// tooltip text was unreadable against the dark card background.
const TOOLTIP_TEXT_STYLE = { color: 'var(--color-text)' };
// Highlights the hovered bar itself (via recharts' `activeBar`) instead of
// the default `cursor` rectangle, which spans the full category band -
// wider/taller than the bar and visually disconnected from its shape.
const ACTIVE_BAR = { stroke: 'var(--color-accent)', strokeWidth: 2, fillOpacity: 0.9 };

const SHOWDOWN_COLORS = {
  wonNoShowdown: 'var(--color-positive)',
  wonAtShowdown: 'color-mix(in srgb, var(--color-positive) 65%, var(--color-accent))',
  lostNoShowdown: 'color-mix(in srgb, var(--color-negative) 55%, var(--color-text-faint))',
  lostAtShowdown: 'var(--color-negative)'
};
const SHOWDOWN_LABELS = {
  wonNoShowdown: 'Won without showdown',
  wonAtShowdown: 'Won at showdown',
  lostNoShowdown: 'Lost without showdown',
  lostAtShowdown: 'Lost at showdown'
};

// `positional` is stats.positional (see statsEngine.js's finalizePositional/
// finalizePositionStats) - keyed by table size, each position now also
// carries totalProfitLoss/bb100/currency (added alongside these charts).
// `showdownBreakdown` is the hand-wide { wonNoShowdown, wonAtShowdown,
// lostNoShowdown, lostAtShowdown } counts (see newShowdownBreakdown()).
//
// Table size matters because a real table's seat count varies hand to
// hand (players sitting down/leaving) - defaulting to the *largest* size
// ever seen (the old behavior) could lock onto a single outlier hand and
// silently hide every other hand from these charts. Defaulting to the
// *most-played* size instead, with a manual switcher for the rest, avoids
// that - same pos-size-tabs pattern PositionalStats.jsx already uses.
export function StudyCharts({ positional, showdownBreakdown }) {
  const sizes = Object.keys(positional || {}).map(Number).filter(n => !Number.isNaN(n)).sort((a, b) => b - a);
  const [activeSize, setActiveSize] = useState(null);

  useEffect(() => {
    setActiveSize(prev => (prev !== null && sizes.includes(prev) ? prev : mostPopulousSize(positional, sizes)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(sizes)]);

  const bucket = activeSize !== null ? positional[activeSize] : null;
  const positions = bucket ? sortPositions(Object.keys(bucket.positions || {})) : [];

  const winRateData = positions.map(pos => ({
    pos,
    bb100: bucket.positions[pos]?.bb100 ?? 0
  }));

  const freqData = positions.map(pos => ({
    pos,
    VPIP: bucket.positions[pos]?.vpip?.pct ?? 0,
    PFR: bucket.positions[pos]?.pfr?.pct ?? 0,
    RFI: bucket.positions[pos]?.open?.pct ?? 0
  }));

  const bettingData = positions.map(pos => ({
    pos,
    'C-Bet Flop': bucket.positions[pos]?.cbFlop?.pct ?? 0,
    'Fold to C-Bet': bucket.positions[pos]?.foldToCbFlop?.pct ?? 0
  }));

  const showdownTotal = Object.values(showdownBreakdown || {}).reduce((s, v) => s + v, 0);
  const showdownData = Object.entries(showdownBreakdown || {})
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({ key, label: SHOWDOWN_LABELS[key], value }));

  if (positions.length === 0 && showdownTotal === 0) return null;

  return (
    <>
      {positions.length > 0 && sizes.length > 1 && (
        <div className="pos-size-tabs study-charts-size-tabs">
          {sizes.map(size => (
            <button
              key={size}
              type="button"
              className={`pos-size-tab ${activeSize === size ? 'active' : ''}`}
              onClick={() => setActiveSize(size)}
            >
              {size}-handed ({bucketHandCount(positional[size])})
            </button>
          ))}
        </div>
      )}
      <div className="study-charts-grid">
      {positions.length > 0 && (
        <div className="study-chart-card">
          <div className="study-chart-card-header">
            <h3 className="section-title">Win rate by position</h3>
            <span className="study-chart-card-sub">bb / 100 hands{activeSize != null ? ` · ${activeSize}-handed` : ''}</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={winRateData}>
              <XAxis dataKey="pos" tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={36} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                itemStyle={TOOLTIP_TEXT_STYLE}
                labelStyle={TOOLTIP_TEXT_STYLE}
                cursor={false}
                formatter={(v) => [`${v} bb/100`, 'Win rate']}
              />
              <Bar dataKey="bb100" radius={[4, 4, 0, 0]} activeBar={ACTIVE_BAR}>
                {winRateData.map((d, i) => (
                  <Cell key={i} fill={d.bb100 >= 0 ? 'var(--color-positive)' : 'var(--color-negative)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {showdownTotal > 0 && (
        <div className="study-chart-card">
          <div className="study-chart-card-header">
            <h3 className="section-title">Showdown breakdown</h3>
            <span className="study-chart-card-sub">% of hands</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={showdownData} dataKey="value" nameKey="label" innerRadius={50} outerRadius={80} paddingAngle={2}>
                {showdownData.map(d => <Cell key={d.key} fill={SHOWDOWN_COLORS[d.key]} />)}
              </Pie>
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                itemStyle={TOOLTIP_TEXT_STYLE}
                labelStyle={TOOLTIP_TEXT_STYLE}
                formatter={(v, n) => [`${Math.round((v / showdownTotal) * 100)}%`, n]}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: 'var(--color-text-muted)' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {positions.length > 0 && (
        <div className="study-chart-card">
          <div className="study-chart-card-header">
            <h3 className="section-title">Open / raise frequency by position</h3>
            <span className="study-chart-card-sub">VPIP · PFR · RFI</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={freqData}>
              <XAxis dataKey="pos" tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={36} tickFormatter={v => `${v}%`} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                itemStyle={TOOLTIP_TEXT_STYLE}
                labelStyle={TOOLTIP_TEXT_STYLE}
                cursor={false}
                formatter={(v) => `${v}%`}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: 'var(--color-text-muted)' }} />
              <Bar dataKey="VPIP" fill="var(--color-accent)" radius={[3, 3, 0, 0]} activeBar={ACTIVE_BAR} />
              <Bar dataKey="PFR" fill="var(--color-accent-hover)" radius={[3, 3, 0, 0]} activeBar={ACTIVE_BAR} />
              <Bar dataKey="RFI" fill="var(--color-positive)" radius={[3, 3, 0, 0]} activeBar={ACTIVE_BAR} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {positions.length > 0 && (
        <div className="study-chart-card">
          <div className="study-chart-card-header">
            <h3 className="section-title">Betting frequency by position</h3>
            <span className="study-chart-card-sub">Flop c-bet / fold to c-bet</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={bettingData}>
              <XAxis dataKey="pos" tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={36} tickFormatter={v => `${v}%`} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                itemStyle={TOOLTIP_TEXT_STYLE}
                labelStyle={TOOLTIP_TEXT_STYLE}
                cursor={{ stroke: 'var(--color-accent)', strokeWidth: 1, strokeDasharray: '4 3' }}
                formatter={(v) => `${v}%`}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: 'var(--color-text-muted)' }} />
              <Line type="monotone" dataKey="C-Bet Flop" stroke="var(--color-positive)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Fold to C-Bet" stroke="var(--color-negative)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      </div>
    </>
  );
}

export default StudyCharts;
