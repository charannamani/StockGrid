const express = require("express");
const router = express.Router();
const { handleOrderPlaced } = require("../controllers/webhookController");
const { flexibleAuth } = require("../middleware/authMiddleware");
const idempotencyMiddleware = require("../middleware/idempotencyMiddleware");

router.post(
  "/order-placed",
  flexibleAuth,
  idempotencyMiddleware,
  handleOrderPlaced
);

module.exports = router;