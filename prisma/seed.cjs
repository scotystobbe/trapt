const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  // Create sample playlists
  const playlist1 = await prisma.playlist.create({
    data: {
      name: 'Chill Vibes',
      spotifyLink: 'https://open.spotify.com/playlist/chillvibes',
    },
  });
  const playlist2 = await prisma.playlist.create({
    data: {
      name: 'Workout Hits',
      spotifyLink: 'https://open.spotify.com/playlist/workouthits',
    },
  });

  // Create sample songs
  await prisma.song.createMany({
    data: [
      {
        title: 'Sunset Lover',
        artist: 'Petit Biscuit',
        album: 'Presence',
        playlistId: playlist1.id,
        rating: 5,
        sortOrder: 1,
        notes: 'Great for relaxing',
        spotifyLink: 'https://open.spotify.com/track/sunsetlover',
      },
      {
        title: 'Lose Yourself',
        artist: 'Eminem',
        album: '8 Mile',
        playlistId: playlist2.id,
        rating: 4,
        sortOrder: 1,
        notes: 'Perfect for motivation',
        spotifyLink: 'https://open.spotify.com/track/loseyourself',
      },
      {
        title: 'Blinding Lights',
        artist: 'The Weeknd',
        album: 'After Hours',
        playlistId: playlist2.id,
        rating: 5,
        sortOrder: 2,
        notes: '',
        spotifyLink: 'https://open.spotify.com/track/blindinglights',
      },
    ],
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 