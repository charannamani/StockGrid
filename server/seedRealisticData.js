const dotenv = require("dotenv");
dotenv.config();

const mongoose = require("mongoose");
const { redisConnection } = require("./config/redis");
const reservationQueue = require("./queues/reservationQueue");
const stockQueue = require("./queues/stockQueue");

const User = require("./models/User");
const Warehouse = require("./models/Warehouse");
const Product = require("./models/Product");
const Stock = require("./models/Stock");
const StockMovement = require("./models/StockMovement");
const Transfer = require("./models/Transfer");
const Reservation = require("./models/Reservation");
const ApiKey = require("./models/ApiKey");

async function seed() {
  console.log("==================================================");
  console.log("   StockGrid Database Reset & Seed                ");
  console.log("   Business: BharatCart E-Commerce Logistics (India)");
  console.log("==================================================");

  try {
    // 1. Connect MongoDB Atlas
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
      console.log(`[MongoDB] Connected to database: ${mongoose.connection.name}`);
    }

    // 2. Clear Redis and BullMQ
    console.log("[Redis] Purging BullMQ queues & clearing Redis caches...");
    try {
      if (reservationQueue) {
        await reservationQueue.obliterate({ force: true }).catch(() => {});
      }
      if (stockQueue) {
        await stockQueue.obliterate({ force: true }).catch(() => {});
      }
      await redisConnection.flushdb();
      console.log("[Redis] Redis flushdb completed successfully.");
    } catch (rErr) {
      console.warn("[Redis] Warning while clearing Redis:", rErr.message);
    }

    // 3. Wipe All MongoDB Collections (Removes all previous Dallas / US data)
    console.log("[MongoDB] Deleting existing data across all collections...");
    await Promise.all([
      User.deleteMany({}),
      Warehouse.deleteMany({}),
      Product.deleteMany({}),
      Stock.deleteMany({}),
      StockMovement.deleteMany({}),
      Transfer.deleteMany({}),
      Reservation.deleteMany({}),
      ApiKey.deleteMany({}),
    ]);
    console.log("[MongoDB] All collections purged cleanly.");

    // 4. Create Indian State-wise Warehouses
    console.log("[Seeding] Creating Indian State-wise Fulfillment Warehouses...");
    const warehousesData = [
      {
        name: "Bengaluru Fulfillment Centre (BLR-1, Karnataka)",
        address: "Plot 42, Hosur Road, Electronic City Phase 1, Bengaluru, Karnataka 560100",
        capacity: 120000,
        latitude: 12.8452,
        longitude: 77.6602,
        isActive: true,
      },
      {
        name: "Mumbai Mega Hub (BOM-1, Maharashtra)",
        address: "Bhiwandi Logistics Park, Kalyan Road, Bhiwandi, Thane, Maharashtra 421302",
        capacity: 180000,
        latitude: 19.2967,
        longitude: 73.0631,
        isActive: true,
      },
      {
        name: "Delhi-NCR Logistics Centre (DEL-1, Haryana)",
        address: "Sector 8, IMT Manesar, Gurugram, Haryana 122051",
        capacity: 150000,
        latitude: 28.3639,
        longitude: 76.9295,
        isActive: true,
      },
      {
        name: "Hyderabad Distribution Hub (HYD-1, Telangana)",
        address: "Hardware Park, Shamshabad, Hyderabad, Telangana 501218",
        capacity: 100000,
        latitude: 17.2346,
        longitude: 78.4312,
        isActive: true,
      },
      {
        name: "Kolkata Regional Depot (CCU-1, West Bengal)",
        address: "Dankuni Industrial Complex, Hooghly, Kolkata, West Bengal 712311",
        capacity: 75000,
        latitude: 22.6841,
        longitude: 88.2917,
        isActive: true,
      },
    ];

    const warehouses = await Warehouse.insertMany(warehousesData);
    const [blrWh, bomWh, delWh, hydWh, ccuWh] = warehouses;
    console.log(`[Seeding] Created ${warehouses.length} Indian state-wise warehouses.`);

    // 5. Create Users (Admin & Scoped Staff)
    console.log("[Seeding] Creating Users with Scoped Facility Access...");
    const usersToCreate = [
      {
        name: "Charan",
        email: "charan@stockgrid.com",
        password: "test1234",
        role: "admin",
        warehouses: [blrWh._id, bomWh._id, delWh._id, hydWh._id, ccuWh._id],
      },
      {
        name: "Karthik Reddy (Bengaluru Hub Manager)",
        email: "karthik.blr@stockgrid.io",
        password: "Password123!",
        role: "staff",
        warehouses: [blrWh._id],
      },
      {
        name: "Pooja Deshmukh (Mumbai Hub Lead)",
        email: "pooja.mumbai@stockgrid.io",
        password: "Password123!",
        role: "staff",
        warehouses: [bomWh._id],
      },
      {
        name: "Amit Verma (Delhi-NCR Specialist)",
        email: "amit.delhi@stockgrid.io",
        password: "Password123!",
        role: "staff",
        warehouses: [delWh._id],
      },
      {
        name: "Sneha Rao (South Zone Floater)",
        email: "sneha.south@stockgrid.io",
        password: "Password123!",
        role: "staff",
        warehouses: [blrWh._id, hydWh._id],
      },
    ];

    const savedUsers = [];
    for (const u of usersToCreate) {
      const userDoc = new User(u);
      await userDoc.save();
      savedUsers.push(userDoc);
    }
    const [adminUser, blrStaff, bomStaff, delStaff, southStaff] = savedUsers;
    console.log(`[Seeding] Created ${savedUsers.length} users with hashed passwords.`);

    // 6. Create Realistic E-Commerce Products (Phones, Shoes, Books, Audio)
    console.log("[Seeding] Creating Realistic E-Commerce Products...");
    const productsData = [
      {
        name: "Apple iPhone 15 (128GB, Blue)",
        sku: "PHN-IPH-15-BLU",
        category: "Smartphones",
        unitCost: 65999,
        defaultThreshold: 15,
        description:
          "6.1-inch Super Retina XDR display, Dynamic Island, A16 Bionic chip, 48MP main camera with 2x Telephoto.",
        isActive: true,
      },
      {
        name: "OnePlus 12R 5G (Cool Blue, 256GB)",
        sku: "PHN-1P-12R-256",
        category: "Smartphones",
        unitCost: 39999,
        defaultThreshold: 20,
        description:
          "Snapdragon 8 Gen 2, 120Hz ProXDR display, 5500mAh battery with 100W SUPERVOOC charging.",
        isActive: true,
      },
      {
        name: "Nike Air Jordan 1 Retro High OG (Chicago Red/White, UK 9)",
        sku: "SHOE-NK-AJ1-RED",
        category: "Footwear",
        unitCost: 16995,
        defaultThreshold: 10,
        description:
          "Iconic high-top premium leather basketball sneaker with encapsulated Nike Air sole cushioning.",
        isActive: true,
      },
      {
        name: "Puma Nitro Velocity 3 Running Shoes (Black, UK 8)",
        sku: "SHOE-PUM-NITRO-8",
        category: "Footwear",
        unitCost: 7499,
        defaultThreshold: 15,
        description:
          "Lightweight responsive road-running shoe with nitrogen-injected NITRO foam midsole.",
        isActive: true,
      },
      {
        name: "Atomic Habits by James Clear (Paperback)",
        sku: "BK-ATOMIC-HABITS",
        category: "Books",
        unitCost: 499,
        defaultThreshold: 30,
        description:
          "An easy and proven way to build good habits and break bad ones. International #1 Bestseller.",
        isActive: true,
      },
      {
        name: "The Psychology of Money by Morgan Housel",
        sku: "BK-PSYCH-MONEY",
        category: "Books",
        unitCost: 350,
        defaultThreshold: 25,
        description:
          "Timeless lessons on wealth, greed, and happiness. Best-selling personal finance guide.",
        isActive: true,
      },
      {
        name: "Sony WH-1000XM5 Wireless Noise Cancelling Headphones",
        sku: "AUD-SONY-XM5-BLK",
        category: "Audio",
        unitCost: 28990,
        defaultThreshold: 12,
        description:
          "Industry-leading active noise cancellation with 8 microphones, LDAC high-res audio, and 30-hour battery life.",
        isActive: true,
      },
      {
        name: "boAt Airdopes 141 ANC TWS Earbuds",
        sku: "AUD-BOAT-141-ANC",
        category: "Audio",
        unitCost: 1499,
        defaultThreshold: 40,
        description:
          "Up to 32dB active noise cancellation, 42 hours total playtime, ENx quad microphones with BEAST mode.",
        isActive: true,
      },
    ];

    const products = await Product.insertMany(productsData);
    console.log(`[Seeding] Created ${products.length} e-commerce products.`);

    const prodMap = {};
    products.forEach((p) => {
      prodMap[p.sku] = p;
    });

    // 7. Seed Physical Stock Levels & Initial Consignment Inbound Movements
    console.log("[Seeding] Populating stock levels & inventory ledger...");

    // Intentional Scenarios:
    // - Delhi-NCR has LOW STOCK on iPhone 15 (4 vs threshold 15) and OnePlus 12R (8 vs threshold 20)
    // - Kolkata has LOW STOCK on Nike Air Jordan 1 (3 vs threshold 10)
    // - Bengaluru has 10 units of Sony XM5 reserved for an Amazon Prime order hold
    const stockDistribution = {
      [blrWh._id.toString()]: {
        "PHN-IPH-15-BLU": { qty: 85, res: 0 },
        "PHN-1P-12R-256": { qty: 140, res: 0 },
        "SHOE-NK-AJ1-RED": { qty: 40, res: 0 },
        "SHOE-PUM-NITRO-8": { qty: 90, res: 0 },
        "BK-ATOMIC-HABITS": { qty: 350, res: 0 },
        "BK-PSYCH-MONEY": { qty: 280, res: 0 },
        "AUD-SONY-XM5-BLK": { qty: 55, res: 10 }, // 10 units reserved for live pending hold!
        "AUD-BOAT-141-ANC": { qty: 600, res: 0 },
      },
      [bomWh._id.toString()]: {
        "PHN-IPH-15-BLU": { qty: 160, res: 0 }, // Outbound transfer of 20 units was deducted from initial 180
        "PHN-1P-12R-256": { qty: 210, res: 0 },
        "SHOE-NK-AJ1-RED": { qty: 95, res: 0 },
        "SHOE-PUM-NITRO-8": { qty: 140, res: 0 },
        "BK-ATOMIC-HABITS": { qty: 500, res: 0 },
        "BK-PSYCH-MONEY": { qty: 450, res: 0 },
        "AUD-SONY-XM5-BLK": { qty: 85, res: 0 },
        "AUD-BOAT-141-ANC": { qty: 950, res: 0 },
      },
      [delWh._id.toString()]: {
        "PHN-IPH-15-BLU": { qty: 4, res: 0 }, // LOW STOCK ALERT! (Threshold 15)
        "PHN-1P-12R-256": { qty: 8, res: 0 }, // LOW STOCK ALERT! (Threshold 20)
        "SHOE-NK-AJ1-RED": { qty: 60, res: 0 },
        "SHOE-PUM-NITRO-8": { qty: 80, res: 0 },
        "BK-ATOMIC-HABITS": { qty: 300, res: 0 },
        "BK-PSYCH-MONEY": { qty: 250, res: 0 },
        "AUD-SONY-XM5-BLK": { qty: 45, res: 0 },
        "AUD-BOAT-141-ANC": { qty: 400, res: 0 },
      },
      [hydWh._id.toString()]: {
        "PHN-IPH-15-BLU": { qty: 50, res: 0 },
        "PHN-1P-12R-256": { qty: 90, res: 0 },
        "SHOE-NK-AJ1-RED": { qty: 30, res: 0 },
        "SHOE-PUM-NITRO-8": { qty: 60, res: 0 },
        "BK-ATOMIC-HABITS": { qty: 200, res: 0 },
        "BK-PSYCH-MONEY": { qty: 180, res: 0 },
        "AUD-SONY-XM5-BLK": { qty: 35, res: 0 },
        "AUD-BOAT-141-ANC": { qty: 350, res: 0 },
      },
      [ccuWh._id.toString()]: {
        "PHN-IPH-15-BLU": { qty: 35, res: 0 },
        "PHN-1P-12R-256": { qty: 60, res: 0 },
        "SHOE-NK-AJ1-RED": { qty: 3, res: 0 }, // LOW STOCK ALERT! (Threshold 10)
        "SHOE-PUM-NITRO-8": { qty: 45, res: 0 },
        "BK-ATOMIC-HABITS": { qty: 150, res: 0 },
        "BK-PSYCH-MONEY": { qty: 140, res: 0 },
        "AUD-SONY-XM5-BLK": { qty: 25, res: 0 },
        "AUD-BOAT-141-ANC": { qty: 250, res: 0 },
      },
    };

    const stocksToInsert = [];
    const movementsToInsert = [];

    for (const wh of warehouses) {
      const dist = stockDistribution[wh._id.toString()];
      for (const p of products) {
        const item = dist[p.sku] || { qty: 50, res: 0 };
        stocksToInsert.push({
          product: p._id,
          warehouse: wh._id,
          currentQuantity: item.qty,
          reservedQuantity: item.res,
          lowStockThreshold: p.defaultThreshold,
        });

        // Audit movement for initial supplier receipt
        movementsToInsert.push({
          product: p._id,
          warehouse: wh._id,
          type: "inbound",
          direction: "increase",
          quantity: item.qty + (p.sku === "PHN-IPH-15-BLU" && wh._id.equals(bomWh._id) ? 20 : 0),
          reason: "Direct Brand Consignment Inwarding (Batch #IN-FESTIVE-2026)",
          performedBy: adminUser._id,
          source: "web",
          createdAt: new Date(Date.now() - 5 * 24 * 3600 * 1000), // 5 days ago
        });
      }
    }

    await Stock.insertMany(stocksToInsert);
    console.log(`[Seeding] Created ${stocksToInsert.length} stock inventory records across 5 states.`);

    // 8. Seed Two-Phase Inter-Warehouse Transfers
    console.log("[Seeding] Creating Inter-State Two-Phase Transfers...");

    // 8.1 In-Transit Transfer: Mumbai -> Delhi-NCR for 20x iPhone 15 Blue
    const transferProduct1 = prodMap["PHN-IPH-15-BLU"];
    const outboundMv1 = await StockMovement.create({
      product: transferProduct1._id,
      warehouse: bomWh._id,
      fromWarehouse: bomWh._id,
      toWarehouse: delWh._id,
      type: "transfer_out",
      direction: "decrease",
      quantity: 20,
      reason: `Transfer to ${delWh.name}: In Transit (Replenishment for Delhi)`,
      performedBy: adminUser._id,
      source: "web",
      createdAt: new Date(Date.now() - 4 * 3600 * 1000),
    });

    await Transfer.create({
      product: transferProduct1._id,
      fromWarehouse: bomWh._id,
      toWarehouse: delWh._id,
      quantity: 20,
      status: "in_transit",
      initiatedBy: adminUser._id,
      outboundMovement: outboundMv1._id,
      notes: "Urgent inventory replenishment to Delhi-NCR hub ahead of festival sales rush.",
      initiatedAt: new Date(Date.now() - 4 * 3600 * 1000),
    });

    // 8.2 Completed Transfer: Bengaluru -> Hyderabad for 100x boAt Airdopes
    const transferProduct2 = prodMap["AUD-BOAT-141-ANC"];
    const outboundMv2 = await StockMovement.create({
      product: transferProduct2._id,
      warehouse: blrWh._id,
      fromWarehouse: blrWh._id,
      toWarehouse: hydWh._id,
      type: "transfer_out",
      direction: "decrease",
      quantity: 100,
      reason: `Transfer to ${hydWh.name}: Dispatched`,
      performedBy: blrStaff._id,
      source: "web",
      createdAt: new Date(Date.now() - 36 * 3600 * 1000),
    });

    const inboundMv2 = await StockMovement.create({
      product: transferProduct2._id,
      warehouse: hydWh._id,
      fromWarehouse: blrWh._id,
      toWarehouse: hydWh._id,
      type: "transfer_in",
      direction: "increase",
      quantity: 100,
      reason: `Received transfer from ${blrWh.name}`,
      performedBy: southStaff._id,
      source: "web",
      createdAt: new Date(Date.now() - 12 * 3600 * 1000),
    });

    await Transfer.create({
      product: transferProduct2._id,
      fromWarehouse: blrWh._id,
      toWarehouse: hydWh._id,
      quantity: 100,
      status: "received",
      initiatedBy: blrStaff._id,
      receivedBy: southStaff._id,
      outboundMovement: outboundMv2._id,
      inboundMovement: inboundMv2._id,
      notes: "Inter-state regional stock rebalance for South Zone.",
      initiatedAt: new Date(Date.now() - 36 * 3600 * 1000),
      receivedAt: new Date(Date.now() - 12 * 3600 * 1000),
    });

    // 9. Seed Reservations
    console.log("[Seeding] Creating Two-Phase Inventory Reservations...");

    // 9.1 Active Live Pending Hold (10 minutes TTL, 9 min remaining)
    const resProduct1 = prodMap["AUD-SONY-XM5-BLK"];
    const liveReservationId = "rsv_amz_99214";
    const liveExpiresAt = new Date(Date.now() + 9 * 60 * 1000);

    await Reservation.create({
      reservationId: liveReservationId,
      product: resProduct1._id,
      warehouse: blrWh._id,
      quantity: 10,
      status: "pending",
      expiresAt: liveExpiresAt,
      clientReference: "Amazon Prime Checkout #408-9821034-7712341 (Bengaluru Express)",
    });

    // Enqueue in BullMQ with delay
    await reservationQueue.add(
      "expireReservation",
      { reservationId: liveReservationId },
      { delay: 9 * 60 * 1000, jobId: liveReservationId }
    );

    // 9.2 Confirmed Reservation (Historical)
    const resProduct2 = prodMap["SHOE-NK-AJ1-RED"];
    const confirmedResId = "rsv_flp_4188";
    await Reservation.create({
      reservationId: confirmedResId,
      product: resProduct2._id,
      warehouse: bomWh._id,
      quantity: 2,
      status: "confirmed",
      expiresAt: new Date(Date.now() - 2 * 3600 * 1000),
      clientReference: "Flipkart SuperCoins Order #OD32984719283710",
    });

    // Outbound movement for the confirmed reservation
    movementsToInsert.push({
      product: resProduct2._id,
      warehouse: bomWh._id,
      type: "outbound",
      direction: "decrease",
      quantity: 2,
      reason: `Confirmed Hold: Order #OD32984719283710 (Rsv: ${confirmedResId})`,
      performedBy: adminUser._id,
      source: "web",
      createdAt: new Date(Date.now() - 2 * 3600 * 1000),
    });

    // Save all movements
    await StockMovement.insertMany(movementsToInsert);
    console.log(`[Seeding] Created ${movementsToInsert.length + 3} total stock ledger movements.`);

    // 10. Seed API Keys
    console.log("[Seeding] Creating Production API Keys...");
    const rawKey1 = "sg_live_" + ApiKey.generateRawKey().slice(0, 32);
    const rawKey2 = "sg_live_" + ApiKey.generateRawKey().slice(0, 32);

    await ApiKey.create([
      {
        name: "Shopify India Direct Storefront Sync",
        key: ApiKey.hashKey(rawKey1),
        isActive: true,
        createdBy: adminUser._id,
        callbackUrl: "https://bharatcart.in/api/webhooks/inventory",
      },
      {
        name: "Delhivery & BlueDart Automated Dispatch",
        key: ApiKey.hashKey(rawKey2),
        isActive: true,
        createdBy: adminUser._id,
      },
    ]);

    console.log("==================================================");
    console.log("       BHARATCART SEEDING COMPLETED SUCCESSFULLY  ");
    console.log("==================================================");
    console.log("\n--- TEST LOGIN CREDENTIALS ---");
    console.log("1. National Admin (All India Facilities):");
    console.log("   Email:    admin@stockgrid.io");
    console.log("   Password: Password123!");
    console.log("\n2. Bengaluru Lead (Karnataka):");
    console.log("   Email:    karthik.blr@stockgrid.io");
    console.log("   Password: Password123!");
    console.log("\n3. Mumbai Lead (Maharashtra):");
    console.log("   Email:    pooja.mumbai@stockgrid.io");
    console.log("   Password: Password123!");
    console.log("\n4. Delhi-NCR Specialist (Haryana/NCR):");
    console.log("   Email:    amit.delhi@stockgrid.io");
    console.log("   Password: Password123!");
    console.log("\n5. South Zone Floater (Bengaluru + Hyderabad):");
    console.log("   Email:    sneha.south@stockgrid.io");
    console.log("   Password: Password123!");
    console.log("--------------------------------------------------\n");

    // Close connections cleanly
    await reservationQueue.close();
    await stockQueue.close();
    await redisConnection.quit();
    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error("[Seeding Error]:", err);
    process.exit(1);
  }
}

seed();
