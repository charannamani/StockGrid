const express = require("express");
const router = express.Router();
const { handleOrderPlaced } = require("../controllers/webhookController");
const apiKeyAuth = require("../middleware/apiKeyMiddleware");

// Webhooks are machine-to-machine only — API key auth specifically, not
// flexibleAuth. An external platform integration should never be using a
// human's JWT to call this.
router.post("/order-placed", apiKeyAuth, handleOrderPlaced);

module.exports = router;