const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const { playlistName, songs } = req.body;
    if (!playlistName || !Array.isArray(songs) || songs.length === 0) {
      return res.status(400).json({ error: 'Missing playlistName or songs' });
    }

    // Create or find the playlist
    let playlist = await prisma.playlist.findFirst({ where: { name: playlistName } });
    if (!playlist) {
      playlist = await prisma.playlist.create({ data: { name: playlistName } });
    }

    // Add songs
    const createdSongs = [];
    for (const [i, song] of songs.entries()) {
      const created = await prisma.song.create({
        data: {
          title: song.title,
          artist: song.artist,
          album: song.album,
          spotifyLink: song.spotifyLink,
          playlistId: playlist.id,
          rating: null,
          sortOrder: i,
          artworkUrl: song.artworkUrl,
        },
      });
      createdSongs.push(created);
    }

    res.status(201).json({ playlist, songs: createdSongs });
  } catch (error) {
    console.error('Error importing playlist:', error);
    res.status(500).json({ error: 'Failed to import playlist', details: error.message });
  }
}; 