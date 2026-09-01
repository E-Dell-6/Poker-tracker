import "./Sidebar.css";
import { Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { LayoutDashboard, List, Users, BarChart2, Spade, ChevronLeft, ChevronRight, Clock } from "lucide-react";
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
    icon: BarChart2, label: "Study", to: "/study",
    subItems: [{ label: "Preflop", to: "/study/range-matrix" }]
  },
];

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
  const live = useActiveLiveSession();

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>

      {/* Brand */}
      <Link to="/dashboard" className="sidebar-brand">
        <Spade className="sidebar-brand-icon" size={20} fill="currentColor" />
        {!collapsed && <span className="sidebar-brand-name">PokerFlow</span>}
      </Link>

      {/* Nav */}
      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <div key={item.label}>
            <Link
              to={item.to}
              className={`sidebar-link ${location.pathname === item.to ? 'active' : ''}`}
              title={collapsed ? item.label : ''}
            >
              <item.icon className="sidebar-icon" size={18} />
              {!collapsed && <span className="sidebar-label">{item.label}</span>}
            </Link>
            {/* Contextual sub-nav: only shown while inside this section
                (e.g. Study's "Preflop"), and hidden when collapsed since
                there's no room to show sub-labels. */}
            {item.subItems && !collapsed && location.pathname.startsWith(item.to) && (
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
        ))}
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
