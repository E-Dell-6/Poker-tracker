import "./Sidebar.css";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { LayoutDashboard, List, Users, BarChart2, Spade, ChevronLeft, ChevronRight, Clock, Star, User, Settings } from "lucide-react";
import { useLiveSession } from "../context/LiveSessionContext";

// Replayer is deliberately NOT a sidebar item - it's a full-screen,
// distraction-free view (see HandReplayer.jsx/HandReplayer.css), matching
// its mockup, which shows no sidebar at all, just a top-left Exit button.
// A sidebar link into a page with no sidebar shell would be inconsistent -
// hands are opened into it from History/Dashboard/etc instead.
const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", to: "/dashboard" },
  { icon: Clock, label: "Clock In", to: "/clock" },
  { icon: List, label: "History", to: "/history" },
  { icon: Users, label: "Players", to: "/players" },
  {
    icon: BarChart2, label: "Study", to: "/study", matchPrefix: "/study",
    subItems: [
      { label: "Hands", to: "/study/hands" },
      { label: "Preflop", to: "/study/range-matrix" },
      { label: "Flop", to: "/study/flop" },
    ]
  },
];

// The `from` value below is router state this app set itself, but it's
// built out of location.pathname - which an attacker influences by sending
// someone a crafted URL on this domain. "//evil.com" (or "/\evil.com",
// which browsers normalize to the same thing) reads as a protocol-relative
// URL, so navigating to it leaves the site entirely. Accept only a path
// beginning with exactly one slash.
function safeInternalPath(path, fallback = '/dashboard') {
  return typeof path === 'string' && /^\/(?![/\\])/.test(path) ? path : fallback;
}

function formatElapsed(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
}

// Reads the active clocked-in live session from LiveSessionContext (shared
// with Clock.jsx, which calls setActiveSession() straight after a
// clock-in/clock-out) - the sidebar just needs to know whether one's
// running and since when, not the full clock-in/buy-in form state.
function useActiveLiveSession() {
  const { activeSession } = useLiveSession();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!activeSession) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [activeSession]);

  if (!activeSession) return null;
  return {
    stakes: `$${activeSession.smallBlind}/$${activeSession.bigBlind}`,
    elapsedMs: now - new Date(activeSession.clockInTime).getTime()
  };
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const live = useActiveLiveSession();
  const isStarredPage = location.pathname === '/starred';

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>

      {/* Brand */}
      <Link to="/dashboard" className="sidebar-brand">
        <Spade className="sidebar-brand-icon" size={20} fill="currentColor" />
        {!collapsed && <span className="sidebar-brand-name">PokerFlow</span>}
      </Link>

      {/* Nav */}
      <nav className="sidebar-nav">
        {menuItems.map((item) => {
          // Sections with subpages (e.g. Study, now /study/hands|range-matrix|
          // flop) match by prefix, since their own `to` only ever names ONE
          // of the subpages - strict equality would leave the parent
          // permanently unhighlighted whenever a sibling subpage is active.
          // Everything else keeps exact matching, unchanged.
          const sectionPath = item.matchPrefix ?? item.to;
          const parentActive = item.matchPrefix
            ? location.pathname.startsWith(item.matchPrefix)
            : location.pathname === item.to;

          return (
            <div key={item.label}>
              <Link
                to={item.to}
                className={`sidebar-link ${parentActive ? 'active' : ''}`}
                title={collapsed ? item.label : ''}
              >
                <item.icon className="sidebar-icon" size={18} />
                {!collapsed && <span className="sidebar-label">{item.label}</span>}
              </Link>
              {/* Contextual sub-nav: only shown while inside this section
                  (e.g. Study's "Preflop"), and hidden when collapsed since
                  there's no room to show sub-labels. */}
              {item.subItems && !collapsed && location.pathname.startsWith(sectionPath) && (
                <div className="sidebar-subnav">
                  {item.subItems.map(sub => (
                    <Link
                      key={sub.to}
                      to={sub.to}
                      className={`sidebar-sublink ${location.pathname === sub.to ? 'active' : ''}`}
                    >
                      {sub.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Live session widget - only rendered when one is actually active */}
      {live && (
        <div className="sidebar-live">
          {!collapsed && <div className="sidebar-live-heading">Live</div>}
          <div className="sidebar-live-card" title={collapsed ? `Live: ${live.stakes}` : ''}>
            <Clock size={16} className="sidebar-live-icon" />
            {!collapsed && (
              <div className="sidebar-live-info">
                <div className="sidebar-live-stakes">{live.stakes}</div>
                <div className="sidebar-live-timer">{formatElapsed(live.elapsedMs)}</div>
              </div>
            )}
            <span className="sidebar-live-dot" aria-hidden="true" />
          </div>
        </div>
      )}

      {/* Account row: profile, starred, settings. Settings is a
          placeholder - there's no settings page yet. */}
      <div className="sidebar-footer">
        <Link
          to="/profile"
          className={`sidebar-footer-btn ${location.pathname === '/profile' ? 'active' : ''}`}
          title="Profile"
          aria-label="Profile"
        >
          <User size={16} />
        </Link>

        <button
          type="button"
          className={`sidebar-footer-btn ${isStarredPage ? 'active' : ''}`}
          onClick={() => {
            if (isStarredPage) {
              // Return to wherever the star button was clicked *from*
              // (stashed as router state below) rather than a raw
              // navigate(-1) - reliable even if the Starred page's own tab
              // switching or a refresh sits between the two clicks.
              navigate(safeInternalPath(location.state?.from));
            } else {
              navigate('/starred', { state: { from: location.pathname + location.search } });
            }
          }}
          title="Starred"
          aria-label="View starred hands, players, and sessions"
        >
          <Star size={16} fill={isStarredPage ? 'currentColor' : 'none'} />
        </button>

        <button
          type="button"
          className="sidebar-footer-btn"
          title="Settings"
          aria-label="Settings"
        >
          <Settings size={16} />
        </button>
      </div>

      {/* Collapse toggle at bottom */}
      <button
        className="collapse-btn"
        onClick={() => setCollapsed(!collapsed)}
        aria-label="Toggle sidebar"
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

    </aside>
  );
}

export default Sidebar;
