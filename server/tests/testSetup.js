require("dotenv").config();
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const { redisConnection } = require("../config/redis");
const stockQueue = require("../queues/stockQueue");

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
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  
  if (mongoServer) {
    await mongoServer.stop();
  }

  // Close active BullMQ queue connections
  if (stockQueue) {
    await stockQueue.close();
  }

  // Close active Redis connection
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