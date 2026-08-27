import { Layout } from "../../components/Layout";
import { useState, useEffect, useMemo } from "react";
import "./Profile.css";
import { API_URL } from "../../config";
import { toMajorUnits } from "../../utils/formatMoney";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

const TIME_FILTERS = [
  { label: "30D",       value: 30   },
  { label: "90D",       value: 90   },
  { label: "365D",      value: 365  },
  { label: "All Time",  value: null },
];

const SOURCE_FILTERS = [
  { label: "All",    value: "all"    },
  { label: "Online", value: "online" },
  { label: "Live",   value: "live"   },
];

/* ─── helpers ──────────────────────────────────────────── */
function fmt$(n) {
  if (n == null) return "—";
  const abs = Math.abs(n);
  const s = abs >= 1000
    ? `$${(abs / 1000).toFixed(1)}k`
    : `$${abs.toFixed(0)}`;
  return n < 0 ? `-${s}` : s;
}

function fmtFull$(n) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0,
  }).format(n);
}

function fmtDuration(ms) {
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// An online Session's totalProfit is stored in whatever unit its currency
// uses (integer cents for USD/CAD, plain units for CHIPS) - see
// ACRPokerParser.js and formatMoney.js's CURRENCY_META. Live sessions have
// no `currency` field and are entered by the user directly in dollars, so
// they're already in major units and pass through toMajorUnits unchanged
// (CHIPS-style fallback = identity). This does NOT convert USD<->CAD; it
// only fixes cents-vs-major-unit scaling so real-money online sessions
// stop being counted ~100x too large.
function onlineSessionProfit(session) {
  return toMajorUnits(session.totalProfit ?? 0, session.currency);
}

/* ─── Recharts tooltip ─────────────────────────────────── */
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const { cumulative, profit } = payload[0].payload;

  return (
    <div className="chart-tooltip" style={{ position: "static" }}>
      <div className="tt-date">{label}</div>
      <div className={`tt-val ${cumulative >= 0 ? "pos" : "neg"}`}>
        {cumulative >= 0 ? "+" : ""}{fmtFull$(cumulative)}
      </div>
      <div className="tt-session">
        {profit >= 0 ? "▲" : "▼"} {fmtFull$(Math.abs(profit))} this session
      </div>
    </div>
  );
}

