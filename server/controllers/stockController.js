const mongoose = require("mongoose");
const Stock = require("../models/Stock");
const Product = require("../models/Product");

const getStockLevels = async (req, res, next) => {
  try {
    const { product, warehouse } = req.query;
    const filter = {};

    if (product && mongoose.Types.ObjectId.isValid(product)) {
      filter.product = product;
    }
    if (warehouse && mongoose.Types.ObjectId.isValid(warehouse)) {
      filter.warehouse = warehouse;
    }

    const stock = await Stock.find(filter)
      .populate("product", "name sku category unitCost price lowStockThreshold")
      .populate("warehouse", "name address location")
      .lean();

    const validStock = stock.filter((entry) => entry.product && entry.warehouse);

    res.json(validStock);
  } catch (error) {
    next(error);
  }
};

const getStockByWarehouse = async (req, res, next) => {
  try {
    const { warehouseId } = req.params;

    if (!warehouseId || !mongoose.Types.ObjectId.isValid(warehouseId)) {
      return res.json([]);
    }

    const stock = await Stock.find({ warehouse: warehouseId })
      .populate("product", "name sku category unitCost price lowStockThreshold")
      .lean();

    const validStock = stock.filter((entry) => entry.product);
    res.json(validStock);
  } catch (error) {
    next(error);
  }
};

const getStockByProduct = async (req, res, next) => {
  try {
    const { productId } = req.params;

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.json({ totalQuantity: 0, byWarehouse: [] });
    }

    const stock = await Stock.find({ product: productId })
      .populate("warehouse", "name address location")
      .lean();

    const validStock = stock.filter((entry) => entry.warehouse);
    const totalQuantity = validStock.reduce((sum, entry) => sum + (entry.currentQuantity || 0), 0);

    res.json({ totalQuantity, byWarehouse: validStock });
  } catch (error) {
    next(error);
  }
};

const checkAvailability = async (req, res, next) => {
  try {
    const { productId, quantity } = req.query;

    if (!productId || !quantity || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.json({
        fulfillable: false,
        strategy: "invalid_input",
        totalAvailable: 0,
        options: [],
      });
    }

    const requestedQty = Number(quantity);

    const product = await Product.findById(productId).lean();
    if (!product) {
      return res.json({
        fulfillable: false,
        strategy: "product_not_found",
        totalAvailable: 0,
        options: [],
      });
    }

    const stockEntries = await Stock.find({ product: productId, currentQuantity: { $gt: 0 } })
      .populate("warehouse", "name address location")
      .sort({ currentQuantity: -1 })
      .lean();

    const validEntries = stockEntries.filter((entry) => entry.warehouse);

    const singleSource = validEntries.find((entry) => entry.currentQuantity >= requestedQty);

    if (singleSource) {
      return res.json({
        fulfillable: true,
        strategy: "single_warehouse",
        options: [
          {
            warehouse: singleSource.warehouse,
            quantityAvailable: singleSource.currentQuantity,
          },
        ],
      });
    }

    const combination = [];
    let remaining = requestedQty;

    for (const entry of validEntries) {
      if (remaining <= 0) break;
      const take = Math.min(entry.currentQuantity, remaining);
      combination.push({
        warehouse: entry.warehouse,
        quantityAvailable: entry.currentQuantity,
        quantityToUse: take,
      });
      remaining -= take;
    }

    if (remaining <= 0) {
      return res.json({
        fulfillable: true,
        strategy: "multi_warehouse",
        options: combination,
      });
    }

    const totalAvailable = validEntries.reduce((sum, e) => sum + e.currentQuantity, 0);

    return res.json({
      fulfillable: false,
      strategy: "insufficient_stock",
      totalAvailable,
      shortfall: requestedQty - totalAvailable,
      options: combination,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getStockLevels,
  getStockByWarehouse,
  getStockByProduct,
  checkAvailability,
};