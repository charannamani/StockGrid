require("dotenv").config();
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const { redisConnection } = require("../config/redis");
const stockQueue = require("../queues/stockQueue");
const reservationQueue = require("../queues/reservationQueue");

jest.setTimeout(60000);

let mongoServer;

const connect = async () => {
  mongoServer = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
};

const closeDatabase = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  }
  
  if (mongoServer) {
    await mongoServer.stop();
  }

  if (stockQueue) {
    await stockQueue.close();
  }

  if (reservationQueue) {
    await reservationQueue.close();
  }

  if (redisConnection) {
    await redisConnection.quit();
  }
};

const clearDatabase = async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany();
  }
};

module.exports = { connect, closeDatabase, clearDatabase };