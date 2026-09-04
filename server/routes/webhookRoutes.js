const express = require("express");
const router = express.Router();
const { handleOrderPlaced } = require("../controllers/webhookController");
const apiKeyAuth = require("../middleware/apiKeyMiddleware");


router.post("/order-placed", apiKeyAuth, handleOrderPlaced);

module.exports = router;