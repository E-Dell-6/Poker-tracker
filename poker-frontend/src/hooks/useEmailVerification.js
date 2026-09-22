import { useState, useCallback } from "react";
import { sendVerifyOtp, verifyAccount } from "../api/auth";

const EMPTY = ["", "", "", "", "", ""];

// The verify-your-email flow: request a code, enter it, confirm. Extracted
// from LoginButton so the Settings page runs the same state machine instead
// of a second copy - the flow is the genuinely duplicated part, more so than
// the input boxes it drives.
//
// States: idle -> sending -> otp -> verifying -> done
export function useEmailVerification({ onVerified } = {}) {
  const [state, setState] = useState("idle");
  const [otp, setOtp] = useState(EMPTY);
  const [error, setError] = useState("");

  const reset = useCallback(() => {
    setState("idle");
    setOtp(EMPTY);
    setError("");
  }, []);

  const sendOtp = useCallback(async () => {
    setState("sending");
    setError("");
    try {
      const data = await sendVerifyOtp();
      if (data.success) {
        setState("otp");
        return true;
      }
      setError(data.message);
      setState("idle");
      return false;
    } catch {
      setError("Something went wrong.");
      setState("idle");
      return false;
    }
  }, []);

  const verify = useCallback(async (code) => {
    const joined = code ?? otp.join("");
    if (joined.length < 6) {
      setError("Please enter all 6 digits.");
      return false;
    }
    setState("verifying");
    setError("");
    try {
      const data = await verifyAccount(joined);
      if (data.success) {
        setState("done");
        onVerified?.();
        return true;
      }
      setError(data.message);
      setState("otp");
      return false;
    } catch {
      setError("Something went wrong.");
      setState("otp");
      return false;
    }
  }, [otp, onVerified]);

  // Typing clears a stale error - leaving "Invalid otp" up while the user
  // corrects it reads as though the new code was rejected too.
  const changeOtp = useCallback((digits) => {
    setOtp(digits);
    setError("");
  }, []);

  return { state, otp, error, setOtp: changeOtp, sendOtp, verify, reset };
}
