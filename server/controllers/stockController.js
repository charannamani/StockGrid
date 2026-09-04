const mongoose = require("mongoose");
const Stock = require("../models/Stock");
const Product = require("../models/Product");
const Warehouse = require("../models/Warehouse");

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
      .populate("product", "name sku category unitCost")
      .populate("warehouse", "name address latitude longitude isActive")
      .lean();

    const validStock = stock
      .filter((entry) => entry.product && entry.warehouse && entry.warehouse.isActive !== false)
      .map((entry) => ({
        ...entry,
        availableQuantity: Math.max(0, entry.currentQuantity - (entry.reservedQuantity || 0)),
      }));

    res.json(validStock);
  } catch (error) {
    next(error);
  }
};

const getStockByWarehouse = async (req, res, next) => {
  try {
    const { warehouseId } = req.params;

    if (!warehouseId || !mongoose.Types.ObjectId.isValid(warehouseId)) {
      return res.json({ stock: [], totalOccupancy: 0, capacity: null, spaceLeft: null, isOverCapacity: false });
    }

    const [warehouse, stock] = await Promise.all([
      Warehouse.findById(warehouseId).lean(),
      Stock.find({ warehouse: warehouseId }).populate("product", "name sku category unitCost").lean(),
    ]);

    if (!warehouse || warehouse.isActive === false) {
      return res.json({ stock: [], totalOccupancy: 0, capacity: null, spaceLeft: null, isOverCapacity: false });
    }

    const validStock = stock
      .filter((entry) => entry.product)
      .map((entry) => ({
        ...entry,
        availableQuantity: Math.max(0, entry.currentQuantity - (entry.reservedQuantity || 0)),
      }));

    const totalOccupancy = validStock.reduce((sum, entry) => sum + (entry.currentQuantity || 0), 0);
    const capacity = warehouse.capacity != null ? warehouse.capacity : null;
    const spaceLeft = capacity != null ? capacity - totalOccupancy : null;
    const isOverCapacity = capacity != null ? totalOccupancy > capacity : false;

    res.json({
      stock: validStock,
      totalOccupancy,
      capacity,
      spaceLeft,
      isOverCapacity,
    });
  } catch (error) {
    next(error);
  }
};

const getStockByProduct = async (req, res, next) => {
  try {
    const { productId } = req.params;

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.json({ totalQuantity: 0, totalAvailable: 0, byWarehouse: [] });
    }

    const stock = await Stock.find({ product: productId })
      .populate("warehouse", "name address latitude longitude isActive")
      .lean();

    const validStock = stock
      .filter((entry) => entry.warehouse && entry.warehouse.isActive !== false)
      .map((entry) => ({
        ...entry,
        availableQuantity: Math.max(0, entry.currentQuantity - (entry.reservedQuantity || 0)),
      }));

    const totalQuantity = validStock.reduce((sum, entry) => sum + (entry.currentQuantity || 0), 0);
    const totalAvailable = validStock.reduce((sum, entry) => sum + (entry.availableQuantity || 0), 0);

    res.json({ totalQuantity, totalAvailable, byWarehouse: validStock });
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
    if (!product || product.isActive === false) {
      return res.json({
        fulfillable: false,
        strategy: "product_not_found",
        totalAvailable: 0,
        options: [],
      });
    }

    const stockEntries = await Stock.find({ product: productId, currentQuantity: { $gt: 0 } })
      .populate("warehouse", "name address latitude longitude isActive")
      .lean();

    let validEntries = stockEntries
      .filter((entry) => entry.warehouse && entry.warehouse.isActive !== false)
      .map((entry) => ({
        ...entry,
        effectiveQuantity: Math.max(0, entry.currentQuantity - (entry.reservedQuantity || 0)),
      }))
      .filter((entry) => entry.effectiveQuantity > 0);

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
            distanceKm:
              Math.round(
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
      validEntries = validEntries.sort((a, b) => b.effectiveQuantity - a.effectiveQuantity);
    }

    if (usingCostOptimal) {
      const singleSource = validEntries.find((entry) => entry.effectiveQuantity >= requestedQty);
      if (singleSource) {
        return res.json({
          fulfillable: true,
          strategy: "cost_optimal_single_warehouse",
          options: [
            {
              warehouse: singleSource.warehouse,
              quantityAvailable: singleSource.effectiveQuantity,
              distanceKm: singleSource.distanceKm,
            },
          ],
        });
      }
    } else {
      const singleSource = validEntries.find((entry) => entry.effectiveQuantity >= requestedQty);
      if (singleSource) {
        return res.json({
          fulfillable: true,
          strategy: "single_warehouse",
          options: [
            {
              warehouse: singleSource.warehouse,
              quantityAvailable: singleSource.effectiveQuantity,
            },
          ],
        });
      }
    }

    const combination = [];
    let remaining = requestedQty;

    for (const entry of validEntries) {
      if (remaining <= 0) break;
      const take = Math.min(entry.effectiveQuantity, remaining);
      combination.push({
        warehouse: entry.warehouse,
        quantityAvailable: entry.effectiveQuantity,
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

    const totalAvailable = validEntries.reduce((sum, e) => sum + e.effectiveQuantity, 0);

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