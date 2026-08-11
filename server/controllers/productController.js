const Product = require("../models/Product");

// Get all products with optional category or search filters
const getProducts = async (req, res, next) => {
  try {
    const { category, search } = req.query;
    const filter = {};

    if (category) filter.category = category;
    if (search) filter.name = { $regex: search, $options: "i" };

    const products = await Product.find(filter).lean(); // Optimization: Plain JS objects
    res.json(products);
  } catch (error) {
    next(error);
  }
};

// Get single product details by ID
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

// Create a new product (Admin only)
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

// Update an existing product (Admin only)
const updateProduct = async (req, res, next) => {
  try {
    const { name, category, unitCost, description } = req.body;

    const product = await Product.findById(req.params.id);
    if (!product) {
      res.status(404);
      return next(new Error("Product not found"));
    }

    if (name) product.name = name;
    if (category) product.category = category;
    if (unitCost !== undefined) product.unitCost = unitCost;
    if (description !== undefined) product.description = description;

    const updatedProduct = await product.save();
    res.json(updatedProduct);
  } catch (error) {
    next(error);
  }
};

// Delete a product (Admin only)
const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      res.status(404);
      return next(new Error("Product not found"));
    }

    await product.deleteOne();
    res.json({ message: "Product removed successfully" });
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