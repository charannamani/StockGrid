const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");
const Warehouse = require("../models/Warehouse");

const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};


const registerUser = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      res.status(400);
      return next(new Error("An account with this email already exists"));
    }


    const user = await User.create({
      name,
      email,
      password,
      role: "staff",
    });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id, user.role),
    });
  } catch (error) {
    next(error);
  }
};


const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user || !(await user.matchPassword(password))) {
      res.status(401);
      return next(new Error("Invalid email or password"));
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id, user.role),
    });
  } catch (error) {
    next(error);
  }
};

const listUsers = async (req, res, next) => {
  try {
    const users = await User.find()
      .select("-password")
      .populate("warehouses", "name");
    res.json(users);
  } catch (error) {
    next(error);
  }
};

const updateUserWarehouses = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { warehouses } = req.body;

    if (!Array.isArray(warehouses)) {
      return res.status(400).json({ message: "warehouses must be an array" });
    }

    for (const whId of warehouses) {
      if (!mongoose.Types.ObjectId.isValid(whId)) {
        return res.status(400).json({ message: `Invalid warehouse ID: ${whId}` });
      }
    }

    if (warehouses.length > 0) {
      const uniqueIds = Array.from(new Set(warehouses.map((w) => w.toString())));
      const existingCount = await Warehouse.countDocuments({
        _id: { $in: uniqueIds },
      });
      if (existingCount !== uniqueIds.length) {
        return res.status(400).json({ message: "One or more warehouse IDs do not exist" });
      }
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role === "admin") {
      return res.status(400).json({ message: "warehouses do not apply to admin users" });
    }

    user.warehouses = warehouses;
    await user.save();

    const updatedUser = await User.findById(id)
      .select("-password")
      .populate("warehouses", "name");

    res.json(updatedUser);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registerUser,
  loginUser,
  listUsers,
  updateUserWarehouses,
};