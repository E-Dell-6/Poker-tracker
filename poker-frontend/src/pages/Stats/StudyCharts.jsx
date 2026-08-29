import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './StudyCharts.css';

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
export function StudyCharts({ positional, showdownBreakdown }) {
  const sizes = Object.keys(positional || {}).map(Number).filter(n => !Number.isNaN(n)).sort((a, b) => b - a);
  const largestSize = sizes[0];
  const bucket = largestSize ? positional[largestSize] : null;
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
    <div className="study-charts-grid">
      {positions.length > 0 && (
        <div className="study-chart-card">
          <div className="study-chart-card-header">
            <h3 className="section-title">Win rate by position</h3>
            <span className="study-chart-card-sub">bb / 100 hands{largestSize ? ` · ${largestSize}-handed` : ''}</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={winRateData}>
              <XAxis dataKey="pos" tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={36} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${v} bb/100`, 'Win rate']} />
              <Bar dataKey="bb100" radius={[4, 4, 0, 0]}>
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
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, n) => [`${Math.round((v / showdownTotal) * 100)}%`, n]} />
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
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => `${v}%`} />
              <Legend wrapperStyle={{ fontSize: 11, color: 'var(--color-text-muted)' }} />
              <Bar dataKey="VPIP" fill="var(--color-accent)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="PFR" fill="var(--color-accent-hover)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="RFI" fill="var(--color-positive)" radius={[3, 3, 0, 0]} />
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
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => `${v}%`} />
              <Legend wrapperStyle={{ fontSize: 11, color: 'var(--color-text-muted)' }} />
              <Line type="monotone" dataKey="C-Bet Flop" stroke="var(--color-positive)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Fold to C-Bet" stroke="var(--color-negative)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default StudyCharts;
