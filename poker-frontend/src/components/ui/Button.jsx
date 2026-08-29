import './Button.css';

// Consolidates the ~6 bespoke "-btn" classes that used to be redeclared per
// page (refresh-btn, sessions-toggle-btn, collapse-btn, etc) - same visual
// shape everywhere already, just duplicated. `variant`: 'primary' (orange
// filled, for the main CTA per page) or 'secondary' (outline, for
// lower-emphasis actions like Recompute/Refresh).
export function Button({ variant = 'secondary', icon: Icon, iconSize = 14, children, className = '', ...rest }) {
  return (
    <button className={`ui-btn ui-btn--${variant} ${className}`} {...rest}>
      {Icon && <Icon size={iconSize} />}
      {children}
    </button>
  );
}

export default Button;
