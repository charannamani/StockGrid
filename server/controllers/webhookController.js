const mongoose = require("mongoose");
const Stock = require("../models/Stock");
const Product = require("../models/Product");
const StockMovement = require("../models/StockMovement");
const { recordMovement } = require("./movementController");

const haversineDistanceKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const handleOrderPlaced = async (req, res, next) => {
  try {
    const {
      orderId,
      productId,
      sku,
      quantity,
      allowSplit = true,
      destinationLatitude,
      destinationLongitude,
} = req.body || {};

    const requestedQty = Number(quantity);

    if ((!productId && !sku) || !requestedQty || requestedQty <= 0) {
      res.status(400);
      return next(new Error("Valid product identifier (productId or sku) and quantity are required"));
    }

    let productDoc;
    if (productId && mongoose.Types.ObjectId.isValid(productId)) {
      productDoc = await Product.findById(productId).lean();
    } else if (sku) {
      productDoc = await Product.findOne({ sku: sku.trim().toUpperCase() }).lean();
    }

    if (!productDoc || productDoc.isActive === false) {
      res.status(404);
      return next(new Error("Product not found in active catalog"));
    }

    const stockEntries = await Stock.find({
      product: productDoc._id,
      currentQuantity: { $gt: 0 },
    })
      .populate("warehouse", "name address latitude longitude isActive")
      .lean();

    let validEntries = stockEntries.filter(
      (entry) => entry.warehouse && entry.warehouse.isActive !== false
    );

    const totalAvailable = validEntries.reduce((sum, e) => sum + e.currentQuantity, 0);

    if (totalAvailable < requestedQty) {
      return res.status(422).json({
        success: false,
        error: "INSUFFICIENT_STOCK",
        message: "Order cannot be fulfilled. Requested quantity exceeds total inventory network on-hand.",
        requestedQuantity: requestedQty,
        totalNetworkAvailable: totalAvailable,
        shortfall: requestedQty - totalAvailable,
      });
    }

    const hasDestination =
      destinationLatitude !== undefined &&
      destinationLongitude !== undefined &&
      destinationLatitude !== "" &&
      destinationLongitude !== "";

    const destLat = Number(destinationLatitude);
    const destLng = Number(destinationLongitude);

    if (hasDestination && !Number.isNaN(destLat) && !Number.isNaN(destLng)) {
      validEntries = validEntries.map((entry) => {
        const hasCoords = entry.warehouse.latitude != null && entry.warehouse.longitude != null;
        const distanceKm = hasCoords
          ? Math.round(
              haversineDistanceKm(destLat, destLng, entry.warehouse.latitude, entry.warehouse.longitude) * 10
            ) / 10
          : null;
        return { ...entry, distanceKm };
      });

      validEntries.sort((a, b) => {
        if (a.distanceKm === null) return 1;
        if (b.distanceKm === null) return -1;
        return a.distanceKm - b.distanceKm;
      });
    } else {
      validEntries.sort((a, b) => b.currentQuantity - a.currentQuantity);
    }

    let plan = [];
    let isSplitDelivery = false;
    let strategyUsed = "single_warehouse";

    const singleFacilityMatch = validEntries.find((e) => e.currentQuantity >= requestedQty);

    if (singleFacilityMatch) {
      strategyUsed = "single_warehouse";
      isSplitDelivery = false;
      plan.push({
        warehouse: singleFacilityMatch.warehouse,
        allocatedQuantity: requestedQty,
        distanceKm: singleFacilityMatch.distanceKm ?? null,
      });
    } else {
      if (allowSplit === false) {
        return res.status(422).json({
          success: false,
          error: "SPLIT_FULFILLMENT_DISABLED",
          message: "No single warehouse has sufficient inventory, and split fulfillment was explicitly disabled by the caller (allowSplit: false).",
          requestedQuantity: requestedQty,
          maxSingleWarehouseAvailable: Math.max(...validEntries.map((e) => e.currentQuantity), 0),
        });
      }

      strategyUsed = "split_warehouse";
      isSplitDelivery = true;
      let remaining = requestedQty;

      for (const entry of validEntries) {
        if (remaining <= 0) break;
        const take = Math.min(entry.currentQuantity, remaining);
        plan.push({
          warehouse: entry.warehouse,
          allocatedQuantity: take,
          distanceKm: entry.distanceKm ?? null,
        });
        remaining -= take;
      }
    }

    const attribution = req.isApiKeyAuth && req.apiKey
      ? {
          source: "api_key",
          performedByApiKey: req.apiKey._id,
          performedBy: req.apiKey.createdBy?._id || req.apiKey.createdBy || undefined,
        }
      : {
          source: "web",
          performedBy: req.user?._id || undefined,
        };

    const movementsExecuted = [];

    for (const alloc of plan) {
      const reasonText = orderId
        ? `External Order #${orderId} Fulfillment${isSplitDelivery ? " (Split shipment)" : ""}`
        : `Webhook Order Fulfillment${isSplitDelivery ? " (Split shipment)" : ""}`;

      const { movement } = await recordMovement({
        product: productDoc._id,
        warehouse: alloc.warehouse._id,
        type: "outbound",
        quantity: alloc.allocatedQuantity,
        reason: reasonText,
        attribution,
      });

      movementsExecuted.push({
        movementId: movement._id,
        warehouseId: alloc.warehouse._id,
        warehouseName: alloc.warehouse.name,
        allocatedQuantity: alloc.allocatedQuantity,
        distanceKm: alloc.distanceKm,
      });
    }

    res.status(200).json({
      success: true,
      orderId: orderId || null,
      product: {
        id: productDoc._id,
        name: productDoc.name,
        sku: productDoc.sku,
      },
      totalRequested: requestedQty,
      strategy: strategyUsed,
      isSplitDelivery,
      logisticsNotice: isSplitDelivery
        ? "Multi-facility dispatch: items will arrive in separate packages with staggered delivery dates."
        : "Single-facility dispatch: optimal consolidated delivery.",
      allocations: movementsExecuted,
      fulfilledAt: new Date().toISOString(),
    });
  } catch (error) {
    if (error.statusCode) res.status(error.statusCode);
    next(error);
  }
};

module.exports = {
  handleOrderPlaced,
};