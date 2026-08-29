import './Tabs.css';

// Segmented tab control, extracted from the `.pos-size-tab` pattern built
// earlier this session in PositionalStats.css/GroupedStats.jsx (both now
// import this instead of keeping their own copy). `options`: [{key, label}]
// or plain strings (used as both key and label).
export function Tabs({ options, active, onChange, className = '' }) {
  return (
    <div className={`ui-tabs ${className}`}>
      {options.map(opt => {
        const key = typeof opt === 'string' ? opt : opt.key;
        const label = typeof opt === 'string' ? opt : opt.label;
        const disabled = typeof opt === 'object' && opt.disabled;
        return (
          <button
            key={key}
            type="button"
            className={`ui-tab ${active === key ? 'active' : ''}`}
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
