require('dotenv').config({ path: '.env.test' });
require('dotenv').config();
const { createApp } = require('./app');

const port = process.env.TEST_PORT || 1338;
const databaseURI = process.env.TEST_DATABASE_URI || process.env.DATABASE_URI;

async function startServer() {
  try {
    const app = await createApp({
      databaseURI,
      appId: process.env.TEST_APP_ID || process.env.APP_ID,
      masterKey: process.env.TEST_MASTER_KEY || process.env.MASTER_KEY,
      serverURL: process.env.TEST_SERVER_URL || `http://localhost:${port}/parse`,
      publicServerURL: process.env.TEST_PUBLIC_SERVER_URL || `http://localhost:${port}/parse`,
      appName: 'Ministry of Friendship - Test',
    }, process.env.TEST_CORS_ORIGIN || 'http://localhost:8081');

    app.listen(port, () => {
      console.log(`:~: Parse Test Server running on port ${port}`);
      console.log(`:~: Database: ${String(databaseURI).replace(/\/\/[^/]*@/, '//').split('?')[0]}`);
    });
  } catch (error) {
    console.error('Failed to start Parse Test Server:', error);
    process.exit(1);
  }
}

startServer();
