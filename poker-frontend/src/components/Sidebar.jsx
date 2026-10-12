import "./Sidebar.css";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { LayoutDashboard, List, Users, BarChart2, Spade, ChevronsLeft, ChevronsRight, Clock, Star, User, Settings, X } from "lucide-react";
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

// Collapsed or not is remembered per browser. Storage can be missing or
// throw (private mode, blocked site data) - the sidebar just starts
// expanded then.
const COLLAPSED_KEY = 'pf:sidebar-collapsed';

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

function saveCollapsed(collapsed) {
  try {
    localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0');
  } catch {
    // Not remembered - it still works for this page.
  }
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

// 232px, or 68px collapsed. Collapsed labels stay in the DOM - just
// visually hidden (see Sidebar.css) - so every link keeps its name for
// screen readers. Under 900px wide the sidebar is an off-canvas drawer
// instead: `mobileOpen` shows it, `onMobileClose` hides it (Layout owns the
// state; the header's menu button opens it).
export function Sidebar({ mobileOpen = false, onMobileClose }) {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const asideRef = useRef(null);
  const onMobileCloseRef = useRef(onMobileClose);
  const location = useLocation();
  const navigate = useNavigate();
  const live = useActiveLiveSession();
  const isStarredPage = location.pathname === '/starred';

  useEffect(() => {
    onMobileCloseRef.current = onMobileClose;
  });

  const closeMobile = () => onMobileCloseRef.current?.();

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    saveCollapsed(next);
  };

  // Drawer open: focus moves to its close button, Escape closes it, and
  // focus goes back to whatever opened it (the header's menu button).
  useEffect(() => {
    if (!mobileOpen) return undefined;
    const opener = document.activeElement;
    asideRef.current?.querySelector('.sidebar-close')?.focus();
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onMobileCloseRef.current?.();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, [mobileOpen]);

  // Tabbing out of the open drawer closes it, so focus never ends up
  // behind the scrim. (relatedTarget is null for a click on empty space
  // inside the drawer, which should leave it open.)
  const handleBlur = (e) => {
    if (mobileOpen && e.relatedTarget && !e.currentTarget.contains(e.relatedTarget)) closeMobile();
  };

  return (
    <>
      {mobileOpen && <div className="sidebar-scrim" aria-hidden="true" onClick={closeMobile} />}
      <aside
        id="app-sidebar"
        ref={asideRef}
        className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'is-mobile-open' : ''}`}
        onBlur={handleBlur}
      >
        <div className="sidebar-brand-row">
          <Link to="/dashboard" className="sidebar-brand" onClick={closeMobile}>
            <span className="sidebar-brand-mark" aria-hidden="true">
              <Spade size={16} fill="currentColor" />
            </span>
            <span className="sidebar-brand-name">Poker Flow</span>
          </Link>
          <button type="button" className="sidebar-close" onClick={closeMobile} aria-label="Close navigation">
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Main">
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
                  aria-current={location.pathname === item.to ? 'page' : undefined}
                  title={collapsed ? item.label : undefined}
                  onClick={closeMobile}
                >
                  <item.icon className="sidebar-icon" size={18} aria-hidden="true" />
                  <span className="sidebar-label">{item.label}</span>
                </Link>
                {/* Contextual sub-nav: only shown while inside this section
                    (e.g. Study's "Preflop"). Hidden by CSS while collapsed,
                    since there's no room for sub-labels. */}
                {item.subItems && location.pathname.startsWith(sectionPath) && (
                  <div className="sidebar-subnav">
                    {item.subItems.map(sub => (
                      <Link
                        key={sub.to}
                        to={sub.to}
                        className={`sidebar-sublink ${location.pathname === sub.to ? 'active' : ''}`}
                        aria-current={location.pathname === sub.to ? 'page' : undefined}
                        onClick={closeMobile}
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

        {/* Live session widget - only rendered when one is actually active.
            The card links to the clock, where the session is managed. */}
        {live && (
          <div className="sidebar-live">
            <div className="sidebar-live-heading">Live session</div>
            <Link
              to="/clock"
              className="sidebar-live-card"
              title={collapsed ? `Live: ${live.stakes}, ${formatElapsed(live.elapsedMs)}` : undefined}
              aria-label={`Live session, ${live.stakes}`}
              onClick={closeMobile}
            >
              <span className="sidebar-live-dot" aria-hidden="true" />
              <span className="sidebar-live-info">
                <span className="sidebar-live-stakes">{live.stakes}</span>
                <span className="sidebar-live-timer">{formatElapsed(live.elapsedMs)}</span>
              </span>
              <Clock size={16} className="sidebar-live-icon" aria-hidden="true" />
            </Link>
          </div>
        )}

        {/* Account row: profile, starred, settings - and the collapse toggle. */}
        <div className="sidebar-footer">
          <Link
            to="/profile"
            className={`sidebar-footer-btn ${location.pathname === '/profile' ? 'active' : ''}`}
            title="Profile"
            aria-label="Profile"
            onClick={closeMobile}
          >
            <User size={18} />
          </Link>

          <button
            type="button"
            className={`sidebar-footer-btn ${isStarredPage ? 'active' : ''}`}
            onClick={() => {
              closeMobile();
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
            <Star size={18} fill={isStarredPage ? 'currentColor' : 'none'} />
          </button>

          <Link
            to="/settings"
            className={`sidebar-footer-btn ${location.pathname === '/settings' ? 'active' : ''}`}
            title="Settings"
            aria-label="Settings"
            onClick={closeMobile}
          >
            <Settings size={18} />
          </Link>

          <button
            type="button"
            className="sidebar-footer-btn sidebar-collapse-btn"
            onClick={toggleCollapsed}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
          </button>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
