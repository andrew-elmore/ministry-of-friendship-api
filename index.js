require('dotenv').config();
const { createApp } = require('./app');

const port = process.env.PORT || 1337;

async function startServer() {
  try {
    const app = await createApp({
      databaseURI: process.env.DATABASE_URI,
      appId: process.env.APP_ID,
      masterKey: process.env.MASTER_KEY,
      serverURL: process.env.SERVER_URL || `http://localhost:${port}/parse`,
      publicServerURL: process.env.PUBLIC_SERVER_URL || `http://localhost:${port}/parse`,
      appName: 'Ministry of Friendship',
    }, process.env.CORS_ORIGIN || 'http://localhost:3000');

    app.listen(port, () => {
      console.log(`:~: Parse Server running on port ${port}`);
    });
  } catch (error) {
    console.error('Failed to start Parse Server:', error);
    process.exit(1);
  }
}

startServer();
