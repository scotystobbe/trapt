// Genius Proxy API Route
// Handles: /api/genius?action=auth|callback|search|lyrics|annotation

import fetch from 'node-fetch';

const CLIENT_ID = process.env.GENIUS_CLIENT_ID;
const CLIENT_SECRET = process.env.GENIUS_CLIENT_SECRET;
const REDIRECT_URI = process.env.GENIUS_REDIRECT_URI;
const GENIUS_BASE_URL = 'https://api.genius.com';
const GENIUS_AUTH_URL = 'https://genius.com/oauth/authorize';
const GENIUS_TOKEN_URL = 'https://api.genius.com/oauth/token';

export default async function handler(req, res) {
  // Prevent caching for all responses
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const { action } = req.query;

  // Route: /api/genius?action=auth
  if (action === 'auth') {
    const authUrl = `${GENIUS_AUTH_URL}?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=me`;
    return res.redirect(authUrl);
  }

  // Route: /api/genius?action=callback
  if (action === 'callback') {
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: 'Missing code' });
    // Exchange code for access token
    try {
      const tokenRes = await fetch(GENIUS_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          redirect_uri: REDIRECT_URI,
          grant_type: 'authorization_code',
        }),
      });
      const tokenData = await tokenRes.json();
      if (tokenData.access_token) {
        // Set token in cookie (or session)
        res.setHeader('Set-Cookie', `genius_token=${tokenData.access_token}; Path=/; HttpOnly; SameSite=Lax`);
        // Serve a small HTML page for graceful handling
        return res.send(`
          <html>
            <body>
              <script>
                // Try to notify opener and close if in a popup
                if (window.opener) {
                  window.opener.postMessage({ type: 'genius-auth-success' }, window.location.origin);
                  window.close();
                } else {
                  // Not a popup: redirect after a short delay
                  setTimeout(() => {
                    window.location = '/';
                  }, 1000);
                }
              </script>
              <p>Authentication successful. You can close this window or <a href="/">return to the app</a>.</p>
            </body>
          </html>
        `);
      } else {
        return res.status(400).json({ error: 'Failed to get access token', details: tokenData });
      }
    } catch (err) {
      return res.status(500).json({ error: 'Token exchange failed', details: err.message });
    }
  }

  // Helper: Get access token from cookie
  function getTokenFromCookie(req) {
    const cookie = req.headers.cookie || '';
    const match = cookie.match(/genius_token=([^;]+)/);
    return match ? match[1] : null;
  }

  // Route: /api/genius?action=search
  if (action === 'search') {
    const { q } = req.query;
    const token = getTokenFromCookie(req);
    if (!token) return res.status(401).json({ error: 'Not authenticated' });
    if (!q) return res.status(400).json({ error: 'Missing search query' });
    try {
      const searchRes = await fetch(`${GENIUS_BASE_URL}/search?q=${encodeURIComponent(q)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const searchData = await searchRes.json();
      return res.json(searchData.response.hits);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to search Genius', details: err.message });
    }
  }

  // Route: /api/genius?action=lyrics
  if (action === 'lyrics') {
    const { song_id } = req.query;
    const token = getTokenFromCookie(req);
    if (!token) return res.status(401).json({ error: 'Not authenticated' });
    if (!song_id) return res.status(400).json({ error: 'Missing song_id' });
    // Fetch song data from Genius API to get embed_content
    try {
      const songRes = await fetch(`${GENIUS_BASE_URL}/songs/${song_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const songData = await songRes.json();
      if (songData.response && songData.response.song && songData.response.song.embed_content) {
        return res.json({ embed_content: songData.response.song.embed_content });
      } else {
        return res.status(404).json({ error: 'Song or embed_content not found' });
      }
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch song', details: err.message });
    }
  }

  // Route: /api/genius?action=annotation
  if (action === 'annotation') {
    const { annotation_id } = req.query;
    const token = getTokenFromCookie(req);
    if (!token) return res.status(401).json({ error: 'Not authenticated' });
    if (!annotation_id) return res.status(400).json({ error: 'Missing annotation_id' });
    // Fetch annotation from Genius API
    try {
      const annotationRes = await fetch(`${GENIUS_BASE_URL}/annotations/${annotation_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const annotationData = await annotationRes.json();
      return res.json(annotationData);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch annotation', details: err.message });
    }
  }

  // Default: Not found
  return res.status(404).json({ error: 'Not found' });
} 