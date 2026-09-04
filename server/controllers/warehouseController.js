const Warehouse = require("../models/Warehouse");

const getWarehouses = async (req, res, next) => {
  try {
    const warehouses = await Warehouse.find({ isActive: true }).lean();
    res.json(warehouses);
  } catch (error) {
    next(error);
  }
};

const getWarehouseById = async (req, res, next) => {
  try {
    const warehouse = await Warehouse.findById(req.params.id).lean();
    if (!warehouse) {
      res.status(404);
      return next(new Error("Warehouse not found"));
    }
    res.json(warehouse);
  } catch (error) {
    next(error);
  }
};

const createWarehouse = async (req, res, next) => {
  try {
    const { name, address, capacity, latitude, longitude } = req.body;

    const existingWarehouse = await Warehouse.findOne({ name });
    if (existingWarehouse) {
      res.status(400);
      return next(new Error("Warehouse with this name already exists"));
    }

    const warehouse = await Warehouse.create({
      name,
      address,
      capacity,
      latitude,
      longitude,
    });

    res.status(201).json(warehouse);
  } catch (error) {
    next(error);
  }
};

const updateWarehouse = async (req, res, next) => {
  try {
    const { name, address, capacity, latitude, longitude, isActive } = req.body;

    const warehouse = await Warehouse.findById(req.params.id);
    if (!warehouse) {
      res.status(404);
      return next(new Error("Warehouse not found"));
    }

    if (name) warehouse.name = name;
    if (address !== undefined) warehouse.address = address;
    if (capacity !== undefined) warehouse.capacity = capacity;
    if (latitude !== undefined) warehouse.latitude = latitude;
    if (longitude !== undefined) warehouse.longitude = longitude;
    if (isActive !== undefined) warehouse.isActive = isActive;

    const updatedWarehouse = await warehouse.save();
    res.json(updatedWarehouse);
  } catch (error) {
    next(error);
  }
};

const deleteWarehouse = async (req, res, next) => {
  try {
    const warehouse = await Warehouse.findById(req.params.id);
    if (!warehouse) {
      res.status(404);
      return next(new Error("Warehouse not found"));
    }

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