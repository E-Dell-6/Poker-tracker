import { useState } from "react";
import { User, Mail, Lock, ShieldCheck, EyeOff, Eye, Check, ArrowLeft } from "lucide-react";
import "./Login.css";
import { login, register, sendResetOtp, resetPassword } from "../../api/auth";

// ── Icons (defined outside to prevent remounting) ──
const UserIcon = () => <User className="login-icon-svg" />;
const EmailIcon = () => <Mail className="login-icon-svg" />;
const LockIcon = () => <Lock className="login-icon-svg" />;
const ShieldIcon = () => <ShieldCheck className="login-icon-svg" />;
const EyeOffIcon = () => <EyeOff className="login-icon-svg" />;
const EyeIcon = () => <Eye className="login-icon-svg" />;

// ── Field component (defined outside Login to prevent remounting) ──
const Field = ({ icon, type, placeholder, value, onChange, error, toggle, showToggle }) => (
  <div className="field-group">
    <div className={`input-wrapper ${error ? "error-border" : ""}`}>
      <span className="icon">{icon}</span>
      <input
        className="input"
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {toggle && (
        <button className="eye-btn" onClick={toggle} tabIndex={-1}>
          {showToggle ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      )}
    </div>
    {error && <span className="error-msg">{error}</span>}
  </div>
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
    }, 300);
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
    else if (registerForm.password.length < 6) errs.password = "At least 6 characters";
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
    else if (resetForm.newPassword.length < 6) errs.newPassword = "At least 6 characters";
    if (Object.keys(errs).length) return setErrors(errs);
    setLoading(true); setServerError("");
    try {
      const data = await resetPassword({ email: forgotEmail, otp: resetForm.otp, newPassword: resetForm.newPassword });
      if (data.success) setSuccess(true);
      else setServerError(data.message);
    } catch { setServerError("Something went wrong."); }
    finally { setLoading(false); }
  };

  const titles = { login: "Welcome Back", register: "Create Account", forgot: "Forgot Password", reset: "Reset Password" };
  const subtitles = {
    login: "Sign in to your account",
    register: "Create your account",
    forgot: "Enter your email to receive an OTP",
    reset: `OTP sent to ${forgotEmail}`,
  };

  return (
    <div className="page">
      <div className="card">
        <div className="glow-top" />
        <div className={`card-content ${animating ? "fade-out" : "fade-in"}`}>
          <h1 className="title">{titles[view]}</h1>
          <p className="subtitle">{subtitles[view]}</p>

          {serverError && <div className="server-error">{serverError}</div>}

          {success ? (
            <div className="success-box">
              <div className="success-icon"><Check size={22} /></div>
              <p className="success-text">Password reset successfully!</p>
              <button className="submit-btn" onClick={() => { setSuccess(false); switchView("login"); }}>
                Back to Login
              </button>
            </div>
          ) : (
            <>
              {view === "login" && (
                <>
                  <Field icon={<EmailIcon />} type="email" placeholder="Email id"
                    value={loginForm.email} onChange={(v) => handleChange(setLoginForm, "email", v)} error={errors.email} />
                  <Field icon={<LockIcon />} type={showPassword ? "text" : "password"} placeholder="Password"
                    value={loginForm.password} onChange={(v) => handleChange(setLoginForm, "password", v)}
                    error={errors.password} toggle={() => setShowPassword(s => !s)} showToggle={showPassword} />
                  <div className="forgot-row">
                    <button className="forgot-btn" onClick={() => switchView("forgot")}>Forgot password?</button>
                  </div>
                  <button className="submit-btn" onClick={handleLogin} disabled={loading}>
                    {loading ? <span className="spinner" /> : "Login"}
                  </button>
                  <p className="footer-text">Don't have an account?{" "}
                    <button className="link-btn" onClick={() => switchView("register")}>Sign up here</button>
                  </p>
                </>
              )}

              {view === "register" && (
                <>
                  <Field icon={<UserIcon />} type="text" placeholder="Full Name"
                    value={registerForm.name} onChange={(v) => handleChange(setRegisterForm, "name", v)} error={errors.name} />
                  <Field icon={<EmailIcon />} type="email" placeholder="Email id"
                    value={registerForm.email} onChange={(v) => handleChange(setRegisterForm, "email", v)} error={errors.email} />
                  <Field icon={<LockIcon />} type={showPassword ? "text" : "password"} placeholder="Password"
                    value={registerForm.password} onChange={(v) => handleChange(setRegisterForm, "password", v)}
                    error={errors.password} toggle={() => setShowPassword(s => !s)} showToggle={showPassword} />
                  <button className="submit-btn submit-btn--register" onClick={handleRegister} disabled={loading}>
                    {loading ? <span className="spinner" /> : "Sign Up"}
                  </button>
                  <p className="footer-text">Already have an account?{" "}
                    <button className="link-btn" onClick={() => switchView("login")}>Login here</button>
                  </p>
                </>
              )}

              {view === "forgot" && (
                <>
                  <Field icon={<EmailIcon />} type="email" placeholder="Email id"
                    value={forgotEmail} onChange={(v) => { setForgotEmail(v); setErrors({}); }} error={errors.forgotEmail} />
                  <button className="submit-btn" onClick={handleSendOtp} disabled={loading}>
                    {loading ? <span className="spinner" /> : "Send OTP"}
                  </button>
                  <button className="ghost-btn" onClick={() => switchView("login")}><ArrowLeft size={14} /> Back to Login</button>
                </>
              )}

              {view === "reset" && (
                <>
                  <Field icon={<ShieldIcon />} type="text" placeholder="Enter OTP"
                    value={resetForm.otp} onChange={(v) => handleChange(setResetForm, "otp", v)} error={errors.otp} />
                  <Field icon={<LockIcon />} type={showPassword ? "text" : "password"} placeholder="New Password"
                    value={resetForm.newPassword} onChange={(v) => handleChange(setResetForm, "newPassword", v)}
                    error={errors.newPassword} toggle={() => setShowPassword(s => !s)} showToggle={showPassword} />
                  <button className="submit-btn" onClick={handleResetPassword} disabled={loading}>
                    {loading ? <span className="spinner" /> : "Reset Password"}
                  </button>
                  <button className="ghost-btn" onClick={() => switchView("forgot")}><ArrowLeft size={14} /> Back</button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Login;