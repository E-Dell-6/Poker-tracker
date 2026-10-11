import { useState } from "react";
import {
  User, Mail, Lock, ShieldCheck, EyeOff, Eye, Check, ArrowLeft,
  PlayCircle, Grid3x3, Timer, Users,
} from "lucide-react";
import "./Login.css";
import { login, register, sendResetOtp, resetPassword } from "../../api/auth";
import { MIN_PASSWORD_LENGTH } from "../../config";

const FEATURES = [
  { icon: <PlayCircle size={16} aria-hidden="true" />, title: "Hand replayer", text: "Step through every street and share hands with a link." },
  { icon: <Grid3x3 size={16} aria-hidden="true" />, title: "Range & leak study", text: "Preflop matrices, board textures and hand-class leaks." },
  { icon: <Timer size={16} aria-hidden="true" />, title: "Live sessions", text: "Clock your sessions and track results as you play." },
  { icon: <Users size={16} aria-hidden="true" />, title: "Player notes", text: "Tag opponents and keep stats on the regs you face." },
];

// ── Field component (defined outside Login to prevent remounting) ──
const Field = ({ id, label, icon, type, placeholder, value, onChange, error, hint, toggle, showToggle, autoComplete, aside }) => (
  <div className="login-field">
    <div className="login-label-row">
      <label className="login-label" htmlFor={id}>{label}</label>
      {aside}
    </div>
    <div className={`login-input-wrap ${error ? "login-input-wrap--error" : ""}`}>
      {icon}
      <input
        id={id}
        className="login-input"
        type={type}
        placeholder={placeholder}
        value={value}
        autoComplete={autoComplete}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {toggle && (
        <button
          type="button"
          className="login-eye-btn"
          onClick={toggle}
          aria-label={showToggle ? "Hide password" : "Show password"}
        >
          {showToggle ? <EyeOff className="login-input-icon" /> : <Eye className="login-input-icon" />}
        </button>
      )}
    </div>
    {error
      ? <span id={`${id}-error`} className="login-error-msg">{error}</span>
      : hint && <span id={`${id}-hint`} className="login-hint">{hint}</span>}
  </div>
);

const SubmitButton = ({ loading, children }) => (
  <button type="submit" className="login-submit" disabled={loading}>
    {loading ? <span className="login-spinner" aria-label="Loading" /> : children}
  </button>
);

