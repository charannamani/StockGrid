const request = require("supertest");
const app = require("../app");
const { connect, closeDatabase, clearDatabase } = require("./testSetup");
const Product = require("../models/Product");
const Warehouse = require("../models/Warehouse");
const Stock = require("../models/Stock");
const User = require("../models/User");
const Reservation = require("../models/Reservation");

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

  await User.create({
    name: "Reservation Tester",
    email: "rsv-tester@stockgrid.local",
    password: "password123",
    role: "admin",
  });

  const loginRes = await request(app).post("/api/auth/login").send({
    email: "rsv-tester@stockgrid.local",
    password: "password123",
  });
  authToken = loginRes.body.token;

  testProduct = await Product.create({
    name: "GPU Workstation",
    sku: "GPU-WS-4090",
    category: "Hardware",
    unitCost: 3200,
    isActive: true,
  });

  testWarehouse = await Warehouse.create({
    name: "Bengaluru East Facility",
    address: "Whitefield, Bengaluru",
    latitude: 12.9716,
    longitude: 77.5946,
    capacity: 1000,
    isActive: true,
  });
});

describe("Two-Phase Commit Reservation Engine", () => {
  test("Reserving stock must increase reservedQuantity and block subsequent over-reservations", async () => {
    await Stock.create({
      product: testProduct._id,
      warehouse: testWarehouse._id,
      currentQuantity: 4,
      reservedQuantity: 0,
      lowStockThreshold: 2,
    });

    const rsvRes = await request(app)
      .post("/api/stock/reserve")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        productId: testProduct._id.toString(),
        warehouseId: testWarehouse._id.toString(),
        quantity: 3,
      });

    expect(rsvRes.status).toBe(201);
    expect(rsvRes.body.reservationId).toBeDefined();

    const availRes = await request(app)
      .get(`/api/stock/availability?productId=${testProduct._id}&quantity=2`)
      .set("Authorization", `Bearer ${authToken}`);

    expect(availRes.body.fulfillable).toBe(false);

    const overReserveRes = await request(app)
      .post("/api/stock/reserve")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        productId: testProduct._id.toString(),
        warehouseId: testWarehouse._id.toString(),
        quantity: 2,
      });

    expect(overReserveRes.status).toBe(422);
  });

  test("Releasing a reservation must restore sellable balance", async () => {
    await Stock.create({
      product: testProduct._id,
      warehouse: testWarehouse._id,
      currentQuantity: 5,
      reservedQuantity: 0,
      lowStockThreshold: 2,
    });

    const hold = await request(app)
      .post("/api/stock/reserve")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        productId: testProduct._id.toString(),
        warehouseId: testWarehouse._id.toString(),
        quantity: 3,
      });

    const reservationId = hold.body.reservationId;

    const releaseRes = await request(app)
      .post("/api/stock/release")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ reservationId });

    expect(releaseRes.status).toBe(200);
    expect(releaseRes.body.status).toBe("released");

    const updatedStock = await Stock.findOne({
      product: testProduct._id,
      warehouse: testWarehouse._id,
    });

    expect(updatedStock.reservedQuantity).toBe(0);
    expect(updatedStock.currentQuantity).toBe(5);
  });
});