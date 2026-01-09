const fetch = require('node-fetch');
const { authenticateJWT, requireRole } = require('../middleware');

// Apple Music API base URL
const APPLE_MUSIC_API_BASE = 'https://api.music.apple.com/v1';
const DEVELOPER_TOKEN = process.env.APPLE_MUSIC_DEVELOPER_TOKEN;

// Extract playlist ID from Apple Music URL or ID
function extractPlaylistId(input) {
  // Handle URLs like: https://music.apple.com/us/playlist/pl.u-xxx or music.apple.com/playlist/pl.u-xxx
  const urlMatch = input.match(/playlist\/(pl\.u-[a-zA-Z0-9]+)/);
  if (urlMatch) return urlMatch[1];
  
  // Handle direct ID: pl.u-xxx
  if (input.startsWith('pl.u-')) return input;
  
  return null;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  authenticateJWT(req, res, () => {
    requireRole('ADMIN')(req, res, async () => {
      try {
        const { playlistId, userToken } = req.body;
        
        if (!playlistId) {
          return res.status(400).json({ error: 'Missing playlistId' });
        }

        if (!userToken) {
          return res.status(400).json({ error: 'Missing userToken. Please authenticate with Apple Music first.' });
        }

        const extractedId = extractPlaylistId(playlistId);
        if (!extractedId) {
          return res.status(400).json({ error: 'Invalid Apple Music playlist ID or URL' });
        }

        // Apple Music API requires both developer token and user token
        if (!DEVELOPER_TOKEN) {
          return res.status(500).json({ 
            error: 'Apple Music developer token not configured. Please set APPLE_MUSIC_DEVELOPER_TOKEN in environment variables.' 
          });
        }

        // Fetch playlist details
        const playlistRes = await fetch(`${APPLE_MUSIC_API_BASE}/me/library/playlists/${extractedId}`, {
          headers: {
            'Authorization': `Bearer ${DEVELOPER_TOKEN}`,
            'Music-User-Token': userToken, // User's personal token for accessing their library
          },
        });

        if (!playlistRes.ok) {
          const errorData = await playlistRes.json().catch(() => ({}));
          if (playlistRes.status === 401) {
            return res.status(401).json({ 
              error: 'Apple Music authentication expired or invalid',
              code: 'APPLE_MUSIC_AUTH_REQUIRED'
            });
          }
          return res.status(playlistRes.status).json({ 
            error: 'Failed to fetch Apple Music playlist',
            details: errorData
          });
        }

        const playlistData = await playlistRes.json();
        
        // Fetch playlist tracks (with pagination)
        let allTracks = [];
        let nextUrl = playlistData.data?.[0]?.relationships?.tracks?.href;
        
        while (nextUrl) {
          const tracksRes = await fetch(nextUrl, {
            headers: {
              'Authorization': `Bearer ${userToken}`,
              'Music-User-Token': userToken,
            },
          });

          if (!tracksRes.ok) break;
          
          const tracksData = await tracksRes.json();
          if (tracksData.data) {
            allTracks = allTracks.concat(tracksData.data);
          }
          nextUrl = tracksData.next;
        }

        // Transform to our format
        const playlist = playlistData.data?.[0];
        const tracks = allTracks.map((track, index) => ({
          position: index + 1,
          title: track.attributes?.name || '',
          artist: track.attributes?.artistName || '',
          album: track.attributes?.albumName || '',
          appleMusicId: track.id,
          duration: track.attributes?.durationInMillis || null,
          artworkUrl: track.attributes?.artwork?.url ? 
            track.attributes.artwork.url.replace('{w}', '300').replace('{h}', '300') : null,
        }));

        res.json({
          playlistName: playlist?.attributes?.name || 'Untitled Playlist',
          playlistDescription: playlist?.attributes?.description?.standard || '',
          tracks,
        });
      } catch (err) {
        console.error('Error fetching Apple Music playlist:', err);
        res.status(500).json({ error: 'Failed to fetch Apple Music playlist', details: err.message });
      }
    });
  });
};

