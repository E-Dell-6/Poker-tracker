import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { List, Eye, ArrowRight, Star } from 'lucide-react';
import { Layout } from '../../components/Layout';
import { API_URL } from '../../config';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { StatTile } from '../../components/ui/StatTile';
import { CumulativeChart } from '../../components/CumulativeChart';
import { Tabs } from '../../components/ui/Tabs';
import { Table, TableHead, TableBody, TableRow, TableCell } from '../../components/ui/Table';
import { DashboardSkeleton } from './DashboardSkeleton';
import { toMajorUnits, formatSignedMajorUnits } from '../../utils/formatMoney';
import './HomePage.css';

const CHART_RANGES = [
  { key: 7, label: '7D' },
  { key: 30, label: '30D' },
  { key: 90, label: '90D' },
  { key: null, label: 'All' },
];

// Card glyphs for the starred-hands panel - same 2-char-code convention
// (rank + suit letter) used throughout the app (see CardSelector.jsx).
const SUIT_SYMBOLS = { s: '♠', h: '♥', d: '♦', c: '♣' };
const isRedCard = (card) => 'hd'.includes(card.slice(-1));
const cardLabel = (card) => `${card.slice(0, -1)}${SUIT_SYMBOLS[card.slice(-1)] || card.slice(-1)}`;

const STAT_CARDS = [
  { label: 'Total Hands', key: 'totalHands', icon: '♠', suffix: '' },
  { label: 'Online Sessions', key: 'onlineSessions', icon: <List size={16} />, suffix: '' },
  { label: 'Live Sessions', key: 'liveSessions', icon: '♣', suffix: '' },
];

// Demo data shown to guests
const GUEST_SESSIONS = [
  { _id: 'g1', gameType: 'NL Hold\'em', date: '2024-11-10', hands: Array(87), totalProfit: 142 },
  { _id: 'g2', gameType: 'NL Hold\'em', date: '2024-11-08', hands: Array(63), totalProfit: -55 },
  { _id: 'g3', gameType: 'PLO', date: '2024-11-05', hands: Array(44), totalProfit: 310 },
  { _id: 'g4', gameType: 'NL Hold\'em', date: '2024-11-01', hands: Array(101), totalProfit: -88 },
  { _id: 'g5', gameType: 'PLO', date: '2024-10-28', hands: Array(72), totalProfit: 220 },
];

const GUEST_LIVE_SESSIONS = [
  { _id: 'gl1', gameType: 'Cash Game', date: '2024-11-09', clockInTime: '2024-11-09T19:00:00', clockOutTime: '2024-11-09T22:30:00', totalProfit: 180 },
  { _id: 'gl2', gameType: 'Cash Game', date: '2024-11-03', clockInTime: '2024-11-03T20:00:00', clockOutTime: '2024-11-03T23:15:00', totalProfit: -60 },
];

const GUEST_STATS = { totalHands: 367, onlineSessions: 5, liveSessions: 2 };
const GUEST_PULSE = [-55, 142, -60, 310, -88, 180, 220];

// Feature and process copy for the logged-out marketing sections
const HOW_STEPS = [
  { n: '1', title: 'Upload your logs', desc: 'Drop in ACR (.txt), GGPoker, or PokerNow (.csv) hand history files — or clock in a live session by hand.' },
  { n: '2', title: 'Auto-parsed into hands', desc: 'Every hand is structured into players, actions, board, pot size, and result — no manual entry.' },
  { n: '3', title: 'Analyze & replay', desc: 'Step through any hand action-by-action and track VPIP, PFR, 3-Bet % and opponent tendencies over time.' },
];

const computeTrendSlope = (values) => {
  const n = values.length;
  if (n < 2) return 0;

  const xs = values.map((_, i) => i);
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((sum, x, i) => sum + x * values[i], 0);
  const sumXX = xs.reduce((sum, x) => sum + x * x, 0);

  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return 0;

  return (n * sumXY - sumX * sumY) / denominator;
};

