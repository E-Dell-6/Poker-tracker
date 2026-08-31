import { Layout } from '../../components/Layout';
import { useState, useEffect } from 'react';
import { RotateCcw } from 'lucide-react';
import { getMyStats, getMyFilteredStats, recomputeMyStats } from '../../api/stats';
import { formatSignedMajorUnits } from '../../utils/formatMoney';
import { useIsLoggedIn } from '../../hooks/useIsLoggedIn';
import { PositionalStats } from '../../components/PositionalStats';
import { GroupedStats } from '../../components/GroupedStats';
import { EVGraph } from '../../components/EVGraph';
import { StatTile } from '../../components/ui/StatTile';
import { GhostChart } from '../../components/ui/GhostChart';
import { Tabs } from '../../components/ui/Tabs';
import { StudyCharts } from './StudyCharts';
import { PositionMatrixTables } from './PositionMatrixTables';
import { HandClassBreakdown } from './HandClassBreakdown';
import { StudyPageSkeleton } from './StudyPageSkeleton';
import './Stats.css';

const SECTION_TABS = [
  { key: 'hands', label: 'Hands' },
  { key: 'position', label: 'Position' },
  { key: 'board', label: 'Board' }
];

// Same presets/convention as Profile.jsx's TIME_FILTERS (plain component
// state, no URL sync) - reused here rather than inventing a second "time
// range" UI. Keys are strings (not the day-count/null itself) since Tabs
// uses `key` as both the React key and the active-comparison identity.
const TIME_FILTERS = [
  { key: '30', label: '30D' },
  { key: '90', label: '90D' },
  { key: '365', label: '365D' },
  { key: 'all', label: 'All Time' }
];

