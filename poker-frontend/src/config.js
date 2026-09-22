export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:1111";
// Mirrors MIN_PASSWORD_LENGTH in poker-backend/controllers/authController.js.
// The two were out of sync: the client said "at least 6 characters" and the
// server then refused anything under 10.
export const MIN_PASSWORD_LENGTH = 10;
