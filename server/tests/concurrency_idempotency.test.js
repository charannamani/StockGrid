const request = require("supertest");
const app = require("../app");
const { connect, closeDatabase, clearDatabase } = require("./testSetup");
const Product = require("../models/Product");
const Warehouse = require("../models/Warehouse");
const Stock = require("../models/Stock");
const User = require("../models/User");
const { redisConnection } = require("../config/redis");

let authToken;
let testProduct;
let testWarehouse;

beforeAll(async () => {
  await connect();
});

afterAll(async () => {
  await closeDatabase();
});

beforeEach(async () => {
  await clearDatabase();
  if (redisConnection) {
    await redisConnection.flushdb();
  }

  await User.create({
    name: "Admin User",
    email: "admin-ci@stockgrid.local",
    password: "password123",
    role: "admin",
  });

  const loginRes = await request(app).post("/api/auth/login").send({
    email: "admin-ci@stockgrid.local",
    password: "password123",
  });
  authToken = loginRes.body.token;

  testProduct = await Product.create({
    name: "Enterprise Server Node",
    sku: "SRV-NODE-001",
    category: "Hardware",
    unitCost: 1500,
    defaultThreshold: 5,
    isActive: true,
  });

  testWarehouse = await Warehouse.create({
    name: "Primary Testing Hub",
    address: "Banjara Hills, Hyderabad",
    latitude: 17.4156,
    longitude: 78.475,
    capacity: 1000,
    isActive: true,
  });
});

describe("CRITICAL: Concurrency & Oversell Protection", () => {
  test("Should strictly prevent negative stock when 20 requests race for 5 units", async () => {
    await Stock.create({
      product: testProduct._id,
      warehouse: testWarehouse._id,
      currentQuantity: 5,
      reservedQuantity: 0,
      lowStockThreshold: 5,
    });

    const requests = Array.from({ length: 20 }, (_, index) =>
      request(app)
        .post("/api/webhooks/order-placed")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          orderId: `ORD-RACE-${index}`,
          productId: testProduct._id.toString(),
          quantity: 1,
          destinationLatitude: 17.41,
          destinationLongitude: 78.47,
        })
    );

    const responses = await Promise.all(requests);

    const successfulFulfillments = responses.filter((r) => r.status === 200);
    const rejectedFulfillments = responses.filter(
      (r) => r.status === 422 || r.status === 400
    );

    expect(successfulFulfillments.length).toBe(5);
    expect(rejectedFulfillments.length).toBe(15);

    const finalStock = await Stock.findOne({
      product: testProduct._id,
      warehouse: testWarehouse._id,
    });

    expect(finalStock.currentQuantity).toBe(0);
    expect(finalStock.currentQuantity).toBeGreaterThanOrEqual(0);
  });
});

describe("CRITICAL: Network Idempotency", () => {
  test("Duplicate order retries with the same Idempotency-Key must not deduct stock twice", async () => {
    await Stock.create({
      product: testProduct._id,
      warehouse: testWarehouse._id,
      currentQuantity: 10,
      reservedQuantity: 0,
      lowStockThreshold: 5,
    });

    const idempotencyHeader = "idemp_test_key_abc_999";

    const res1 = await request(app)
      .post("/api/webhooks/order-placed")
      .set("Authorization", `Bearer ${authToken}`)
      .set("idempotency-key", idempotencyHeader)
      .send({
        orderId: "ORD-IDEMP-001",
        productId: testProduct._id.toString(),
        quantity: 3,
      });

    expect(res1.status).toBe(200);

    const res2 = await request(app)
      .post("/api/webhooks/order-placed")
      .set("Authorization", `Bearer ${authToken}`)
      .set("idempotency-key", idempotencyHeader)
      .send({
        orderId: "ORD-IDEMP-001",
        productId: testProduct._id.toString(),
        quantity: 3,
      });

    expect(res2.status).toBe(200);
    expect(res2.body.orderId).toBe(res1.body.orderId);

    const stockAfter = await Stock.findOne({
      product: testProduct._id,
      warehouse: testWarehouse._id,
    });

    expect(stockAfter.currentQuantity).toBe(7);
  });
});