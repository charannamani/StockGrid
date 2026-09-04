const express = require("express");
const router = express.Router();
const {
  getMovementHistory,
  createMovement,
  transferStock,
} = require("../controllers/movementController");
const { protect, flexibleAuth } = require("../middleware/authMiddleware");

router.get("/", protect, getMovementHistory);
router.post("/", flexibleAuth, createMovement);
router.post("/transfer", protect, transferStock);

module.exports = router;