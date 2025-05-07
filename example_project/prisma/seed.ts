const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  // Read albums.json
  const dataPath = path.join(__dirname, '../src/data/albums.json');
  const raw = fs.readFileSync(dataPath, 'utf-8');
  const { albums } = JSON.parse(raw);

  for (const album of albums) {
    // Create Album
    await prisma.album.create({
      data: {
        id: album.id,
        title: album.title,
        sortTitle: album.sortTitle ?? null,
        year: album.year,
        cover: album.cover,
        tracks: {
          create: album.tracks.map((track) => ({
            title: track.title,
            type: track.type,
            originalSong: track.originalSong ?? null,
            originalArtist: track.originalArtist ?? null,
            featuredSongs: track.featuredSongs ?? [],
            searchAliases: track.searchAliases ?? [],
            details: track.details ?? null,
          })),
        },
      },
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });