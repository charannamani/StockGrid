const express = require("express");
const cors = require("cors");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");
const { generalLimiter } = require("./middleware/rateLimiter");



const app = express();
app.use(express.json());

app.use("/api/webhooks", require("./routes/webhookRoutes"));
app.use(cors());
app.use(generalLimiter);

app.get("/", (req, res) => {
  res.json({ message: "StockGrid API is running" });
});

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/warehouses", require("./routes/warehouseRoutes"));
app.use("/api/products", require("./routes/productRoutes"));
app.use("/api/stock", require("./routes/stockRoutes"));
app.use("/api/movements", require("./routes/movementRoutes"));
app.use("/api/apikeys", require("./routes/apiKeyRoutes"));

app.use(notFound);
app.use(errorHandler);

module.exports = app;