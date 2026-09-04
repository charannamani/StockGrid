const { redisConnection: redisClient } = require("../config/redis");

const idempotencyMiddleware = async (req, res, next) => {
  const idempotencyKey = req.headers["idempotency-key"] || req.body.orderId;

  if (!idempotencyKey) {
    return next();
  }

  const cacheKey = `idempotency:${idempotencyKey}`;

  try {
    if (!redisClient) {
      return next();
    }

    const cachedData = await redisClient.get(cacheKey);

    if (cachedData) {
      const parsed = JSON.parse(cachedData);

      if (parsed.status === "in_progress") {
        return res.status(409).json({
          message: "A request with this idempotency key is currently processing. Please retry shortly.",
        });
      }

      return res.status(parsed.statusCode).json(parsed.body);
    }

    await redisClient.set(
      cacheKey,
      JSON.stringify({ status: "in_progress" }),
      "EX",
      60
    );

    const originalJson = res.json.bind(res);

    res.json = (body) => {
      const statusCode = res.statusCode || 200;

      redisClient.set(
        cacheKey,
        JSON.stringify({ status: "completed", statusCode, body }),
        "EX",
        86400
      ).catch((err) => console.error("Redis idempotency cache error:", err.message));

      return originalJson(body);
    };

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = idempotencyMiddleware;