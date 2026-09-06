const express = require("express");
const router = express.Router();
const {
  getMovementHistory,
  createMovement,
} = require("../controllers/movementController");
const { flexibleAuth } = require("../middleware/authMiddleware");
const movementCreateGuard = require("../middleware/movementCreateGuard");

router.get("/", flexibleAuth, getMovementHistory);
router.post("/", flexibleAuth, movementCreateGuard, createMovement);

module.exports = router;