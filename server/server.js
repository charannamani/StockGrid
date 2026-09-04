const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");
const { apiLimiter } = require("./middleware/rateLimiter");
const { protect, adminOnly } = require("./middleware/authMiddleware");
connectDB();

const app = express();

app.use(cors());
app.use(express.json());
app.use(apiLimiter);


require("./workers/stockWorker");
require("./workers/reservationWorker");

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/products", require("./routes/productRoutes"));
app.use("/api/warehouses", require("./routes/warehouseRoutes"));
app.use("/api/stock", require("./routes/stockRoutes"));
app.use("/api/movements", require("./routes/movementRoutes"));
app.use("/api/apikeys", require("./routes/apiKeyRoutes"));
app.use("/api/webhooks", require("./routes/webhookRoutes"));

const { createBullBoard } = require("@bull-board/api");
const { BullMQAdapter } = require("@bull-board/api/bullMQAdapter");
const { ExpressAdapter } = require("@bull-board/express");
const stockQueue = require("./queues/stockQueue");

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/admin/queues");

createBullBoard({
  queues: [new BullMQAdapter(stockQueue)],
  serverAdapter: serverAdapter,
});

app.use("/admin/queues", protect, adminOnly, serverAdapter.getRouter());

app.get("/", (req, res) => {
  res.send("StockGrid API Engine Running Smoothly...");
});

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});