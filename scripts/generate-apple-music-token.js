/**
 * Helper script to generate Apple Music Developer Token (JWT)
 * 
 * Usage:
 *   node scripts/generate-apple-music-token.js
 * 
 * Requires environment variables:
 *   APPLE_MUSIC_TEAM_ID - Your Apple Developer Team ID
 *   APPLE_MUSIC_KEY_ID - The Key ID from your private key
 *   APPLE_MUSIC_PRIVATE_KEY - Contents of your .p8 file (or path to file)
 */

require('dotenv').config();
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const TEAM_ID = process.env.APPLE_MUSIC_TEAM_ID;
const KEY_ID = process.env.APPLE_MUSIC_KEY_ID;
let PRIVATE_KEY = process.env.APPLE_MUSIC_PRIVATE_KEY;

// If PRIVATE_KEY is a file path, read it
if (PRIVATE_KEY && !PRIVATE_KEY.includes('BEGIN PRIVATE KEY')) {
  try {
    const keyPath = path.resolve(PRIVATE_KEY);
    if (fs.existsSync(keyPath)) {
      PRIVATE_KEY = fs.readFileSync(keyPath, 'utf8');
    } else {
      console.error(`Error: Private key file not found at ${keyPath}`);
      process.exit(1);
    }
  } catch (err) {
    console.error('Error reading private key file:', err.message);
    process.exit(1);
  }
}

if (!TEAM_ID || !KEY_ID || !PRIVATE_KEY) {
  console.error('Missing required environment variables:');
  console.error('  APPLE_MUSIC_TEAM_ID:', TEAM_ID ? '✓' : '✗');
  console.error('  APPLE_MUSIC_KEY_ID:', KEY_ID ? '✓' : '✗');
  console.error('  APPLE_MUSIC_PRIVATE_KEY:', PRIVATE_KEY ? '✓' : '✗');
  console.error('\nPlease set these in your .env file or as environment variables.');
  process.exit(1);
}

// Normalize the private key (handle newlines)
PRIVATE_KEY = PRIVATE_KEY.replace(/\\n/g, '\n');

// Generate JWT
const now = Math.floor(Date.now() / 1000);
const payload = {
  iss: TEAM_ID,
  iat: now,
  exp: now + 15777000, // 6 months (max allowed)
};

const header = {
  alg: 'ES256',
  kid: KEY_ID,
};

try {
  const token = jwt.sign(payload, PRIVATE_KEY, {
    algorithm: 'ES256',
    header: header,
  });

  console.log('\n✅ Apple Music Developer Token generated successfully!\n');
  console.log('Token (valid for 6 months):');
  console.log(token);
  console.log('\nAdd this to your .env file as:');
  console.log(`APPLE_MUSIC_DEVELOPER_TOKEN="${token}"\n`);
  
  // Also save to a file for convenience
  const tokenFile = path.join(__dirname, '..', '.apple-music-token.txt');
  fs.writeFileSync(tokenFile, token);
  console.log(`Token also saved to: ${tokenFile}\n`);
} catch (err) {
  console.error('Error generating token:', err.message);
  if (err.message.includes('PEM')) {
    console.error('\nMake sure your private key is in the correct format:');
    console.error('  -----BEGIN PRIVATE KEY-----');
    console.error('  ...');
    console.error('  -----END PRIVATE KEY-----');
  }
  process.exit(1);
}




