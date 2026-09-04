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
    if (!redisClient) return;
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

const recordMovement = async ({ product, warehouse, type, quantity, reason, attribution }) => {
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
      } else {
        updatedStock = await Stock.findOneAndUpdate(
          { product, warehouse },
          {
            $set: { currentQuantity: qty },
            $setOnInsert: { product, warehouse, lowStockThreshold: defaultThreshold },
          },
          { new: true, upsert: true, session }
        );
      }

      const movementData = {
        product,
        toWarehouse: type === "inbound" ? warehouse : null,
        fromWarehouse: type === "outbound" ? warehouse : null,
        warehouse,
        type,
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
  const { type, quantity, reason } = req.body;

  try {
    const { movement } = await recordMovement({
      product,
      warehouse,
      type,
      quantity,
      reason,
      attribution: buildAttribution(req),
    });
    res.status(201).json(movement);
  } catch (error) {
    if (error.statusCode) res.status(error.statusCode);
    next(error);
  }
};

const transferStock = async (req, res, next) => {
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

  const productDoc = await Product.findById(product).lean();
  const defaultThreshold = productDoc?.defaultThreshold ?? 10;

  const session = await mongoose.startSession();
  let sourceStock;
  let targetStock;
  let transferOut;
  let transferIn;
  let sourcePreviousQuantity = 0;
  let targetPreviousQuantity = 0;

  try {
    await session.withTransaction(async () => {
      const existingSource = await Stock.findOne({ product, warehouse: fromWarehouse }).session(session);
      sourcePreviousQuantity = existingSource ? existingSource.currentQuantity : 0;

      const existingTarget = await Stock.findOne({ product, warehouse: toWarehouse }).session(session);
      targetPreviousQuantity = existingTarget ? existingTarget.currentQuantity : 0;

      sourceStock = await Stock.findOneAndUpdate(
        { product, warehouse: fromWarehouse, currentQuantity: { $gte: qty } },
        { $inc: { currentQuantity: -qty } },
        { new: true, session }
      );

      if (!sourceStock) {
        const err = new Error("Insufficient stock at source warehouse");
        err.statusCode = 400;
        throw err;
      }

      targetStock = await Stock.findOneAndUpdate(
        { product, warehouse: toWarehouse },
        {
          $inc: { currentQuantity: qty },
          $setOnInsert: { product, warehouse: toWarehouse, lowStockThreshold: defaultThreshold },
        },
        { new: true, upsert: true, session }
      );

      const attribution = buildAttribution(req);

      const transferOutData = {
        product,
        fromWarehouse,
        warehouse: fromWarehouse,
        type: "transfer_out",
        quantity: qty,
        reason: reason || "Inter-warehouse transfer",
        ...attribution,
      };

      const transferInData = {
        product,
        toWarehouse,
        warehouse: toWarehouse,
        type: "transfer_in",
        quantity: qty,
        reason: reason || "Inter-warehouse transfer",
        ...attribution,
      };

      const createdOut = await StockMovement.create([transferOutData], { session });
      const createdIn = await StockMovement.create([transferInData], { session });
      transferOut = createdOut[0];
      transferIn = createdIn[0];
    });

    await clearStockCache();

    await checkStockThresholdEvents(
      product,
      fromWarehouse,
      sourcePreviousQuantity,
      sourceStock.currentQuantity,
      sourceStock.lowStockThreshold
    );

    await checkStockThresholdEvents(
      product,
      toWarehouse,
      targetPreviousQuantity,
      targetStock.currentQuantity,
      targetStock.lowStockThreshold
    );

    res.status(201).json({ transferOut, transferIn });
  } catch (error) {
    if (error.statusCode) res.status(error.statusCode);
    next(error);
  } finally {
    session.endSession();
  }
};

module.exports = {
  getMovementHistory,
  createMovement,
  transferStock,
  recordMovement,
};