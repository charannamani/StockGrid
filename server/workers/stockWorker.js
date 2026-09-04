const { Worker } = require("bullmq");
const { redisConnection } = require("../config/redis");
const ApiKey = require("../models/ApiKey");
const crypto = require("crypto");

const buildEnvelope = (eventName, data) => ({
  eventId: crypto.randomUUID(),
  event: eventName,
  timestamp: new Date().toISOString(),
  data,
});

const signPayload = (payloadString, secret) => {
  if (!secret) return "";
  return crypto
    .createHmac("sha256", secret)
    .update(payloadString)
    .digest("hex");
};

const dispatchWebhook = async (url, payload, secret) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  const payloadString = JSON.stringify(payload);
  const signature = signPayload(payloadString, secret);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Event": payload.event,
        "X-StockGrid-Signature": signature,
      },
      body: payloadString,
      signal: controller.signal,
    });
    return response.ok;
  } catch (err) {
    return false;
  } finally {
    clearTimeout(timeout);
  }
};

const stockWorker = new Worker(
  "lowStockAlerts",
  async (job) => {
    const eventName = job.name === "backInStock" ? "stock.replenished" : "stock.low";
    const envelope = buildEnvelope(eventName, job.data);

    const subscribers = await ApiKey.find({
      isActive: true,
      callbackUrl: { $exists: true, $ne: "" },
    }).lean();

    if (subscribers.length === 0) {
      return { delivered: 0, total: 0 };
    }

    const results = await Promise.allSettled(
      subscribers.map((sub) =>
        dispatchWebhook(sub.callbackUrl, envelope, sub.keySecret)
      )
    );

    const delivered = results.filter(
      (r) => r.status === "fulfilled" && r.value === true
    ).length;

    return { delivered, total: subscribers.length };
  },
  {
    connection: redisConnection,
    concurrency: 5,
  }
);

module.exports = stockWorker;