import './control.css';
import './Input.css';

// Text input in the shared control box.
// - icon: a lucide component drawn inside the box, before the text.
// - trailing: any element after the text (a show-password toggle, a unit).
// - invalid: red border. Inside <Field error> this is set for you through
//   aria-invalid, and the message is linked for screen readers.
// - size: 'md' (44px, default) or 'sm' (36px, for toolbars).
// Everything else (value, onChange, type, ref...) goes to the <input>.
export function Input({
  icon: Icon,
  trailing,
  invalid = false,
  size = 'md',
  className = '',
  ...rest
}) {
  const isInvalid = invalid || rest['aria-invalid'] === true || rest['aria-invalid'] === 'true';
  const classes = [
    'ui-control',
    'ui-input',
    `ui-control--${size}`,
    isInvalid && 'is-invalid',
    rest.disabled && 'is-disabled',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      {Icon && <Icon size={16} className="ui-input-icon" aria-hidden="true" />}
      <input className="ui-control-native" {...rest} aria-invalid={isInvalid || undefined} />
      {trailing && <span className="ui-input-trailing">{trailing}</span>}
    </div>
  );
}

export default Input;
