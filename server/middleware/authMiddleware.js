const jwt = require("jsonwebtoken");
const User = require("../models/User");
const apiKeyAuth = require("./apiKeyMiddleware");

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    try {
      token = req.headers.authorization.split(" ")[1];

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      req.user = await User.findById(decoded.id).select("-password");

      if (!req.user) {
        return res.status(401).json({ message: "User not found" });
      }

      next();
    } catch (error) {
      return res.status(401).json({ message: "Not authorized, token failed" });
    }
  } else {
    return res.status(401).json({ message: "Not authorized, no token" });
  }
};

// Accepts EITHER a JWT (the frontend app, staff/admin) OR an API key
// (an external system, e.g. an e-commerce platform integration). Routes
// that both humans and external systems legitimately need to call — like
// checking stock availability or recording a sale as an outbound movement —
// use this instead of `protect` so external callers aren't forced through
// the login flow.
const flexibleAuth = async (req, res, next) => {
  if (req.headers["x-api-key"]) {
    req.isApiKeyAuth = true;
    return apiKeyAuth(req, res, next);
  }
  return protect(req, res, next);
};

const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    res.status(403).json({ message: "Access denied, admin only" });
  }
};

module.exports = { protect, adminOnly, flexibleAuth };