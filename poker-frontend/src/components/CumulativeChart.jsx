import { TrendingUp, TrendingDown } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import './CumulativeChart.css';

function fmt$(n) {
  if (n == null) return '—';
  const abs = Math.abs(n);
  const s = abs >= 1000 ? `$${(abs / 1000).toFixed(1)}k` : `$${abs.toFixed(0)}`;
  return n < 0 ? `-${s}` : s;
}

function fmtFull$(n) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  }).format(n);
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const { cumulative, profit } = payload[0].payload;

  return (
    <div className="cum-chart-tooltip">
      <div className="cum-chart-tt-date">{label}</div>
      <div className={`cum-chart-tt-val ${cumulative >= 0 ? 'pos' : 'neg'}`}>
        {cumulative >= 0 ? '+' : ''}{fmtFull$(cumulative)}
      </div>
      <div className="cum-chart-tt-delta">
        {profit >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />} {fmtFull$(Math.abs(profit))} this point
      </div>
    </div>
  );
}

// Cumulative-profit area chart, extracted from Profile.jsx's ProfitChart
// (originally inline there) so Dashboard can use the exact same look
// instead of a second hand-rolled chart. `data`: [{ label, profit,
// cumulative }], already sorted chronologically.
export function CumulativeChart({ data, height = 260, emptyMessage = 'Not enough data yet.' }) {
  if (data.length < 2) {
    return <div className="cum-chart-empty">{emptyMessage}</div>;
  }

  const isUp = data[data.length - 1].cumulative >= 0;
  const stroke = isUp ? 'var(--color-positive)' : 'var(--color-negative)';
  const fillId = isUp ? 'cumChartFillPos' : 'cumChartFillNeg';

  return (
    <div className="cum-chart-svg-wrap">
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="cumChartFillPos" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-positive)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--color-positive)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="cumChartFillNeg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-negative)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--color-negative)" stopOpacity={0} />
            </linearGradient>
          </defs>

          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={fmt$}
            tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }}
            axisLine={false}
            tickLine={false}
            width={56}
          />

          <ReferenceLine y={0} stroke="var(--color-border-strong)" strokeDasharray="5 4" />

          <Tooltip
            content={<CustomTooltip />}
            cursor={{ stroke: 'var(--color-border-strong)', strokeDasharray: '4 3' }}
          />

          <Area
            type="monotone"
            dataKey="cumulative"
            stroke={stroke}
            strokeWidth={2.2}
            fill={`url(#${fillId})`}
            dot={false}
            activeDot={{ r: 5, fill: stroke, stroke: 'var(--color-bg)', strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default CumulativeChart;
