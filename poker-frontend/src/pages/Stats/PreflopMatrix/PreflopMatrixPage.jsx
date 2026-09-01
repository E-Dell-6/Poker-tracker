import { useEffect, useState } from 'react';
import { Layout } from '../../../components/Layout';
import { useHeroStats } from '../../../hooks/useHeroStats';
import { StudyPageSkeleton } from '../StudyPageSkeleton';
import { HandMatrix } from './HandMatrix';
import { PreflopMatrixControls } from './PreflopMatrixControls';
import { HERO_POSITIONS } from '../../../utils/handGrid';
import '../Stats.css';
import './PreflopMatrixPage.css';

function sortByHeroPositionOrder(positions) {
  return [...positions].sort((a, b) => HERO_POSITIONS.indexOf(a) - HERO_POSITIONS.indexOf(b));
}

// Total hands across every hand token in a facing-position bucket - used to
// pick the default facing position (whichever one hero has the most data
// against), same "most-populous" idea PositionMatrixTables.jsx's
// mostPopulousSize already uses for table-size selection.
function facingBucketHandCount(tokens) {
  return Object.values(tokens || {}).reduce((sum, c) => sum + (c.total || 0), 0);
}

export function PreflopMatrixPage() {
  const {
    isLoggedIn, baseStats, stats,
    isFilterActive,
    loading, error,
    stakesFilter, setStakesFilter,
    daysFilter, setDaysFilter,
    fetchStats
  } = useHeroStats();

  const [scenario, setScenario] = useState('rfi');
  const [heroPosition, setHeroPosition] = useState('UTG');
  const [facingPosition, setFacingPosition] = useState(null);
  const [minSampleSize, setMinSampleSize] = useState(0);

  // Table size is always "6" - the range-matrix is only ever aggregated
  // for 6-max (see statsEngine.js's tableSize === 6 gate).
  const matrixRoot = stats?.preflopMatrix?.['6'];

  const facingOptions = scenario === 'rfi'
    ? []
    : sortByHeroPositionOrder(Object.keys(matrixRoot?.[scenario]?.[heroPosition] || {}));

  useEffect(() => {
    if (scenario === 'rfi') {
      setFacingPosition(null);
      return;
    }
    if (facingOptions.includes(facingPosition)) return;
    if (facingOptions.length === 0) {
      setFacingPosition(null);
      return;
    }
    const scenarioBucket = matrixRoot?.[scenario]?.[heroPosition] || {};
    let best = facingOptions[0];
    let bestTotal = -1;
    for (const opt of facingOptions) {
      const total = facingBucketHandCount(scenarioBucket[opt]);
      if (total > bestTotal) { bestTotal = total; best = opt; }
    }
    setFacingPosition(best);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario, heroPosition, matrixRoot]);

  const gridData = scenario === 'rfi'
    ? matrixRoot?.rfi?.[heroPosition]
    : matrixRoot?.[scenario]?.[heroPosition]?.[facingPosition];

  if (loading || (isFilterActive && !stats)) {
    return (
      <Layout title="Range Matrix">
        <div className="study-page">
          <StudyPageSkeleton />
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout title="Range Matrix">
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

  if (isLoggedIn === false || !baseStats || baseStats.totalHands === 0) {
    return (
      <Layout title="Range Matrix">
        <div className="study-page">
          <div className="study-status-container">
            <h2>No data yet</h2>
            <p>
              {isLoggedIn === false
                ? 'Sign in to see your preflop range matrix.'
                : 'Import a session, then hit Recompute on the Study page to generate your stats.'}
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Range Matrix" subtitle="Hero's own fold/call/raise split, by starting hand">
      <div className="study-page">
        <div className="pfm-page">
          <PreflopMatrixControls
            scenario={scenario} setScenario={setScenario}
            heroPosition={heroPosition} setHeroPosition={setHeroPosition}
            facingPosition={facingPosition} setFacingPosition={setFacingPosition}
            facingOptions={facingOptions}
            stakesFilter={stakesFilter} setStakesFilter={setStakesFilter}
            stakesOptions={Object.keys(baseStats.byStakes || {})}
            daysFilter={daysFilter} setDaysFilter={setDaysFilter}
            minSampleSize={minSampleSize} setMinSampleSize={setMinSampleSize}
          />

          {!gridData || Object.keys(gridData).length === 0 ? (
            <div className="study-status-container">
              <h2>No hands recorded</h2>
              <p>Hero has no tracked hands for this position/scenario combination yet.</p>
            </div>
          ) : (
            <HandMatrix data={gridData} minSampleSize={minSampleSize} />
          )}
        </div>
      </div>
    </Layout>
  );
}

export default PreflopMatrixPage;
