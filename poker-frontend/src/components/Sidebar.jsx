import "./Sidebar.css";
import { Link } from "react-router-dom";
import { useState } from "react";

const menuItems = [
  { icon: "🏠", label: "Dashboard", to: "/dashboard"},
  { icon: "📖", label: "Ledger", to: "/ledger" },
  { icon: "⏱️", label: "History", to: "/history" },
  { icon: "🃏", label: "Hands", to: "/hands" },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  const toggleCollapse = () => setCollapsed(!collapsed);
  const sidebarClass = `sidebar ${collapsed ? 'collapsed' : ''}`;

  return (
    <div className={sidebarClass}>
      <button className="collapse-btn" onClick={toggleCollapse}>
        {collapsed ? "➡️" : "⬅️"}
      </button>

      {menuItems.map((item) => (
        <div key={item.label} className="sidebar-item">
          <Link to={item.to} className="sidebar-link">
            <div className="sidebar-icon">{item.icon}</div>
            {!collapsed && <div className="sidebar-label">{item.label}</div>}
          </Link>
        </div>
      ))}
    </div>
  );
}
