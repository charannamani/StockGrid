const mongoose = require("mongoose");

const stockSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    warehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
    },
    currentQuantity: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    lowStockThreshold: {
      type: Number,
      default: 10,
    },
  },
  { timestamps: true }
);

stockSchema.index({ product: 1, warehouse: 1 }, { unique: true });
stockSchema.index({ warehouse: 1, currentQuantity: 1 });

module.exports = mongoose.model("Stock", stockSchema);