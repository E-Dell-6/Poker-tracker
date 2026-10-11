// Unset in dev: requests stay same-origin and go through the Vite proxy
// (vite.config.js), so only the frontend port needs forwarding over SSH.
// Production builds set VITE_API_URL to the API host.
export const API_URL = import.meta.env.VITE_API_URL || "";

// Mirrors MIN_PASSWORD_LENGTH in poker-backend/controllers/authController.js.
// Keep the two in step, or the client accepts passwords the server refuses.
export const MIN_PASSWORD_LENGTH = 6;
