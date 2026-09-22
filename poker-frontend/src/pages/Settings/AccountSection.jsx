import { useState, useEffect } from "react";
import { Check, AlertTriangle, Mail, User as UserIcon, Lock, Loader2 } from "lucide-react";
import { MIN_PASSWORD_LENGTH } from "../../config";
import { updateProfile, deleteAccount } from "../../api/user";
import { changePassword, logout } from "../../api/auth";
import { StorageCard } from "../../components/StorageCard";
import { OtpInput } from "../../components/OtpInput";
import { useEmailVerification } from "../../hooks/useEmailVerification";

export function AccountSection({ user, loading, storage, onUserChange }) {
  /* ── name ── */
  const [name, setName] = useState("");
  const [nameState, setNameState] = useState("idle"); // idle | saving | saved
  const [nameError, setNameError] = useState("");

  // The name arrives asynchronously, so the field is seeded when it lands
  // rather than from a useState initialiser that would run while it's null.
  useEffect(() => { setName(user?.name ?? ""); }, [user?.name]);

  const nameDirty = name.trim() !== (user?.name ?? "") && name.trim().length > 0;

  const saveName = async () => {
    setNameState("saving");
    setNameError("");
    try {
      const data = await updateProfile({ name: name.trim() });
      if (data.success) {
        onUserChange?.((u) => ({ ...u, name: data.name }));
        setNameState("saved");
      } else {
        setNameError(data.message);
        setNameState("idle");
      }
    } catch {
      setNameError("Something went wrong.");
      setNameState("idle");
    }
  };

  /* ── email verification (shared with LoginButton) ── */
  const {
    state: verifyState, otp, error: otpError, setOtp, sendOtp, verify,
  } = useEmailVerification({
    onVerified: () => onUserChange?.((u) => ({ ...u, isAccountVerified: true })),
  });

  /* ── password ── */
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwState, setPwState] = useState("idle"); // idle | saving | saved
  const [pwError, setPwError] = useState("");

  const submitPassword = async (e) => {
    e.preventDefault();
    setPwError("");
    // Checked here so the user isn't told the rule only after a round trip.
    // The server enforces the same minimum regardless.
    if (pw.next.length < MIN_PASSWORD_LENGTH) {
      setPwError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }
    if (pw.next !== pw.confirm) {
      setPwError("New passwords don't match");
      return;
    }
    setPwState("saving");
    try {
      const data = await changePassword({ currentPassword: pw.current, newPassword: pw.next });
      if (data.success) {
        setPw({ current: "", next: "", confirm: "" });
        setPwState("saved");
      } else {
        setPwError(data.message);
        setPwState("idle");
      }
    } catch {
      setPwError("Something went wrong.");
      setPwState("idle");
    }
  };

  /* ── danger zone ── */
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [del, setDel] = useState({ email: "", password: "" });
  const [delState, setDelState] = useState("idle");
  const [delError, setDelError] = useState("");

  // Friction, not security - the server re-verifies the password regardless.
  // Both fields must be right before the button is even usable.
  const canDelete =
    Boolean(user?.email) &&
    del.email.trim().toLowerCase() === user.email.toLowerCase() &&
    del.password.length > 0;

  const confirmDelete = async () => {
    setDelState("deleting");
    setDelError("");
    try {
      const data = await deleteAccount({ password: del.password });
      if (data.success) {
        window.location.href = "/login";
      } else {
        setDelError(data.message);
        setDelState("idle");
      }
    } catch {
      setDelError("Something went wrong.");
      setDelState("idle");
    }
  };

  const handleLogout = async () => {
    await logout();
    // Full reload rather than a router navigate: it clears every piece of
    // in-memory user state, the theme context included.
    window.location.href = "/";
  };

  if (loading) {
    return (
      <section className="settings-section" id="account">
        <h2 className="settings-section-title"><UserIcon size={17} /> Account</h2>
        <p className="settings-section-sub">Loading…</p>
      </section>
    );
  }

  return (
    <>
      <section className="settings-section" id="account">
        <h2 className="settings-section-title"><UserIcon size={17} /> Account</h2>
        <p className="settings-section-sub">Your profile and sign-in details.</p>

        {/* ── name ── */}
        <div className="settings-row">
          <div className="settings-row-info">
            <div className="settings-row-label">Display name</div>
            <input
              className="settings-input"
              value={name}
              maxLength={60}
              onChange={(e) => { setName(e.target.value); setNameState("idle"); setNameError(""); }}
              aria-label="Display name"
            />
            {nameError && <p className="settings-error">{nameError}</p>}
            {nameState === "saved" && !nameError && (
              <p className="settings-success"><Check size={12} /> Saved</p>
            )}
          </div>
          <div className="settings-row-control">
            <button
              className="settings-btn settings-btn--primary"
              onClick={saveName}
              disabled={!nameDirty || nameState === "saving"}
            >
              {nameState === "saving" ? <Loader2 size={14} className="spin" /> : "Save"}
            </button>
          </div>
        </div>

        {/* ── email ── */}
        <div className="settings-row">
          <div className="settings-row-info">
            <div className="settings-row-label">Email</div>
            <div className="settings-row-value">{user?.email ?? "—"}</div>
            <div className="settings-row-hint">
              Used for sign-in, verification and password resets.
            </div>
          </div>
          <div className="settings-row-control">
            {user?.isAccountVerified ? (
              <span className="settings-badge settings-badge--verified"><Check size={12} /> Verified</span>
            ) : (
              <span className="settings-badge settings-badge--unverified"><AlertTriangle size={12} /> Unverified</span>
            )}
          </div>
        </div>

        {/* ── verification flow ── */}
        {!user?.isAccountVerified && (
          <div className="settings-row">
            <div className="settings-row-info">
              {verifyState === "idle" && (
                <>
                  <div className="settings-row-label">Verify your email</div>
                  <div className="settings-row-hint">We'll send a 6-digit code to {user?.email}.</div>
                  {otpError && <p className="settings-error">{otpError}</p>}
                </>
              )}

              {verifyState === "sending" && (
                <div className="settings-row-value"><Loader2 size={14} className="spin" /> Sending code…</div>
              )}

              {(verifyState === "otp" || verifyState === "verifying") && (
                <>
                  <div className="settings-row-label">Enter the 6-digit code sent to your email</div>
                  <OtpInput
                    value={otp}
                    onChange={setOtp}
                    onComplete={verify}
                    disabled={verifyState === "verifying"}
                    hasError={Boolean(otpError)}
                  />
                  {otpError && <p className="settings-error">{otpError}</p>}
                </>
              )}

              {verifyState === "done" && (
                <p className="settings-success"><Check size={12} /> Email verified</p>
              )}
            </div>

            <div className="settings-row-control">
              {verifyState === "idle" && (
                <button className="settings-btn" onClick={sendOtp}>
                  <Mail size={13} /> Send code
                </button>
              )}
              {(verifyState === "otp" || verifyState === "verifying") && (
                <button
                  className="settings-btn settings-btn--primary"
                  onClick={() => verify()}
                  disabled={verifyState === "verifying"}
                >
                  {verifyState === "verifying" ? <Loader2 size={14} className="spin" /> : "Confirm"}
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ── security ── */}
      <section className="settings-section" id="security">
        <h2 className="settings-section-title"><Lock size={17} /> Security</h2>
        <p className="settings-section-sub">
          Changing your password signs out any other device holding an old session.
        </p>

        <form className="settings-form" onSubmit={submitPassword}>
          <div className="settings-field">
            <label className="settings-field-label" htmlFor="pw-current">Current password</label>
            <input
              id="pw-current" type="password" autoComplete="current-password"
              className="settings-input"
              value={pw.current}
              onChange={(e) => { setPw({ ...pw, current: e.target.value }); setPwState("idle"); setPwError(""); }}
            />
          </div>
          <div className="settings-field">
            <label className="settings-field-label" htmlFor="pw-next">
              New password (at least {MIN_PASSWORD_LENGTH} characters)
            </label>
            <input
              id="pw-next" type="password" autoComplete="new-password"
              className="settings-input"
              value={pw.next}
              onChange={(e) => { setPw({ ...pw, next: e.target.value }); setPwState("idle"); setPwError(""); }}
            />
          </div>
          <div className="settings-field">
            <label className="settings-field-label" htmlFor="pw-confirm">Confirm new password</label>
            <input
              id="pw-confirm" type="password" autoComplete="new-password"
              className="settings-input"
              value={pw.confirm}
              onChange={(e) => { setPw({ ...pw, confirm: e.target.value }); setPwState("idle"); setPwError(""); }}
            />
          </div>

          {pwError && <p className="settings-error">{pwError}</p>}
          {pwState === "saved" && !pwError && (
            <p className="settings-success"><Check size={12} /> Password updated</p>
          )}

          <button
            type="submit"
            className="settings-btn settings-btn--primary"
            style={{ marginTop: 8 }}
            disabled={pwState === "saving" || !pw.current || !pw.next || !pw.confirm}
          >
            {pwState === "saving" ? <Loader2 size={14} className="spin" /> : "Change password"}
          </button>
        </form>
      </section>

      {/* ── storage ── */}
      {/* Absolute account totals: how much of the import quota is spent. */}
      <StorageCard storage={storage} />

      {/* ── danger zone ── */}
      <section className="settings-section settings-section--danger">
        <h2 className="settings-section-title"><AlertTriangle size={17} /> Danger zone</h2>
        <p className="settings-section-sub">Sign out of this device, or remove your account entirely.</p>

        <div className="settings-row">
          <div className="settings-row-info">
            <div className="settings-row-label">Log out</div>
            <div className="settings-row-hint">Ends this session on this device.</div>
          </div>
          <div className="settings-row-control">
            <button className="settings-btn" onClick={handleLogout}>Log out</button>
          </div>
        </div>

        <div className="settings-row">
          <div className="settings-row-info">
            <div className="settings-row-label">Delete account</div>
            <div className="settings-row-hint">
              Permanently removes your sessions, hands, players, notes and share links.
            </div>
          </div>
          <div className="settings-row-control">
            {!confirmingDelete && (
              <button className="settings-btn settings-btn--danger" onClick={() => setConfirmingDelete(true)}>
                Delete account
              </button>
            )}
          </div>
        </div>

        {confirmingDelete && (
          <div className="settings-danger-panel">
            <p className="settings-danger-warning">
              <strong>This cannot be undone.</strong> Every session, hand, player, note and
              public share link on this account will be deleted. To confirm, type your email
              address and your password.
            </p>

            <div className="settings-field">
              <label className="settings-field-label" htmlFor="del-email">
                Type <strong>{user?.email}</strong> to confirm
              </label>
              <input
                id="del-email" type="text" autoComplete="off"
                className="settings-input"
                value={del.email}
                onChange={(e) => { setDel({ ...del, email: e.target.value }); setDelError(""); }}
              />
            </div>
            <div className="settings-field">
              <label className="settings-field-label" htmlFor="del-password">Password</label>
              <input
                id="del-password" type="password" autoComplete="current-password"
                className="settings-input"
                value={del.password}
                onChange={(e) => { setDel({ ...del, password: e.target.value }); setDelError(""); }}
              />
            </div>

            {delError && <p className="settings-error">{delError}</p>}

            <div className="settings-row-control" style={{ marginTop: 12 }}>
              <button
                className="settings-btn settings-btn--danger"
                onClick={confirmDelete}
                disabled={!canDelete || delState === "deleting"}
              >
                {delState === "deleting" ? <Loader2 size={14} className="spin" /> : "Permanently delete my account"}
              </button>
              <button
                className="settings-btn"
                onClick={() => { setConfirmingDelete(false); setDel({ email: "", password: "" }); setDelError(""); }}
                disabled={delState === "deleting"}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>
    </>
  );
}

export default AccountSection;
