import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../../components/Layout';
import { API_URL } from '../../config';
import './HomePage.css';

const STAT_CARDS = [
  { label: 'Total Hands', key: 'totalHands', icon: '♠', suffix: '' },
  { label: 'Sessions Logged', key: 'sessions', icon: '≡', suffix: '' },
  { label: 'VPIP', key: 'vpip', icon: '%', suffix: '%' },
  { label: 'PFR', key: 'pfr', icon: '↑', suffix: '%' },
];

// Demo data shown to guests
const GUEST_SESSIONS = [
  { _id: 'g1', gameType: 'NL Hold\'em', date: '2024-11-10', hands: Array(87), totalProfit: 142 },
  { _id: 'g2', gameType: 'NL Hold\'em', date: '2024-11-08', hands: Array(63), totalProfit: -55 },
  { _id: 'g3', gameType: 'PLO', date: '2024-11-05', hands: Array(44), totalProfit: 310 },
  { _id: 'g4', gameType: 'NL Hold\'em', date: '2024-11-01', hands: Array(101), totalProfit: -88 },
  { _id: 'g5', gameType: 'PLO', date: '2024-10-28', hands: Array(72), totalProfit: 220 },
];

const GUEST_STATS = { totalHands: 367, sessions: 5, vpip: '28', pfr: '19' };
const GUEST_PULSE = [-55, 142, 310, -88, 220];

export function HomePage() {
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState(null);
  const [isGuest, setIsGuest] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState(null);
  const [pulse, setPulse] = useState([]);

  useEffect(() => {
    fetch(`${API_URL}/api/user/data`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => setIsLoggedIn(data.success === true))
      .catch(() => setIsLoggedIn(false));
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;

    fetch(`${API_URL}/api/sessions`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data)) return;

        setSessions(data);

        const recent = [...data]
          .sort((a, b) => new Date(a.date) - new Date(b.date))
          .slice(-10);

        setPulse(recent.map(s => s.totalProfit ?? 0));

        const totalHands = data.reduce(
          (sum, s) => sum + (s.hands?.length ?? 0),
          0
        );

        setStats({
          totalHands,
          sessions: data.length,
          vpip: '--',
          pfr: '--',
        });
      })
      .catch(() => {});
  }, [isLoggedIn]);

  const handleGuestMode = () => {
    setIsGuest(true);
    setSessions(GUEST_SESSIONS);
    setStats(GUEST_STATS);
    setPulse(GUEST_PULSE);
  };

  const recentSessions = [...sessions]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  const Sparkline = ({ values }) => {
    if (!values.length) return null;

    const w = 200, h = 48, pad = 4;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const pts = values.map((v, i) => {
      const x = pad + (i / Math.max(values.length - 1, 1)) * (w - pad * 2);
      const y = h - pad - ((v - min) / range) * (h - pad * 2);
      return `${x},${y}`;
    });

    const area = `M${pts[0]} L${pts.join(' L')} L${w - pad},${h} L${pad},${h} Z`;
    const line = `M${pts.join(' L')}`;

    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="sparkline">
        <defs>
          <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#sg)" />
        <path
          d={line}
          fill="none"
          stroke="#22c55e"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  // ── LOGGED OUT ──
  if (isLoggedIn === false && !isGuest) {
    return (
      <div className="hp-root">
        <section className="hp-hero">
          <div className="hp-hero-bg">
            <div className="hp-pulse-ring r1" />
            <div className="hp-pulse-ring r2" />
            <div className="hp-pulse-ring r3" />
          </div>

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
              Continue as Guest
            </button>

            <div className="hp-hero-pills">
              <span>Hand-by-hand replay</span>
              <span>VPIP · PFR · 3-Bet %</span>
              <span>Opponent profiling</span>
            </div>
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
            © {new Date().getFullYear()} Poker. All rights reserved.
          </p>
        </footer>
      </div>
    );
  }

  // ── LOADING ──
  if (isLoggedIn === null) {
    return (
      <div className="hp-root">
        <div className="hp-loading">
          <div className="hp-spinner" />
        </div>
      </div>
    );
  }

  // ── LOGGED IN or GUEST ──
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
            <div className="hp-sparkline-card">
              <div className="hp-sparkline-label">
                Session Profit Trend
              </div>
              <Sparkline values={pulse} />
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
                      {s.gameType ?? '—'}
                    </span>

                    <span className="hp-feed-date">
                      {new Date(s.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>

                    <span className="hp-feed-hands">
                      {s.hands?.length ?? 0} hands
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

        {sessions.length === 0 && stats && (
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