const { Worker } = require("bullmq");
const { redisConfig } = require("../config/redis");

const stockWorker = new Worker(
  "lowStockAlerts",
  async (job) => {
    const { productId, warehouseId, currentQuantity, threshold } = job.data;

    console.log(`\n[QUEUE JOB ${job.id}] Processing low stock alert...`);

    // Simulate sending email/webhook alert (1.5s artificial latency)
    await new Promise((resolve) => setTimeout(resolve, 1500));

    console.log(
      `[ALERT SENT] Product ${productId} in Warehouse ${warehouseId} dropped to ${currentQuantity} (Threshold: ${threshold}).\n`
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