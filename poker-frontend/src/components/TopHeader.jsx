import './TopHeader.css';
import { Search, Bell } from 'lucide-react';
import { Button } from './ui/Button';
import { LoginButton } from './LoginButton';

// Page header: title/subtitle (per-page, via props) + a search box, a
// notification bell, and a primary CTA button on the right. The search box
// is visual only (styled after HandSearchMenu.jsx's input, which stays
// where it is - a hand-specific filter panel on the History page, not a
// generic global search) and the bell has no real notification system
// behind it yet - both are intentionally inert, per plan.
export function TopHeader({ title, subtitle, ctaLabel, ctaIcon, onCta }) {
  return (
    <header className="top-header">
      <div className="top-header-titles">
        <h1 className="top-header-title">{title}</h1>
        {subtitle && <p className="top-header-subtitle">{subtitle}</p>}
      </div>

      <div className="top-header-actions">
        <div className="top-header-search">
          <Search size={16} className="top-header-search-icon" />
          <input type="text" placeholder="Search hands, players..." readOnly />
          <kbd className="top-header-search-kbd">/</kbd>
        </div>

        <button className="top-header-icon-btn" aria-label="Notifications" type="button">
          <Bell size={18} />
        </button>

        {ctaLabel && (
          <Button variant="primary" icon={ctaIcon} onClick={onCta}>
            {ctaLabel}
          </Button>
        )}

        <LoginButton />
      </div>
    </header>
  );
}

export default TopHeader;
