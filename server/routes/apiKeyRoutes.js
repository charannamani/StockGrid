const express = require("express");
const router = express.Router();
const {
  generateApiKey,
  listApiKeys,
  revokeApiKey,
} = require("../controllers/apiKeyController");
const { protect, adminOnly } = require("../middleware/authMiddleware");
const { apiKeyLimiter } = require("../middleware/rateLimiter");

router.get("/", protect, adminOnly, listApiKeys);
router.post("/", protect, adminOnly, apiKeyLimiter, generateApiKey);
router.delete("/:id", protect, adminOnly, revokeApiKey);

module.exports = router;