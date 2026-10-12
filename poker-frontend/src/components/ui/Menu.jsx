import { createContext, useContext, useEffect, useRef } from 'react';
import './Menu.css';

const MenuContext = createContext({ close: () => {} });
const ITEM = '[role="menuitem"]:not(:disabled)';

// Dropdown menu anchored under its trigger. Put the trigger and the menu
// in a MenuAnchor and own `open` yourself:
//
//   <MenuAnchor>
//     <Button aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)}>
//       Import
//     </Button>
//     <Menu open={open} onClose={() => setOpen(false)} align="end">
//       <MenuItem icon={Upload} onSelect={upload}>Upload files</MenuItem>
//     </Menu>
//   </MenuAnchor>
//
// The first item takes focus on open. Arrow keys, Home and End move between
// items; Escape closes and returns focus to the trigger; Tab or a click
// outside the anchor closes; choosing an item calls its onSelect and closes.
export function MenuAnchor({ className = '', children }) {
  return <div className={`ui-menu-anchor ${className}`}>{children}</div>;
}

export function Menu({ open, onClose, align = 'start', className = '', 'aria-label': ariaLabel, children }) {
  const menuRef = useRef(null);
  const triggerRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return undefined;
    const menu = menuRef.current;
    const anchor = menu.closest('.ui-menu-anchor') ?? menu.parentElement;
    // Safari doesn't focus a button on click, so prefer the anchor's
    // aria-haspopup element over whatever happens to be focused.
    triggerRef.current = anchor.querySelector('[aria-haspopup]') ?? document.activeElement;
    menu.querySelector(ITEM)?.focus();

    const onPointerDown = (e) => {
      if (!anchor.contains(e.target)) onCloseRef.current();
    };
    // Capture phase, and stopped there: inside a Modal, Escape should close
    // only the menu, not the modal's own document listener too.
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onCloseRef.current();
      triggerRef.current?.focus();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open]);

  if (!open) return null;

  const close = () => {
    onCloseRef.current();
    triggerRef.current?.focus();
  };

  const moveFocus = (e) => {
    if (e.key === 'Tab') {
      onCloseRef.current();
      return;
    }
    const items = [...menuRef.current.querySelectorAll(ITEM)];
    if (items.length === 0) return;
    const i = items.indexOf(document.activeElement);
    const last = items.length - 1;
    const next = {
      ArrowDown: items[i < 0 || i === last ? 0 : i + 1],
      ArrowUp: items[i <= 0 ? last : i - 1],
      Home: items[0],
      End: items[last],
    }[e.key];
    if (!next) return;
    e.preventDefault();
    next.focus();
  };

  return (
    <MenuContext.Provider value={{ close }}>
      <div
        ref={menuRef}
        role="menu"
        aria-label={ariaLabel}
        className={`ui-menu ui-menu--${align} ${className}`}
        onKeyDown={moveFocus}
      >
        {children}
      </div>
    </MenuContext.Provider>
  );
}

// One menu entry: icon, label and an optional second line of description.
// `danger` colours it for destructive actions.
export function MenuItem({ icon: Icon, description, danger = false, onSelect, className = '', children, ...rest }) {
  const { close } = useContext(MenuContext);
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      className={`ui-menu-item ${danger ? 'ui-menu-item--danger' : ''} ${className}`}
      onClick={(e) => {
        onSelect?.(e);
        close();
      }}
      {...rest}
    >
      {Icon && <Icon size={16} className="ui-menu-item-icon" aria-hidden="true" />}
      <span className="ui-menu-item-text">
        <span className="ui-menu-item-label">{children}</span>
        {description && <span className="ui-menu-item-description">{description}</span>}
      </span>
    </button>
  );
}

export function MenuSeparator() {
  return <div role="separator" className="ui-menu-separator" />;
}

export default Menu;
