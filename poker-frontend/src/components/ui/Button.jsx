import { Loader2 } from 'lucide-react';
import './Button.css';

// The shared button.
// - variant: 'primary' (accent fill - the one main action on a screen),
//   'secondary' (neutral, the default), 'ghost' (text only) or 'danger'
//   (destructive actions).
// - size: 'sm' (32px), 'md' (40px, default) or 'lg' (48px).
// - icon: a lucide component drawn before the label. With no children the
//   button becomes a square icon button - give it an aria-label.
// - loading: disables the button and draws a spinner over the label. The
//   label stays in the layout (just invisible), so the width doesn't jump.
// Defaults to type="button"; pass type="submit" inside a form.
export function Button({
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  iconSize,
  loading = false,
  disabled,
  type = 'button',
  className = '',
  children,
  ...rest
}) {
  const glyph = iconSize ?? (size === 'sm' ? 14 : 16);
  const classes = [
    'ui-btn',
    `ui-btn--${variant}`,
    `ui-btn--${size}`,
    children == null && 'ui-btn--icon-only',
    loading && 'ui-btn--loading',
    className,
  ].filter(Boolean).join(' ');

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {Icon && <Icon size={glyph} aria-hidden="true" />}
      {children}
      {loading && (
        <span className="ui-btn-spinner" aria-hidden="true">
          <Loader2 size={glyph} className="spin" />
        </span>
      )}
    </button>
  );
}

export default Button;
