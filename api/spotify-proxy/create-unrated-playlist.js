const { PrismaClient } = require('@prisma/client');
const { authenticateSpotify } = require('../middleware');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Use the authenticateSpotify middleware
  authenticateSpotify(req, res, async () => {
    try {
      const { playlistId } = req.body;
      if (!playlistId) {
        return res.status(400).json({ error: 'Missing playlistId' });
      }

      // Get the playlist from DB
      const playlist = await prisma.playlist.findUnique({
        where: { id: playlistId },
        include: { songs: true }
      });

      if (!playlist) {
        return res.status(404).json({ error: 'Playlist not found' });
      }

      // Get unrated songs
      const unrated = playlist.songs.filter(s => s.rating == null || s.rating === 0);
      const trackUris = unrated
        .map(s => {
          if (s.spotifyLink) {
            const match = s.spotifyLink.match(/track\/([a-zA-Z0-9]+)/);
            if (match) return `spotify:track:${match[1]}`;
          }
          return null;
        })
        .filter(Boolean);

      if (trackUris.length === 0) {
        return res.status(400).json({ error: 'No unrated songs with Spotify links to add.' });
      }

      // If we have an existing unrated playlist, update it
      if (playlist.unratedPlaylistId) {
        try {
          // First, clear the playlist
          const clearRes = await fetch(`https://api.spotify.com/v1/playlists/${playlist.unratedPlaylistId}/tracks`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${req.spotifyToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ uris: [] })
          });

          if (clearRes.status === 401) {
            return res.status(401).json({ 
              error: 'Spotify authentication expired',
              code: 'SPOTIFY_AUTH_EXPIRED'
            });
          }

          if (!clearRes.ok) {
            throw new Error('Failed to clear playlist');
          }

          // Then add the new tracks
          const addRes = await fetch(`https://api.spotify.com/v1/playlists/${playlist.unratedPlaylistId}/tracks`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${req.spotifyToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ uris: trackUris })
          });

          if (!addRes.ok) {
            throw new Error('Failed to add tracks to playlist');
          }

          // Get the playlist details to return the external URL
          const playlistRes = await fetch(`https://api.spotify.com/v1/playlists/${playlist.unratedPlaylistId}`, {
            headers: { 'Authorization': `Bearer ${req.spotifyToken}` }
          });

          if (!playlistRes.ok) {
            throw new Error('Failed to get playlist details');
          }

          const playlistData = await playlistRes.json();

          return res.json({
            message: 'Unrated playlist updated successfully',
            externalUrl: playlistData.external_urls.spotify,
            playlistId: playlist.unratedPlaylistId
          });
        } catch (err) {
          console.error('Error updating unrated playlist:', err);
          // If update fails, fall back to creating a new playlist
        }
      }

      // Create a new playlist
      const createRes = await fetch('https://api.spotify.com/v1/me/playlists', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${req.spotifyToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: `${playlist.name} - Not Rated`,
          public: false
        })
      });

      if (createRes.status === 401) {
        return res.status(401).json({ 
          error: 'Spotify authentication expired',
          code: 'SPOTIFY_AUTH_EXPIRED'
        });
      }

      if (!createRes.ok) {
        throw new Error('Failed to create playlist');
      }

      const newPlaylist = await createRes.json();

      // Add tracks to the new playlist
      const addTracksRes = await fetch(`https://api.spotify.com/v1/playlists/${newPlaylist.id}/tracks`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${req.spotifyToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ uris: trackUris })
      });

      if (!addTracksRes.ok) {
        throw new Error('Failed to add tracks to new playlist');
      }

      // Save the new playlist ID
      await prisma.playlist.update({
        where: { id: playlistId },
        data: { unratedPlaylistId: newPlaylist.id }
      });

      res.json({
        message: 'Unrated playlist created successfully',
        externalUrl: newPlaylist.external_urls.spotify,
        playlistId: newPlaylist.id
      });
    } catch (err) {
      console.error('Error handling unrated playlist:', err);
      res.status(500).json({ error: 'Failed to handle unrated playlist' });
    }
  });
}; 