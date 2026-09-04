const ApiKey = require("../models/ApiKey");

const generateApiKey = async (req, res, next) => {
  try {
    const { name, callbackUrl } = req.body;

    if (!name) {
      res.status(400);
      return next(new Error("A name for the API key is required"));
    }

    const rawKey = ApiKey.generateRawKey();
    const hashedKey = ApiKey.hashKey(rawKey);

    const apiKey = await ApiKey.create({
      name,
      key: hashedKey,
      callbackUrl: callbackUrl || undefined,
      createdBy: req.user._id,
    });

    res.status(201).json({
      _id: apiKey._id,
      name: apiKey.name,
      callbackUrl: apiKey.callbackUrl || null,
      rawKey,
      message: "Save this key now — it will not be shown again",
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      res.status(400);
    }
    next(error);
  }
};

const listApiKeys = async (req, res, next) => {
  try {
    const keys = await ApiKey.find()
      .select("-key")
      .populate("createdBy", "name email");
    res.json(keys);
  } catch (error) {
    next(error);
  }
};

const revokeApiKey = async (req, res, next) => {
  try {
    const apiKey = await ApiKey.findById(req.params.id);
    if (!apiKey) {
      res.status(404);
      return next(new Error("API key not found"));
    }

    apiKey.isActive = false;
    await apiKey.save();

    res.json({ message: "API key revoked" });
  } catch (error) {
    next(error);
  }
};

module.exports = { generateApiKey, listApiKeys, revokeApiKey };