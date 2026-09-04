const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    sku: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    unitCost: {
      type: Number,
      required: true,
      min: 0,
    },
    defaultThreshold: {
      type: Number,
      default: 10,
      min: 0,
    },
    description: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

productSchema.index({ name: "text", sku: "text" });
productSchema.index({ category: 1 });

module.exports = mongoose.model("Product", productSchema);