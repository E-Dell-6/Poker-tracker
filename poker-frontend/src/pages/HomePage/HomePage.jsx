import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../../components/Layout';
import { API_URL } from '../../config';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import './HomePage.css';

const STAT_CARDS = [
  { label: 'Total Hands', key: 'totalHands', icon: '♠', suffix: '' },
  { label: 'Online Sessions', key: 'onlineSessions', icon: '≡', suffix: '' },
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
  const [sessions, setSessions] = useState([]);
  const [combinedSessions, setCombinedSessions] = useState([]);
  const [stats, setStats] = useState(null);
  const [pulse, setPulse] = useState([]);
  const [showPulse, setShowPulse] = useState(false);

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
    ]).then(([onlineData, liveData]) => {
      const onlineSessions = Array.isArray(onlineData) ? onlineData : [];
      const liveSessions = Array.isArray(liveData) ? liveData : [];

      setSessions(onlineSessions);

      const combined = [
        ...onlineSessions.map(s => ({ ...s, isLive: false })),
        ...liveSessions.map(s => ({ ...s, isLive: true })),
      ];

      setCombinedSessions(combined);

      const recent = [...combined]
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(-10);

      setPulse(recent.map(s => s.totalProfit ?? 0));

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
    });
  }, [isLoggedIn]);

  const handleGuestMode = () => {
    setIsGuest(true);
    setSessions(GUEST_SESSIONS);
    setCombinedSessions([
      ...GUEST_SESSIONS.map(s => ({ ...s, isLive: false })),
      ...GUEST_LIVE_SESSIONS.map(s => ({ ...s, isLive: true })),
    ]);
    setStats(GUEST_STATS);
    setPulse(GUEST_PULSE);
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
                Explore with sample data →
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
                  <span>Click to explore →</span>
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
        <div className="hp-loading">
          <div className="hp-spinner" />
        </div>
      </div>
    );
  }

  return (
    <Layout>
      <div className="hp-dashboard">
        {isGuest && (
          <div className="hp-guest-banner">
            <span className="hp-guest-banner-icon">👁</span>
            <span>You're browsing as a guest with sample data.</span>
            <button
              className="hp-guest-banner-cta"
              onClick={() => navigate('/login')}
            >
              Sign up free →
            </button>
          </div>
        )}

        <section className="hp-section">
          <h2 className="hp-section-title">Performance Snapshot</h2>

          <div className="hp-stats-grid">
            {STAT_CARDS.map(card => (
              <div key={card.key} className="hp-stat-card">
                <div className="hp-stat-icon">{card.icon}</div>
                <div className="hp-stat-value">
                  {stats ? stats[card.key] ?? '--' : '--'}
                  {card.suffix && stats?.[card.key] !== '--'
                    ? card.suffix
                    : ''}
                </div>
                <div className="hp-stat-label">{card.label}</div>
              </div>
            ))}
          </div>

          {pulse.length > 1 && (
            <div
              className="hp-sparkline-card"
              onClick={() => !showPulse && setShowPulse(true)}
              style={{ cursor: showPulse ? 'default' : 'pointer' }}
            >
              <div className="hp-sparkline-label">
                Session Profit Trend
              </div>
              {showPulse ? (
                <Sparkline values={pulse} positive={computeTrendSlope(pulse) >= 0} />
              ) : (
                <div
                  className="sparkline"
                  style={{
                    height: '48px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--muted, #6b7280)',
                    fontSize: '13px',
                  }}
                >
                  Click to reveal
                </div>
              )}
            </div>
          )}
        </section>

        {recentSessions.length > 0 && (
          <section className="hp-section hp-section-dark">
            <h2 className="hp-section-title">Recent Sessions</h2>

            <div className="hp-feed">
              {recentSessions.map(s => (
                <div
                  key={s._id}
                  className="hp-feed-item"
                  onClick={() => !isGuest && navigate('/history')}
                  style={isGuest ? { cursor: 'default' } : {}}
                >
                  <div className="hp-feed-left">
                    <span className="hp-feed-type">
                      {s.isLive ? 'Live · ' : ''}{s.gameType ?? '—'}
                    </span>

                    <span className="hp-feed-date">
                      {new Date(s.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>

                    <span className="hp-feed-hands">
                      {s.isLive
                        ? formatSessionDuration(s.clockInTime, s.clockOutTime) ?? 'Live session'
                        : `${s.totalHands ?? s.hands?.length ?? 0} hands`}
                    </span>
                  </div>

                  <div
                    className={`hp-feed-profit ${
                      (s.totalProfit ?? 0) >= 0 ? 'pos' : 'neg'
                    }`}
                  >
                    {(s.totalProfit ?? 0) >= 0 ? '+' : ''}
                    {s.totalProfit ?? 0}
                  </div>
                </div>
              ))}

              {!isGuest && (
                <button
                  className="hp-btn-ghost hp-view-all"
                  onClick={() => navigate('/history')}
                >
                  View All Sessions →
                </button>
              )}

              {isGuest && (
                <button
                  className="hp-btn-primary hp-view-all"
                  onClick={() => navigate('/login')}
                >
                  Sign up to track your own sessions →
                </button>
              )}
            </div>
          </section>
        )}

        {combinedSessions.length === 0 && stats && (
          <section className="hp-section">
            <div className="hp-empty">
              <div className="hp-empty-icon">♠</div>
              <h3>No sessions yet</h3>
              <p>
                Upload a PokerNow CSV to get started tracking your game.
              </p>

              <button
                className="hp-btn-primary"
                onClick={() => navigate('/history')}
              >
                Upload Hand History
              </button>
            </div>
          </section>
        )}
      </div>
    </Layout>
  );
}