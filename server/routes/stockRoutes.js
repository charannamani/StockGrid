const express = require("express");
const router = express.Router();
const {
  getStockLevels,
  getStockByWarehouse,
  getStockByProduct,
  checkAvailability,
} = require("../controllers/stockController");
const {
  reserveStock,
  confirmReservation,
  releaseReservation,
} = require("../controllers/reservationController");
const { flexibleAuth } = require("../middleware/authMiddleware");

router.get("/", flexibleAuth, getStockLevels);
router.get("/availability", flexibleAuth, checkAvailability);

router.post("/reserve", flexibleAuth, reserveStock);
router.post("/confirm", flexibleAuth, confirmReservation);
router.post("/release", flexibleAuth, releaseReservation);

router.get("/warehouse/:warehouseId", flexibleAuth, getStockByWarehouse);
router.get("/product/:productId", flexibleAuth, getStockByProduct);

module.exports = router;