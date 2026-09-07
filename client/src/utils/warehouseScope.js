/**
 * Filters a list of warehouses based on user role and assigned warehouses.
 * - Admin users have access to all warehouses.
 * - Staff users only have access to warehouses assigned in user.warehouses.
 */
export const getAccessibleWarehouses = (allWarehouses = [], user = null) => {
  if (!Array.isArray(allWarehouses)) return [];
  if (!user || user.role === "admin") return allWarehouses;

  const userWhs = user.warehouses || [];
  const assignedIds = new Set(
    userWhs.map((w) => (typeof w === "object" && w?._id ? w._id.toString() : w?.toString()))
  );

  return allWarehouses.filter((wh) => assignedIds.has(wh._id?.toString()));
};
