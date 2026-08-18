const mongoose = require("mongoose");
const StockMovement = require("../models/StockMovement");
const Stock = require("../models/Stock");
const Product = require("../models/Product");
const Warehouse = require("../models/Warehouse");
const stockQueue = require("../queues/stockQueue");
// Fix 1: Destructure the connection instance from the config module
const { redisConnection: redisClient } = require("../config/redis");

const clearStockCache = async () => {
  try {
    if (!redisClient) return;
    const keys = await redisClient.keys("stocks:*");
    const whKeys = await redisClient.keys("stock_wh:*");
    const prodKeys = await redisClient.keys("stock_prod:*");
    const availKeys = await redisClient.keys("availability:*");

    const allKeys = [...keys, ...whKeys, ...prodKeys, ...availKeys];
    if (allKeys.length > 0) {
      await redisClient.del(allKeys);
    }
  } catch (error) {
    console.error("Cache clearance error:", error.message);
  }
};

const checkAndTriggerLowStockAlert = async (productId, warehouseId, newQuantity) => {
  try {
    const product = await Product.findById(productId).lean();
    const warehouse = await Warehouse.findById(warehouseId).lean();

    const threshold = product?.lowStockThreshold ?? 10;

    if (product && warehouse && newQuantity <= threshold) {
      await stockQueue.add("lowStockAlert", {
        productId: product._id,
        productName: product.name,
        warehouseId: warehouse._id,
        warehouseName: warehouse.name,
        currentQuantity: newQuantity,
        threshold,
      });
    }
  } catch (error) {
    console.error("Low stock alert queue error:", error.message);
  }
};

const createMovement = async (req, res, next) => {
  try {
    const product = req.body.product || req.body.productId;
    const warehouse = req.body.warehouse || req.body.warehouseId;
    const { type, quantity, reason } = req.body;

    if (!product || !warehouse || !type || !quantity) {
      res.status(400);
      return next(new Error("Invalid movement parameters provided"));
    }

    const qty = Number(quantity);
    if (qty <= 0) {
      res.status(400);
      return next(new Error("Quantity must be greater than zero"));
    }

    if (type !== "inbound" && type !== "outbound" && type !== "adjustment") {
      res.status(400);
      return next(new Error("Invalid movement type"));
    }

    let stock = await Stock.findOne({ product, warehouse });

    if (!stock) {
      if (type === "outbound") {
        res.status(400);
        return next(new Error("Insufficient stock: Record does not exist"));
      }
      stock = new Stock({
        product,
        warehouse,
        currentQuantity: 0,
      });
    }

    if (type === "inbound") {
      stock.currentQuantity += qty;
    } else if (type === "outbound") {
      if (stock.currentQuantity < qty) {
        res.status(400);
        return next(new Error("Insufficient stock for outbound movement"));
      }
      stock.currentQuantity -= qty;
    } else if (type === "adjustment") {
      stock.currentQuantity = qty;
    }

    await stock.save();

    const movementData = {
      product,
      toWarehouse: type === "inbound" ? warehouse : null,
      fromWarehouse: type === "outbound" ? warehouse : null,
      warehouse: warehouse,
      type,
      quantity: qty,
      reason,
    };

    if (req.user?._id || req.user?.id) {
      movementData.performedBy = req.user._id || req.user.id;
    }

    const movement = await StockMovement.create(movementData);

    await clearStockCache();

    if (type === "outbound" || type === "adjustment") {
      await checkAndTriggerLowStockAlert(product, warehouse, stock.currentQuantity);
    }

    res.status(201).json(movement);
  } catch (error) {
    next(error);
  }
};

const transferStock = async (req, res, next) => {
  try {
    const { product, fromWarehouse, toWarehouse, quantity, reason } = req.body;

    const qty = Number(quantity);
    if (!product || !fromWarehouse || !toWarehouse || !qty || qty <= 0) {
      res.status(400);
      return next(new Error("Invalid transfer parameters"));
    }

    if (fromWarehouse === toWarehouse) {
      res.status(400);
      return next(new Error("Source and destination warehouses cannot be identical"));
    }

    let sourceStock = await Stock.findOne({ product, warehouse: fromWarehouse });

    if (!sourceStock || sourceStock.currentQuantity < qty) {
      res.status(400);
      return next(new Error("Insufficient stock at source warehouse"));
    }

    sourceStock.currentQuantity -= qty;
    await sourceStock.save();

    let targetStock = await Stock.findOne({ product, warehouse: toWarehouse });

    if (!targetStock) {
      targetStock = new Stock({
        product,
        warehouse: toWarehouse,
        currentQuantity: 0,
      });
    }

    targetStock.currentQuantity += qty;
    await targetStock.save();

    // Fix 2: Generate separate transfer_out and transfer_in movement documents
    const transferOutData = {
      product,
      fromWarehouse,
      warehouse: fromWarehouse,
      type: "transfer_out",
      quantity: qty,
      reason: reason || "Inter-warehouse transfer",
    };

    const transferInData = {
      product,
      toWarehouse,
      warehouse: toWarehouse,
      type: "transfer_in",
      quantity: qty,
      reason: reason || "Inter-warehouse transfer",
    };

    if (req.user?._id || req.user?.id) {
      const userId = req.user._id || req.user.id;
      transferOutData.performedBy = userId;
      transferInData.performedBy = userId;
    }

    const [transferOut, transferIn] = await Promise.all([
      StockMovement.create(transferOutData),
      StockMovement.create(transferInData),
    ]);

    await clearStockCache();

    await checkAndTriggerLowStockAlert(product, fromWarehouse, sourceStock.currentQuantity);

    res.status(201).json({ transferOut, transferIn });
  } catch (error) {
    next(error);
  }
};

const getMovementHistory = async (req, res, next) => {
  try {
    const { product, warehouse, type, page, limit = 10 } = req.query;
    let filter = {};

    if (product && mongoose.Types.ObjectId.isValid(product)) {
      filter.product = product;
    }
    if (warehouse && mongoose.Types.ObjectId.isValid(warehouse)) {
      filter.$or = [
        { warehouse: warehouse },
        { fromWarehouse: warehouse },
        { toWarehouse: warehouse },
      ];
    }
    if (type) filter.type = type;

    if (page) {
      const p = parseInt(page, 10);
      const l = parseInt(limit, 10);
      const skip = (p - 1) * l;

      const [movements, total] = await Promise.all([
        StockMovement.find(filter)
          .populate({ path: "product", select: "name sku category", strictPopulate: false })
          .populate({ path: "warehouse", select: "name", strictPopulate: false })
          .populate({ path: "fromWarehouse", select: "name", strictPopulate: false })
          .populate({ path: "toWarehouse", select: "name", strictPopulate: false })
          .populate({ path: "performedBy", select: "name email", strictPopulate: false })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(l)
          .lean(),
        StockMovement.countDocuments(filter),
      ]);

      return res.json({
        data: movements,
        page: p,
        totalPages: Math.ceil(total / l),
        total,
      });
    }

    const movements = await StockMovement.find(filter)
      .populate({ path: "product", select: "name sku", strictPopulate: false })
      .populate({ path: "warehouse", select: "name", strictPopulate: false })
      .populate({ path: "fromWarehouse", select: "name", strictPopulate: false })
      .populate({ path: "toWarehouse", select: "name", strictPopulate: false })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit, 10))
      .lean();

    return res.json(movements);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createMovement,
  transferStock,
  getMovementHistory,
};