const { MongoMemoryServer } = require('mongodb-memory-server');
const { createApp } = require('../../app');

const TEST_APP_ID = 'test-app-id';
const TEST_MASTER_KEY = 'test-master-key';

let mongo = null;

const createTestServer = async () => {
  mongo = await MongoMemoryServer.create();
  return createApp({
    databaseURI: mongo.getUri('ministry-test'),
    appId: TEST_APP_ID,
    masterKey: TEST_MASTER_KEY,
    serverURL: 'http://localhost:1339/parse',
    appName: 'Ministry of Friendship - Jest',
  }, 'http://localhost:8081');
};

const stopTestServer = async () => {
  if (mongo) {
    await mongo.stop();
    mongo = null;
  }
};

module.exports = {
  TEST_APP_ID,
  TEST_MASTER_KEY,
  createTestServer,
  stopTestServer,
};
