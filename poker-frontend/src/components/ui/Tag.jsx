import './Tag.css';

// A small label chip: neutral grey, with an optional coloured dot in front.
// Colour lives only in the dot, so the text stays readable whatever colour
// a user picks for a player tag.
// - color: any CSS colour for the dot - player tags pass the colour picked
//   in TagMenu.jsx (Person.tags is [{label, color}]).
// - variant: 'positive' | 'negative' | 'live' draw a green or red dot for
//   things the app gives meaning to; 'neutral' (the default) has no dot.
// - size: 'sm' (22px, default - tables, lists) or 'md' (28px - headers,
//   like the player profile).
export function Tag({ label, color, variant = 'neutral', size = 'sm', children }) {
  const hasDot = Boolean(color) || variant !== 'neutral';
  return (
    <span className={`ui-tag ui-tag--${variant} ui-tag--${size}`}>
      {hasDot && (
        <span className="ui-tag-dot" style={color ? { background: color } : undefined} aria-hidden="true" />
      )}
      {children ?? label}
    </span>
  );
}

export default Tag;
