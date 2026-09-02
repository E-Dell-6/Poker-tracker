import { useState, useEffect } from 'react';
import { RotateCcw } from 'lucide-react';
import './PlayerStats.css';
import { getPersonStats, recomputePersonStats } from '../../api/stats';
import { StatTile } from '../../components/ui/StatTile';
import { StudyCharts } from '../Stats/StudyCharts';
import { PositionalStats } from '../../components/PositionalStats';

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
          {/* Same 6-tile summary + chart pairing as the Study page (see
              Stats.jsx) - a curated headline set instead of one box per
              tracked rate stat. The rest (open%, steal%, 4-bet%, limp%,
              cold-call%, ...) aren't lost, just no longer flattened into a
              single number here - PositionalStats below breaks every one
              of them out by position, which is strictly more informative
              than the box grid this replaced. */}
          <div className="player-tiles-grid">
            <StatTile label="Hands" value={stats.totalHands} />
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

          <PositionalStats positional={stats.positional} />
        </div>
      )}
    </div>
  );
}