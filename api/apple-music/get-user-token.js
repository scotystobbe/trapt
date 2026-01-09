/**
 * Helper endpoint to get Apple Music user token
 * 
 * This endpoint provides instructions and a helper for obtaining user tokens.
 * In production, you'd implement a full OAuth flow, but for now this provides
 * a way to get the token via MusicKit JS in the browser.
 */

const { authenticateJWT, requireRole } = require('../middleware');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  authenticateJWT(req, res, () => {
    requireRole('ADMIN')(req, res, async () => {
      // Return instructions for getting user token
      res.json({
        instructions: `
To get your Apple Music user token:

1. Open your browser's developer console (F12)
2. Go to https://music.apple.com
3. Run this JavaScript code in the console:

   // Load MusicKit JS if not already loaded
   if (!window.MusicKit) {
     const script = document.createElement('script');
     script.src = 'https://js-cdn.music.apple.com/musickit/v1/musickit.js';
     document.head.appendChild(script);
     await new Promise(resolve => script.onload = resolve);
   }

   // Initialize MusicKit
   const music = await window.MusicKit.configure({
     developerToken: 'YOUR_DEVELOPER_TOKEN', // Replace with your dev token
     app: {
       name: 'Trapt',
       build: '1.0.0'
     }
   });

   // Authorize and get user token
   await music.authorize();
   const userToken = music.musicUserToken;
   console.log('Your user token:', userToken);
   copy(userToken); // Copies to clipboard

Alternatively, you can use the MusicKit JS library in your app to handle this automatically.
        `.trim(),
        developerTokenRequired: !!process.env.APPLE_MUSIC_DEVELOPER_TOKEN,
        note: 'For production, implement a proper OAuth flow similar to Spotify authentication.',
      });
    });
  });
};




