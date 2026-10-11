import './Tag.css';

// A small label chip in the same visual language as the rest of the app:
// a pill like the filter tabs, with a faint tint and a hairline border in
// the tag's colour - the same 14% / 40% strengths as the accent's -dim and
// -border tokens.
// - color: any CSS colour - player tags pass the one picked in TagMenu.jsx
//   (Person.tags is [{label, color}]). The text is a lighter shade of it,
//   readable at 4.8:1 or better for every colour in the picker, on any
//   surface a tag sits on.
// - variant: 'positive' | 'negative' | 'live' use the app's green or red
//   the same way (live also gets a dot); 'neutral', the default, is styled
//   like a secondary button.
// - size: 'sm' (22px, default - tables, lists) or 'md' (26px - headers,
//   like the player profile).
export function Tag({ label, color, variant = 'neutral', size = 'sm', children }) {
  const tone = color ? 'colored' : variant;
  return (
    <span
      className={`ui-tag ui-tag--${tone} ui-tag--${size}`}
      style={color ? { '--tag-color': color } : undefined}
    >
      {tone === 'live' && <span className="ui-tag-dot" aria-hidden="true" />}
      {children ?? label}
    </span>
  );
}

export default Tag;
