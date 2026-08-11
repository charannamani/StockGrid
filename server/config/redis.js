const Redis = require("ioredis");

const redisConfig = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: process.env.REDIS_PORT || 6379,
  maxRetriesPerRequest: null, // Required by BullMQ
};

const redisConnection = new Redis(redisConfig);

redisConnection.on("connect", () => {
  console.log("Redis connected successfully via Docker");
});

redisConnection.on("error", (err) => {
  console.error("Redis connection error:", err.message);
});

module.exports = { redisConnection, redisConfig };