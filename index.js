require('dotenv').config();
const express = require('express');
const { ParseServer } = require('parse-server');
const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const emailAdapter = {
  sendMail: async function(options) {
    const msg = {
      to: options.to,
      from: process.env.FROM_EMAIL_ADDRESS,
      subject: options.subject,
      text: options.text,
      html: options.html
    };
    try {
      await sgMail.send(msg);
    } catch (error) {
      console.error('SendGrid Error:', error);
      throw error;
    }
  }
};

const app = express();

const config = {
  databaseURI: process.env.DATABASE_URI,
  cloud: process.env.CLOUD_CODE_MAIN || __dirname + '/cloud/main.js',
  appId: process.env.APP_ID,
  masterKey: process.env.MASTER_KEY,
  serverURL: process.env.SERVER_URL || 'http://localhost:1337/parse',
  publicServerURL: process.env.PUBLIC_SERVER_URL || 'http://localhost:1337/parse',
  verifyUserEmails: true,
  emailVerifyTokenValidityDuration: 24 * 60 * 60,
  appName: 'Ministry of Friendship',
  emailAdapter: emailAdapter
};

const api = new ParseServer(config);

async function startServer() {
  try {
    await api.start();
    app.use('/parse', api.app);
    
    app.get('/health', (req, res) => {
      res.status(200).json({ status: 'healthy' });
    });

    const port = process.env.PORT || 1337;
    app.listen(port, () => {
      console.log(`Parse Server running on port ${port}`);
    });
  } catch (error) {
    console.error('Failed to start Parse Server:', error);
    process.exit(1);
  }
}

startServer();