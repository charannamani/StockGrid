const express = require("express");
const router = express.Router();
const {
  registerUser,
  loginUser,
  listUsers,
  updateUserWarehouses,
} = require("../controllers/authController");
const { registerValidationRules, loginValidationRules } = require("../middleware/validators");
const { loginLimiter } = require("../middleware/rateLimiter");
const { protect, adminOnly } = require("../middleware/authMiddleware");

router.post("/login", loginLimiter, loginValidationRules, loginUser);
router.post("/register", registerValidationRules, registerUser);
router.get("/users", protect, adminOnly, listUsers);
router.patch("/users/:id/warehouses", protect, adminOnly, updateUserWarehouses);

module.exports = router;