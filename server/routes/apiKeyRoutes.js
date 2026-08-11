const express = require("express");
const router = express.Router();
const {
  generateApiKey,
  listApiKeys,
  revokeApiKey,
} = require("../controllers/apiKeyController");
const { protect, adminOnly } = require("../middleware/authMiddleware");

router.get("/", protect, adminOnly, listApiKeys);
router.post("/", protect, adminOnly, generateApiKey);
router.delete("/:id", protect, adminOnly, revokeApiKey);

module.exports = router;