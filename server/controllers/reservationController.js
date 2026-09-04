const crypto = require("crypto");
const mongoose = require("mongoose");
const Reservation = require("../models/Reservation");
const Stock = require("../models/Stock");
const Product = require("../models/Product");
const Warehouse = require("../models/Warehouse");
const reservationQueue = require("../queues/reservationQueue");
const { recordMovement } = require("./movementController");

const RESERVE_TTL_MS = 10 * 60 * 1000;

const reserveStock = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    const { productId, warehouseId, quantity, clientReference } = req.body;
    const qty = Number(quantity);

    if (!productId || !warehouseId || !qty || qty <= 0) {
      res.status(400);
      return next(new Error("Invalid reservation parameters"));
    }

    const reservationId = `rsv_${crypto.randomBytes(16).toString("hex")}`;
    const expiresAt = new Date(Date.now() + RESERVE_TTL_MS);

    let createdReservation;

    await session.withTransaction(async () => {
      const stock = await Stock.findOne({ product: productId, warehouse: warehouseId }).session(session);

      if (!stock) {
        const err = new Error("No inventory record for this product at the specified warehouse");
        err.statusCode = 404;
        throw err;
      }

      const availableToPromise = stock.currentQuantity - stock.reservedQuantity;
      if (availableToPromise < qty) {
        const err = new Error(`Insufficient sellable stock. Available to promise: ${availableToPromise}`);
        err.statusCode = 422;
        throw err;
      }

      stock.reservedQuantity += qty;
      await stock.save({ session });

      const [resDoc] = await Reservation.create(
        [
          {
            reservationId,
            product: productId,
            warehouse: warehouseId,
            quantity: qty,
            status: "pending",
            expiresAt,
            clientReference: clientReference || undefined,
          },
        ],
        { session }
      );

      createdReservation = resDoc;
    });

    await reservationQueue.add(
      "expireReservation",
      { reservationId },
      { delay: RESERVE_TTL_MS, jobId: reservationId }
    );

    res.status(201).json({
      success: true,
      reservationId: createdReservation.reservationId,
      quantityReserved: qty,
      expiresAt: createdReservation.expiresAt,
      ttlSeconds: RESERVE_TTL_MS / 1000,
    });
  } catch (error) {
    if (error.statusCode) res.status(error.statusCode);
    next(error);
  } finally {
    session.endSession();
  }
};

const confirmReservation = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    const { reservationId, orderId } = req.body;

    if (!reservationId) {
      res.status(400);
      return next(new Error("reservationId is required"));
    }

    let reservation;
    await session.withTransaction(async () => {
      reservation = await Reservation.findOne({ reservationId }).session(session);

      if (!reservation) {
        const err = new Error("Reservation not found");
        err.statusCode = 404;
        throw err;
      }

      if (reservation.status === "confirmed") {
        return;
      }

      if (reservation.status === "released") {
        const err = new Error("Reservation has already expired or been cancelled");
        err.statusCode = 410;
        throw err;
      }

      reservation.status = "confirmed";
      await reservation.save({ session });

      await Stock.findOneAndUpdate(
        { product: reservation.product, warehouse: reservation.warehouse },
        {
          $inc: {
            currentQuantity: -reservation.quantity,
            reservedQuantity: -reservation.quantity,
          },
        },
        { session }
      );
    });

    try {
      const job = await reservationQueue.getJob(reservationId);
      if (job) await job.remove();
    } catch (e) {
      console.error("Delayed job cleanup error:", e.message);
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

    const reasonText = orderId
      ? `Confirmed Hold: Order #${orderId} (Rsv: ${reservationId})`
      : `Confirmed Hold: Reservation ${reservationId}`;

    await recordMovement({
      product: reservation.product,
      warehouse: reservation.warehouse,
      type: "outbound",
      quantity: reservation.quantity,
      reason: reasonText,
      attribution,
    });

    res.json({
      success: true,
      reservationId,
      status: "confirmed",
      quantityDeducted: reservation.quantity,
    });
  } catch (error) {
    if (error.statusCode) res.status(error.statusCode);
    next(error);
  } finally {
    session.endSession();
  }
};

const releaseReservation = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    const { reservationId } = req.body;

    if (!reservationId) {
      res.status(400);
      return next(new Error("reservationId is required"));
    }

    let freedQuantity = 0;

    await session.withTransaction(async () => {
      const reservation = await Reservation.findOne({ reservationId }).session(session);

      if (!reservation) {
        const err = new Error("Reservation not found");
        err.statusCode = 404;
        throw err;
      }

      if (reservation.status === "released") {
        return;
      }

      if (reservation.status === "confirmed") {
        const err = new Error("Cannot release an already confirmed reservation");
        err.statusCode = 400;
        throw err;
      }

      reservation.status = "released";
      await reservation.save({ session });

      freedQuantity = reservation.quantity;

      await Stock.findOneAndUpdate(
        { product: reservation.product, warehouse: reservation.warehouse },
        { $inc: { reservedQuantity: -reservation.quantity } },
        { session }
      );
    });

    try {
      const job = await reservationQueue.getJob(reservationId);
      if (job) await job.remove();
    } catch (e) {
      console.error("Job remove error:", e.message);
    }

    res.json({
      success: true,
      reservationId,
      status: "released",
      freedQuantity,
    });
  } catch (error) {
    if (error.statusCode) res.status(error.statusCode);
    next(error);
  } finally {
    session.endSession();
  }
};

module.exports = {
  reserveStock,
  confirmReservation,
  releaseReservation,
};