import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    const songs = await prisma.song.findMany({
      include: { playlist: true },
    });
    res.status(200).json(songs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
} 