// Views: "login" | "register" | "forgot" | "reset"
export function Login() {
  const [view, setView] = useState("login");
  const [animating, setAnimating] = useState(false);

  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState({ name: "", email: "", password: "" });
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetForm, setResetForm] = useState({ otp: "", newPassword: "" });

  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const switchView = (next) => {
    if (animating) return;
    setAnimating(true);
    setErrors({});
    setServerError("");
    setShowPassword(false);
    setTimeout(() => {
      setView(next);
      setAnimating(false);
    }, 200);
  };

  const handleChange = (setter, field, value) => {
    setter((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleLogin = async () => {
    const errs = {};
    if (!loginForm.email.trim()) errs.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(loginForm.email)) errs.email = "Invalid email";
    if (!loginForm.password) errs.password = "Password is required";
    if (Object.keys(errs).length) return setErrors(errs);
    setLoading(true); setServerError("");
    try {
      const data = await login(loginForm);
      if (data.success) window.location.href = "/";
      else setServerError(data.message);
    } catch { setServerError("Something went wrong."); }
    finally { setLoading(false); }
  };

  const handleRegister = async () => {
    const errs = {};
    if (!registerForm.name.trim()) errs.name = "Full name is required";
    if (!registerForm.email.trim()) errs.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(registerForm.email)) errs.email = "Invalid email";
    if (!registerForm.password) errs.password = "Password is required";
    else if (registerForm.password.length < MIN_PASSWORD_LENGTH) errs.password = `At least ${MIN_PASSWORD_LENGTH} characters`;
    if (Object.keys(errs).length) return setErrors(errs);
    setLoading(true); setServerError("");
    try {
      const data = await register(registerForm);
      if (data.success) window.location.href = "/";
      else setServerError(data.message);
    } catch { setServerError("Something went wrong."); }
    finally { setLoading(false); }
  };

  const handleSendOtp = async () => {
    if (!forgotEmail.trim() || !/\S+@\S+\.\S+/.test(forgotEmail))
      return setErrors({ forgotEmail: "Please enter a valid email" });
    setLoading(true); setServerError("");
    try {
      const data = await sendResetOtp(forgotEmail);
      if (data.success) switchView("reset");
      else setServerError(data.message);
    } catch { setServerError("Something went wrong."); }
    finally { setLoading(false); }
  };

  const handleResetPassword = async () => {
    const errs = {};
    if (!resetForm.otp.trim()) errs.otp = "OTP is required";
    if (!resetForm.newPassword) errs.newPassword = "Password is required";
    else if (resetForm.newPassword.length < MIN_PASSWORD_LENGTH) errs.newPassword = `At least ${MIN_PASSWORD_LENGTH} characters`;
    if (Object.keys(errs).length) return setErrors(errs);
    setLoading(true); setServerError("");
    try {
      const data = await resetPassword({ email: forgotEmail, otp: resetForm.otp, newPassword: resetForm.newPassword });
      if (data.success) setSuccess(true);
      else setServerError(data.message);
    } catch { setServerError("Something went wrong."); }
    finally { setLoading(false); }
  };

  const submitHandlers = { login: handleLogin, register: handleRegister, forgot: handleSendOtp, reset: handleResetPassword };
  const onSubmit = (e) => {
    e.preventDefault();
    if (!loading) submitHandlers[view]();
  };

  const titles = { login: "Welcome back", register: "Create your account", forgot: "Forgot password", reset: "Reset password" };
  const subtitles = {
    login: "Sign in to pick up where you left off.",
    register: "Start tracking your hands in under a minute.",
    forgot: "Enter your email and we'll send you a one-time code.",
    reset: `We sent a code to ${forgotEmail}.`,
  };

  const isAuthView = view === "login" || view === "register";

  return (
    <div className="login-page">
      {/* ── Brand panel ── */}
      <aside className="login-hero">
        <div className="login-hero-glow" aria-hidden="true" />
        <span className="login-hero-suit login-hero-suit--a" aria-hidden="true">♠</span>
        <span className="login-hero-suit login-hero-suit--b" aria-hidden="true">♦</span>

        <div className="login-brand">
          <span className="login-brand-mark" aria-hidden="true">♠</span>
          <span className="login-brand-name">Poker Flow</span>
        </div>

        <div className="login-hero-body">
          <h2 className="login-hero-title">
            Track every hand.<br />
            <span className="login-hero-accent">Find every leak.</span>
          </h2>
          <p className="login-hero-text">
            Import your hand histories, replay the big pots and see exactly where your win rate goes.
          </p>

          <ul className="login-features">
            {FEATURES.map(({ icon, title, text }) => (
              <li key={title} className="login-feature">
                <span className="login-feature-icon">{icon}</span>
                <div>
                  <p className="login-feature-title">{title}</p>
                  <p className="login-feature-text">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

      </aside>

      {/* ── Form panel ── */}
      <main className="login-panel">
        <div className="login-form-wrap">
          <div className="login-brand login-brand--mobile">
            <span className="login-brand-mark" aria-hidden="true">♠</span>
            <span className="login-brand-name">Poker Flow</span>
          </div>

          {isAuthView && !success && (
            <div className="login-tabs" role="tablist">
              <button type="button" role="tab" aria-selected={view === "login"}
                className={`login-tab ${view === "login" ? "is-active" : ""}`}
                onClick={() => view !== "login" && switchView("login")}>
                Log in
              </button>
              <button type="button" role="tab" aria-selected={view === "register"}
                className={`login-tab ${view === "register" ? "is-active" : ""}`}
                onClick={() => view !== "register" && switchView("register")}>
                Sign up
              </button>
            </div>
          )}

          <div className={`login-content ${animating ? "is-leaving" : ""}`}>
            {success ? (
              <div className="login-success">
                <div className="login-success-icon"><Check size={24} /></div>
                <h1 className="login-title">Password updated</h1>
                <p className="login-subtitle">You can now log in with your new password.</p>
                <button type="button" className="login-submit" onClick={() => { setSuccess(false); switchView("login"); }}>
                  Back to login
                </button>
              </div>
            ) : (
              <>
                {!isAuthView && (
                  <button type="button" className="login-back"
                    onClick={() => switchView(view === "reset" ? "forgot" : "login")}>
                    <ArrowLeft size={14} /> {view === "reset" ? "Back" : "Back to login"}
                  </button>
                )}

                <h1 className="login-title">{titles[view]}</h1>
                <p className="login-subtitle">{subtitles[view]}</p>

                {serverError && <div className="login-server-error" role="alert">{serverError}</div>}

                <form className="login-form" onSubmit={onSubmit} noValidate>
                  {view === "login" && (
                    <>
                      <Field id="login-email" label="Email" icon={<Mail className="login-input-icon" aria-hidden="true" />} type="email" placeholder="you@example.com"
                        autoComplete="email"
                        value={loginForm.email} onChange={(v) => handleChange(setLoginForm, "email", v)} error={errors.email} />
                      <Field id="login-password" label="Password" icon={<Lock className="login-input-icon" aria-hidden="true" />} type={showPassword ? "text" : "password"}
                        placeholder="Your password" autoComplete="current-password"
                        value={loginForm.password} onChange={(v) => handleChange(setLoginForm, "password", v)}
                        error={errors.password} toggle={() => setShowPassword(s => !s)} showToggle={showPassword}
                        aside={<button type="button" className="login-link login-link--small" onClick={() => switchView("forgot")}>Forgot password?</button>} />
                      <SubmitButton loading={loading}>Log in</SubmitButton>
                    </>
                  )}

                  {view === "register" && (
                    <>
                      <Field id="register-name" label="Full name" icon={<User className="login-input-icon" aria-hidden="true" />} type="text" placeholder="Jane Doe"
                        autoComplete="name"
                        value={registerForm.name} onChange={(v) => handleChange(setRegisterForm, "name", v)} error={errors.name} />
                      <Field id="register-email" label="Email" icon={<Mail className="login-input-icon" aria-hidden="true" />} type="email" placeholder="you@example.com"
                        autoComplete="email"
                        value={registerForm.email} onChange={(v) => handleChange(setRegisterForm, "email", v)} error={errors.email} />
                      <Field id="register-password" label="Password" icon={<Lock className="login-input-icon" aria-hidden="true" />} type={showPassword ? "text" : "password"}
                        placeholder="Create a password" autoComplete="new-password"
                        hint={`At least ${MIN_PASSWORD_LENGTH} characters`}
                        value={registerForm.password} onChange={(v) => handleChange(setRegisterForm, "password", v)}
                        error={errors.password} toggle={() => setShowPassword(s => !s)} showToggle={showPassword} />
                      <SubmitButton loading={loading}>Create account</SubmitButton>
                    </>
                  )}

                  {view === "forgot" && (
                    <>
                      <Field id="forgot-email" label="Email" icon={<Mail className="login-input-icon" aria-hidden="true" />} type="email" placeholder="you@example.com"
                        autoComplete="email"
                        value={forgotEmail} onChange={(v) => { setForgotEmail(v); setErrors({}); }} error={errors.forgotEmail} />
                      <SubmitButton loading={loading}>Send code</SubmitButton>
                    </>
                  )}

                  {view === "reset" && (
                    <>
                      <Field id="reset-otp" label="One-time code" icon={<ShieldCheck className="login-input-icon" aria-hidden="true" />} type="text" placeholder="6-digit code"
                        autoComplete="one-time-code"
                        value={resetForm.otp} onChange={(v) => handleChange(setResetForm, "otp", v)} error={errors.otp} />
                      <Field id="reset-password" label="New password" icon={<Lock className="login-input-icon" aria-hidden="true" />} type={showPassword ? "text" : "password"}
                        placeholder="Create a new password" autoComplete="new-password"
                        hint={`At least ${MIN_PASSWORD_LENGTH} characters`}
                        value={resetForm.newPassword} onChange={(v) => handleChange(setResetForm, "newPassword", v)}
                        error={errors.newPassword} toggle={() => setShowPassword(s => !s)} showToggle={showPassword} />
                      <SubmitButton loading={loading}>Reset password</SubmitButton>
                    </>
                  )}
                </form>

                {view === "login" && (
                  <p className="login-footer">Don't have an account?{" "}
                    <button type="button" className="login-link" onClick={() => switchView("register")}>Sign up</button>
                  </p>
                )}
                {view === "register" && (
                  <p className="login-footer">Already have an account?{" "}
                    <button type="button" className="login-link" onClick={() => switchView("login")}>Log in</button>
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      <p className="login-footer-note">© {new Date().getFullYear()} Poker Flow</p>
    </div>
  );
}

export default Login;
