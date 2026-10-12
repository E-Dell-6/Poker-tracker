import { Link } from "react-router-dom";
import { useState, useEffect, useRef, useCallback } from "react";
import { Check, AlertTriangle, User, Mail, Settings, LogOut, Loader2 } from "lucide-react";
import { Button } from "./ui/Button";
import { Tag } from "./ui/Tag";
import "./LoginButton.css";
import { getUserData } from "../api/user";
import { logout } from "../api/auth";
import { OtpInput } from "./OtpInput";
import { useEmailVerification } from "../hooks/useEmailVerification";

export function LoginButton() {
  const [userData, setUserData] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);

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
    // Escape closes it too, and hands focus back to the avatar button.
    const handleKeyDown = (e) => {
      if (e.key !== "Escape" || !dropdownOpen) return;
      closeDropdown();
      buttonRef.current?.focus();
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeDropdown, dropdownOpen]);

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
        <Link className="lb-button" to="/login">Log in</Link>
      </nav>
    );
  }

  const initial = userData.name.charAt(0).toUpperCase();

  return (
    <nav className="lb-nav" ref={dropdownRef}>
      <button
        ref={buttonRef}
        type="button"
        className="lb-button lb-button--user"
        onClick={handleButtonClick}
        aria-haspopup="true"
        aria-expanded={dropdownOpen}
      >
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
              {userData.isAccountVerified
                ? <Tag variant="positive"><Check size={12} aria-hidden="true" /> Verified</Tag>
                : <Tag color="var(--color-warning)"><AlertTriangle size={12} aria-hidden="true" /> Unverified</Tag>}
            </div>
          </div>

          <div className="lb-divider" />

          <Link className="lb-menu-item" to="/profile" onClick={closeDropdown}>
            <User size={16} aria-hidden="true" />
            Profile
          </Link>

          <Link className="lb-menu-item" to="/settings" onClick={closeDropdown}>
            <Settings size={16} aria-hidden="true" />
            Settings
          </Link>

          <div className="lb-divider" />

          {/* Verify email flow */}
          {!userData.isAccountVerified && (
            <>
              {verifyState === "idle" && (
                <button type="button" className="lb-menu-item lb-menu-item--verify" onClick={sendOtp}>
                  <Mail size={16} aria-hidden="true" />
                  Verify Email
                </button>
              )}

              {verifyState === "sending" && (
                <div className="lb-otp-status">
                  <Loader2 size={14} className="spin" aria-hidden="true" /> Sending code…
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
                  <Button variant="primary" size="sm" loading={verifyState === "verifying"} onClick={() => verify()}>
                    Confirm
                  </Button>
                </div>
              )}

              {verifyState === "done" && (
                <div className="lb-otp-done"><Check size={14} /> Email verified!</div>
              )}

              {otpError && verifyState === "idle" && (
                <p className="lb-otp-error lb-otp-error--standalone">{otpError}</p>
              )}

              <div className="lb-divider" />
            </>
          )}

          {/* Logout */}
          <button type="button" className="lb-menu-item lb-menu-item--logout" onClick={handleLogout}>
            <LogOut size={16} aria-hidden="true" />
            Log out
          </button>
        </div>
      )}
    </nav>
  );
}

export default LoginButton;
