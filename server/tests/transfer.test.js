const request = require("supertest");
const app = require("../app");
const { connect, closeDatabase, clearDatabase } = require("./testSetup");
const User = require("../models/User");
const Warehouse = require("../models/Warehouse");
const Product = require("../models/Product");
const Stock = require("../models/Stock");
const StockMovement = require("../models/StockMovement");
const Transfer = require("../models/Transfer");

beforeAll(async () => {
  await connect();
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

const setupTestEnvironment = async () => {
  const warehouseA = await Warehouse.create({
    name: "Transfer Hub A",
    latitude: 17.385,
    longitude: 78.4867,
    capacity: 1000,
    isActive: true,
  });

  const warehouseB = await Warehouse.create({
    name: "Transfer Hub B",
    latitude: 12.9716,
    longitude: 77.5946,
    capacity: 1000,
    isActive: true,
  });

  const admin = await User.create({
    name: "Admin User",
    email: "admin@stockgrid.local",
    password: "password123",
    role: "admin",
  });

  const adminLogin = await request(app).post("/api/auth/login").send({
    email: "admin@stockgrid.local",
    password: "password123",
  });
  const adminToken = adminLogin.body.token;

  const staffA = await User.create({
    name: "Staff Warehouse A",
    email: "staffA@stockgrid.local",
    password: "password123",
    role: "staff",
    warehouses: [warehouseA._id],
  });

  const staffALogin = await request(app).post("/api/auth/login").send({
    email: "staffA@stockgrid.local",
    password: "password123",
  });
  const staffAToken = staffALogin.body.token;

  const staffB = await User.create({
    name: "Staff Warehouse B",
    email: "staffB@stockgrid.local",
    password: "password123",
    role: "staff",
    warehouses: [warehouseB._id],
  });

  const staffBLogin = await request(app).post("/api/auth/login").send({
    email: "staffB@stockgrid.local",
    password: "password123",
  });
  const staffBToken = staffBLogin.body.token;

  const product = await Product.create({
    name: "High Precision Sensor",
    sku: `SENS-${Date.now()}`,
    category: "Electronics",
    unitCost: 80,
    defaultThreshold: 10,
    isActive: true,
  });

  return {
    admin,
    adminToken,
    staffA,
    staffAToken,
    staffB,
    staffBToken,
    warehouseA,
    warehouseB,
    product,
  };
};

describe("Two-Phase Stock Transfer Lifecycle", () => {
  test("Full lifecycle: initiate (debits source) -> confirm (credits destination)", async () => {
    const { adminToken, staffBToken, staffB, warehouseA, warehouseB, product } =
      await setupTestEnvironment();

    await Stock.create({
      product: product._id,
      warehouse: warehouseA._id,
      currentQuantity: 100,
      lowStockThreshold: 10,
    });

    const initRes = await request(app)
      .post("/api/transfers")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        product: product._id.toString(),
        fromWarehouse: warehouseA._id.toString(),
        toWarehouse: warehouseB._id.toString(),
        quantity: 40,
        notes: "Routine restocking",
      });

    expect(initRes.status).toBe(201);
    expect(initRes.body.status).toBe("in_transit");
    expect(initRes.body.quantity).toBe(40);
    expect(initRes.body.outboundMovement).toBeDefined();

    const transferId = initRes.body._id;

    const sourceStockAfterInit = await Stock.findOne({
      product: product._id,
      warehouse: warehouseA._id,
    });
    expect(sourceStockAfterInit.currentQuantity).toBe(60);

    const targetStockAfterInit = await Stock.findOne({
      product: product._id,
      warehouse: warehouseB._id,
    });
    expect(targetStockAfterInit).toBeNull();

    const confirmRes = await request(app)
      .post(`/api/transfers/${transferId}/confirm`)
      .set("Authorization", `Bearer ${staffBToken}`);

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.status).toBe("received");
    expect(confirmRes.body.receivedBy.toString()).toBe(staffB._id.toString());
    expect(confirmRes.body.receivedAt).toBeDefined();
    expect(confirmRes.body.inboundMovement).toBeDefined();

    const targetStockAfterConfirm = await Stock.findOne({
      product: product._id,
      warehouse: warehouseB._id,
    });
    expect(targetStockAfterConfirm.currentQuantity).toBe(40);

    const totalRes = await request(app)
      .get(`/api/stock/product/${product._id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(totalRes.body.totalQuantity).toBe(100);
  });

  test("Initiate then cancel: restores stock to source warehouse with reversing movement", async () => {
    const { staffAToken, warehouseA, warehouseB, product } =
      await setupTestEnvironment();

    await Stock.create({
      product: product._id,
      warehouse: warehouseA._id,
      currentQuantity: 50,
      lowStockThreshold: 10,
    });

    const initRes = await request(app)
      .post("/api/transfers")
      .set("Authorization", `Bearer ${staffAToken}`)
      .send({
        product: product._id.toString(),
        fromWarehouse: warehouseA._id.toString(),
        toWarehouse: warehouseB._id.toString(),
        quantity: 20,
      });

    expect(initRes.status).toBe(201);
    const transferId = initRes.body._id;

    const cancelRes = await request(app)
      .post(`/api/transfers/${transferId}/cancel`)
      .set("Authorization", `Bearer ${staffAToken}`)
      .send({ notes: "Shipment recalled due to damaged vehicle" });

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.status).toBe("cancelled");
    expect(cancelRes.body.cancelledAt).toBeDefined();

    const restoredStock = await Stock.findOne({
      product: product._id,
      warehouse: warehouseA._id,
    });
    expect(restoredStock.currentQuantity).toBe(50);

    const reversingMovement = await StockMovement.findOne({
      product: product._id,
      type: "inbound",
      warehouse: warehouseA._id,
    });
    expect(reversingMovement).toBeDefined();
    expect(reversingMovement.quantity).toBe(20);
    expect(reversingMovement.fromWarehouse).toBeNull();
    expect(reversingMovement.reason).toBe("Shipment recalled due to damaged vehicle");
  });

  test("Attempting to confirm an already-received or cancelled transfer returns 400", async () => {
    const { adminToken, warehouseA, warehouseB, product } =
      await setupTestEnvironment();

    await Stock.create({
      product: product._id,
      warehouse: warehouseA._id,
      currentQuantity: 50,
      lowStockThreshold: 10,
    });

    const initRes = await request(app)
      .post("/api/transfers")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        product: product._id.toString(),
        fromWarehouse: warehouseA._id.toString(),
        toWarehouse: warehouseB._id.toString(),
        quantity: 15,
      });

    const transferId = initRes.body._id;

    const confirm1 = await request(app)
      .post(`/api/transfers/${transferId}/confirm`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(confirm1.status).toBe(200);

    const confirmAgain = await request(app)
      .post(`/api/transfers/${transferId}/confirm`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(confirmAgain.status).toBe(400);

    const cancelAfterConfirm = await request(app)
      .post(`/api/transfers/${transferId}/cancel`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(cancelAfterConfirm.status).toBe(400);
  });

  test("Rejects initiate when quantity exceeds available stock", async () => {
    const { adminToken, warehouseA, warehouseB, product } =
      await setupTestEnvironment();

    await Stock.create({
      product: product._id,
      warehouse: warehouseA._id,
      currentQuantity: 10,
      lowStockThreshold: 5,
    });

    const res = await request(app)
      .post("/api/transfers")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        product: product._id.toString(),
        fromWarehouse: warehouseA._id.toString(),
        toWarehouse: warehouseB._id.toString(),
        quantity: 50,
      });

    expect(res.status).toBe(400);

    const stock = await Stock.findOne({
      product: product._id,
      warehouse: warehouseA._id,
    });
    expect(stock.currentQuantity).toBe(10);
  });

  test("Rejects initiate when source and destination warehouses are identical", async () => {
    const { adminToken, warehouseA, product } = await setupTestEnvironment();

    const res = await request(app)
      .post("/api/transfers")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        product: product._id.toString(),
        fromWarehouse: warehouseA._id.toString(),
        toWarehouse: warehouseA._id.toString(),
        quantity: 5,
      });

    expect(res.status).toBe(400);
  });
});
