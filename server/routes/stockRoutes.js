const express = require("express");
const router = express.Router();
const {
  getStockLevels,
  getStockByWarehouse,
  getStockByProduct,
  checkAvailability,
} = require("../controllers/stockController");
const { flexibleAuth } = require("../middleware/authMiddleware");
const cache = require("../middleware/cacheMiddleware");

router.use(flexibleAuth);

router.get("/", cache("stocks", 300), getStockLevels);
router.get("/availability", cache("availability", 60), checkAvailability);
router.get("/warehouse/:warehouseId", cache("stock_wh", 300), getStockByWarehouse);
router.get("/product/:productId", cache("stock_prod", 300), getStockByProduct);

module.exports = router;