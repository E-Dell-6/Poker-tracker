import { Children, cloneElement, useId } from 'react';
import './Field.css';

// Label + one control + a hint or an error, wired for screen readers: the
// label points at the control, the hint or error is linked through
// aria-describedby, and an error sets aria-invalid (an Input or Select
// turns its border red from that). An error replaces the hint.
//
//   <Field label="Email" hint="We never share it" error={errors.email}>
//     <Input type="email" value={email} onChange={...} />
//   </Field>
//
// - aside: an element shown at the end of the label row ("Forgot
//   password?").
// - id: the control's id; generated when omitted.
export function Field({ label, hint, error, aside, id, className = '', children }) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const message = error || hint;
  const messageId = `${controlId}-${error ? 'error' : 'hint'}`;
  const control = Children.only(children);

  return (
    <div className={`ui-field ${className}`}>
      {(label || aside) && (
        <div className="ui-field-label-row">
          {label && <label className="ui-field-label" htmlFor={controlId}>{label}</label>}
          {aside}
        </div>
      )}
      {cloneElement(control, {
        id: controlId,
        'aria-invalid': error ? true : control.props['aria-invalid'],
        'aria-describedby': message ? messageId : control.props['aria-describedby'],
      })}
      {message && (
        <p id={messageId} className={error ? 'ui-field-error' : 'ui-field-hint'}>
          {message}
        </p>
      )}
    </div>
  );
}

export default Field;
