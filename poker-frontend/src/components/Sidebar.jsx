import "./Sidebar.css";
import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { LayoutDashboard, List, Clock, Users, BarChart2, Spade, ChevronLeft, ChevronRight } from "lucide-react";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", to: "/" },
  { icon: List, label: "History", to: "/history" },
  { icon: Clock, label: "Clock In", to: "/clock" },
  { icon: Users, label: "Players", to: "/players" },
  { icon: BarChart2, label: "Study", to: "/study" },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>

      {/* Brand */}
      <div className="sidebar-brand">
        <Spade className="sidebar-brand-icon" size={20} fill="currentColor" />
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
            <item.icon className="sidebar-icon" size={18} />
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
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

    </aside>
  );
}
