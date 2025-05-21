const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    try {
      const playlistId = req.query.playlistId ? Number(req.query.playlistId) : undefined;
      const songs = await prisma.song.findMany({
        where: playlistId ? { playlistId } : undefined,
        include: { playlist: true },
        orderBy: { sortOrder: 'asc' },
      });
      res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
      res.status(200).json(songs);
    } catch (error) {
      console.error('Error fetching songs:', error);
      res.status(500).json({ error: 'Failed to fetch songs' });
    }
  } else if (req.method === 'POST') {
    try {
      const { title, artist, album, playlistId, rating, sortOrder, notes, spotifyLink } = req.body;
      const song = await prisma.song.create({
        data: { title, artist, album, playlistId, rating, sortOrder, notes, spotifyLink },
      });
      res.status(201).json(song);
    } catch (error) {
      console.error('Error creating song:', error);
      res.status(500).json({ error: 'Failed to create song' });
    }
  } else if (req.method === 'PUT') {
    try {
      const { id, ...data } = req.body;
      const song = await prisma.song.update({
        where: { id },
        data,
      });
      res.status(200).json(song);
    } catch (error) {
      console.error('Error updating song:', error);
      res.status(500).json({ error: 'Failed to update song' });
    }
  } else if (req.method === 'DELETE') {
    try {
      const { id } = req.body;
      await prisma.song.delete({ where: { id } });
      res.status(204).end();
    } catch (error) {
      console.error('Error deleting song:', error);
      res.status(500).json({ error: 'Failed to delete song' });
    }
  } else {
    res.status(405).json({ message: 'Method not allowed' });
  }
}; 