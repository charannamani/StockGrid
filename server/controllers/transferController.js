const mongoose = require("mongoose");
const Transfer = require("../models/Transfer");
const Stock = require("../models/Stock");
const Product = require("../models/Product");
const StockMovement = require("../models/StockMovement");
const {
  clearStockCache,
  buildAttribution,
  checkStockThresholdEvents,
} = require("./movementController");

const initiateTransfer = async (req, res, next) => {
  const { product, fromWarehouse, toWarehouse, quantity, notes } = req.body;
  const qty = Number(quantity);

  if (!product || !fromWarehouse || !toWarehouse || !qty || qty <= 0) {
    return res.status(400).json({ message: "Invalid transfer parameters" });
  }

  if (fromWarehouse.toString() === toWarehouse.toString()) {
    return res.status(400).json({ message: "Source and destination warehouses cannot be identical" });
  }

  const productDoc = await Product.findById(product).lean();
  const defaultThreshold = productDoc?.defaultThreshold ?? 10;

  const session = await mongoose.startSession();
  let sourceStock;
  let sourcePreviousQuantity = 0;
  let createdTransfer;

  try {
    await session.withTransaction(async () => {
      const existingSource = await Stock.findOne({
        product,
        warehouse: fromWarehouse,
      }).session(session);
      sourcePreviousQuantity = existingSource ? existingSource.currentQuantity : 0;

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

      const attribution = buildAttribution(req);

      const transferOutData = {
        product,
        fromWarehouse,
        toWarehouse,
        warehouse: fromWarehouse,
        type: "transfer_out",
        quantity: qty,
        reason: notes || "Transfer initiated",
        ...attribution,
      };

      const [outboundMovement] = await StockMovement.create([transferOutData], { session });

      const initiatorId = req.user?._id || req.user?.id || (req.apiKey && req.apiKey.createdBy);

      const [transferDoc] = await Transfer.create(
        [
          {
            product,
            fromWarehouse,
            toWarehouse,
            quantity: qty,
            status: "in_transit",
            initiatedBy: initiatorId,
            outboundMovement: outboundMovement._id,
            notes,
          },
        ],
        { session }
      );

      createdTransfer = transferDoc;
    });

    await clearStockCache();

    await checkStockThresholdEvents(
      product,
      fromWarehouse,
      sourcePreviousQuantity,
      sourceStock.currentQuantity,
      sourceStock.lowStockThreshold
    );

    res.status(201).json(createdTransfer);
  } catch (error) {
    if (error.statusCode) res.status(error.statusCode);
    next(error);
  } finally {
    session.endSession();
  }
};

const confirmTransfer = async (req, res, next) => {
  try {
    const transfer = req.transfer || (await Transfer.findById(req.params.id));

    if (!transfer) {
      return res.status(404).json({ message: "Transfer not found" });
    }

    if (transfer.status !== "in_transit") {
      return res.status(400).json({ message: "Cannot confirm a transfer that is not in_transit" });
    }

    const productDoc = await Product.findById(transfer.product).lean();
    const defaultThreshold = productDoc?.defaultThreshold ?? 10;

    const session = await mongoose.startSession();
    let targetStock;
    let targetPreviousQuantity = 0;

    try {
      await session.withTransaction(async () => {
        const existingTarget = await Stock.findOne({
          product: transfer.product,
          warehouse: transfer.toWarehouse,
        }).session(session);
        targetPreviousQuantity = existingTarget ? existingTarget.currentQuantity : 0;

        targetStock = await Stock.findOneAndUpdate(
          { product: transfer.product, warehouse: transfer.toWarehouse },
          {
            $inc: { currentQuantity: transfer.quantity },
            $setOnInsert: {
              product: transfer.product,
              warehouse: transfer.toWarehouse,
              lowStockThreshold: defaultThreshold,
            },
          },
          { new: true, upsert: true, session }
        );

        const attribution = buildAttribution(req);

        const transferInData = {
          product: transfer.product,
          fromWarehouse: transfer.fromWarehouse,
          toWarehouse: transfer.toWarehouse,
          warehouse: transfer.toWarehouse,
          type: "transfer_in",
          quantity: transfer.quantity,
          reason: "Transfer received",
          ...attribution,
        };

        const [inboundMovement] = await StockMovement.create([transferInData], { session });

        transfer.status = "received";
        transfer.receivedBy = req.user?._id || req.user?.id || (req.apiKey && req.apiKey.createdBy);
        transfer.receivedAt = new Date();
        transfer.inboundMovement = inboundMovement._id;

        await transfer.save({ session });
      });

      await clearStockCache();

      await checkStockThresholdEvents(
        transfer.product,
        transfer.toWarehouse,
        targetPreviousQuantity,
        targetStock.currentQuantity,
        targetStock.lowStockThreshold
      );

      res.json(transfer);
    } finally {
      session.endSession();
    }
  } catch (error) {
    if (error.statusCode) res.status(error.statusCode);
    next(error);
  }
};

