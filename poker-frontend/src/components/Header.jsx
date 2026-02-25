import "./Header.css";
import { Link, useLocation } from "react-router-dom";
import { LoginButton } from "./LoginButton"

const menuItems = [
  { icon: "≡", label: "Hand History", to: "/history" },
  { icon: "◷", label: "Clock In", to: "/clock" },
  { icon: "◈", label: "Players", to: "/players" },
  { icon: "◎", label: "Stats", to: "/study" },
];

export function Header() {
  const location = useLocation();

  return (
    <header className="header">
      {/* Brand */}
      <Link to="/" className="header-brand">
        <span className="header-brand-icon">♠</span>
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
            <span className="header-icon">{item.icon}</span>
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