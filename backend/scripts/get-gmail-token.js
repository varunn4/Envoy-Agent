/**
 * One-time script to get a Gmail OAuth2 refresh token.
 *
 * Usage:
 *   node scripts/get-gmail-token.js
 *
 * This will:
 *   1. Open a URL in your browser for Google OAuth consent
 *   2. You authorize the app and copy the authorization code
 *   3. It exchanges the code for a refresh token
 *   4. Copy the refresh token to your .env as GMAIL_OAUTH_REFRESH_TOKEN
 */

import 'dotenv/config';
import http from 'http';
import { URL } from 'url';
import axios from 'axios';

const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3456/oauth2callback';
const SCOPES = 'https://mail.google.com/';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET in .env first');
  process.exit(1);
}

const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
  `client_id=${encodeURIComponent(CLIENT_ID)}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&response_type=code` +
  `&scope=${encodeURIComponent(SCOPES)}` +
  `&access_type=offline` +
  `&prompt=consent`;

console.log('\n=== Gmail OAuth2 Token Generator ===\n');
console.log('Open this URL in your browser:\n');
console.log(authUrl);
console.log('\nWaiting for OAuth callback on http://localhost:3456 ...\n');

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:3456');

  if (url.pathname === '/oauth2callback') {
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');

    if (error) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end(`<h2>Error: ${error}</h2><p>Try again.</p>`);
      server.close();
      process.exit(1);
    }

    if (!code) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end('<h2>No code received</h2>');
      return;
    }

    try {
      // Exchange code for tokens
      const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code'
      });

      const { refresh_token, access_token } = tokenResponse.data;

      // Get user email
      let userEmail = '';
      try {
        const profileRes = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${access_token}` }
        });
        userEmail = profileRes.data.email;
      } catch (_) {}

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <h2>Success!</h2>
        <p>Email: <strong>${userEmail}</strong></p>
        <p>You can close this window now.</p>
        <p>Add this to your .env file:</p>
        <pre>GMAIL_OAUTH_REFRESH_TOKEN=${refresh_token}\nSMTP_FROM=${userEmail}</pre>
      `);

      console.log('\n=== SUCCESS ===\n');
      if (userEmail) console.log(`Email: ${userEmail}`);
      console.log(`\nAdd these to your .env:\n`);
      console.log(`GMAIL_OAUTH_REFRESH_TOKEN=${refresh_token}`);
      console.log(`SMTP_FROM=${userEmail}`);
      console.log('');

      server.close();
      process.exit(0);
    } catch (err) {
      const errMsg = err.response?.data?.error_description || err.message;
      res.writeHead(500, { 'Content-Type': 'text/html' });
      res.end(`<h2>Token exchange failed</h2><p>${errMsg}</p>`);
      console.error('Token exchange failed:', errMsg);
      server.close();
      process.exit(1);
    }
  }
});

server.listen(3456);
