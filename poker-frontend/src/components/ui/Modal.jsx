import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from './Button';
import './Modal.css';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

// Open dialogs, most recent last. Only the top one reacts to Escape, so a
// modal opened from inside another closes on its own.
const openDialogs = [];

// Dialog rendered into <body>, above everything else (--z-modal).
// - The caller owns `open`; Escape, the scrim and the close button call
//   onClose. dismissible={false} turns all three off - use it while a save
//   is in flight.
// - Focus moves into the dialog on open (an element with data-autofocus,
//   else the first focusable control in the body or footer), Tab cycles
//   inside it, and focus goes back to whatever opened it on close.
// - size: 'sm' (400px), 'md' (520px, default) or 'lg' (720px).
// - footer: action buttons, right-aligned under the body.
export function Modal({
  open,
  onClose,
  title,
  description,
  footer,
  size = 'md',
  dismissible = true,
  className = '',
  children,
}) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const dismissibleRef = useRef(dismissible);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
    dismissibleRef.current = dismissible;
  });

  useEffect(() => {
    if (!open) return undefined;
    const dialog = dialogRef.current;
    const opener = document.activeElement;
    openDialogs.push(dialog);

    const initial =
      dialog.querySelector('[data-autofocus]') ??
      [...dialog.querySelectorAll(FOCUSABLE)].find((el) => !el.closest('.ui-modal-header')) ??
      dialog;
    initial.focus();

    const onKeyDown = (e) => {
      if (e.key !== 'Escape' || openDialogs[openDialogs.length - 1] !== dialog) return;
      if (dismissibleRef.current) onCloseRef.current();
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      openDialogs.splice(openDialogs.indexOf(dialog), 1);
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, [open]);

  if (!open) return null;

  // Keep Tab and Shift+Tab inside the dialog.
  const trapTab = (e) => {
    if (e.key !== 'Tab') return;
    const dialog = dialogRef.current;
    const items = [...dialog.querySelectorAll(FOCUSABLE)];
    if (items.length === 0) {
      e.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const current = document.activeElement;
    if (e.shiftKey && (current === first || current === dialog)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && current === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const hasHeader = title || description || dismissible;

  return createPortal(
    <div className="ui-modal-root">
      <div className="ui-modal-scrim" aria-hidden="true" onClick={() => dismissible && onClose()} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={`ui-modal ui-modal--${size} ${className}`}
        onKeyDown={trapTab}
      >
        {hasHeader && (
          <div className="ui-modal-header">
            <div className="ui-modal-heading">
              {title && <h2 id={titleId} className="ui-modal-title">{title}</h2>}
              {description && <p id={descriptionId} className="ui-modal-description">{description}</p>}
            </div>
            {dismissible && (
              <Button variant="ghost" size="sm" icon={X} aria-label="Close" className="ui-modal-close" onClick={onClose} />
            )}
          </div>
        )}
        <div className="ui-modal-body">{children}</div>
        {footer && <div className="ui-modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export default Modal;
