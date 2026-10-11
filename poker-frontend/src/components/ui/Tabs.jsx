import './Tabs.css';

// A row of mutually exclusive filter buttons (time range, table size,
// street...). Each option is a toggle button with aria-pressed; the
// selected one also gets the `active` class.
// - variant: 'pill' (default - separate chips, the selected one filled with
//   the accent) or 'segmented' (one track, the selected segment raised).
// - size: 'md' (default) or 'sm' for tight toolbars.
// `options`: [{key, label, disabled}] or plain strings (used as both key
// and label).
export function Tabs({
  options,
  active,
  onChange,
  variant = 'pill',
  size = 'md',
  className = '',
  'aria-label': ariaLabel,
}) {
  return (
    <div
      className={`ui-tabs ui-tabs--${variant} ui-tabs--${size} ${className}`}
      role="group"
      aria-label={ariaLabel}
    >
      {options.map(opt => {
        const key = typeof opt === 'string' ? opt : opt.key;
        const label = typeof opt === 'string' ? opt : opt.label;
        const disabled = typeof opt === 'object' && opt.disabled;
        const selected = active === key;
        return (
          <button
            key={key}
            type="button"
            className={`ui-tab ${selected ? 'active' : ''}`}
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => onChange(key)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export default Tabs;
