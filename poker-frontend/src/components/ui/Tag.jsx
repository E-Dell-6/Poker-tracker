import './Tag.css';

// A small label chip, styled after Notion's select tags: a compact rounded
// rectangle filled with a deep, muted version of the tag's colour, with
// light text and no border.
// - color: any CSS colour - player tags pass the one picked in TagMenu.jsx
//   (Person.tags is [{label, color}]). It's blended 40% into the darkest
//   surface, which keeps the label at 5.8:1 or better for every colour in
//   the picker.
// - variant: 'positive' | 'negative' | 'live' use the app's green or red
//   the same way (live also gets a dot); 'neutral', the default, is grey.
// - size: 'sm' (20px, default - tables, lists) or 'md' (24px - headers,
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
