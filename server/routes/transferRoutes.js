const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Transfer = require("../models/Transfer");
const {
  initiateTransfer,
  confirmTransfer,
  cancelTransfer,
  getTransfers,
  getTransferById,
} = require("../controllers/transferController");
const { flexibleAuth } = require("../middleware/authMiddleware");
const { checkWarehouseAccess } = require("../middleware/warehouseAccessMiddleware");

const loadTransfer = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ message: "Transfer not found" });
    }
    const transfer = await Transfer.findById(id);
    if (!transfer) {
      return res.status(404).json({ message: "Transfer not found" });
    }
    req.transfer = transfer;
    next();
  } catch (error) {
    next(error);
  }
};

router.get("/", flexibleAuth, getTransfers);
router.get("/:id", flexibleAuth, getTransferById);

router.post(
  "/",
  flexibleAuth,
  checkWarehouseAccess((req) => req.body.fromWarehouse),
  initiateTransfer
);

router.post(
  "/:id/confirm",
  flexibleAuth,
  loadTransfer,
  checkWarehouseAccess((req) => req.transfer.toWarehouse),
  confirmTransfer
);

router.post(
  "/:id/cancel",
  flexibleAuth,
  loadTransfer,
  checkWarehouseAccess((req) => req.transfer.fromWarehouse),
  cancelTransfer
);

module.exports = router;
