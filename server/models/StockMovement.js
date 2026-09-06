const mongoose = require("mongoose");

const stockMovementSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    warehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
    },
    fromWarehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
    },
    toWarehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
    },
    type: {
      type: String,
      required: true,
      enum: [
        "inbound",
        "outbound",
        "transfer_in",
        "transfer_out",
        "adjustment",
      ],
    },
    direction: {
      type: String,
      enum: ["increase", "decrease"],
    },
    quantity: {
      type: Number,
      required: true,
    },
    reason: {
      type: String,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    performedByApiKey: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ApiKey",
    },
    source: {
      type: String,
      enum: ["web", "api_key"],
      default: "web",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("StockMovement", stockMovementSchema);