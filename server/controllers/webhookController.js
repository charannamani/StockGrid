const Product = require("../models/Product");
const Warehouse = require("../models/Warehouse");
const { recordMovement } = require("./movementController");

// Inbound webhook: an external system (e.g. an e-commerce platform) tells us
// a sale happened. We independently re-check and atomically decrement stock
// here rather than trusting that platform's own "in stock" display — that
// display can be stale by the time checkout completes (see design notes:
// caching lag, multiple sales channels drawing on the same warehouse, or
// simply the time between add-to-cart and payment).
//
// Expected payload:
// {
//   "orderId": "shopify-order-12345",
//   "warehouseId": "6a9076e18c7ea9eab9185b61",
//   "items": [{ "sku": "RACE-001", "quantity": 2 }],
//   "reservationId": null   // reserved for future use once soft-locks exist;
//                           // unused today, every order takes the fresh
//                           // atomic-decrement path below
// }
//
// Each line item is processed independently (not all-or-nothing) — a real
// order with 3 items where 1 is out of stock should still fulfill the other
// 2, not fail the whole order. The response reports per-item outcome so the
// calling system knows exactly what happened and can act (partial ship,
// backorder, refund the missing item, etc).
//
// NOTE: this does not yet deduplicate retried webhook calls with the same
// orderId — a network retry could double-decrement. That's addressed by
// task #4 (idempotency keys), not yet built.
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

    // 200 here means "we received and processed the webhook" — not
    // "every item succeeded." A 4xx/5xx would tell the sender their
    // delivery failed and to retry the whole payload, which is wrong when
    // the real answer is "delivered fine, but item 2 was out of stock."
    // Business-level outcome lives in the results array, per item.
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