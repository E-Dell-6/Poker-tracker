import './Card.css';

// Surface for a group of content: surface-1, a 1px border, --radius-lg, no
// shadow at rest.
// - as: the element to render ('section', 'article', 'button', Link...).
// - padding: 'none' | 'sm' (16) | 'md' (20, default) | 'lg' (24).
// - interactive: hover raise + focus ring, for cards that are themselves a
//   link or button (pass `as` too, so it's reachable by keyboard).
export function Card({
  as = 'div',
  padding = 'md',
  interactive = false,
  className = '',
  children,
  ...rest
}) {
  const Component = as;
  const classes = [
    'ui-card',
    `ui-card--pad-${padding}`,
    interactive && 'ui-card--interactive',
    className,
  ].filter(Boolean).join(' ');

  return <Component className={classes} {...rest}>{children}</Component>;
}

// Title row for a Card: title + optional subtitle on the left, actions
// (buttons, tabs) on the right. `titleAs` sets the heading level - h2 by
// default, under the page's h1.
export function CardHeader({ title, subtitle, actions, titleAs = 'h2', className = '' }) {
  const Title = titleAs;
  return (
    <div className={`ui-card-header ${className}`}>
      <div className="ui-card-heading">
        {title && <Title className="ui-card-title">{title}</Title>}
        {subtitle && <p className="ui-card-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="ui-card-actions">{actions}</div>}
    </div>
  );
}

export default Card;
