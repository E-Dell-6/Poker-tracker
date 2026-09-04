import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './TopHeader.css';
import { Search, SlidersHorizontal, Star } from 'lucide-react';
import { Button } from './ui/Button';
import { LoginButton } from './LoginButton';
import { HandSearchMenu } from './HandSearchMenu';

// Page header: title/subtitle (per-page, via props) + a search box and a
// primary CTA button on the right. Typing a query and hitting Enter goes to
// the /search results page (player-name or hand-notation results, decided
// there by parseHandQuery) - same search reachable from every page. The "/"
// key focuses the box (ignored while typing in a form field, so it doesn't
// hijack normal "/" characters). The pill-filter modal (HandSearchMenu) -
// also used inline on the History page toolbar - stays reachable here via
// its own small icon button next to the input.
//
// `ctaMenu` (optional) turns the CTA into a split-less dropdown trigger:
// pass [{ label, description, icon, onSelect }] and clicking the button
// opens a small menu anchored under it instead of firing onCta. That's what
// lets a single "Import hands" button offer both a file picker and a folder
// picker - one <input type="file"> can't do both (webkitdirectory makes it
// folders-only), so the choice has to be made before the picker opens.
export function TopHeader({ title, subtitle, ctaLabel, ctaIcon, onCta, ctaMenu }) {
  const [query, setQuery] = useState('');
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [ctaMenuOpen, setCtaMenuOpen] = useState(false);
  const inputRef = useRef(null);
  const ctaRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const isStarredPage = location.pathname === '/starred';

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key !== '/') return;
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close the CTA menu on an outside click or Escape. Bound only while
  // open so the listeners aren't live for every page that never uses it.
  useEffect(() => {
    if (!ctaMenuOpen) return;
    const handlePointerDown = (e) => {
      if (ctaRef.current?.contains(e.target)) return;
      setCtaMenuOpen(false);
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setCtaMenuOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [ctaMenuOpen]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    navigate(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <>
      <header className="top-header">
        <div className="top-header-titles">
          <h1 className="top-header-title">{title}</h1>
          {subtitle && <p className="top-header-subtitle">{subtitle}</p>}
        </div>

        <div className="top-header-actions">
          <form className="top-header-search" onSubmit={handleSearchSubmit} role="search">
            <Search size={16} className="top-header-search-icon" />
            <input
              ref={inputRef}
              type="text"
              className="top-header-search-input"
              placeholder="Search hands, players..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search hands or players"
            />
            <button
              type="button"
              className="top-header-search-filter-btn"
              onClick={() => setFilterMenuOpen(true)}
              title="Advanced hand filters"
              aria-label="Open advanced hand filters"
            >
              <SlidersHorizontal size={14} />
            </button>
          </form>

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
            <div className="top-header-cta" ref={ctaRef}>
              <Button
                variant="primary"
                icon={ctaIcon}
                iconSize={13}
                onClick={ctaMenu?.length ? () => setCtaMenuOpen((open) => !open) : onCta}
                aria-haspopup={ctaMenu?.length ? 'menu' : undefined}
                aria-expanded={ctaMenu?.length ? ctaMenuOpen : undefined}
              >
                {ctaLabel}
              </Button>

              {ctaMenu?.length > 0 && ctaMenuOpen && (
                <div className="top-header-cta-menu" role="menu">
                  {ctaMenu.map(({ label, description, icon: ItemIcon, onSelect }) => (
                    <button
                      key={label}
                      type="button"
                      role="menuitem"
                      className="top-header-cta-menu-item"
                      onClick={() => { setCtaMenuOpen(false); onSelect(); }}
                    >
                      {ItemIcon && <ItemIcon size={15} className="top-header-cta-menu-icon" />}
                      <span className="top-header-cta-menu-text">
                        <span className="top-header-cta-menu-label">{label}</span>
                        {description && (
                          <span className="top-header-cta-menu-desc">{description}</span>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
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
        open={filterMenuOpen}
        onOpenChange={setFilterMenuOpen}
        onHandClick={(hand, session) => {
          setFilterMenuOpen(false);
          navigate('/hand-replay', { state: { hand, session } });
        }}
      />
    </>
  );
}

export default TopHeader;
