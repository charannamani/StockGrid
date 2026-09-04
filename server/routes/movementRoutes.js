const express = require("express");
const router = express.Router();
const {
  getMovementHistory,
  createMovement,
  transferStock,
} = require("../controllers/movementController");
const { flexibleAuth } = require("../middleware/authMiddleware");

router.get("/", flexibleAuth, getMovementHistory);
router.post("/", flexibleAuth, createMovement);
router.post("/transfer", flexibleAuth, transferStock);

module.exports = router;