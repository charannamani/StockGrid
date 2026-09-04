const express = require("express");
const router = express.Router();
const { registerUser, loginUser } = require("../controllers/authController");
const { registerValidationRules, loginValidationRules } = require("../middleware/validators");
const { loginLimiter } = require("../middleware/rateLimiter");

router.post("/login", loginLimiter, loginValidationRules, loginUser);
router.post("/register", registerValidationRules, registerUser);

module.exports = router;