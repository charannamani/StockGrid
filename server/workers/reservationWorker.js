const { Worker } = require("bullmq");
const mongoose = require("mongoose");
const { redisConnection } = require("../config/redis");
const Reservation = require("../models/Reservation");
const Stock = require("../models/Stock");

const reservationWorker = new Worker(
  "reservationExpiryQueue",
  async (job) => {
    const { reservationId } = job.data;

    const reservation = await Reservation.findOne({ reservationId });
    if (!reservation || reservation.status !== "pending") {
      return { status: "skipped", reason: "Already resolved or not found" };
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const lockedRes = await Reservation.findOneAndUpdate(
          { reservationId, status: "pending" },
          { $set: { status: "released" } },
          { new: true, session }
        );

        if (!lockedRes) return;

        await Stock.findOneAndUpdate(
          { product: lockedRes.product, warehouse: lockedRes.warehouse },
          { $inc: { reservedQuantity: -lockedRes.quantity } },
          { session }
        );
      });

      return { status: "auto_released", reservationId };
    } finally {
      session.endSession();
    }
  },
  {
    connection: redisConnection,
    concurrency: 5,
  }
);

module.exports = reservationWorker;