/* ─── Recharts-powered cumulative profit chart ─────────── */
function ProfitChart({ data }) {
  if (data.length < 2) {
    return (
      <div className="chart-empty">
        Not enough data — play more sessions!
      </div>
    );
  }

  const isUp = data[data.length - 1].cumulative >= 0;
  const stroke = isUp ? "#22c55e" : "#ef4444";
  const fillId = isUp ? "fillGreen" : "fillRed";

  return (
    <div className="chart-svg-wrap">
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="fillGreen" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="fillRed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
            </linearGradient>
          </defs>

          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "#6b7280" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={fmt$}
            tick={{ fontSize: 10, fill: "#6b7280" }}
            axisLine={false}
            tickLine={false}
            width={56}
          />

          <ReferenceLine y={0} stroke="rgba(255,255,255,0.18)" strokeDasharray="5 4" />

          <Tooltip
            content={<CustomTooltip />}
            cursor={{ stroke: "rgba(255,255,255,0.18)", strokeDasharray: "4 3" }}
          />

          <Area
            type="monotone"
            dataKey="cumulative"
            stroke={stroke}
            strokeWidth={2.2}
            fill={`url(#${fillId})`}
            dot={false}
            activeDot={{ r: 5, fill: stroke, stroke: "#0d0f12", strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ─── main page ─────────────────────────────────────────── */
export function Profile() {
  const [user, setUser]             = useState(null);
  const [onlineSessions, setOnline] = useState([]);
  const [liveSessions,   setLive]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [timeFilter,   setTime]     = useState(null);
  const [sourceFilter, setSource]   = useState("all");

  useEffect(() => {
    (async () => {
      try {
        const [uRes, oRes, lRes] = await Promise.all([
          fetch(`${API_URL}/api/user/data`,      { credentials: "include" }),
          fetch(`${API_URL}/api/sessions`,       { credentials: "include" }),
          fetch(`${API_URL}/api/live-sessions`,  { credentials: "include" }),
        ]);
        const [uData, oData, lData] = await Promise.all([
          uRes.json(), oRes.json(), lRes.json(),
        ]);
        if (uData?.userData) setUser(uData.userData);
        setOnline(Array.isArray(oData) ? oData : []);
        setLive(Array.isArray(lData)   ? lData  : []);
      } catch (e) {
        console.error("Profile fetch:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const cutoff = useMemo(() => {
    if (!timeFilter) return null;
    const d = new Date();
    d.setDate(d.getDate() - timeFilter);
    return d;
  }, [timeFilter]);

  const fOnline = useMemo(() =>
    onlineSessions.filter(s => !cutoff || new Date(s.date) >= cutoff),
    [onlineSessions, cutoff]);

  const fLive = useMemo(() =>
    liveSessions.filter(s => !cutoff || new Date(s.date) >= cutoff),
    [liveSessions, cutoff]);

  /* cumulative chart data */
  const chartData = useMemo(() => {
    const pts = [];
    if (sourceFilter !== "live")
      fOnline.forEach(s => pts.push({ date: new Date(s.date), profit: onlineSessionProfit(s) }));
    if (sourceFilter !== "online")
      fLive.forEach(s => pts.push({ date: new Date(s.clockOutTime ?? s.date), profit: s.totalProfit ?? 0 }));
    pts.sort((a, b) => a.date - b.date);
    let cum = 0;
    return pts.map(p => {
      cum += p.profit;
      return { label: fmtDate(p.date), profit: p.profit, cumulative: cum };
    });
  }, [fOnline, fLive, sourceFilter]);

  /* summary stats */
  const stats = useMemo(() => {
    const ol = sourceFilter !== "live"   ? fOnline : [];
    const lv = sourceFilter !== "online" ? fLive   : [];
    const allProfits = [...ol.map(onlineSessionProfit), ...lv.map(x => x.totalProfit ?? 0)];
    const totalProfit = allProfits.reduce((s, v) => s + v, 0);
    const wins        = allProfits.filter(p => p > 0).length;
    const liveMs      = lv.reduce((s, x) =>
      s + (x.clockInTime && x.clockOutTime
        ? new Date(x.clockOutTime) - new Date(x.clockInTime) : 0), 0);

    return {
      totalProfit,
      totalSessions: ol.length + lv.length,
      // Session list responses no longer include the full `hands` array
      // (see GET /api/sessions) - use the precomputed per-session count.
      onlineHands:   ol.reduce((s, x) => s + (x.totalHands ?? x.hands?.length ?? 0), 0),
      liveSessions:  lv.length,
      liveMs,
      liveProfit:    lv.reduce((s, x) => s + (x.totalProfit ?? 0), 0),
      avgLiveMs:     lv.length ? liveMs / lv.length : 0,
      best:          allProfits.length ? Math.max(...allProfits) : null,
      worst:         allProfits.length ? Math.min(...allProfits) : null,
      winRate:       allProfits.length ? Math.round((wins / allProfits.length) * 100) : null,
    };
  }, [fOnline, fLive, sourceFilter]);

  if (loading) return (
    <Layout>
      <div className="profile-loading"><div className="profile-spinner" /></div>
    </Layout>
  );

  const isUp = stats.totalProfit >= 0;

  return (
    <Layout>
      <div className="profile-page">

        {/* ── HERO ── */}
        <div className="profile-hero">
          <div className="profile-avatar">
            {user?.image
              ? <img src={`${API_URL}${user.image}`} alt={user.name} />
              : <span>{user?.name?.charAt(0).toUpperCase() ?? "?"}</span>
            }
          </div>
          <div className="profile-hero-info">
            <h1 className="profile-name">{user?.name ?? "Player"}</h1>
            <div className="profile-badges">
              <span className="badge">{stats.totalSessions} sessions</span>
              {stats.onlineHands > 0 && <span className="badge">{stats.onlineHands.toLocaleString()} online hands</span>}
              {stats.liveMs > 0      && <span className="badge">⏱ {fmtDuration(stats.liveMs)} live</span>}
            </div>
          </div>
          <div className={`hero-pnl ${isUp ? "pos" : "neg"}`}>
            <div className="hero-pnl-label">Total P&L</div>
            <div className="hero-pnl-value">{isUp ? "+" : ""}{fmtFull$(stats.totalProfit)}</div>
          </div>
        </div>

        {/* ── FILTERS ── */}
        <div className="profile-filters">
          <div className="seg-group">
            {TIME_FILTERS.map(f => (
              <button key={f.label}
                className={`seg-btn ${timeFilter === f.value ? "active" : ""}`}
                onClick={() => setTime(f.value)}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="seg-group">
            {SOURCE_FILTERS.map(f => (
              <button key={f.label}
                className={`seg-btn ${sourceFilter === f.value ? "active" : ""}`}
                onClick={() => setSource(f.value)}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── STAT CARDS ── */}
        <div className="profile-stats-grid">
          {[
            { label: "Win Rate",     val: stats.winRate != null ? `${stats.winRate}%` : "—" },
            { label: "Best Session", val: stats.best  != null  ? `+${fmtFull$(stats.best)}`  : "—", cls: "pos" },
            { label: "Worst Session",val: stats.worst != null  ? fmtFull$(stats.worst) : "—", cls: "neg" },
            ...(sourceFilter !== "live"   ? [{ label: "Online Hands",    val: stats.onlineHands.toLocaleString() }] : []),
            ...(sourceFilter !== "online" && stats.liveMs > 0 ? [{ label: "Live Time", val: fmtDuration(stats.liveMs) }] : []),
            { label: "Sessions",     val: stats.totalSessions },
          ].map(({ label, val, cls }) => (
            <div className="pstat" key={label}>
              <div className="pstat-label">{label}</div>
              <div className={`pstat-value ${cls ?? ""}`}>{val}</div>
            </div>
          ))}
        </div>

        {/* ── CHART ── */}
        <div className="profile-chart-card">
          <div className="chart-header">
            <div>
              <div className="chart-title">Cumulative Profit</div>
              <div className="chart-sub">{chartData.length} sessions plotted</div>
            </div>
            <div className={`chart-total ${isUp ? "pos" : "neg"}`}>
              {isUp ? "+" : ""}{fmtFull$(stats.totalProfit)}
            </div>
          </div>
          <ProfitChart data={chartData} />
        </div>

        {/* ── LIVE BREAKDOWN ── */}
        {sourceFilter !== "online" && stats.liveSessions > 0 && (
          <div className="profile-live-card">
            <div className="live-title">⏱ Live Session Breakdown</div>
            <div className="live-grid">
              {[
                { label: "Sessions",      val: stats.liveSessions },
                { label: "Total Time",    val: fmtDuration(stats.liveMs) },
                { label: "Avg Session",   val: fmtDuration(stats.avgLiveMs) },
                { label: "Live P&L",      val: fmtFull$(stats.liveProfit), cls: stats.liveProfit >= 0 ? "pos" : "neg" },
              ].map(({ label, val, cls }) => (
                <div className="live-stat" key={label}>
                  <div className="live-stat-label">{label}</div>
                  <div className={`live-stat-value ${cls ?? ""}`}>{val}</div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}