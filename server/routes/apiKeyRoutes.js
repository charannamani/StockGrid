const express = require("express");
const router = express.Router();
const {
  getApiKeys,
  generateApiKey,
  updateApiKey,
  revokeApiKey,
} = require("../controllers/apiKeyController");
const { protect, adminOnly } = require("../middleware/authMiddleware");

router.use(protect);
router.use(adminOnly);

router.route("/")
  .get(getApiKeys)
  .post(generateApiKey);

router.route("/:id")
  .put(updateApiKey)
  .delete(revokeApiKey);

module.exports = router;