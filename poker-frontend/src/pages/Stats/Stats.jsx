import { Layout } from '../../components/Layout';
import { useState, useEffect } from 'react';
import { RotateCcw } from 'lucide-react';
import { API_URL } from '../../config';
import { confidenceModifier } from '../../utils/confidence';
import { PositionalStats } from '../../components/PositionalStats';
import { GroupedStats } from '../../components/GroupedStats';
import { EVGraph } from '../../components/EVGraph';
import { StatTile } from '../../components/ui/StatTile';
import { StudyCharts } from './StudyCharts';
import { PositionMatrixTables } from './PositionMatrixTables';
import './Stats.css';

const STAT_GROUPS = [
  {
    title: 'Preflop',
    glyph: '♠',
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
    glyph: '♣',
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

function SectionHeader({ glyph, title }) {
  return (
    <div className="section-header">
      <span className="section-glyph" aria-hidden="true">{glyph}</span>
      <h3 className="section-title">{title}</h3>
      <span className="section-rule" />
    </div>
  );
}

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

export function Stats() {
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
      <Layout title="Study">
        <div className="study-page">
          <div className="study-status-container">
            <div className="study-spinner"></div>
            <p>Loading your stats…</p>
          </div>
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

  const netPositive = stats && stats.totalProfitLoss >= 0;
  const subtitle = stats?.totalHands
    ? `${stats.totalHands.toLocaleString()} hands analysed${stats.lastComputedAt ? ` · updated ${new Date(stats.lastComputedAt).toLocaleDateString()}` : ''}`
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
        {!stats || stats.totalHands === 0 ? (
          <div className="study-status-container">
            <h2>No data yet</h2>
            <p>Import a session, then hit Recompute to generate your stats.</p>
          </div>
        ) : (
          <div className="stats-container">
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
            <PositionMatrixTables positional={stats.positional} />

            <div className="stats-grid stats-grid--hero">
              <div className="stat-box stat-box--hero">
                <div className="stat-label">Net Won</div>
                <div className={`stat-value ${netPositive ? 'stat-value--positive' : 'stat-value--negative'}`}>
                  {netPositive ? '+' : ''}{stats.totalProfitLoss}
                </div>
                <div className="stat-sample">{stats.handsWithProfitData} hands w/ data</div>
              </div>
              <div className="stat-box stat-box--hero">
                <div className="stat-label">Aggression %</div>
                <div className="stat-value">{stats.aggPct}%</div>
              </div>
              <div className="stat-box stat-box--hero">
                <div className="stat-label">Aggression Factor</div>
                <div className="stat-value">{stats.aggFactor ?? '—'}</div>
              </div>
            </div>

            {STAT_GROUPS.map(group => (
              <div key={group.title}>
                <SectionHeader glyph={group.glyph} title={group.title} />
                <div className="stats-grid">
                  {group.stats.map(([key, label]) => (
                    <StatBox key={key} label={label} rate={stats[key]} />
                  ))}
                </div>
              </div>
            ))}

            <PositionalStats positional={stats.positional} coverage={stats.positionCoverage} />
            <GroupedStats byStakes={stats.byStakes} byStackDepth={stats.byStackDepth} byFlopTexture={stats.byFlopTexture} />

            <EVGraph />

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

export default Stats;