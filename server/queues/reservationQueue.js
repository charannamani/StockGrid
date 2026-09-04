const { Queue } = require("bullmq");
const { redisConnection } = require("../config/redis");

const reservationQueue = new Queue("reservationExpiryQueue", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

module.exports = reservationQueue;