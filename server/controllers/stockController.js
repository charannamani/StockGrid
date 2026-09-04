const mongoose = require("mongoose");
const Stock = require("../models/Stock");
const Product = require("../models/Product");

const haversineDistanceKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

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
      .populate("warehouse", "name address latitude longitude")
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
      .populate("warehouse", "name address latitude longitude")
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
    const { productId, quantity, destLat, destLng } = req.query;

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
      .populate("warehouse", "name address latitude longitude")
      .lean();

    let validEntries = stockEntries.filter((entry) => entry.warehouse);

    const hasDestination = destLat !== undefined && destLng !== undefined && destLat !== "" && destLng !== "";
    const destLatNum = Number(destLat);
    const destLngNum = Number(destLng);

    let usingCostOptimal = false;

    if (hasDestination && !Number.isNaN(destLatNum) && !Number.isNaN(destLngNum)) {
      const entriesWithCoords = validEntries.filter(
        (entry) => entry.warehouse.latitude != null && entry.warehouse.longitude != null
      );

      if (entriesWithCoords.length > 0) {
        usingCostOptimal = true;
        validEntries = entriesWithCoords
          .map((entry) => ({
            ...entry,
            distanceKm: Math.round(
              haversineDistanceKm(
                destLatNum,
                destLngNum,
                entry.warehouse.latitude,
                entry.warehouse.longitude
              ) * 10
            ) / 10,
          }))
          .sort((a, b) => a.distanceKm - b.distanceKm);
      }
    }

    if (!usingCostOptimal) {
      validEntries = validEntries.sort((a, b) => b.currentQuantity - a.currentQuantity);
    }

    const strategy = usingCostOptimal ? "cost_optimal" : "quantity_greedy";

    if (usingCostOptimal) {
      const singleSource = validEntries.find((entry) => entry.currentQuantity >= requestedQty);
      if (singleSource) {
        return res.json({
          fulfillable: true,
          strategy: "cost_optimal_single_warehouse",
          options: [
            {
              warehouse: singleSource.warehouse,
              quantityAvailable: singleSource.currentQuantity,
              distanceKm: singleSource.distanceKm,
            },
          ],
        });
      }
    } else {
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
        ...(usingCostOptimal ? { distanceKm: entry.distanceKm } : {}),
      });
      remaining -= take;
    }

    if (remaining <= 0) {
      return res.json({
        fulfillable: true,
        strategy: usingCostOptimal ? "cost_optimal_multi_warehouse" : "multi_warehouse",
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