import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './TopHeader.css';
import { Search, Star } from 'lucide-react';
import { Button } from './ui/Button';
import { LoginButton } from './LoginButton';
import { HandSearchMenu } from './HandSearchMenu';

// Page header: title/subtitle (per-page, via props) + a search box and a
// primary CTA button on the right. The search box opens HandSearchMenu's
// existing hand-search modal (controlled from here, no trigger button of
// its own) - same search History.jsx's toolbar already uses, just reachable
// from every page. The "/" key is a shortcut for it too, matching the kbd
// hint shown in the box (ignored while typing in a form field, so it
// doesn't hijack normal "/" characters).
export function TopHeader({ title, subtitle, ctaLabel, ctaIcon, onCta }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const isStarredPage = location.pathname === '/starred';

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key !== '/' || searchOpen) return;
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;
      e.preventDefault();
      setSearchOpen(true);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchOpen]);

  return (
    <>
      <header className="top-header">
        <div className="top-header-titles">
          <h1 className="top-header-title">{title}</h1>
          {subtitle && <p className="top-header-subtitle">{subtitle}</p>}
        </div>

        <div className="top-header-actions">
          <button type="button" className="top-header-search" onClick={() => setSearchOpen(true)} aria-label="Search hands">
            <Search size={16} className="top-header-search-icon" />
            <span className="top-header-search-placeholder">Search hands, players...</span>
            <kbd className="top-header-search-kbd">/</kbd>
          </button>

          <button
            type="button"
            className={`top-header-star-btn ${isStarredPage ? 'active' : ''}`}
            onClick={() => {
              if (isStarredPage) {
                // Return to wherever the star button was clicked *from*
                // (stashed as router state below) rather than a raw
                // navigate(-1) - reliable even if the Starred page's own tab
                // switching or a refresh sits between the two clicks.
                navigate(location.state?.from || '/dashboard');
              } else {
                navigate('/starred', { state: { from: location.pathname + location.search } });
              }
            }}
            title="Starred"
            aria-label="View starred hands, players, and sessions"
          >
            <Star size={16} fill={isStarredPage ? 'currentColor' : 'none'} />
          </button>

          {ctaLabel && (
            <Button variant="primary" icon={ctaIcon} iconSize={13} onClick={onCta}>
              {ctaLabel}
            </Button>
          )}

          <LoginButton />
        </div>
      </header>

      {/* Rendered outside <header> entirely, not as a flex item of either of
          its rows - as one it's an empty box even when closed (isControlled
          hides its own toggle button), which ate an extra flex `gap` and
          threw off the spacing around it. Its overlay/modal are
          full-viewport, so its position in the DOM doesn't matter. */}
      <HandSearchMenu
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onHandClick={(hand, session) => {
          setSearchOpen(false);
          navigate('/hand-replay', { state: { hand, session } });
        }}
      />
    </>
  );
}

export default TopHeader;
