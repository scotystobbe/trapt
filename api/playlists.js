import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    const playlists = await prisma.playlist.findMany({
      include: { songs: true },
    });
    res.status(200).json(playlists);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
} 