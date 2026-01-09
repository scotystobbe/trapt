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
        const { playlistName, playlistDescription, tracks } = req.body;

        if (!playlistName) {
          return res.status(400).json({ error: 'Missing playlistName' });
        }

        if (!tracks || !Array.isArray(tracks) || tracks.length === 0) {
          return res.status(400).json({ error: 'Missing or empty tracks array' });
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

        // Get current user ID
        const userRes = await fetch('https://api.spotify.com/v1/me', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (userRes.status === 401) {
          return res.status(401).json({
            error: 'Spotify authentication expired',
            code: 'SPOTIFY_AUTH_EXPIRED'
          });
        }

        if (!userRes.ok) {
          throw new Error('Failed to get user profile');
        }

        const userData = await userRes.json();

        // Create playlist
        const createRes = await fetch(`https://api.spotify.com/v1/users/${userData.id}/playlists`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: playlistName,
            description: playlistDescription || 'Converted from Apple Music',
            public: true, // User requested public playlists
          }),
        });

        if (!createRes.ok) {
          const errorData = await createRes.json().catch(() => ({}));
          throw new Error(errorData.error?.message || 'Failed to create playlist');
        }

        const playlistData = await createRes.json();

        // Sort tracks by position to maintain order
        const sortedTracks = [...tracks].sort((a, b) => (a.position || 0) - (b.position || 0));
        const trackUris = sortedTracks
          .map(t => t.spotifyUri || t.uri)
          .filter(Boolean);

        // Add tracks in batches of 50 (Spotify API limit)
        const batchSize = 50;
        let tracksAdded = 0;
        let tracksFailed = 0;
        const failedTracks = [];

        for (let i = 0; i < trackUris.length; i += batchSize) {
          const batch = trackUris.slice(i, i + batchSize);
          
          const addTracksRes = await fetch(
            `https://api.spotify.com/v1/playlists/${playlistData.id}/tracks`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ uris: batch }),
            }
          );

          if (addTracksRes.ok) {
            tracksAdded += batch.length;
          } else {
            const errorData = await addTracksRes.json().catch(() => ({}));
            console.error('Error adding tracks batch:', errorData);
            tracksFailed += batch.length;
            failedTracks.push(...batch);
          }
        }

        res.json({
          spotifyPlaylistId: playlistData.id,
          spotifyPlaylistUrl: playlistData.external_urls?.spotify,
          tracksAdded,
          tracksFailed,
          failedTracks: failedTracks.length > 0 ? failedTracks : undefined,
        });
      } catch (err) {
        console.error('Error creating Spotify playlist:', err);
        res.status(500).json({ error: 'Failed to create Spotify playlist', details: err.message });
      }
    });
  });
};




