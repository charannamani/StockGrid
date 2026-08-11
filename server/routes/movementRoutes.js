const express = require("express");
const router = express.Router();
const {
  getMovementHistory,
  createMovement,
  transferStock,
} = require("../controllers/movementController");
const { protect } = require("../middleware/authMiddleware");

// Routes
router.get("/", protect, getMovementHistory);
router.post("/", protect, createMovement);
router.post("/transfer", protect, transferStock);

module.exports = router;