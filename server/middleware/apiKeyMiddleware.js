const ApiKey = require("../models/ApiKey");


const apiKeyAuth = async (req, res, next) => {
  const rawKey = req.headers["x-api-key"];

  if (!rawKey) {
    return res.status(401).json({ message: "API key required" });
  }

  try {
    const hashedKey = ApiKey.hashKey(rawKey);

    const apiKeyDoc = await ApiKey.findOne({ key: hashedKey, isActive: true }).populate(
      "createdBy",
      "_id name role"
    );

    if (!apiKeyDoc) {
      return res.status(401).json({ message: "Invalid or inactive API key" });
    }

    req.apiKey = apiKeyDoc;

    next();
  } catch (error) {
    res.status(500).json({ message: "Server error during API key validation" });
  }
};

module.exports = apiKeyAuth;