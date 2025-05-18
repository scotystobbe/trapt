const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    try {
      // If ?admin=1, return all playlists (id and name only)
      if (req.query.admin === '1') {
        const playlists = await prisma.playlist.findMany({ select: { id: true, name: true } });
        return res.status(200).json(playlists);
      }
      const playlists = await prisma.playlist.findMany({
        include: { songs: true },
        orderBy: { name: 'asc' },
      });
      res.status(200).json(playlists);
    } catch (error) {
      console.error('Error fetching playlists:', error);
      res.status(500).json({ error: 'Failed to fetch playlists' });
    }
  } else if (req.method === 'POST') {
    try {
      const { name, spotifyLink } = req.body;
      const playlist = await prisma.playlist.create({
        data: { name, spotifyLink },
      });
      res.status(201).json(playlist);
    } catch (error) {
      console.error('Error creating playlist:', error);
      res.status(500).json({ error: 'Failed to create playlist' });
    }
  } else if (req.method === 'PUT') {
    try {
      const { id, ...data } = req.body;
      const playlist = await prisma.playlist.update({
        where: { id },
        data,
      });
      res.status(200).json(playlist);
    } catch (error) {
      console.error('Error updating playlist:', error);
      res.status(500).json({ error: 'Failed to update playlist' });
    }
  } else if (req.method === 'DELETE') {
    try {
      const { id } = req.body;
      // Delete all songs in the playlist first
      await prisma.song.deleteMany({ where: { playlistId: id } });
      // Then delete the playlist
      await prisma.playlist.delete({ where: { id } });
      res.status(204).end();
    } catch (error) {
      console.error('Error deleting playlist:', error);
      res.status(500).json({ error: 'Failed to delete playlist' });
    }
  } else {
    res.status(405).json({ message: 'Method not allowed' });
  }
}; 