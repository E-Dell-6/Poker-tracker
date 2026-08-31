import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Layout } from '../../components/Layout';
import { useIsLoggedIn } from '../../hooks/useIsLoggedIn';
import { getMyStats } from '../../api/stats';
import { getAllSessions } from '../../api/sessions';
import { getLiveSessions } from '../../api/liveSessions';
import { getFavourites } from '../../api/favourites';
import { StatTile } from '../../components/ui/StatTile';
import { CumulativeChart } from '../../components/CumulativeChart';
import { GhostChart } from '../../components/ui/GhostChart';
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

export function HomePage() {
  const navigate = useNavigate();
  const isLoggedIn = useIsLoggedIn();
  const [dataLoading, setDataLoading] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [combinedSessions, setCombinedSessions] = useState([]);
  const [stats, setStats] = useState(null);
  const [heroStats, setHeroStats] = useState(null);
  const [favourites, setFavourites] = useState([]);
  const [chartRange, setChartRange] = useState(30);

  useEffect(() => {
    if (isLoggedIn === false) {
      setDataLoading(false);
      return;
    }
    if (!isLoggedIn) return;

    Promise.all([
      getAllSessions().catch(() => []),
      getLiveSessions().catch(() => []),
      getMyStats().catch(() => null),
      getFavourites().catch(() => []),
    ]).then(([onlineData, liveData, heroStatsData, favouritesData]) => {
      setHeroStats(heroStatsData);
      setFavourites(Array.isArray(favouritesData) ? favouritesData.slice(-4).reverse() : []);
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
            {isLoggedIn === false ? (
              <GhostChart type="area" emptyMessage="Sign in to track your bankroll." />
            ) : (
              <CumulativeChart data={chartData} emptyMessage="Not enough session data yet - play more sessions or import hand histories." />
            )}
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
                          {/* profit is straight off the hand doc (raw units -
                              cents for USD/CAD), and hand docs have no
                              `currency` field - favouriting denormalizes the
                              parent session's currency as `sessionCurrency`
                              (see handRoute.js). Normalize before formatting,
                              same pattern netProfit30d below uses.
                              formatSignedMajorUnits already prepends its own
                              sign - no separate '+' here, or positive amounts
                              doubled up as "++$12.34". */}
                          {formatSignedMajorUnits(toMajorUnits(profit, hand.sessionCurrency), hand.sessionCurrency)}
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
            <button className="hp-btn-ghost hp-view-all" onClick={() => navigate('/history')}>
              All sessions <ArrowRight size={14} />
            </button>
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
                  <TableRow key={s._id} onClick={() => navigate('/history')}>
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