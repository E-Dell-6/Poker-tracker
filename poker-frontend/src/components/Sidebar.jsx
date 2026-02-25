import "./Sidebar.css";
import { Link, useLocation } from "react-router-dom";
import { useState } from "react";

const menuItems = [
  { icon: "⊞", label: "Dashboard", to: "/" },
  { icon: "≡", label: "History", to: "/history" },
  { icon: "◷", label: "Clock In", to: "/clock" },
  { icon: "◈", label: "Players", to: "/players" },
  { icon: "◎", label: "Study", to: "/study" },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>

      {/* Brand */}
      <div className="sidebar-brand">
        <span className="sidebar-brand-icon">♠</span>
        {!collapsed && <span className="sidebar-brand-name">PokerFlow</span>}
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <Link
            key={item.label}
            to={item.to}
            className={`sidebar-link ${location.pathname === item.to ? 'active' : ''}`}
            title={collapsed ? item.label : ''}
          >
            <span className="sidebar-icon">{item.icon}</span>
            {!collapsed && <span className="sidebar-label">{item.label}</span>}
          </Link>
        ))}
      </nav>

      {/* Collapse toggle at bottom */}
      <button
        className="collapse-btn"
        onClick={() => setCollapsed(!collapsed)}
        aria-label="Toggle sidebar"
      >
        {collapsed ? '›' : '‹'}
      </button>

    </aside>
  );
}
