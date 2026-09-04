const rateLimit = require("express-rate-limit");


const skipInTest = () => process.env.NODE_ENV === "test";

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skip: skipInTest,
  message: { message: "Too many login attempts. Please try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 400,
  skip: skipInTest,
  message: { message: "Too many requests. Please slow down." },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiKeyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  skip: skipInTest,
  keyGenerator: (req) => req.headers["x-api-key"] || req.ip,
  validate: { keyGeneratorIpFallback: false, xForwardedForHeader: false },
  message: { message: "API key rate limit exceeded (60 req / 15 min)." },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  authLimiter,
  loginLimiter: authLimiter,
  apiLimiter,
  generalLimiter: apiLimiter,
  apiKeyLimiter,
};