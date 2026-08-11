const Warehouse = require("../models/Warehouse");

// Get all active warehouses
const getWarehouses = async (req, res, next) => {
  try {
    const warehouses = await Warehouse.find({ isActive: true }).lean(); // Optimization
    res.json(warehouses);
  } catch (error) {
    next(error);
  }
};

// Get single warehouse by ID
const getWarehouseById = async (req, res, next) => {
  try {
    const warehouse = await Warehouse.findById(req.params.id).lean(); // Optimization
    if (!warehouse) {
      res.status(404);
      return next(new Error("Warehouse not found"));
    }
    res.json(warehouse);
  } catch (error) {
    next(error);
  }
};

// Create a new warehouse facility (Admin only)
const createWarehouse = async (req, res, next) => {
  try {
    const { name, code, address } = req.body;

    const existingWarehouse = await Warehouse.findOne({ code });
    if (existingWarehouse) {
      res.status(400);
      return next(new Error("Warehouse with this code already exists"));
    }

    const warehouse = await Warehouse.create({
      name,
      code,
      address,
    });

    res.status(201).json(warehouse);
  } catch (error) {
    next(error);
  }
};

// Update warehouse facility details (Admin only)
const updateWarehouse = async (req, res, next) => {
  try {
    const { name, address, isActive } = req.body;

    const warehouse = await Warehouse.findById(req.params.id);
    if (!warehouse) {
      res.status(404);
      return next(new Error("Warehouse not found"));
    }

    if (name) warehouse.name = name;
    if (address !== undefined) warehouse.address = address;
    if (isActive !== undefined) warehouse.isActive = isActive;

    const updatedWarehouse = await warehouse.save();
    res.json(updatedWarehouse);
  } catch (error) {
    next(error);
  }
};

// Delete / Deactivate a warehouse (Admin only)
const deleteWarehouse = async (req, res, next) => {
  try {
    const warehouse = await Warehouse.findById(req.params.id);
    if (!warehouse) {
      res.status(404);
      return next(new Error("Warehouse not found"));
    }

    // Soft delete: mark as inactive
    warehouse.isActive = false;
    await warehouse.save();

    res.json({ message: "Warehouse deactivated successfully" });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getWarehouses,
  getWarehouseById,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
};