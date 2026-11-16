const path = require('path');
const express = require('express');
const cors = require('cors');
const { ParseServer } = require('parse-server');
const { clerkMiddleware, requireClerkUser } = require('./auth/clerkAuth');
const schema = require('./cloud/schema');

/**
 * Builds the API: a public /health route, then Clerk session verification in front of every Parse route so
 * cloud code only ever runs for a verified Clerk user.
 * @param {object} parseOptions Environment specific Parse Server options (databaseURI, appId, masterKey, URLs, appName).
 * @param {string} corsOrigin The UI origin allowed to call the API from the browser.
 * @returns {Promise<import('express').Express>}
 */
async function createApp(parseOptions, corsOrigin) {
  const api = new ParseServer({
    cloud: path.join(__dirname, 'cloud/main.js'),
    ...parseOptions,
    schema,
    directAccess: true,
    allowClientClassCreation: false,
    enableAnonymousUsers: false,
    allowOrigin: corsOrigin,
  });
  await api.start();

  const app = express();
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy' });
  });
  app.use('/parse', cors({ origin: corsOrigin }), clerkMiddleware(), requireClerkUser, api.app);
  return app;
}

module.exports = { createApp };
