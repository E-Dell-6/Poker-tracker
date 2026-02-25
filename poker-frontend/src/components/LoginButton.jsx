import { Link} from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import "./LoginButton.css";
import { API_URL } from "../config";

export function LoginButton() {
  const [userData, setUserData] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [verifyState, setVerifyState] = useState("idle");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [otpError, setOtpError] = useState("");

  const dropdownRef = useRef(null);
  const otpRefs = useRef([]);

  useEffect(() => {
    fetch(`${API_URL}/api/user/data`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (d.success) setUserData(d.userData); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        closeDropdown();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const closeDropdown = () => {
    setDropdownOpen(false);
    setVerifyState("idle");
    setOtp(["", "", "", "", "", ""]);
    setOtpError("");
  };

  const handleButtonClick = () => {
    if (userData) setDropdownOpen((o) => !o);
  };

  const handleLogout = async () => {
    await fetch(`${API_URL}/api/auth/logout`, { method: "POST", credentials: "include" });
    setUserData(null);
    closeDropdown();
    window.location.href = "/";
  };

  const handleSendOtp = async () => {
    setVerifyState("sending");
    setOtpError("");
    try {
      const res = await fetch(`${API_URL}/api/auth/send-verify-otp`, {
        method: "POST", credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        setVerifyState("otp");
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
      } else {
        setOtpError(data.message);
        setVerifyState("idle");
      }
    } catch {
      setOtpError("Something went wrong.");
      setVerifyState("idle");
    }
  };

  const handleOtpChange = (index, value) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...otp];
    next[index] = value;
    setOtp(next);
    setOtpError("");
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (text.length === 6) {
      setOtp(text.split(""));
      otpRefs.current[5]?.focus();
    }
    e.preventDefault();
  };

  const handleVerifyOtp = async () => {
    const code = otp.join("");
    if (code.length < 6) { setOtpError("Please enter all 6 digits."); return; }
    setVerifyState("verifying");
    setOtpError("");
    try {
      const res = await fetch(`${API_URL}/api/auth/verify-account`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp: code }),
      });
      const data = await res.json();
      if (data.success) {
        setVerifyState("done");
        setUserData((u) => ({ ...u, isAccountVerified: true }));
      } else {
        setOtpError(data.message);
        setVerifyState("otp");
      }
    } catch {
      setOtpError("Something went wrong.");
      setVerifyState("otp");
    }
  };

  if (!userData) {
    return (
      <nav className="lb-nav">
        <Link className="lb-button" to="/login">Login</Link>
      </nav>
    );
  }

  const initial = userData.name.charAt(0).toUpperCase();

  return (
    <nav className="lb-nav" ref={dropdownRef}>
      <button className="lb-button lb-button--user" onClick={handleButtonClick}>
        <span className="lb-avatar">{initial}</span>
        <span className="lb-name">{userData.name}</span>
        <span className={`lb-chevron ${dropdownOpen ? "lb-chevron--open" : ""}`}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      </button>

      {dropdownOpen && (
        <div className="lb-dropdown">
          {/* User info header */}
          <div className="lb-dropdown-header">
            <div className="lb-dropdown-avatar">{initial}</div>
            <div>
              <div className="lb-dropdown-name">{userData.name}</div>
              <div className={`lb-badge ${userData.isAccountVerified ? "lb-badge--verified" : "lb-badge--unverified"}`}>
                {userData.isAccountVerified ? "✓ Verified" : "⚠ Unverified"}
              </div>
            </div>
          </div>

          <div className="lb-divider" />

          {/* Profile link */}
          <Link
            className="lb-menu-item"
            to="/profile"
            onClick={closeDropdown}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            Profile
          </Link>

          <div className="lb-divider" />

          {/* Verify email flow */}
          {!userData.isAccountVerified && (
            <>
              {verifyState === "idle" && (
                <button className="lb-menu-item lb-menu-item--verify" onClick={handleSendOtp}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.5 19.79 19.79 0 0 1 1.61 5.18 2 2 0 0 1 3.58 3h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 10.9a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 17z"/>
                  </svg>
                  Verify Email
                </button>
              )}

              {verifyState === "sending" && (
                <div className="lb-otp-sending">
                  <span className="lb-spinner" /> Sending code…
                </div>
              )}

              {(verifyState === "otp" || verifyState === "verifying") && (
                <div className="lb-otp-section">
                  <p className="lb-otp-label">Enter the 6-digit code sent to your email</p>
                  <div className="lb-otp-inputs" onPaste={handleOtpPaste}>
                    {otp.map((digit, i) => (
                      <input
                        key={i}
                        ref={(el) => (otpRefs.current[i] = el)}
                        className={`lb-otp-input ${otpError ? "lb-otp-input--error" : ""}`}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(i, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(i, e)}
                        disabled={verifyState === "verifying"}
                      />
                    ))}
                  </div>
                  {otpError && <p className="lb-otp-error">{otpError}</p>}
                  <button
                    className="lb-confirm-btn"
                    onClick={handleVerifyOtp}
                    disabled={verifyState === "verifying"}
                  >
                    {verifyState === "verifying" ? <span className="lb-spinner" /> : "Confirm"}
                  </button>
                </div>
              )}

              {verifyState === "done" && (
                <div className="lb-otp-done">✓ Email verified!</div>
              )}

              {otpError && verifyState === "idle" && (
                <p className="lb-otp-error" style={{ padding: "0 14px 8px" }}>{otpError}</p>
              )}

              <div className="lb-divider" />
            </>
          )}

          {/* Logout */}
          <button className="lb-menu-item lb-menu-item--logout" onClick={handleLogout}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Log Out
          </button>
        </div>
      )}
    </nav>
  );
}

export default LoginButton;
