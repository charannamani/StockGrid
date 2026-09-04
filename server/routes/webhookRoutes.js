const express = require("express");
const router = express.Router();
const { handleOrderPlaced } = require("../controllers/webhookController");
const apiKeyAuth = require("../middleware/apiKeyMiddleware");
const { apiKeyLimiter } = require("../middleware/rateLimiter");

router.post("/order-placed", apiKeyAuth, apiKeyLimiter, handleOrderPlaced);

module.exports = router;