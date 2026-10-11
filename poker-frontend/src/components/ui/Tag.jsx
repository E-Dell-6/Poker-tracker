import './Tag.css';

// A small label chip.
// - color: any CSS colour - player tags pass the one picked in TagMenu.jsx
//   (Person.tags is [{label, color}]). The chip gets a faint wash of it and
//   the text a lighter shade of it, which keeps every colour in the picker
//   at 5:1 or better.
// - variant: 'positive' | 'negative' | 'live' colour the chip the same way
//   with the app's green or red (live also gets a dot); 'neutral', the
//   default, is a plain grey chip.
// - size: 'sm' (22px, default - tables, lists) or 'md' (28px - headers,
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
