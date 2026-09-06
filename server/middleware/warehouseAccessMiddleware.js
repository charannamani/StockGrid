/**
 * Higher-order middleware to enforce warehouse-scoped access for staff users.
 * Admins bypass this check completely.
 *
 * @param {Function} getWarehouseId - Function (sync or async) `(req) => warehouseId`
 */
const checkWarehouseAccess = (getWarehouseId) => {
  return async (req, res, next) => {
    try {
      const user = req.user || (req.apiKey && req.apiKey.createdBy);

      if (!user) {
        return res.status(401).json({ message: "Not authorized, user not found" });
      }

      if (user.role === "admin") {
        return next();
      }

      const warehouseId = await getWarehouseId(req);

      if (!warehouseId) {
        return res.status(400).json({ message: "Warehouse ID is required for access check" });
      }

      const userWarehouses = user.warehouses || [];
      const hasAccess = userWarehouses.some(
        (w) => (w._id ? w._id.toString() : w.toString()) === warehouseId.toString()
      );

      if (hasAccess) {
        return next();
      }

      return res.status(403).json({ message: "You do not have access to this warehouse." });
    } catch (error) {
      next(error);
    }
  };
};

module.exports = { checkWarehouseAccess };
