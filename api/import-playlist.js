const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticateJWT, requireRole } = require('./middleware');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  authenticateJWT(req, res, () => {
    requireRole('ADMIN')(req, res, async () => {
      try {
        const { playlistName, playlistArtworkUrl, playlistSpotifyLink, songs, overwrite } = req.body;
        if (!playlistName || !Array.isArray(songs) || songs.length === 0) {
          return res.status(400).json({ error: 'Missing playlistName or songs' });
        }

        // Create or find the playlist, and update artwork or spotifyLink if needed
        let playlist = await prisma.playlist.findFirst({ where: { name: playlistName } });
        if (!playlist) {
          playlist = await prisma.playlist.create({ data: { name: playlistName, spotifyLink: playlistSpotifyLink, artworkUrl: playlistArtworkUrl } });
        } else {
          // If overwrite, delete all songs in the playlist
          if (overwrite) {
            await prisma.song.deleteMany({ where: { playlistId: playlist.id } });
          }
          // Update artwork or spotifyLink if needed
          const updateData = {};
          if (playlistArtworkUrl && playlist.artworkUrl !== playlistArtworkUrl) {
            updateData.artworkUrl = playlistArtworkUrl;
          }
          if (playlistSpotifyLink && playlist.spotifyLink !== playlistSpotifyLink) {
            updateData.spotifyLink = playlistSpotifyLink;
          }
          if (Object.keys(updateData).length > 0) {
            playlist = await prisma.playlist.update({ where: { id: playlist.id }, data: updateData });
          }
        }

        // Add songs (skip existing if not overwrite)
        const createdSongs = [];
        for (const [i, song] of songs.entries()) {
          let shouldCreate = true;
          if (!overwrite) {
            const exists = await prisma.song.findFirst({
              where: {
                title: song.title,
                artist: song.artist,
                playlistId: playlist.id,
              },
            });
            if (exists) shouldCreate = false;
          }
          if (shouldCreate) {
            const created = await prisma.song.create({
              data: {
                title: song.title,
                artist: song.artist,
                album: song.album,
                spotifyLink: song.spotifyLink,
                artworkUrl: song.artworkUrl,
                playlistId: playlist.id,
                rating: null,
                sortOrder: i,
              },
            });
            createdSongs.push(created);
          }
        }

        res.status(201).json({ playlist, songs: createdSongs });
      } catch (error) {
        console.error('Error importing playlist:', error);
        res.status(500).json({ error: 'Failed to import playlist', details: error.message });
      }
    });
  });
}; 