const cancelTransfer = async (req, res, next) => {
  try {
    const transfer = req.transfer || (await Transfer.findById(req.params.id));

    if (!transfer) {
      return res.status(404).json({ message: "Transfer not found" });
    }

    if (transfer.status !== "in_transit") {
      return res.status(400).json({ message: "Cannot cancel a transfer that is not in_transit" });
    }

    const productDoc = await Product.findById(transfer.product).lean();
    const defaultThreshold = productDoc?.defaultThreshold ?? 10;

    const session = await mongoose.startSession();
    let sourceStock;
    let sourcePreviousQuantity = 0;

    try {
      await session.withTransaction(async () => {
        const existingSource = await Stock.findOne({
          product: transfer.product,
          warehouse: transfer.fromWarehouse,
        }).session(session);
        sourcePreviousQuantity = existingSource ? existingSource.currentQuantity : 0;

        sourceStock = await Stock.findOneAndUpdate(
          { product: transfer.product, warehouse: transfer.fromWarehouse },
          {
            $inc: { currentQuantity: transfer.quantity },
            $setOnInsert: {
              product: transfer.product,
              warehouse: transfer.fromWarehouse,
              lowStockThreshold: defaultThreshold,
            },
          },
          { new: true, upsert: true, session }
        );

        const attribution = buildAttribution(req);

        const revertMovementData = {
          product: transfer.product,
          warehouse: transfer.fromWarehouse,
          fromWarehouse: transfer.fromWarehouse,
          toWarehouse: transfer.fromWarehouse,
          type: "inbound",
          quantity: transfer.quantity,
          reason: req.body.notes || "Transfer cancelled — stock returned to source",
          ...attribution,
        };

        await StockMovement.create([revertMovementData], { session });

        transfer.status = "cancelled";
        transfer.cancelledAt = new Date();
        if (req.body.notes) {
          transfer.notes = req.body.notes;
        }

        await transfer.save({ session });
      });

      await clearStockCache();

      await checkStockThresholdEvents(
        transfer.product,
        transfer.fromWarehouse,
        sourcePreviousQuantity,
        sourceStock.currentQuantity,
        sourceStock.lowStockThreshold
      );

      res.json(transfer);
    } finally {
      session.endSession();
    }
  } catch (error) {
    if (error.statusCode) res.status(error.statusCode);
    next(error);
  }
};

const getTransfers = async (req, res, next) => {
  try {
    const { status, product, warehouse, page = 1, limit = 50 } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (product) filter.product = product;
    if (warehouse) {
      filter.$or = [{ fromWarehouse: warehouse }, { toWarehouse: warehouse }];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const transfers = await Transfer.find(filter)
      .populate("product", "name sku")
      .populate("fromWarehouse", "name address")
      .populate("toWarehouse", "name address")
      .populate("initiatedBy", "name email")
      .populate("receivedBy", "name email")
      .populate("outboundMovement")
      .populate("inboundMovement")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const total = await Transfer.countDocuments(filter);

    res.json({
      transfers,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
    });
  } catch (error) {
    next(error);
  }
};

const getTransferById = async (req, res, next) => {
  try {
    const transfer = await Transfer.findById(req.params.id)
      .populate("product", "name sku")
      .populate("fromWarehouse", "name address")
      .populate("toWarehouse", "name address")
      .populate("initiatedBy", "name email")
      .populate("receivedBy", "name email")
      .populate("outboundMovement")
      .populate("inboundMovement");

    if (!transfer) {
      return res.status(404).json({ message: "Transfer not found" });
    }

    res.json(transfer);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  initiateTransfer,
  confirmTransfer,
  cancelTransfer,
  getTransfers,
  getTransferById,
};
