import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    // Example seed data
    const playlist = await prisma.playlist.create({
      data: {
        name: 'My Playlist',
        spotifyLink: 'https://open.spotify.com/playlist/example',
        songs: {
          create: [
            {
              title: 'Song 1',
              artist: 'Artist 1',
              album: 'Album 1',
              rating: 4,
              sortOrder: 1,
              notes: 'Great song!',
              spotifyLink: 'https://open.spotify.com/track/example1',
            },
            {
              title: 'Song 2',
              artist: 'Artist 2',
              album: 'Album 2',
              rating: 5,
              sortOrder: 2,
              notes: 'Another great song!',
              spotifyLink: 'https://open.spotify.com/track/example2',
            },
          ],
        },
      },
      include: { songs: true },
    });
    res.status(200).json({ playlist });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
} 