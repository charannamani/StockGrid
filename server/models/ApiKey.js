const mongoose = require("mongoose");
const crypto = require("crypto");

const apiKeySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    key: {
      type: String,
      required: true,
      unique: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

// Generates a random API key string (raw key, shown to the user only once)
apiKeySchema.statics.generateRawKey = function () {
  return crypto.randomBytes(32).toString("hex");
};

// Hash a raw key for storage/lookup comparison
apiKeySchema.statics.hashKey = function (rawKey) {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
};

module.exports = mongoose.model("ApiKey", apiKeySchema);