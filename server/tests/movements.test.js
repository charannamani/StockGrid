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

  describe("Stock Adjustments (Signed Delta)", () => {
    test("adjustment increase adds to existing stock rather than replacing it", async () => {
      const { token, warehouseA, product } = await setupAdminAndData();

      // Seed 50 units via inbound
      await request(app)
        .post("/api/movements")
        .set("Authorization", `Bearer ${token}`)
        .send({ product: product._id, warehouse: warehouseA._id, type: "inbound", quantity: 50 });

      // Increase by 15 via adjustment
      const res = await request(app)
        .post("/api/movements")
        .set("Authorization", `Bearer ${token}`)
        .send({
          product: product._id,
          warehouse: warehouseA._id,
          type: "adjustment",
          direction: "increase",
          quantity: 15,
          reason: "Found extra pallet",
        });

      expect(res.status).toBe(201);
      expect(res.body.direction).toBe("increase");

      const stockRes = await request(app)
        .get(`/api/stock/warehouse/${warehouseA._id}`)
        .set("Authorization", `Bearer ${token}`);

      // Must be 65 (50 + 15), NOT 15
      expect(stockRes.body.stock[0].currentQuantity).toBe(65);
    });

    test("adjustment decrease reduces stock by exact quantity", async () => {
      const { token, warehouseA, product } = await setupAdminAndData();

      await request(app)
        .post("/api/movements")
        .set("Authorization", `Bearer ${token}`)
        .send({ product: product._id, warehouse: warehouseA._id, type: "inbound", quantity: 50 });

      const res = await request(app)
        .post("/api/movements")
        .set("Authorization", `Bearer ${token}`)
        .send({
          product: product._id,
          warehouse: warehouseA._id,
          type: "adjustment",
          direction: "decrease",
          quantity: 20,
          reason: "Damaged inventory write-off",
        });

      expect(res.status).toBe(201);
      expect(res.body.direction).toBe("decrease");

      const stockRes = await request(app)
        .get(`/api/stock/warehouse/${warehouseA._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(stockRes.body.stock[0].currentQuantity).toBe(30);
    });

    test("adjustment decrease exceeding current stock returns 400 and leaves stock unchanged", async () => {
      const { token, warehouseA, product } = await setupAdminAndData();

      await request(app)
        .post("/api/movements")
        .set("Authorization", `Bearer ${token}`)
        .send({ product: product._id, warehouse: warehouseA._id, type: "inbound", quantity: 20 });

      const res = await request(app)
        .post("/api/movements")
        .set("Authorization", `Bearer ${token}`)
        .send({
          product: product._id,
          warehouse: warehouseA._id,
          type: "adjustment",
          direction: "decrease",
          quantity: 50,
          reason: "Over-decrement attempt",
        });

      expect(res.status).toBe(400);

      const stockRes = await request(app)
        .get(`/api/stock/warehouse/${warehouseA._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(stockRes.body.stock[0].currentQuantity).toBe(20);
    });

    test("missing or invalid direction on adjustment returns 400", async () => {
      const { token, warehouseA, product } = await setupAdminAndData();

      // Missing direction
      const resMissing = await request(app)
        .post("/api/movements")
        .set("Authorization", `Bearer ${token}`)
        .send({
          product: product._id,
          warehouse: warehouseA._id,
          type: "adjustment",
          quantity: 10,
        });

      expect(resMissing.status).toBe(400);

      // Invalid direction
      const resInvalid = await request(app)
        .post("/api/movements")
        .set("Authorization", `Bearer ${token}`)
        .send({
          product: product._id,
          warehouse: warehouseA._id,
          type: "adjustment",
          direction: "sideways",
          quantity: 10,
        });

      expect(resInvalid.status).toBe(400);
    });
  });
});