const express = require("express");
const router = express.Router();
const Reservation = require("../models/Reservation");
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
const { checkWarehouseAccess } = require("../middleware/warehouseAccessMiddleware");

const getReservationWarehouse = async (req) => {
  if (!req.body.reservationId) return null;
  const rsv = await Reservation.findOne({ reservationId: req.body.reservationId });
  if (!rsv) {
    const err = new Error("Reservation not found");
    err.statusCode = 404;
    throw err;
  }
  return rsv.warehouse;
};

router.get("/", flexibleAuth, getStockLevels);
router.get("/availability", flexibleAuth, checkAvailability);

router.post(
  "/reserve",
  flexibleAuth,
  checkWarehouseAccess((req) => req.body.warehouse || req.body.warehouseId),
  reserveStock
);
router.post(
  "/confirm",
  flexibleAuth,
  checkWarehouseAccess(getReservationWarehouse),
  confirmReservation
);
router.post(
  "/release",
  flexibleAuth,
  checkWarehouseAccess(getReservationWarehouse),
  releaseReservation
);

router.get("/warehouse/:warehouseId", flexibleAuth, getStockByWarehouse);
router.get("/product/:productId", flexibleAuth, getStockByProduct);

module.exports = router;