import { ChevronDown } from 'lucide-react';
import './control.css';
import './Select.css';

// Native <select> in the shared control box - the platform picker and its
// keyboard behaviour stay, only the closed state is restyled (with a
// chevron in place of the browser's arrow).
// - invalid / size: as for Input.
// Everything else (value, onChange, ref...) goes to the <select>; pass the
// <option>s as children.
export function Select({ invalid = false, size = 'md', className = '', children, ...rest }) {
  const isInvalid = invalid || rest['aria-invalid'] === true || rest['aria-invalid'] === 'true';
  const classes = [
    'ui-control',
    'ui-select',
    `ui-control--${size}`,
    isInvalid && 'is-invalid',
    rest.disabled && 'is-disabled',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      <select className="ui-control-native ui-select-native" {...rest} aria-invalid={isInvalid || undefined}>
        {children}
      </select>
      <ChevronDown size={16} className="ui-select-chevron" aria-hidden="true" />
    </div>
  );
}

export default Select;
