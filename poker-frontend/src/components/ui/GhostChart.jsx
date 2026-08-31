import {
  AreaChart, Area,
  BarChart, Bar,
  PieChart, Pie, Cell,
  ResponsiveContainer,
} from 'recharts';
import './GhostChart.css';

// Fixed (not random) so the shape doesn't reshuffle on every re-render -
// just needs to read as "a graph", not represent anything real.
const AREA_DATA = [4, 7, 5, 9, 6, 11, 8, 13, 10, 14].map((v, i) => ({ i, v }));
const BAR_DATA = [6, 10, 4, 8, 12, 5, 9].map((v, i) => ({ i, v }));
const PIE_DATA = [40, 28, 18, 14].map((v, i) => ({ i, v }));

const GRAY = 'var(--color-text-faint)';
const GRAY_DIM = 'var(--color-border-strong)';

// Non-interactive, single-color placeholder chart for "this is what a real
// chart looks like here once you have data" - used wherever a signed-out
// or data-less view still needs to show a graph shape rather than a text
// message or nothing at all. No axes/tooltip/legend on purpose: it's fake
// shape data, not something worth a reader trying to read values off of.
export function GhostChart({ type = 'area', height = 200, emptyMessage }) {
  return (
    <div className="ghost-chart">
      <ResponsiveContainer width="100%" height={height}>
        {type === 'bar' ? (
          <BarChart data={BAR_DATA} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
            <Bar dataKey="v" fill={GRAY} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        ) : type === 'pie' ? (
          <PieChart margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
            <Pie
              data={PIE_DATA}
              dataKey="v"
              innerRadius="55%"
              outerRadius="85%"
              stroke="var(--color-bg)"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {PIE_DATA.map((_, idx) => (
                <Cell key={idx} fill={idx % 2 === 0 ? GRAY : GRAY_DIM} />
              ))}
            </Pie>
          </PieChart>
        ) : (
          <AreaChart data={AREA_DATA} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
            <Area
              type="monotone"
              dataKey="v"
              stroke={GRAY}
              strokeWidth={2}
              fill={GRAY}
              fillOpacity={0.12}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        )}
      </ResponsiveContainer>
      {emptyMessage && <p className="ghost-chart-message">{emptyMessage}</p>}
    </div>
  );
}

export default GhostChart;
