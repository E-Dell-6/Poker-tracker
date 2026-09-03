import { Layout } from '../../components/Layout';
import { RotateCcw } from 'lucide-react';
import { Outlet, useOutletContext } from 'react-router-dom';
import { formatSignedMajorUnits } from '../../utils/formatMoney';
import { useHeroStats, TIME_FILTERS } from '../../hooks/useHeroStats';
import { StatTile } from '../../components/ui/StatTile';
import { GhostChart } from '../../components/ui/GhostChart';
import { Tabs } from '../../components/ui/Tabs';
import { StudyPageSkeleton } from './StudyPageSkeleton';
import './MatrixTableCard.css';
import './Stats.css';

// Owns the single useHeroStats() instance for the whole /study section (see
// studyRoutes.jsx) - every subpage reads its result via useStudyContext()
// instead of calling the hook itself, so switching subpages no longer
// refetches stats or resets the stakes/date filter (the bug this layout
// route was built to fix; previously each of Stats.jsx and
// PreflopMatrixPage.jsx called useHeroStats() independently). Navigation
// between Hands/Preflop/Flop is the sidebar's job (see Sidebar.jsx's
// Study subItems) - no in-page tab strip here.
export function StudyLayout() {
  const {
    isLoggedIn, baseStats, stats,
    isFilterActive,
    loading, filterLoading, refreshing, error,
    stakesFilter, setStakesFilter,
    daysFilter, setDaysFilter,
    fetchStats, refreshStats
  } = useHeroStats();

  if (loading || (isFilterActive && !stats)) {
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
                <h3 className="section-title">Preflop range matrix</h3>
              </div>
              <GhostChart type="area" emptyMessage="Sign in to see your preflop range matrix." />
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
              {filterLoading && stats && <span className="study-filter-updating">Updating…</span>}
            </div>

            {stats.totalHands === 0 ? (
              <div className="study-status-container">
                <h2>No hands match this filter</h2>
                <p>Try a different stakes or time range.</p>
              </div>
            ) : (
              <>
                {/* The 6 stat tiles + StudyCharts render ONLY on the
                    /study index route (StudyOverview.jsx) - every other
                    subpage gets just the filter bar above and its own
                    content via this Outlet. */}
                <Outlet context={{ stats }} />

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

// Subpages of /study read the layout's single useHeroStats() instance
// through this - see studyRoutes.jsx. `stats` is guaranteed non-null with
// totalHands > 0 here: the layout above gates on loading/error/logged-out/
// no-data/empty-filter before ever rendering <Outlet>, so subpages need no
// null guards of their own.
export function useStudyContext() {
  return useOutletContext();
}

export default StudyLayout;
