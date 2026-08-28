import "./Header.css";
import { Link, useLocation } from "react-router-dom";
import { List, Clock, Users, BarChart2, Spade } from "lucide-react";
import { LoginButton } from "./LoginButton"

const menuItems = [
  { icon: List, label: "Hand History", to: "/history" },
  { icon: Clock, label: "Clock In", to: "/clock" },
  { icon: Users, label: "Players", to: "/players" },
  { icon: BarChart2, label: "Stats", to: "/stats" },
];

export function Header() {
  const location = useLocation();

  return (
    <header className="header">
      {/* Brand */}
      <Link to="/" className="header-brand">
        <Spade className="header-brand-icon" size={20} fill="currentColor" />
        <span className="header-brand-name">PokerFlow</span>
      </Link>

      {/* Nav */}
      <nav className="header-nav">
        {menuItems.map((item) => (
          <Link
            key={item.label}
            to={item.to}
            className={`header-link ${location.pathname === item.to ? "active" : ""}`}
          >
            <item.icon className="header-icon" size={18} />
            <span className="header-label">{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* Right slot */}
      <div className="header-actions">
        <LoginButton />
      </div>
    </header>
  );
}