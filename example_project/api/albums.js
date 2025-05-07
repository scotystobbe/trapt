const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
  console.log('API /api/albums called with method:', req.method);
  if (req.method === 'GET') {
    try {
      const albums = await prisma.album.findMany({
        include: { tracks: { orderBy: { id: 'asc' } } },
        orderBy: { year: 'asc' }
      });
      res.status(200).json(albums);
    } catch (error) {
      console.error('Error fetching albums:', error);
      res.status(500).json({ error: 'Failed to fetch albums' });
    }
  } else {
    res.status(405).json({ message: 'Method not allowed' });
  }
};
