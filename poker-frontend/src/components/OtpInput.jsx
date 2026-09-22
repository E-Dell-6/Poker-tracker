import { useRef } from "react";
import "./OtpInput.css";

// A controlled row of single-character boxes for an emailed OTP. Extracted
// from LoginButton's dropdown so the Settings page renders the same input
// rather than a second copy of the focus/paste handling, which is the part
// most likely to drift.
//
// `value` is an array of single characters, one per box - not a string, so
// the caller can hold a partially-filled code without ambiguity about which
// box an empty slot belongs to.
export function OtpInput({ value, onChange, onComplete, disabled = false, hasError = false, length = 6 }) {
  const refs = useRef([]);

  const handleChange = (index, next) => {
    // Reject anything that isn't a single digit rather than truncating, so a
    // pasted letter can't silently land as an empty box.
    if (!/^\d?$/.test(next)) return;
    const digits = [...value];
    digits[index] = next;
    onChange(digits);
    if (next && index < length - 1) refs.current[index + 1]?.focus();
    if (next && index === length - 1) {
      const code = digits.join("");
      if (code.length === length) onComplete?.(code);
    }
  };

  // Backspace in an already-empty box steps back, so holding it clears the
  // whole code instead of stalling on the first empty one.
  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !value[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  // People paste the code out of the email far more often than they type it.
  // Strips non-digits first, so "123 456" and "Code: 123456" both work.
  const handlePaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!text) return;
    const digits = Array.from({ length }, (_, i) => text[i] ?? "");
    onChange(digits);
    const lastFilled = Math.min(text.length, length) - 1;
    refs.current[lastFilled]?.focus();
    if (text.length === length) onComplete?.(text);
  };

  return (
    <div className="otp-inputs" onPaste={handlePaste}>
      {Array.from({ length }, (_, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          className={`otp-input ${hasError ? "otp-input--error" : ""}`}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          aria-label={`Digit ${i + 1} of ${length}`}
          value={value[i] ?? ""}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          disabled={disabled}
        />
      ))}
    </div>
  );
}

export default OtpInput;
