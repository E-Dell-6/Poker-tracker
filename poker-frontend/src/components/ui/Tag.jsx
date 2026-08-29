import './Tag.css';

// Two modes:
//  - `variant` (preset semantic pill - 'positive'|'negative'|'live'|'neutral')
//    for things this app controls the meaning of (a LIVE badge, a won/lost
//    indicator).
//  - `color` (arbitrary hex) for player tags, matching TagMenu.jsx's
//    existing free-color tagging model (Person.tags is [{label, color}],
//    the user picks any color when creating a tag - there's no fixed
//    Fish/Reg/Maniac/Nit enum on the backend, those are just example
//    labels a user assigned themselves).
export function Tag({ label, color, variant, children }) {
  if (color) {
    return (
      <span
        className="ui-tag"
        style={{ color, borderColor: color, background: `color-mix(in srgb, ${color} 16%, transparent)` }}
      >
        {children ?? label}
      </span>
    );
  }
  return <span className={`ui-tag ui-tag--${variant || 'neutral'}`}>{children ?? label}</span>;
}

export default Tag;
