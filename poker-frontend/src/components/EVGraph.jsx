import { useEffect, useState } from 'react';
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer
} from 'recharts';
import { getEvGraph } from '../api/stats';
import { Skeleton } from './ui/Skeleton';
import './PositionalStats.css'; // shared section-header/glyph/rule classes
import './EVGraph.css';

// No currency symbol here, deliberately - the endpoint sums each hand's
// own-currency-normalized result together (see statsService.js's
// buildEvGraphRows), so a user mixing real-money and play-chip sessions
// wouldn't have one honest symbol to show. Matches Stats.jsx's own
// "Net Won" stat box, which does the same (plain signed number, no $).
function fmtNum(n) {
  if (n == null) return '—';
  const abs = Math.abs(n);
  const s = abs >= 1000 ? `${(abs / 1000).toFixed(1)}k` : abs.toFixed(abs >= 100 ? 0 : 1);
  return n < 0 ? `-${s}` : `+${s}`;
}

function fmtFull(n) {
  if (n == null) return '—';
  const sign = n > 0 ? '+' : n < 0 ? '-' : '';
  return `${sign}${Math.abs(n).toFixed(2)}`;
}

function EVTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  const variance = point.cumulativeActual - point.cumulativeEV;

  return (
    <div className="ev-chart-tooltip">
      <div className="ev-tt-hand">Hand #{label}</div>
      <div className="ev-tt-row"><span className="ev-tt-dot ev-tt-dot--actual" />Actual <b>{fmtFull(point.cumulativeActual)}</b></div>
      <div className="ev-tt-row"><span className="ev-tt-dot ev-tt-dot--ev" />EV <b>{fmtFull(point.cumulativeEV)}</b></div>
      <div className={`ev-tt-variance ${variance >= 0 ? 'pos' : 'neg'}`}>
        {variance >= 0 ? 'Running above EV' : 'Running below EV'} ({fmtFull(variance)})
      </div>
    </div>
  );
}

// `stakes`/`from`/`to` mirror the page-wide Stakes/Time filter of whichever
// page renders this (see statsController.js's getHeroEvGraphRoute) - all
// optional, omitted entirely means "all hands". `heading` lets a host page
// that already renders its own card title (Profile.jsx) suppress this
// component's internal one instead of showing two - default true keeps
// every other render site's existing look.
export function EVGraph({ stakes, from, to, heading = true } = {}) {
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getEvGraph({ stakes, from, to });
        if (!cancelled) setRows(data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [stakes, from, to]);

  // Distinct from the empty/`rows === null` case below: this only covers
  // the very first fetch. A host page whose filter changes (Profile.jsx's
  // time filter) re-triggers the effect above on every click - collapsing
  // to nothing on each of those refetches (the old `if (loading) return
  // null` behavior) would make the chart flicker away and back constantly,
  // so only the initial load (no `rows` yet at all) shows this skeleton;
  // a refetch keeps rendering the previous chart underneath until the new
  // data arrives.
  if (loading && !rows) {
    return (
      <div className="ev-graph-section">
        {heading && (
          <div className="pos-section-header">
            <span className="pos-glyph" aria-hidden="true">♥</span>
            <h3 className="section-title">Profit vs. Expected Value</h3>
            <span className="pos-rule" />
          </div>
        )}
        <Skeleton style={{ height: 260 }} />
      </div>
    );
  }
  if (error) return <div className="ev-graph-section stats-placeholder">{error}</div>;
  if (!rows || rows.length < 2) {
    return (
      <div className="ev-graph-section">
        {heading && (
          <div className="pos-section-header">
            <span className="pos-glyph" aria-hidden="true">♥</span>
            <h3 className="section-title">Profit vs. Expected Value</h3>
            <span className="pos-rule" />
          </div>
        )}
        <div className="stats-placeholder">
          Not enough hand-by-hand data yet - this fills in as all-in hands with known showdown cards are tracked.
        </div>
      </div>
    );
  }

  const last = rows[rows.length - 1];
  const isUp = last.cumulativeActual >= 0;

  return (
    <div className="ev-graph-section">
      {heading && (
        <div className="pos-section-header">
          <span className="pos-glyph" aria-hidden="true">♥</span>
          <h3 className="section-title">Profit vs. Expected Value</h3>
          <span className="pos-rule" />
        </div>
      )}

      <div className="ev-chart-header">
        <div className="ev-legend">
          <span className="ev-legend-item"><span className="ev-tt-dot ev-tt-dot--actual" />Actual</span>
          <span className="ev-legend-item"><span className="ev-tt-dot ev-tt-dot--ev" />All-in EV</span>
        </div>
        <div className={`ev-chart-total ${isUp ? 'pos' : 'neg'}`}>{fmtFull(last.cumulativeActual)}</div>
      </div>

      <div className="ev-chart-svg-wrap">
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={rows} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="evFillGreen" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22c55e" stopOpacity={0.22} />
                <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="evFillRed" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity={0.22} />
                <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>

            <XAxis
              dataKey="handIndex"
              tick={{ fontSize: 10, fill: '#8a8a8f' }}
              axisLine={false}
              tickLine={false}
              label={{ value: 'Hand #', position: 'insideBottom', offset: -4, fontSize: 10, fill: '#8a8a8f' }}
            />
            <YAxis
              tickFormatter={fmtNum}
              tick={{ fontSize: 10, fill: '#8a8a8f' }}
              axisLine={false}
              tickLine={false}
              width={48}
            />

            <ReferenceLine y={0} stroke="rgba(255,255,255,0.18)" strokeDasharray="5 4" />

            <Tooltip content={<EVTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.18)', strokeDasharray: '4 3' }} />

            <Area
              type="monotone"
              dataKey="cumulativeActual"
              stroke={isUp ? '#22c55e' : '#ef4444'}
              strokeWidth={2.2}
              fill={isUp ? 'url(#evFillGreen)' : 'url(#evFillRed)'}
              dot={false}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="cumulativeEV"
              stroke="#d4af37"
              strokeWidth={2}
              strokeDasharray="5 3"
              dot={false}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default EVGraph;
