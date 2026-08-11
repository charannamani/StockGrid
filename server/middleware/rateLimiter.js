const rateLimit = require("express-rate-limit");

// 1. Strict Limiter for Login / Auth Routes (Prevents Brute-Force Password Attacks)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Max 10 failed login attempts per window
  message: { message: "Too many login attempts. Please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
});

// 2. High-Capacity General Limiter for Dashboard & Operational API Endpoints
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Allows smooth parallel data fetching across UI views
  message: { message: "Too many requests from this IP. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
});

// 3. Strict Limiter for B2B API Key Generation & Revocation
const apiKeyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Max 20 key actions per hour
  message: { message: "API key generation limit reached. Try again in an hour." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
});

module.exports = { loginLimiter, generalLimiter, apiKeyLimiter };