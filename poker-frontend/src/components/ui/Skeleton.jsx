import './Skeleton.css';

// One flexible shimmering block, not a library of shaped sub-components -
// callers size/shape it per use via className/style (width, height,
// border-radius) to match whatever real content it stands in for. Each
// page composes its own loading layout by dropping these into that page's
// own existing grid/card CSS classes, so the skeleton naturally lines up
// with the real content's positions instead of needing parallel layout CSS.
export function Skeleton({ className = '', style, ...rest }) {
  return <div className={`ui-skeleton ${className}`} style={style} {...rest} />;
}

export default Skeleton;
