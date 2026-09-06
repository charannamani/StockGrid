const request = require("supertest");
const app = require("../app");
const { connect, closeDatabase, clearDatabase } = require("./testSetup");
const User = require("../models/User");
const Warehouse = require("../models/Warehouse");
const Product = require("../models/Product");

beforeAll(async () => {
  await connect();
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

const setupAdminEnvironment = async () => {
  const warehouse1 = await Warehouse.create({
    name: "Site One",
    latitude: 17.385,
    longitude: 78.4867,
    capacity: 500,
    isActive: true,
  });

  const warehouse2 = await Warehouse.create({
    name: "Site Two",
    latitude: 12.9716,
    longitude: 77.5946,
    capacity: 500,
    isActive: true,
  });

  const admin = await User.create({
    name: "Manager Admin",
    email: "mgr-admin@stockgrid.local",
    password: "password123",
    role: "admin",
  });

  const adminLogin = await request(app).post("/api/auth/login").send({
    email: "mgr-admin@stockgrid.local",
    password: "password123",
  });
  const adminToken = adminLogin.body.token;

  const staff = await User.create({
    name: "Warehouse Worker",
    email: "worker@stockgrid.local",
    password: "password123",
    role: "staff",
    warehouses: [],
  });

  const staffLogin = await request(app).post("/api/auth/login").send({
    email: "worker@stockgrid.local",
    password: "password123",
  });
  const staffToken = staffLogin.body.token;

  const product = await Product.create({
    name: "Network Cable",
    sku: `CAB-${Date.now()}`,
    category: "Accessories",
    unitCost: 15,
    isActive: true,
  });

  return {
    admin,
    adminToken,
    staff,
    staffToken,
    warehouse1,
    warehouse2,
    product,
  };
};

describe("Admin User Management & Dynamic RBAC Refresh", () => {
  test("Non-admin gets 403 on GET /users and PATCH /users/:id/warehouses", async () => {
    const { staff, staffToken, warehouse1 } = await setupAdminEnvironment();

    const getRes = await request(app)
      .get("/api/auth/users")
      .set("Authorization", `Bearer ${staffToken}`);
    expect(getRes.status).toBe(403);

    const patchRes = await request(app)
      .patch(`/api/auth/users/${staff._id}/warehouses`)
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ warehouses: [warehouse1._id.toString()] });
    expect(patchRes.status).toBe(403);
  });

  test("Admin grants and revokes warehouses; staff access updates immediately on next request", async () => {
    const { adminToken, staff, staffToken, warehouse1, warehouse2, product } =
      await setupAdminEnvironment();

    // 1. Initially worker has no warehouses -> 403 on warehouse 1
    const beforeGrant = await request(app)
      .post("/api/movements")
      .set("Authorization", `Bearer ${staffToken}`)
      .send({
        product: product._id.toString(),
        warehouse: warehouse1._id.toString(),
        type: "inbound",
        quantity: 20,
      });
    expect(beforeGrant.status).toBe(403);

    // 2. Admin grants warehouse 1
    const grantRes = await request(app)
      .patch(`/api/auth/users/${staff._id}/warehouses`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ warehouses: [warehouse1._id.toString()] });
    expect(grantRes.status).toBe(200);
    expect(grantRes.body.warehouses.length).toBe(1);

    // 3. Worker immediately succeeds at warehouse 1 on next request (no re-login needed)
    const afterGrant = await request(app)
      .post("/api/movements")
      .set("Authorization", `Bearer ${staffToken}`)
      .send({
        product: product._id.toString(),
        warehouse: warehouse1._id.toString(),
        type: "inbound",
        quantity: 20,
      });
    expect(afterGrant.status).toBe(201);

    // Worker is still blocked at warehouse 2
    const blockedWh2 = await request(app)
      .post("/api/movements")
      .set("Authorization", `Bearer ${staffToken}`)
      .send({
        product: product._id.toString(),
        warehouse: warehouse2._id.toString(),
        type: "inbound",
        quantity: 20,
      });
    expect(blockedWh2.status).toBe(403);

    // 4. Admin revokes warehouse 1 and switches worker to warehouse 2
    const switchRes = await request(app)
      .patch(`/api/auth/users/${staff._id}/warehouses`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ warehouses: [warehouse2._id.toString()] });
    expect(switchRes.status).toBe(200);

    // 5. Worker is now blocked at warehouse 1
    const revokedWh1 = await request(app)
      .post("/api/movements")
      .set("Authorization", `Bearer ${staffToken}`)
      .send({
        product: product._id.toString(),
        warehouse: warehouse1._id.toString(),
        type: "inbound",
        quantity: 20,
      });
    expect(revokedWh1.status).toBe(403);

    // And worker succeeds at warehouse 2
    const allowedWh2 = await request(app)
      .post("/api/movements")
      .set("Authorization", `Bearer ${staffToken}`)
      .send({
        product: product._id.toString(),
        warehouse: warehouse2._id.toString(),
        type: "inbound",
        quantity: 20,
      });
    expect(allowedWh2.status).toBe(201);
  });

  test("PATCH with a non-existent warehouse ID returns 400", async () => {
    const { adminToken, staff } = await setupAdminEnvironment();
    const fakeWarehouseId = "507f1f77bcf86cd799439011";

    const res = await request(app)
      .patch(`/api/auth/users/${staff._id}/warehouses`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ warehouses: [fakeWarehouseId] });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not exist|invalid/i);
  });

  test("PATCH targeting an admin user returns 400", async () => {
    const { admin, adminToken, warehouse1 } = await setupAdminEnvironment();

    const res = await request(app)
      .patch(`/api/auth/users/${admin._id}/warehouses`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ warehouses: [warehouse1._id.toString()] });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/do not apply to admin/i);
  });
});
