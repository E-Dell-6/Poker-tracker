import { useStudyContext } from './StudyLayout';
import { StatTile } from '../../components/ui/StatTile';
import { StudyCharts } from './StudyCharts';

// The /study index route - the only place the 6 headline stat tiles and
// the 4 overview charts (StudyCharts) render. Hands/Preflop/Flop are
// focused subpages with just the shared filter bar (see StudyLayout.jsx)
// plus their own content - no tiles, no charts.
export function StudyOverview() {
  const { stats } = useStudyContext();
  return (
    <>
      <div className="study-tiles-grid">
        <StatTile label="Hands" value={stats.totalHands.toLocaleString()} />
        <StatTile
          label="Win Rate"
          value={stats.bb100 != null ? `${stats.bb100} bb/100` : '—'}
          valueClassName={stats.bb100 != null ? (stats.bb100 >= 0 ? 'pos' : 'neg') : ''}
        />
        <StatTile label="VPIP / PFR" value={`${stats.vpip.pct}% / ${stats.pfr.pct}%`} />
        <StatTile label="3-Bet" value={`${stats.threeBet.pct}%`} />
        <StatTile label="Flop C-Bet" value={`${stats.cbFlop.pct}%`} />
        <StatTile label="WTSD / W$SD" value={`${stats.wtsd.pct}% / ${stats.wsd.pct}%`} />
      </div>

      <StudyCharts positional={stats.positional} showdownBreakdown={stats.showdownBreakdown} />
    </>
  );
}

export default StudyOverview;
