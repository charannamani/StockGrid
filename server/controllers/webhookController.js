const Product = require("../models/Product");
const Warehouse = require("../models/Warehouse");
const { recordMovement } = require("./movementController");

const handleOrderPlaced = async (req, res, next) => {
  try {
    const { orderId, warehouseId, items } = req.body;

    if (!orderId || !warehouseId || !Array.isArray(items) || items.length === 0) {
      res.status(400);
      return next(new Error("orderId, warehouseId, and a non-empty items array are required"));
    }

    const warehouse = await Warehouse.findById(warehouseId).lean();
    if (!warehouse || !warehouse.isActive) {
      res.status(404);
      return next(new Error("Warehouse not found or inactive"));
    }

    const results = [];

    for (const item of items) {
      const { sku, quantity } = item;

      if (!sku || !quantity || Number(quantity) <= 0) {
        results.push({ sku: sku || null, status: "failed", reason: "Invalid sku or quantity" });
        continue;
      }

      const product = await Product.findOne({ sku: String(sku).toUpperCase() }).lean();
      if (!product) {
        results.push({ sku, status: "failed", reason: "Product not found" });
        continue;
      }

      try {
        const { movement, stock } = await recordMovement({
          product: product._id,
          warehouse: warehouseId,
          type: "outbound",
          quantity,
          reason: `webhook: order ${orderId}`,
          attribution: {
            source: "api_key",
            performedByApiKey: req.apiKey?._id,
            performedBy: req.apiKey?.createdBy?._id || req.apiKey?.createdBy,
          },
        });
        results.push({
          sku,
          status: "fulfilled",
          movementId: movement._id,
          remainingStock: stock.currentQuantity,
        });
      } catch (err) {
        results.push({ sku, status: "failed", reason: err.message });
      }
    }

    const allFulfilled = results.every((r) => r.status === "fulfilled");
    const anyFulfilled = results.some((r) => r.status === "fulfilled");


    res.status(200).json({
      orderId,
      warehouseId,
      allFulfilled,
      anyFulfilled,
      results,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { handleOrderPlaced };