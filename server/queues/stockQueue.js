const { Queue } = require("bullmq");
const { redisConfig } = require("../config/redis");

const stockQueue = new Queue("lowStockAlerts", {
  connection: redisConfig,
  defaultJobOptions: {
    attempts: 3, 
    backoff: {
      type: "exponential",
      delay: 3000,
    },
    removeOnComplete: true, 
  },
});

module.exports = stockQueue;