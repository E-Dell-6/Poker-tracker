import { useState, useEffect } from 'react';
import { RotateCcw } from 'lucide-react';
import './PlayerStats.css';
import { getPersonStats, recomputePersonStats } from '../../api/stats';
import { formatSignedMajorUnits } from '../../utils/formatMoney';
import { confidenceModifier } from '../../utils/confidence';
import { PositionalStats } from '../../components/PositionalStats';
import { GroupedStats } from '../../components/GroupedStats';

const STAT_GROUPS = [
  {
    title: 'Preflop',
    stats: [
      ['vpip', 'VPIP'],
      ['pfr', 'PFR'],
      ['open', 'Open %'],
      ['threeBet', '3-Bet %'],
      ['foldTo3Bet', 'Fold to 3-Bet %'],
      ['fourBet', '4-Bet %'],
      ['foldTo4Bet', 'Fold to 4-Bet %'],
      ['steal', 'Steal %'],
      ['foldToSteal', 'Fold to Steal %'],
      ['limp', 'Limp %'],
      ['coldCall', 'Cold Call %']
    ]
  },
  {
    title: 'Postflop',
    stats: [
      ['cbFlop', 'Flop C-Bet %'],
      ['foldToCbFlop', 'Fold to Flop C-Bet %'],
      ['checkRaise', 'Check-Raise %'],
      ['wtsd', 'Went to Showdown %'],
      ['wsd', 'Won at Showdown %'],
      ['wwsf', 'Won When Saw Flop %']
    ]
  }
];

function StatBox({ label, rate }) {
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

export function PlayerStats({ player }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchStats = async (personId) => {
    try {
      setLoading(true);
      setError(null);
      setStats(await getPersonStats(personId));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const refreshStats = async () => {
    try {
      setRefreshing(true);
      setStats(await recomputePersonStats(player._id));
    } catch (err) {
      setError(err.message);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (player?._id) fetchStats(player._id);
  }, [player?._id]);

  if (!player) return null;

  return (
    <div className="player-stats-section">
      <div className="stats-header">
        <h2>Statistics</h2>
        <button className="sessions-toggle-btn" onClick={refreshStats} disabled={refreshing}>
          {refreshing ? 'Recomputing…' : <><RotateCcw size={14} /> Recompute</>}
        </button>
      </div>

      {loading ? (
        <div className="stats-placeholder">Loading stats…</div>
      ) : error ? (
        <div className="stats-placeholder">{error}</div>
      ) : !stats || stats.totalHands === 0 ? (
        <div className="stats-placeholder">
          No stats yet for this player. Hit Recompute after they appear in an imported session.
        </div>
      ) : (
        <div className="stats-container">
          <div className="stats-grid">
            <div className="stat-box">
              <div className="stat-label">Total Hands</div>
              <div className="stat-value">{stats.totalHands}</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Net Won</div>
              <div className="stat-value">
                {stats.currency
                  ? formatSignedMajorUnits(stats.totalProfitLoss, stats.currency)
                  : `${stats.totalProfitLoss >= 0 ? '+' : ''}${stats.totalProfitLoss} (mixed currencies)`}
              </div>
              <div className="stat-sample">{stats.handsWithProfitData} hands w/ data</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">BB/100</div>
              <div className="stat-value">{stats.bb100 ?? '—'}</div>
              {stats.bb100 === null && !stats.currency && (
                <div className="stat-sample">mixed currencies</div>
              )}
            </div>
            <div className="stat-box">
              <div className="stat-label">Aggression %</div>
              <div className="stat-value">{stats.aggPct}%</div>
            </div>
          </div>

          {STAT_GROUPS.map(group => (
            <div key={group.title}>
              <h3 className="section-title">{group.title}</h3>
              <div className="stats-grid">
                {group.stats.map(([key, label]) => (
                  <StatBox key={key} label={label} rate={stats[key]} />
                ))}
              </div>
            </div>
          ))}

          <PositionalStats positional={stats.positional} />
          <GroupedStats byStakes={stats.byStakes} byStackDepth={stats.byStackDepth} byFlopTexture={stats.byFlopTexture} />
        </div>
      )}
    </div>
  );
}