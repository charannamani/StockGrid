const Product = require("../models/Product");

const getProducts = async (req, res, next) => {
  try {
    const { category, search } = req.query;
    const filter = { isActive: true };

    if (category) filter.category = category;
    if (search) filter.name = { $regex: search, $options: "i" };

    const products = await Product.find(filter).lean(); // Optimization: Plain JS objects
    res.json(products);
  } catch (error) {
    next(error);
  }
};

const getProductById = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id).lean(); // Optimization
    if (!product) {
      res.status(404);
      return next(new Error("Product not found"));
    }
    res.json(product);
  } catch (error) {
    next(error);
  }
};

const createProduct = async (req, res, next) => {
  try {
    const { name, sku, category, unitCost, description } = req.body;

    const existingProduct = await Product.findOne({ sku });
    if (existingProduct) {
      res.status(400);
      return next(new Error("Product with this SKU already exists"));
    }

    const product = await Product.create({
      name,
      sku,
      category,
      unitCost,
      description,
    });

    res.status(201).json(product);
  } catch (error) {
    next(error);
  }
};

const updateProduct = async (req, res, next) => {
  try {
    const { name, category, unitCost, description, isActive } = req.body;

    const product = await Product.findById(req.params.id);
    if (!product) {
      res.status(404);
      return next(new Error("Product not found"));
    }

    if (name) product.name = name;
    if (category) product.category = category;
    if (unitCost !== undefined) product.unitCost = unitCost;
    if (description !== undefined) product.description = description;
    if (isActive !== undefined) product.isActive = isActive;

    const updatedProduct = await product.save();
    res.json(updatedProduct);
  } catch (error) {
    next(error);
  }
};


const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      res.status(404);
      return next(new Error("Product not found"));
    }

    product.isActive = false;
    await product.save();

    res.json({ message: "Product deactivated successfully" });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
};