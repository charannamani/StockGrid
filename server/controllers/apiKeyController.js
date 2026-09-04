const crypto = require("crypto");
const ApiKey = require("../models/ApiKey");

const getApiKeys = async (req, res, next) => {
  try {
    const keys = await ApiKey.find({ isActive: true })
      .select("-keySecret")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 })
      .lean();
    res.json(keys);
  } catch (error) {
    next(error);
  }
};

const generateApiKey = async (req, res, next) => {
  try {
    const { name, callbackUrl } = req.body;

    if (!name || name.trim() === "") {
      res.status(400);
      return next(new Error("Key name is required"));
    }

    const rawKey = `sg_${crypto.randomBytes(24).toString("hex")}`;
    const keySecret = crypto.randomBytes(32).toString("hex");

    const newKey = await ApiKey.create({
      name: name.trim(),
      key: rawKey,
      keySecret,
      callbackUrl: callbackUrl ? callbackUrl.trim() : undefined,
      createdBy: req.user._id,
    });

    res.status(201).json({
      _id: newKey._id,
      name: newKey.name,
      key: rawKey,
      keySecret,
      callbackUrl: newKey.callbackUrl,
      createdAt: newKey.createdAt,
    });
  } catch (error) {
    next(error);
  }
};

const updateApiKey = async (req, res, next) => {
  try {
    const { callbackUrl, name } = req.body;
    const apiKey = await ApiKey.findById(req.params.id);

    if (!apiKey) {
      res.status(404);
      return next(new Error("API key not found"));
    }

    if (name) apiKey.name = name.trim();
    if (callbackUrl !== undefined) apiKey.callbackUrl = callbackUrl.trim();

    await apiKey.save();
    res.json(apiKey);
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

    res.json({ message: "API key revoked successfully" });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getApiKeys,
  generateApiKey,
  updateApiKey,
  revokeApiKey,
};