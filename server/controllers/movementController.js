const mongoose = require("mongoose");
const StockMovement = require("../models/StockMovement");
const Stock = require("../models/Stock");
const Product = require("../models/Product");
const Warehouse = require("../models/Warehouse");
const stockQueue = require("../queues/stockQueue");
const { redisConnection: redisClient } = require("../config/redis");

const scanKeys = async (pattern) => {
  const found = [];
  let cursor = "0";
  do {
    const [nextCursor, keys] = await redisClient.scan(cursor, "MATCH", pattern, "COUNT", 100);
    cursor = nextCursor;
    found.push(...keys);
  } while (cursor !== "0");
  return found;
};

const clearStockCache = async () => {
  try {
    if (!redisClient || redisClient.status !== "ready") return;
    const [keys, whKeys, prodKeys, availKeys] = await Promise.all([
      scanKeys("stocks:*"),
      scanKeys("stock_wh:*"),
      scanKeys("stock_prod:*"),
      scanKeys("availability:*"),
    ]);

    const allKeys = [...keys, ...whKeys, ...prodKeys, ...availKeys];
    if (allKeys.length > 0) {
      await redisClient.del(allKeys);
    }
  } catch (error) {
    console.error("Cache clearance error:", error.message);
  }
};

const buildAttribution = (req) => {
  if (req.isApiKeyAuth && req.apiKey) {
    return {
      source: "api_key",
      performedByApiKey: req.apiKey._id,
      performedBy: req.apiKey.createdBy?._id || req.apiKey.createdBy || undefined,
    };
  }
  if (req.user?._id || req.user?.id) {
    return { source: "web", performedBy: req.user._id || req.user.id };
  }
  return { source: "web" };
};

const checkStockThresholdEvents = async (productId, warehouseId, previousQuantity, newQuantity, threshold) => {
  try {
    const product = await Product.findById(productId).lean();
    const warehouse = await Warehouse.findById(warehouseId).lean();
    if (!product || !warehouse) return;

    const resolvedThreshold = threshold ?? product.defaultThreshold ?? 10;
    const wasLow = previousQuantity <= resolvedThreshold;
    const isLowNow = newQuantity <= resolvedThreshold;

    if (isLowNow) {
      await stockQueue.add("lowStockAlert", {
        productId: product._id,
        productName: product.name,
        warehouseId: warehouse._id,
        warehouseName: warehouse.name,
        currentQuantity: newQuantity,
        threshold: resolvedThreshold,
      });
    } else if (wasLow && !isLowNow) {
      await stockQueue.add("backInStock", {
        productId: product._id,
        productName: product.name,
        warehouseId: warehouse._id,
        warehouseName: warehouse.name,
        currentQuantity: newQuantity,
        threshold: resolvedThreshold,
      });
    }
  } catch (error) {
    console.error("Stock threshold event queue error:", error.message);
  }
};

const recordMovement = async ({ product, warehouse, type, quantity, reason, attribution, direction }) => {
  const qty = Number(quantity);

  if (!product || !warehouse || !type || !qty || qty <= 0) {
    const err = new Error("Invalid movement parameters provided");
    err.statusCode = 400;
    throw err;
  }

  if (type !== "inbound" && type !== "outbound" && type !== "adjustment") {
    const err = new Error("Invalid movement type");
    err.statusCode = 400;
    throw err;
  }

  if (type === "adjustment" && direction !== "increase" && direction !== "decrease") {
    const err = new Error("Adjustment direction must be 'increase' or 'decrease'");
    err.statusCode = 400;
    throw err;
  }

  const productDoc = await Product.findById(product).lean();
  const defaultThreshold = productDoc?.defaultThreshold ?? 10;

  const session = await mongoose.startSession();
  let updatedStock;
  let movement;
  let previousQuantity = 0;

  try {
    await session.withTransaction(async () => {
      const existingStock = await Stock.findOne({ product, warehouse }).session(session);
      previousQuantity = existingStock ? existingStock.currentQuantity : 0;

      if (type === "inbound") {
        updatedStock = await Stock.findOneAndUpdate(
          { product, warehouse },
          {
            $inc: { currentQuantity: qty },
            $setOnInsert: { product, warehouse, lowStockThreshold: defaultThreshold },
          },
          { new: true, upsert: true, session }
        );
      } else if (type === "outbound") {
        updatedStock = await Stock.findOneAndUpdate(
          { product, warehouse, currentQuantity: { $gte: qty } },
          { $inc: { currentQuantity: -qty } },
          { new: true, session }
        );
        if (!updatedStock) {
          const err = new Error("Insufficient stock for outbound movement");
          err.statusCode = 400;
          throw err;
        }
      } else if (type === "adjustment") {
        if (direction === "increase") {
          updatedStock = await Stock.findOneAndUpdate(
            { product, warehouse },
            {
              $inc: { currentQuantity: qty },
              $setOnInsert: { product, warehouse, lowStockThreshold: defaultThreshold },
            },
            { new: true, upsert: true, session }
          );
        } else {
          updatedStock = await Stock.findOneAndUpdate(
            { product, warehouse, currentQuantity: { $gte: qty } },
            { $inc: { currentQuantity: -qty } },
            { new: true, session }
          );
          if (!updatedStock) {
            const err = new Error("Insufficient stock for adjustment");
            err.statusCode = 400;
            throw err;
          }
        }
      }

      const movementData = {
        product,
        toWarehouse: type === "inbound" ? warehouse : null,
        fromWarehouse: type === "outbound" ? warehouse : null,
        warehouse,
        type,
        direction: type === "adjustment" ? direction : undefined,
        quantity: qty,
        reason,
        ...attribution,
      };

      const created = await StockMovement.create([movementData], { session });
      movement = created[0];
    });

    await clearStockCache();

    await checkStockThresholdEvents(
      product,
      warehouse,
      previousQuantity,
      updatedStock.currentQuantity,
      updatedStock.lowStockThreshold
    );

    return { movement, stock: updatedStock };
  } finally {
    session.endSession();
  }
};

const getMovementHistory = async (req, res, next) => {
  try {
    const { product, warehouse, type, limit = 50, page = 1 } = req.query;
    const filter = {};

    if (product) filter.product = product;
    if (warehouse) filter.$or = [{ warehouse }, { fromWarehouse: warehouse }, { toWarehouse: warehouse }];
    if (type) filter.type = type;

    const skip = (Number(page) - 1) * Number(limit);

    const movements = await StockMovement.find(filter)
      .populate("product", "name sku")
      .populate("warehouse", "name address")
      .populate("fromWarehouse", "name address")
      .populate("toWarehouse", "name address")
      .populate("performedBy", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const total = await StockMovement.countDocuments(filter);

    res.json({ movements, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (error) {
    next(error);
  }
};

const createMovement = async (req, res, next) => {
  const product = req.body.product || req.body.productId;
  const warehouse = req.body.warehouse || req.body.warehouseId;
  const { type, quantity, reason, direction } = req.body;

  try {
    const { movement } = await recordMovement({
      product,
      warehouse,
      type,
      quantity,
      direction,
      reason,
      attribution: buildAttribution(req),
    });
    res.status(201).json(movement);
  } catch (error) {
    if (error.statusCode) res.status(error.statusCode);
    next(error);
  }
};

module.exports = {
  getMovementHistory,
  createMovement,
  recordMovement,
  clearStockCache,
  buildAttribution,
  checkStockThresholdEvents,
};