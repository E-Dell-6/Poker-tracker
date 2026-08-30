import { apiFetch } from "./http";

// No ok-check on any of these - every caller branches on the JSON body's
// `success` flag, never res.ok (4xx responses here carry a valid
// {success:false,message} body by design).

export async function login({ email, password }) {
  const res = await apiFetch("/api/auth/login", { method: "POST", body: { email, password } });
  return res.json();
}

export async function register(registerForm) {
  const res = await apiFetch("/api/auth/register", { method: "POST", body: registerForm });
  return res.json();
}

export async function sendResetOtp(email) {
  const res = await apiFetch("/api/auth/send-reset-otp", { method: "POST", body: { email } });
  return res.json();
}

export async function resetPassword({ email, otp, newPassword }) {
  const res = await apiFetch("/api/auth/reset-password", { method: "POST", body: { email, otp, newPassword } });
  return res.json();
}

export async function sendVerifyOtp() {
  const res = await apiFetch("/api/auth/send-verify-otp", { method: "POST" });
  return res.json();
}

export async function verifyAccount(otp) {
  const res = await apiFetch("/api/auth/verify-account", { method: "POST", body: { otp } });
  return res.json();
}

export async function logout() {
  await apiFetch("/api/auth/logout", { method: "POST" });
}
