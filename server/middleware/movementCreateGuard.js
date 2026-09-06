const { checkWarehouseAccess } = require("./warehouseAccessMiddleware");

const warehouseGuard = checkWarehouseAccess(
  (req) => req.body.warehouse || req.body.warehouseId
);

const movementCreateGuard = (req, res, next) => {
  const { type } = req.body;

  const isAdmin =
    (req.user && req.user.role === "admin") ||
    (req.apiKey && req.apiKey.createdBy && req.apiKey.createdBy.role === "admin");

  if (type === "adjustment") {
    if (isAdmin) {
      return next();
    }
    return res.status(403).json({ message: "Access denied, admin only" });
  }

  if (type === "inbound" || type === "outbound") {
    return warehouseGuard(req, res, next);
  }

  next();
};

module.exports = movementCreateGuard;
