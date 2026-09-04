const { Worker } = require("bullmq");
const crypto = require("crypto");
const { redisConfig } = require("../config/redis");
const ApiKey = require("../models/ApiKey");

const deliverWebhook = async (callbackUrl, eventType, payload) => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(callbackUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Event": eventType,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    return res.ok;
  } catch (err) {
    console.error(`[WEBHOOK DELIVERY FAILED] ${callbackUrl}: ${err.message}`);
    return false;
  }
};

const stockWorker = new Worker(
  "lowStockAlerts",
  async (job) => {
    const { productId, productName, warehouseId, warehouseName, currentQuantity, threshold } = job.data;

    const eventType = job.name === "backInStock" ? "stock.replenished" : "stock.low";
    const logLabel = job.name === "backInStock" ? "BACK IN STOCK" : "LOW STOCK ALERT";

    console.log(`\n[QUEUE JOB ${job.id}] Processing ${logLabel.toLowerCase()}...`);
    console.log(
      `[${logLabel}] ${productName} in ${warehouseName} is now at ${currentQuantity} (Threshold: ${threshold}).`
    );

    const eventId = `${job.id}-${crypto.randomBytes(4).toString("hex")}`;
    const payload = {
      eventId,
      event: eventType,
      productId,
      productName,
      warehouseId,
      warehouseName,
      currentQuantity,
      threshold,
      triggeredAt: new Date().toISOString(),
    };

    const subscribers = await ApiKey.find({
      isActive: true,
      callbackUrl: { $exists: true, $ne: null, $ne: "" },
    }).lean();

    if (subscribers.length === 0) {
      console.log(`[QUEUE JOB ${job.id}] No registered webhook subscribers, nothing to deliver.\n`);
      return;
    }

    const deliveries = await Promise.all(
      subscribers.map((sub) => deliverWebhook(sub.callbackUrl, eventType, payload))
    );

    const succeeded = deliveries.filter(Boolean).length;
    console.log(
      `[QUEUE JOB ${job.id}] Delivered to ${succeeded}/${subscribers.length} subscriber(s).\n`
    );
  },
  { connection: redisConfig }
);

stockWorker.on("completed", (job) => {
  console.log(`[QUEUE JOB ${job.id}] Completed successfully!`);
});

stockWorker.on("failed", (job, err) => {
  console.error(`[QUEUE JOB ${job.id}] Failed: ${err.message}`);
});

module.exports = stockWorker;