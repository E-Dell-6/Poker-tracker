import { Layout } from '../../components/Layout';
import { useState, useEffect } from 'react';
import { API_URL } from '../../config';
import './Study.css';

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
  return (
    <div className="stat-box">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{rate.pct}%</div>
      <div className="stat-sample">{rate.made}/{rate.opportunities}</div>
    </div>
  );
}

export function Study() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_URL}/api/stats/me`, { credentials: 'include' });
      if (res.status === 404) {
        setStats(null);
        return;
      }
      if (!res.ok) throw new Error('Failed to load stats');
      setStats(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const refreshStats = async () => {
    try {
      setRefreshing(true);
      const res = await fetch(`${API_URL}/api/stats/me/recompute`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      if (!res.ok) throw new Error('Failed to recompute stats');
      setStats(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchStats(); }, []);

  if (loading) {
    return (
      <Layout>
        <div className="study-page">
          <div className="study-status-container">
            <div className="study-spinner"></div>
            <p>Loading your stats...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="study-page">
          <div className="study-status-container">
            <h2>Error Loading Stats</h2>
            <p>{error}</p>
            <button className="refresh-btn" onClick={fetchStats}>Retry</button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="study-page">
        <div className="study-header">
          <div className="study-title-row">
            <h1>My Statistics</h1>
            <button className="refresh-btn" onClick={refreshStats} disabled={refreshing}>
              {refreshing ? 'Recomputing…' : '↺ Recompute Stats'}
            </button>
          </div>
        </div>

        {!stats || stats.totalHands === 0 ? (
          <div className="study-status-container">
            <h2>No Data Available</h2>
            <p>No hands found yet. Import a session, then recompute stats.</p>
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
                <div className="stat-value">{stats.totalProfitLoss >= 0 ? '+' : ''}{stats.totalProfitLoss}</div>
                <div className="stat-sample">{stats.handsWithProfitData} hands w/ data</div>
              </div>
              <div className="stat-box">
                <div className="stat-label">BB/100</div>
                <div className="stat-value">{stats.bb100 ?? '—'}</div>
              </div>
              <div className="stat-box">
                <div className="stat-label">Aggression %</div>
                <div className="stat-value">{stats.aggPct}%</div>
              </div>
              <div className="stat-box">
                <div className="stat-label">Aggression Factor</div>
                <div className="stat-value">{stats.aggFactor ?? '—'}</div>
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

            <p className="study-note">
              Last computed {new Date(stats.lastComputedAt).toLocaleString()}. Stats are cached
              server-side and update whenever a session is imported — hit Recompute to force a refresh.
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default Study;