function daysAgoISO(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export function Stats() {
  const isLoggedIn = useIsLoggedIn();
  // `baseStats` is the cached, unfiltered GET /api/stats/me result - always
  // fetched once on load, and kept around even while a filter is active so
  // the Stakes <select> always has its full option list. `filteredStats` is
  // the live GET /api/stats/me/filtered result, only populated when a
  // filter is actually active. `stats` (derived below) is whichever of the
  // two the page should actually render.
  const [baseStats, setBaseStats] = useState(null);
  const [filteredStats, setFilteredStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterLoading, setFilterLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [section, setSection] = useState('hands');
  const [stakesFilter, setStakesFilter] = useState('');
  const [daysFilter, setDaysFilter] = useState('all');

  const isFilterActive = stakesFilter !== '' || daysFilter !== 'all';
  const fromISO = daysFilter !== 'all' ? daysAgoISO(Number(daysFilter)) : null;
  const stats = isFilterActive ? filteredStats : baseStats;

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      setBaseStats(await getMyStats());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchFilteredStats = async () => {
    try {
      setFilterLoading(true);
      setError(null);
      setFilteredStats(await getMyFilteredStats({ stakes: stakesFilter, from: fromISO }));
    } catch (err) {
      setError(err.message);
    } finally {
      setFilterLoading(false);
    }
  };

  const refreshStats = async () => {
    try {
      setRefreshing(true);
      setBaseStats(await recomputeMyStats());
      // Recompute always refreshes the unfiltered cached doc - if a filter
      // is active, re-run it too so the visible (filtered) view reflects
      // the fresh data instead of silently going stale.
      if (isFilterActive) await fetchFilteredStats();
    } catch (err) {
      setError(err.message);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn === false) {
      setLoading(false);
      return;
    }
    if (isLoggedIn !== true) return; // still checking auth
    fetchStats();
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isFilterActive) return;
    fetchFilteredStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stakesFilter, daysFilter]);

  if (loading || (isFilterActive && !filteredStats)) {
    return (
      <Layout title="Study">
        <div className="study-page">
          <StudyPageSkeleton />
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout title="Study">
        <div className="study-page">
          <div className="study-status-container study-status-container--error">
            <h2>Couldn't load your stats</h2>
            <p>{error}</p>
            <button className="refresh-btn" onClick={fetchStats}>Retry</button>
          </div>
        </div>
      </Layout>
    );
  }

  if (isLoggedIn === false) {
    return (
      <Layout title="Study">
        <div className="study-page">
          <div className="study-tiles-grid">
            <StatTile label="Hands" value="—" />
            <StatTile label="Win Rate" value="—" />
            <StatTile label="VPIP / PFR" value="—" />
            <StatTile label="3-Bet" value="—" />
          </div>

          <div className="study-ghost-grid">
            <div className="matrix-table-card">
              <div className="matrix-table-header">
                <h3 className="section-title">Win rate by position</h3>
              </div>
              <GhostChart type="bar" emptyMessage="Sign in to see your win rate by position." />
            </div>
            <div className="matrix-table-card">
              <div className="matrix-table-header">
                <h3 className="section-title">Showdown breakdown</h3>
              </div>
              <GhostChart type="pie" emptyMessage="Sign in to see your showdown results." />
            </div>
            <div className="matrix-table-card">
              <div className="matrix-table-header">
                <h3 className="section-title">Profit vs. Expected Value</h3>
              </div>
              <GhostChart type="area" emptyMessage="Sign in to see your EV over time." />
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  const subtitle = stats?.totalHands
    ? [
        `${stats.totalHands.toLocaleString()} hands analysed`,
        stats.handsWithProfitData > 0 ? `net ${formatSignedMajorUnits(stats.totalProfitLoss, stats.currency)}` : null,
        stats.lastComputedAt ? `updated ${new Date(stats.lastComputedAt).toLocaleDateString()}` : null
      ].filter(Boolean).join(' · ')
    : undefined;

  return (
    <Layout
      title="Study"
      subtitle={subtitle}
      ctaLabel={refreshing ? 'Recomputing…' : 'Recompute Stats'}
      ctaIcon={RotateCcw}
      onCta={refreshStats}
    >
      <div className="study-page">
        {!baseStats || baseStats.totalHands === 0 ? (
          <div className="study-status-container">
            <h2>No data yet</h2>
            <p>Import a session, then hit Recompute to generate your stats.</p>
          </div>
        ) : (
          <div className="stats-container">
            <div className="study-filter-bar">
              <select
                className="study-filter-select"
                value={stakesFilter}
                onChange={e => setStakesFilter(e.target.value)}
                aria-label="Filter by stakes"
              >
                <option value="">All stakes</option>
                {Object.keys(baseStats.byStakes || {}).map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <Tabs options={TIME_FILTERS} active={daysFilter} onChange={setDaysFilter} />
              {filterLoading && filteredStats && <span className="study-filter-updating">Updating…</span>}
            </div>

            {stats.totalHands === 0 ? (
              <div className="study-status-container">
                <h2>No hands match this filter</h2>
                <p>Try a different stakes or time range.</p>
              </div>
            ) : (
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

                <Tabs className="study-section-tabs" options={SECTION_TABS} active={section} onChange={setSection} />

                {section === 'hands' && (
                  <HandClassBreakdown byHandClass={stats.byHandClass} byHandClassCategory={stats.byHandClassCategory} />
                )}
                {section === 'position' && (
                  <>
                    <PositionMatrixTables positional={stats.positional} />
                    <PositionalStats positional={stats.positional} coverage={stats.positionCoverage} />
                  </>
                )}
                {section === 'board' && (
                  <>
                    <GroupedStats byStakes={stats.byStakes} byStackDepth={stats.byStackDepth} byFlopTexture={stats.byFlopTexture} />
                    <EVGraph stakes={stakesFilter || undefined} from={fromISO || undefined} />
                  </>
                )}

                <p className="study-note">
                  Last computed {new Date(stats.lastComputedAt).toLocaleString()}. Stats are cached
                  server-side and update whenever a session is imported — hit Recompute to force a refresh.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}

export default Stats;