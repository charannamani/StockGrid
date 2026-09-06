const request = require("supertest");
const app = require("../app");
const { connect, closeDatabase, clearDatabase } = require("./testSetup");
const User = require("../models/User");
const Warehouse = require("../models/Warehouse");
const Product = require("../models/Product");
const Stock = require("../models/Stock");

beforeAll(async () => {
  await connect();
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

const setupRBACEnvironment = async () => {
  const warehouseA = await Warehouse.create({
    name: "Alpha Warehouse",
    latitude: 17.385,
    longitude: 78.4867,
    capacity: 1000,
    isActive: true,
  });

  const warehouseB = await Warehouse.create({
    name: "Beta Warehouse",
    latitude: 12.9716,
    longitude: 77.5946,
    capacity: 1000,
    isActive: true,
  });

  const product = await Product.create({
    name: "Enterprise Chip",
    sku: `CHIP-${Date.now()}`,
    category: "Hardware",
    unitCost: 120,
    defaultThreshold: 5,
    isActive: true,
  });

  const admin = await User.create({
    name: "Super Admin",
    email: "admin-rbac@stockgrid.local",
    password: "password123",
    role: "admin",
    warehouses: [], // Empty warehouses array to verify admin bypasses it
  });

  const adminLogin = await request(app).post("/api/auth/login").send({
    email: "admin-rbac@stockgrid.local",
    password: "password123",
  });
  const adminToken = adminLogin.body.token;

  const staffNoWh = await User.create({
    name: "Unassigned Staff",
    email: "unassigned@stockgrid.local",
    password: "password123",
    role: "staff",
    warehouses: [],
  });

  const staffNoWhLogin = await request(app).post("/api/auth/login").send({
    email: "unassigned@stockgrid.local",
    password: "password123",
  });
  const staffNoWhToken = staffNoWhLogin.body.token;

  const staffA = await User.create({
    name: "Staff Warehouse A",
    email: "staffA-rbac@stockgrid.local",
    password: "password123",
    role: "staff",
    warehouses: [warehouseA._id],
  });

  const staffALogin = await request(app).post("/api/auth/login").send({
    email: "staffA-rbac@stockgrid.local",
    password: "password123",
  });
  const staffAToken = staffALogin.body.token;

  return {
    warehouseA,
    warehouseB,
    product,
    adminToken,
    staffNoWhToken,
    staffAToken,
  };
};

describe("Warehouse-Scoped RBAC Action Endpoint Gating", () => {
  test("Staff with no assigned warehouses gets 403 on movements, reserve, transfers", async () => {
    const { warehouseA, warehouseB, product, staffNoWhToken } =
      await setupRBACEnvironment();

    // 1. POST /api/movements (inbound)
    const movRes = await request(app)
      .post("/api/movements")
      .set("Authorization", `Bearer ${staffNoWhToken}`)
      .send({
        product: product._id.toString(),
        warehouse: warehouseA._id.toString(),
        type: "inbound",
        quantity: 10,
      });
    expect(movRes.status).toBe(403);
    expect(movRes.body.message).toMatch(/not have access/i);

    // 2. POST /api/stock/reserve
    const rsvRes = await request(app)
      .post("/api/stock/reserve")
      .set("Authorization", `Bearer ${staffNoWhToken}`)
      .send({
        productId: product._id.toString(),
        warehouseId: warehouseA._id.toString(),
        quantity: 5,
      });
    expect(rsvRes.status).toBe(403);

    // 3. POST /api/transfers
    const xferRes = await request(app)
      .post("/api/transfers")
      .set("Authorization", `Bearer ${staffNoWhToken}`)
      .send({
        product: product._id.toString(),
        fromWarehouse: warehouseA._id.toString(),
        toWarehouse: warehouseB._id.toString(),
        quantity: 5,
      });
    expect(xferRes.status).toBe(403);
  });

  test("Staff assigned to Warehouse A succeeds at A, gets 403 at B", async () => {
    const { warehouseA, warehouseB, product, staffAToken } =
      await setupRBACEnvironment();

    // Success at warehouse A
    const movSuccess = await request(app)
      .post("/api/movements")
      .set("Authorization", `Bearer ${staffAToken}`)
      .send({
        product: product._id.toString(),
        warehouse: warehouseA._id.toString(),
        type: "inbound",
        quantity: 50,
      });
    expect(movSuccess.status).toBe(201);

    // Forbidden at warehouse B
    const movDenied = await request(app)
      .post("/api/movements")
      .set("Authorization", `Bearer ${staffAToken}`)
      .send({
        product: product._id.toString(),
        warehouse: warehouseB._id.toString(),
        type: "inbound",
        quantity: 20,
      });
    expect(movDenied.status).toBe(403);
  });

  test("Admin succeeds everywhere regardless of warehouses array contents", async () => {
    const { warehouseA, warehouseB, product, adminToken } =
      await setupRBACEnvironment();

    const resA = await request(app)
      .post("/api/movements")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        product: product._id.toString(),
        warehouse: warehouseA._id.toString(),
        type: "inbound",
        quantity: 30,
      });
    expect(resA.status).toBe(201);

    const resB = await request(app)
      .post("/api/movements")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        product: product._id.toString(),
        warehouse: warehouseB._id.toString(),
        type: "inbound",
        quantity: 30,
      });
    expect(resB.status).toBe(201);
  });

  test("Staff attempting type: adjustment gets 403 even with warehouse access; admin succeeds", async () => {
    const { warehouseA, product, staffAToken, adminToken } =
      await setupRBACEnvironment();

    // Staff attempts adjustment on their assigned warehouse -> 403
    const staffAdj = await request(app)
      .post("/api/movements")
      .set("Authorization", `Bearer ${staffAToken}`)
      .send({
        product: product._id.toString(),
        warehouse: warehouseA._id.toString(),
        type: "adjustment",
        quantity: 25,
      });
    expect(staffAdj.status).toBe(403);
    expect(staffAdj.body.message).toMatch(/admin only/i);

    // Admin creates adjustment -> 201
    const adminAdj = await request(app)
      .post("/api/movements")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        product: product._id.toString(),
        warehouse: warehouseA._id.toString(),
        type: "adjustment",
        direction: "increase",
        quantity: 25,
      });
    expect(adminAdj.status).toBe(201);
  });

  test("Read endpoints remain open to staff with identical cross-warehouse visibility", async () => {
    const { warehouseA, warehouseB, product, staffAToken, adminToken } =
      await setupRBACEnvironment();

    // Create stock at both warehouses
    await Stock.create({
      product: product._id,
      warehouse: warehouseA._id,
      currentQuantity: 40,
    });
    await Stock.create({
      product: product._id,
      warehouse: warehouseB._id,
      currentQuantity: 60,
    });

    // 1. GET /api/stock
    const stockStaff = await request(app)
      .get("/api/stock")
      .set("Authorization", `Bearer ${staffAToken}`);
    const stockAdmin = await request(app)
      .get("/api/stock")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(stockStaff.status).toBe(200);
    expect(stockStaff.body.length).toBe(stockAdmin.body.length);

    // 2. GET /api/stock/availability
    const availStaff = await request(app)
      .get(`/api/stock/availability?productId=${product._id}&quantity=50`)
      .set("Authorization", `Bearer ${staffAToken}`);
    expect(availStaff.status).toBe(200);
    expect(availStaff.body.fulfillable).toBe(true);

    // 3. GET /api/warehouses
    const whStaff = await request(app)
      .get("/api/warehouses")
      .set("Authorization", `Bearer ${staffAToken}`);
    expect(whStaff.status).toBe(200);
    expect(whStaff.body.length).toBe(2);

    // 4. GET /api/movements
    const movStaff = await request(app)
      .get("/api/movements")
      .set("Authorization", `Bearer ${staffAToken}`);
    expect(movStaff.status).toBe(200);

    // 5. GET /api/transfers
    const xferStaff = await request(app)
      .get("/api/transfers")
      .set("Authorization", `Bearer ${staffAToken}`);
    expect(xferStaff.status).toBe(200);
  });
});
