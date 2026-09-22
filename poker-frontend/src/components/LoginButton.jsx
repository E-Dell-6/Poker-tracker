import { Link } from "react-router-dom";
import { useState, useEffect, useRef, useCallback } from "react";
import { Check, AlertTriangle, User, Mail, Settings } from "lucide-react";
import "./LoginButton.css";
import { getUserData } from "../api/user";
import { logout } from "../api/auth";
import { OtpInput } from "./OtpInput";
import { useEmailVerification } from "../hooks/useEmailVerification";

export function LoginButton() {
  const [userData, setUserData] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const dropdownRef = useRef(null);

  // The OTP boxes and the send/verify state machine are shared with the
  // Settings page - see hooks/useEmailVerification.js.
  const {
    state: verifyState, otp, error: otpError, setOtp, sendOtp, verify, reset: resetVerify,
  } = useEmailVerification({
    onVerified: () => setUserData((u) => ({ ...u, isAccountVerified: true })),
  });

  useEffect(() => {
    getUserData()
      .then((d) => { if (d.success) setUserData(d.userData); })
      .catch(() => {});
  }, []);

  // Stable, because the outside-click effect below depends on it.
  const closeDropdown = useCallback(() => {
    setDropdownOpen(false);
    resetVerify();
  }, [resetVerify]);

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        closeDropdown();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [closeDropdown]);

  const handleButtonClick = () => {
    if (userData) setDropdownOpen((o) => !o);
  };

  const handleLogout = async () => {
    await logout();
    setUserData(null);
    closeDropdown();
    window.location.href = "/";
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
                {userData.isAccountVerified ? <><Check size={12} /> Verified</> : <><AlertTriangle size={12} /> Unverified</>}
              </div>
            </div>
          </div>

          <div className="lb-divider" />

          <Link className="lb-menu-item" to="/profile" onClick={closeDropdown}>
            <User size={14} />
            Profile
          </Link>

          <Link className="lb-menu-item" to="/settings" onClick={closeDropdown}>
            <Settings size={14} />
            Settings
          </Link>

          <div className="lb-divider" />

          {/* Verify email flow */}
          {!userData.isAccountVerified && (
            <>
              {verifyState === "idle" && (
                <button className="lb-menu-item lb-menu-item--verify" onClick={sendOtp}>
                  <Mail size={14} />
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
                  <OtpInput
                    value={otp}
                    onChange={setOtp}
                    onComplete={verify}
                    disabled={verifyState === "verifying"}
                    hasError={Boolean(otpError)}
                  />
                  {otpError && <p className="lb-otp-error">{otpError}</p>}
                  <button
                    className="lb-confirm-btn"
                    onClick={() => verify()}
                    disabled={verifyState === "verifying"}
                  >
                    {verifyState === "verifying" ? <span className="lb-spinner" /> : "Confirm"}
                  </button>
                </div>
              )}

              {verifyState === "done" && (
                <div className="lb-otp-done"><Check size={14} /> Email verified!</div>
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
