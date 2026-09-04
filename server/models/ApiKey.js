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

    callbackUrl: {
      type: String,
      trim: true,
      validate: {
        validator: function (value) {
          if (!value) return true; 
          try {
            const parsed = new URL(value);
            return parsed.protocol === "http:" || parsed.protocol === "https:";
          } catch {
            return false;
          }
        },
        message: "callbackUrl must be a valid http(s) URL",
      },
    },
  },
  { timestamps: true }
);

apiKeySchema.statics.generateRawKey = function () {
  return crypto.randomBytes(32).toString("hex");
};

apiKeySchema.statics.hashKey = function (rawKey) {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
};

module.exports = mongoose.model("ApiKey", apiKeySchema);