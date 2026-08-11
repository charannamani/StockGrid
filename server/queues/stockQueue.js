const { Queue } = require("bullmq");
const { redisConfig } = require("../config/redis");

const stockQueue = new Queue("lowStockAlerts", {
  connection: redisConfig,
  defaultJobOptions: {
    attempts: 3, // Auto-retry failed jobs 3 times
    backoff: {
      type: "exponential",
      delay: 3000, // 3s, 6s, 12s retries
    },
    removeOnComplete: true, // Auto-clean finished jobs from Redis
  },
});

module.exports = stockQueue;