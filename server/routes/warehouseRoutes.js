const express = require("express");
const router = express.Router();
const {
  getWarehouses,
  getWarehouseById,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse: deactivateWarehouse,
} = require("../controllers/warehouseController");
const { protect, adminOnly } = require("../middleware/authMiddleware");

router.get("/", protect, getWarehouses);
router.get("/:id", protect, getWarehouseById);
router.post("/", protect, adminOnly, createWarehouse);
router.put("/:id", protect, adminOnly, updateWarehouse);
router.delete("/:id", protect, adminOnly, deactivateWarehouse);

module.exports = router;