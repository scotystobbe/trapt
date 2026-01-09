const fetch = require('node-fetch');
const { authenticateJWT, requireRole } = require('../middleware');

function getCookie(req, name) {
  const cookies = req.headers.cookie || '';
  const match = cookies.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : null;
}

async function refreshSpotifyToken(req, res) {
  const refreshToken = getCookie(req, 'spotify_refresh_token');
  if (!refreshToken) {
    return null;
  }

  try {
    const refreshRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: process.env.SPOTIFY_CLIENT_ID,
        client_secret: process.env.SPOTIFY_CLIENT_SECRET,
      }),
    });

    const refreshData = await refreshRes.json();
    if (refreshData.access_token) {
      return refreshData.access_token;
    }
  } catch (err) {
    console.error('Error refreshing Spotify token:', err);
  }
  return null;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  authenticateJWT(req, res, () => {
    requireRole('ADMIN')(req, res, async () => {
      try {
        const { query } = req.body;

        if (!query || typeof query !== 'string') {
          return res.status(400).json({ error: 'Missing or invalid query' });
        }

        // Get Spotify access token
        let accessToken = getCookie(req, 'spotify_access_token');
        const expiresAt = parseInt(getCookie(req, 'spotify_expires_at'), 10);

        // Refresh token if expired
        if (expiresAt && Date.now() > expiresAt) {
          accessToken = await refreshSpotifyToken(req, res);
          if (!accessToken) {
            return res.status(401).json({
              error: 'Spotify authentication expired',
              code: 'SPOTIFY_AUTH_EXPIRED'
            });
          }
        }

        if (!accessToken) {
          return res.status(401).json({
            error: 'Not authenticated with Spotify',
            code: 'SPOTIFY_AUTH_REQUIRED'
          });
        }

        // Search Spotify
        const encodedQuery = encodeURIComponent(query);
        const searchRes = await fetch(
          `https://api.spotify.com/v1/search?q=${encodedQuery}&type=track&limit=10`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          }
        );

        if (searchRes.status === 401) {
          return res.status(401).json({
            error: 'Spotify authentication expired',
            code: 'SPOTIFY_AUTH_EXPIRED'
          });
        }

        if (!searchRes.ok) {
          const errorData = await searchRes.json().catch(() => ({}));
          throw new Error(errorData.error?.message || 'Spotify search failed');
        }

        const searchData = await searchRes.json();
        const tracks = (searchData.tracks?.items || []).map(track => ({
          id: track.id,
          uri: track.uri,
          name: track.name,
          artists: track.artists,
          album: track.album,
          duration_ms: track.duration_ms,
          external_urls: track.external_urls,
          images: track.album?.images || [],
        }));

        res.json({ tracks });
      } catch (err) {
        console.error('Error searching Spotify:', err);
        res.status(500).json({ error: 'Failed to search Spotify', details: err.message });
      }
    });
  });
};




