import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './TopHeader.css';
import { Menu as MenuIcon, Search, SlidersHorizontal } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Menu, MenuAnchor, MenuItem } from './ui/Menu';
import { LoginButton } from './LoginButton';
import { HandSearchMenu } from './HandSearchMenu';

// Page header: title/subtitle (per-page, via props) + a search box and a
// primary CTA button on the right. Typing a query and hitting Enter goes to
// the /search results page (player-name or hand-notation results, decided
// there by parseHandQuery) - same search reachable from every page. The "/"
// key focuses the box (ignored while typing in a form field, so it doesn't
// hijack normal "/" characters). The pill-filter modal (HandSearchMenu) -
// also used inline on the History page toolbar - stays reachable here via
// its own small icon button inside the box.
//
// `ctaMenu` (optional) turns the CTA into a dropdown trigger: pass
// [{ label, description, icon, onSelect }] and clicking the button opens a
// menu anchored under it instead of firing onCta. That's what lets a single
// "Import hands" button offer both a file picker and a folder picker - one
// <input type="file"> can't do both (webkitdirectory makes it folders-only),
// so the choice has to be made before the picker opens.
//
// At 900px and under, a menu button on the left opens the sidebar drawer
// (`onOpenNav`; Layout owns `navOpen`) and the search box is hidden.
export function TopHeader({ title, subtitle, ctaLabel, ctaIcon, onCta, ctaMenu, navOpen = false, onOpenNav }) {
  const [query, setQuery] = useState('');
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [ctaMenuOpen, setCtaMenuOpen] = useState(false);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const hasCtaMenu = ctaMenu?.length > 0;

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

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    navigate(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <>
      <header className="top-header">
        <div className="top-header-inner">
          <Button
            variant="ghost"
            icon={MenuIcon}
            iconSize={20}
            className="top-header-menu-btn"
            aria-label="Open navigation"
            aria-controls="app-sidebar"
            aria-expanded={navOpen}
            onClick={onOpenNav}
          />

          <div className="top-header-titles">
            <h1 className="top-header-title">{title}</h1>
            {subtitle && <p className="top-header-subtitle">{subtitle}</p>}
          </div>

          <div className="top-header-actions">
            <form className="top-header-search" onSubmit={handleSearchSubmit} role="search">
              <Input
                ref={inputRef}
                size="sm"
                icon={Search}
                placeholder="Search hands, players…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search hands or players"
                trailing={(
                  <>
                    {!query && <kbd className="top-header-kbd" aria-hidden="true">/</kbd>}
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={SlidersHorizontal}
                      title="Advanced hand filters"
                      aria-label="Open advanced hand filters"
                      onClick={() => setFilterMenuOpen(true)}
                    />
                  </>
                )}
              />
            </form>

            {ctaLabel && (hasCtaMenu ? (
              <MenuAnchor>
                <Button
                  variant="primary"
                  icon={ctaIcon}
                  className="top-header-cta"
                  aria-haspopup="menu"
                  aria-expanded={ctaMenuOpen}
                  onClick={() => setCtaMenuOpen((open) => !open)}
                >
                  {ctaLabel}
                </Button>
                <Menu open={ctaMenuOpen} onClose={() => setCtaMenuOpen(false)} align="end" aria-label={ctaLabel}>
                  {ctaMenu.map(({ label, description, icon, onSelect }) => (
                    <MenuItem key={label} icon={icon} description={description} onSelect={onSelect}>
                      {label}
                    </MenuItem>
                  ))}
                </Menu>
              </MenuAnchor>
            ) : (
              <Button variant="primary" icon={ctaIcon} className="top-header-cta" onClick={onCta}>
                {ctaLabel}
              </Button>
            ))}

            <LoginButton />
          </div>
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
