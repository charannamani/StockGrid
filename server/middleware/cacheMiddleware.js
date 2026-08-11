const redisClient = require("../config/redis");

const cache = (keyPrefix, ttlSeconds = 300) => {
  return async (req, res, next) => {
    const key = `${keyPrefix}:${req.originalUrl}`;

    try {
      const cachedData = await redisClient.get(key);
      if (cachedData) {
        return res.json(JSON.parse(cachedData));
      }

      const originalJson = res.json.bind(res);
      res.json = (data) => {
        if (res.statusCode === 200) {
          redisClient.setEx(key, ttlSeconds, JSON.stringify(data));
        }
        return originalJson(data);
      };

      next();
    } catch (error) {
      next();
    }
  };
};

module.exports = cache;