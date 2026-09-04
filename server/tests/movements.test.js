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

const setupAdminAndData = async () => {
  const admin = await User.create({
    name: "Admin",
    email: "admin@stockgrid.com",
    password: "password123",
    role: "admin",
  });

  const loginRes = await request(app).post("/api/auth/login").send({
    email: "admin@stockgrid.com",
    password: "password123",
  });
  const token = loginRes.body.token;

  const warehouseA = await Warehouse.create({
    name: "Warehouse A",
    latitude: 17.385,
    longitude: 78.4867,
    capacity: 1000,
    isActive: true,
  });

  const warehouseB = await Warehouse.create({
    name: "Warehouse B",
    latitude: 12.9716,
    longitude: 77.5946,
    capacity: 1000,
    isActive: true,
  });

  const product = await Product.create({
    name: "Test Product",
    sku: `TEST-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    category: "Test",
    unitCost: 10,
    defaultThreshold: 10,
    isActive: true,
  });

  return { token, warehouseA, warehouseB, product };
};

describe("Stock Movements", () => {
  test("inbound movement creates stock and increases quantity", async () => {
    const { token, warehouseA, product } = await setupAdminAndData();

    const res = await request(app)
      .post("/api/movements")
      .set("Authorization", `Bearer ${token}`)
      .send({
        product: product._id,
        warehouse: warehouseA._id,
        type: "inbound",
        quantity: 100,
        reason: "test delivery",
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.type).toBe("inbound");

    const stockRes = await request(app)
      .get(`/api/stock/warehouse/${warehouseA._id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(stockRes.body.stock[0].currentQuantity).toBe(100);
  });

  test("outbound movement decreases quantity", async () => {
    const { token, warehouseA, product } = await setupAdminAndData();

    await request(app)
      .post("/api/movements")
      .set("Authorization", `Bearer ${token}`)
      .send({ product: product._id, warehouse: warehouseA._id, type: "inbound", quantity: 100 });

    const res = await request(app)
      .post("/api/movements")
      .set("Authorization", `Bearer ${token}`)
      .send({ product: product._id, warehouse: warehouseA._id, type: "outbound", quantity: 30 });

    expect(res.statusCode).toBe(201);

    const stockRes = await request(app)
      .get(`/api/stock/warehouse/${warehouseA._id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(stockRes.body.stock[0].currentQuantity).toBe(70);
  });

  test("rejects outbound movement exceeding current stock and leaves stock unchanged", async () => {
    const { token, warehouseA, product } = await setupAdminAndData();

    await request(app)
      .post("/api/movements")
      .set("Authorization", `Bearer ${token}`)
      .send({ product: product._id, warehouse: warehouseA._id, type: "inbound", quantity: 50 });

    const res = await request(app)
      .post("/api/movements")
      .set("Authorization", `Bearer ${token}`)
      .send({ product: product._id, warehouse: warehouseA._id, type: "outbound", quantity: 999 });

    expect(res.statusCode).toBe(400);

    const stockRes = await request(app)
      .get(`/api/stock/warehouse/${warehouseA._id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(stockRes.body.stock[0].currentQuantity).toBe(50);
  });

  test("transfer moves quantity between warehouses and conserves total", async () => {
    const { token, warehouseA, warehouseB, product } = await setupAdminAndData();

    await request(app)
      .post("/api/movements")
      .set("Authorization", `Bearer ${token}`)
      .send({ product: product._id, warehouse: warehouseA._id, type: "inbound", quantity: 100 });

    const res = await request(app)
      .post("/api/movements/transfer")
      .set("Authorization", `Bearer ${token}`)
      .send({
        product: product._id,
        fromWarehouse: warehouseA._id,
        toWarehouse: warehouseB._id,
        quantity: 40,
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.transferOut.type).toBe("transfer_out");
    expect(res.body.transferIn.type).toBe("transfer_in");

    const totalRes = await request(app)
      .get(`/api/stock/product/${product._id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(totalRes.body.totalQuantity).toBe(100);
  });

  test("availability search returns single warehouse when one covers the request", async () => {
    const { token, warehouseA, warehouseB, product } = await setupAdminAndData();

    await request(app)
      .post("/api/movements")
      .set("Authorization", `Bearer ${token}`)
      .send({ product: product._id, warehouse: warehouseA._id, type: "inbound", quantity: 200 });
    await request(app)
      .post("/api/movements")
      .set("Authorization", `Bearer ${token}`)
      .send({ product: product._id, warehouse: warehouseB._id, type: "inbound", quantity: 20 });

    const res = await request(app)
      .get(`/api/stock/availability?productId=${product._id}&quantity=150`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.fulfillable).toBe(true);
    expect(res.body.strategy).toBe("single_warehouse");
  });

  test("availability search reports shortfall when total stock is insufficient", async () => {
    const { token, warehouseA, product } = await setupAdminAndData();

    await request(app)
      .post("/api/movements")
      .set("Authorization", `Bearer ${token}`)
      .send({ product: product._id, warehouse: warehouseA._id, type: "inbound", quantity: 10 });

    const res = await request(app)
      .get(`/api/stock/availability?productId=${product._id}&quantity=500`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.fulfillable).toBe(false);
    expect(res.body.shortfall).toBe(490);
  });
});