const fetch = require('node-fetch');
require('dotenv').config();

module.exports = async (req, res) => {
  const { playlistId } = req.query;
  if (!playlistId) {
    return res.status(400).json({ error: 'Missing playlistId' });
  }

  try {
    // Get Spotify access token
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET).toString('base64'),
      },
      body: 'grant_type=client_credentials',
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return res.status(500).json({ error: 'Failed to get Spotify access token', details: tokenData });
    }

    // Fetch all playlist tracks (handle pagination)
    let allTracks = [];
    let nextUrl = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100&offset=0`;
    while (nextUrl) {
      const tracksRes = await fetch(nextUrl, {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
        },
      });
      const tracksData = await tracksRes.json();
      if (tracksData.error) {
        return res.status(500).json({ error: 'Failed to fetch playlist tracks', details: tracksData.error });
      }
      allTracks = allTracks.concat(tracksData.items);
      nextUrl = tracksData.next;
    }

    // Fetch playlist metadata (name, etc.)
    const playlistRes = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}`, {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });
    const playlistData = await playlistRes.json();
    if (playlistData.error) {
      return res.status(500).json({ error: 'Failed to fetch playlist', details: playlistData.error });
    }

    // Return playlist info and all tracks
    res.status(200).json({
      ...playlistData,
      tracks: { items: allTracks }
    });
  } catch (err) {
    res.status(500).json({ error: 'Unexpected error', details: err.message });
  }
}; 