// Recharts-powered replacement for the old hand-rolled SVG sparkline.
// Same visual: gradient-filled area under a stroked line, no axes/tooltip.
const Sparkline = ({ values, positive }) => {
  if (!values.length) return null;

  const color = positive ? '#22c55e' : '#ef4444';
  const data = values.map((v, i) => ({ i, v }));

  return (
    <div className="sparkline">
      <ResponsiveContainer width="100%" height={48}>
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
          <defs>
            <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={2}
            fill="url(#sg)"
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export function HomePage() {
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState(null);
  const [isGuest, setIsGuest] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [combinedSessions, setCombinedSessions] = useState([]);
  const [stats, setStats] = useState(null);
  const [heroStats, setHeroStats] = useState(null);
  const [favourites, setFavourites] = useState([]);
  const [chartRange, setChartRange] = useState(30);

  useEffect(() => {
    fetch(`${API_URL}/api/user/data`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => setIsLoggedIn(data.success === true))
      .catch(() => setIsLoggedIn(false));
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;

    Promise.all([
      fetch(`${API_URL}/api/sessions`, { credentials: 'include' })
        .then(r => r.json())
        .catch(() => []),
      fetch(`${API_URL}/api/live-sessions`, { credentials: 'include' })
        .then(r => r.json())
        .catch(() => []),
      fetch(`${API_URL}/api/stats/me`, { credentials: 'include' })
        .then(r => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch(`${API_URL}/api/favourites`, { credentials: 'include' })
        .then(r => (r.ok ? r.json() : []))
        .catch(() => []),
    ]).then(([onlineData, liveData, heroStatsData, favouritesData]) => {
      setHeroStats(heroStatsData);
      setFavourites(Array.isArray(favouritesData) ? favouritesData.slice(0, 4) : []);
      const onlineSessions = Array.isArray(onlineData) ? onlineData : [];
      const liveSessions = Array.isArray(liveData) ? liveData : [];

      setSessions(onlineSessions);

      const combined = [
        ...onlineSessions.map(s => ({ ...s, isLive: false })),
        ...liveSessions.map(s => ({ ...s, isLive: true })),
      ];

      setCombinedSessions(combined);

      // Session list responses no longer include the full `hands` array
      // (see GET /api/sessions) - use the precomputed per-session count.
      const totalHands = onlineSessions.reduce(
        (sum, s) => sum + (s.totalHands ?? s.hands?.length ?? 0),
        0
      );

      setStats({
        totalHands,
        onlineSessions: onlineSessions.length,
        liveSessions: liveSessions.length,
      });
      setDataLoading(false);
    });
  }, [isLoggedIn]);

  const handleGuestMode = () => {
    setIsGuest(true);
    setDataLoading(false);
    setSessions(GUEST_SESSIONS);
    setCombinedSessions([
      ...GUEST_SESSIONS.map(s => ({ ...s, isLive: false })),
      ...GUEST_LIVE_SESSIONS.map(s => ({ ...s, isLive: true })),
    ]);
    setStats(GUEST_STATS);
  };

  const recentSessions = [...combinedSessions]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  const formatSessionDuration = (start, end) => {
    if (!start || !end) return null;
    const diff = Math.floor((new Date(end) - new Date(start)) / 1000);
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  // Each session's profit is normalized to major units by ITS OWN currency
  // before being combined - same reasoning as Profile.jsx's
  // onlineSessionProfit (a real-money/play-chip mix would otherwise inflate
  // the real-money total ~100x). Live sessions have no `currency` field and
  // are already entered in major units, so toMajorUnits passes them through
  // unchanged (CHIPS-style fallback = identity).
  const normalizedProfit = (s) => toMajorUnits(s.totalProfit ?? 0, s.currency);

  const thirtyDaysAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d;
  }, []);

  const netProfit30d = combinedSessions
    .filter(s => new Date(s.date) >= thirtyDaysAgo)
    .reduce((sum, s) => sum + normalizedProfit(s), 0);

  const hoursPlayedMs = combinedSessions
    .filter(s => s.isLive && s.clockInTime && s.clockOutTime)
    .reduce((sum, s) => sum + (new Date(s.clockOutTime) - new Date(s.clockInTime)), 0);

  const chartData = useMemo(() => {
    const cutoff = chartRange ? (() => { const d = new Date(); d.setDate(d.getDate() - chartRange); return d; })() : null;
    const pts = [...combinedSessions]
      .filter(s => !cutoff || new Date(s.date) >= cutoff)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    let cum = 0;
    return pts.map(s => {
      const profit = normalizedProfit(s);
      cum += profit;
      return {
        label: new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        profit,
        cumulative: cum,
      };
    });
  }, [combinedSessions, chartRange]);

  if (isLoggedIn === false && !isGuest) {
    const previewTrendPositive = computeTrendSlope(GUEST_PULSE) >= 0;

    return (
      <div className="hp-root">
        <section className="hp-hero">
          <div className="hp-hero-bg">
            <div className="hp-pulse-ring r1" />
            <div className="hp-pulse-ring r2" />
            <div className="hp-pulse-ring r3" />
          </div>

          <div className="hp-hero-grid">
            <div className="hp-hero-content">
              <div className="hp-hero-badge">Your poker edge, quantified</div>

              <h1 className="hp-hero-title">
                Track your game.<br />
                <span className="hp-hero-accent">Improve your edge.</span>
              </h1>

              <p className="hp-hero-sub">
                Upload hand histories, analyse VPIP, PFR, 3-Bet % and more —
                then replay every hand to see exactly where you win and lose.
              </p>

              <div className="hp-hero-ctas">
                <button
                  className="hp-btn-primary"
                  onClick={() => navigate('/login')}
                >
                  Get Started
                </button>

                <button
                  className="hp-btn-ghost"
                  onClick={() => navigate('/login')}
                >
                  Sign In
                </button>
              </div>

              <button className="hp-btn-guest" onClick={handleGuestMode}>
                Explore with sample data <ArrowRight size={14} />
              </button>

              <div className="hp-hero-pills">
                <span>Hand-by-hand replay</span>
                <span>VPIP · PFR · 3-Bet %</span>
                <span>Opponent profiling</span>
              </div>
            </div>

            {/* Static preview of the real dashboard, built from the same
                guest demo data as "Continue as Guest" - shows the product
                itself instead of an abstract graphic. Clicking it drops
                straight into the interactive guest dashboard. */}
            <button
              type="button"
              className="hp-preview"
              onClick={handleGuestMode}
              aria-label="Preview the dashboard with sample data"
            >
              <div className="hp-preview-window">
                <div className="hp-preview-topbar">
                  <span className="hp-preview-dot" />
                  <span className="hp-preview-dot" />
                  <span className="hp-preview-dot" />
                  <span className="hp-preview-topbar-label">Dashboard</span>
                </div>

                <div className="hp-preview-body">
                  <div className="hp-preview-stats">
                    {STAT_CARDS.map(card => (
                      <div key={card.key} className="hp-preview-stat">
                        <div className="hp-preview-stat-icon">{card.icon}</div>
                        <div className="hp-preview-stat-value">{GUEST_STATS[card.key]}</div>
                        <div className="hp-preview-stat-label">{card.label}</div>
                      </div>
                    ))}
                  </div>

                  <div className="hp-preview-sparkline-card">
                    <div className="hp-preview-sparkline-label">Session Profit Trend</div>
                    <Sparkline values={GUEST_PULSE} positive={previewTrendPositive} />
                  </div>

                  <div className="hp-preview-feed">
                    {GUEST_SESSIONS.slice(0, 3).map(s => (
                      <div key={s._id} className="hp-preview-feed-item">
                        <span className="hp-preview-feed-type">{s.gameType}</span>
                        <span className="hp-preview-feed-hands">{s.hands.length} hands</span>
                        <span className={`hp-preview-feed-profit ${s.totalProfit >= 0 ? 'pos' : 'neg'}`}>
                          {s.totalProfit >= 0 ? '+' : ''}{s.totalProfit}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="hp-preview-overlay">
                  <span>Click to explore <ArrowRight size={14} /></span>
                </div>
              </div>
            </button>
          </div>
        </section>

        <section className="hp-how">
          <h2 className="hp-section-title">How it works</h2>

          <div className="hp-how-steps">
            {HOW_STEPS.map((step, i) => (
              <div key={step.n} className="hp-how-step">
                <div className="hp-how-num">{step.n}</div>
                <h3>{step.title}</h3>
                <p>{step.desc}</p>
                {i < HOW_STEPS.length - 1 && <div className="hp-how-connector" />}
              </div>
            ))}
          </div>
        </section>

        <footer className="hp-footer">
          <div className="hp-footer-brand">
            <span className="hp-logo">♠</span>
            <span className="hp-brand-name">PokerFlow</span>
          </div>

          <div className="hp-footer-links">
            <span>About</span>
            <span>Contact</span>
            <span>Privacy Policy</span>
            <span>Terms</span>
          </div>

          <p className="hp-footer-copy">
            © {new Date().getFullYear()} PokerFlow. All rights reserved.
          </p>
        </footer>
      </div>
    );
  }

  if (isLoggedIn === null) {
    return (
      <div className="hp-root">
        <div className="hp-dashboard hp-dashboard--pre-auth">
          <DashboardSkeleton />
        </div>
      </div>
    );
  }

  const hoursPlayed = hoursPlayedMs / 3600000;

  return (
    <Layout
      title="Dashboard"
      subtitle="Last 30 days · All games · All stakes"
      ctaLabel="Import hands"
      onCta={() => navigate('/history')}
    >
      <div className="hp-dashboard">
        {isGuest && (
          <div className="hp-guest-banner">
            <Eye size={16} className="hp-guest-banner-icon" />
            <span>You're browsing as a guest with sample data.</span>
            <button
              className="hp-guest-banner-cta"
              onClick={() => navigate('/login')}
            >
              Sign up free <ArrowRight size={14} />
            </button>
          </div>
        )}

        {dataLoading ? <DashboardSkeleton /> : (
        <>
        <div className="hp-tiles-grid">
          <StatTile
            label="Net Profit (30D)"
            value={formatSignedMajorUnits(netProfit30d, sessions[0]?.currency)}
            valueClassName={netProfit30d >= 0 ? 'pos' : 'neg'}
          />
          <StatTile label="Hands Tracked" value={(stats?.totalHands ?? 0).toLocaleString()} />
          <StatTile label="Hours Played" value={hoursPlayed > 0 ? hoursPlayed.toFixed(1) : '0'} />
          <StatTile
            label="Win Rate"
            value={heroStats?.bb100 != null ? `${heroStats.bb100} bb/100` : '—'}
            valueClassName="accent"
            delta={heroStats?.bb100 != null ? 'NL Hold\'em only' : undefined}
          />
        </div>

        <div className="hp-main-grid">
          <section className="hp-chart-card">
            <div className="hp-chart-card-header">
              <div>
                <h2 className="hp-section-title">Bankroll</h2>
                <p className="hp-chart-sub">Cumulative profit, last {chartRange ?? 'all time'}{chartRange ? ' days' : ''}</p>
              </div>
              <Tabs options={CHART_RANGES} active={chartRange} onChange={setChartRange} />
            </div>
            <CumulativeChart data={chartData} emptyMessage="Not enough session data yet - play more sessions or import hand histories." />
          </section>

          <section className="hp-starred-card">
            <div className="hp-chart-card-header">
              <h2 className="hp-section-title">Starred hands</h2>
              {favourites.length > 0 && (
                <button className="hp-btn-ghost hp-starred-review" onClick={() => navigate('/history')}>Review</button>
              )}
            </div>
            {favourites.length === 0 ? (
              <p className="hp-starred-empty">Star a hand from History or the Replayer to pin it here.</p>
            ) : (
              <div className="hp-starred-list">
                {favourites.map(hand => {
                  const hero = hand.players?.find(p => p.isHero);
                  const profit = typeof hero?.profitLoss === 'number'
                    ? hero.profitLoss
                    : (hand.winners?.includes(hero?.name) ? hand.finalPotSize ?? 0 : null);
                  const board = [...(hand.board?.flop || []), ...(hand.board?.turn?.slice(-1) || []), ...(hand.board?.river?.slice(-1) || [])];
                  return (
                    <button
                      key={hand._id}
                      type="button"
                      className="hp-starred-item"
                      onClick={() => navigate('/hand-replay', { state: { hand, session: null } })}
                    >
                      <div className="hp-starred-cards">
                        {(hero?.holeCards || []).map((c, i) => (
                          <span key={i} className={`hp-card ${isRedCard(c) ? 'red' : ''}`}>{cardLabel(c)}</span>
                        ))}
                      </div>
                      <div className="hp-starred-board">
                        {board.map((c, i) => <span key={i}>{cardLabel(c)}</span>)}
                      </div>
                      {profit != null && (
                        <span className={`hp-starred-profit ${profit >= 0 ? 'pos' : 'neg'}`}>
                          {profit >= 0 ? '+' : ''}{formatSignedMajorUnits(profit, hand.currency)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <section className="hp-section hp-section-dark">
          <div className="hp-chart-card-header">
            <h2 className="hp-section-title">Recent sessions</h2>
            {!isGuest && (
              <button className="hp-btn-ghost hp-view-all" onClick={() => navigate('/history')}>
                All sessions <ArrowRight size={14} />
              </button>
            )}
          </div>

          {recentSessions.length > 0 ? (
            <Table>
              <TableHead>
                <TableCell header>Date</TableCell>
                <TableCell header>Game</TableCell>
                <TableCell header>Venue</TableCell>
                <TableCell header align="right">Hands</TableCell>
                <TableCell header align="right">Duration</TableCell>
                <TableCell header align="right">Result</TableCell>
              </TableHead>
              <TableBody>
                {recentSessions.map(s => (
                  <TableRow key={s._id} onClick={() => !isGuest && navigate('/history')}>
                    <TableCell>{new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</TableCell>
                    <TableCell>{s.isLive ? <span className="ui-table-value-mono">Live</span> : (s.gameType ?? '—')}</TableCell>
                    <TableCell>{s.source ?? s.venue ?? '—'}</TableCell>
                    <TableCell align="right"><span className="ui-table-value-mono">{s.isLive ? '—' : (s.totalHands ?? s.hands?.length ?? 0)}</span></TableCell>
                    <TableCell align="right"><span className="ui-table-value-mono">{s.isLive ? (formatSessionDuration(s.clockInTime, s.clockOutTime) ?? '—') : '—'}</span></TableCell>
                    <TableCell align="right">
                      <span className={`ui-table-value-mono ${normalizedProfit(s) >= 0 ? 'ui-table-value-pos' : 'ui-table-value-neg'}`}>
                        {formatSignedMajorUnits(normalizedProfit(s), s.currency)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="hp-empty">
              <div className="hp-empty-icon">♠</div>
              <h3>No sessions yet</h3>
              <p>Upload a hand history to get started tracking your game.</p>
              <button className="hp-btn-primary" onClick={() => navigate('/history')}>
                Upload Hand History
              </button>
            </div>
          )}
        </section>
        </>
        )}
      </div>
    </Layout>
  );
}