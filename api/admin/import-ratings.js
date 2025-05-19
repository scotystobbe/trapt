const { promises: fs } = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const stringSimilarity = require('string-similarity');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    const { year } = req.query;
    if (!year) {
      return res.status(400).json({ error: 'Missing or invalid year parameter' });
    }

    const csvPath = path.join(process.cwd(), 'src', 'data', 'import', `Rob ${year}.csv`);
    let csvContent;
    try {
      csvContent = await fs.readFile(csvPath, 'utf-8');
    } catch (err) {
      return res.status(404).json({ error: `CSV file for year ${year} not found.` });
    }

    let records;
    try {
      records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to parse CSV.' });
    }

    // Fetch all songs from the database
    const allSongs = await prisma.song.findMany();

    // For each record, fuzzy match to songs in the DB
    const results = records.map((row) => {
      const importedTitle = row['Song']?.trim() || '';
      const importedArtist = row['Artist']?.trim() || '';
      const importedNotes = row['Notes']?.trim() || '';
      const importedRating = row['Rating']?.trim() || '';

      // Build a string for matching: title + artist
      const importedKey = `${importedTitle} - ${importedArtist}`;
      const dbKeys = allSongs.map((song) => `${song.title} - ${song.artist}`);
      const matches = stringSimilarity.findBestMatch(importedKey, dbKeys);

      // Get top 3 matches
      const topMatches = matches.ratings
        .map((rating, idx) => ({
          score: rating.rating,
          song: allSongs[idx],
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

      return {
        imported: {
          title: importedTitle,
          artist: importedArtist,
          notes: importedNotes,
          rating: importedRating,
        },
        matches: topMatches,
      };
    });

    return res.status(200).json({ results });
  }

  if (req.method === 'POST') {
    const { updates } = req.body;
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided.' });
    }
    const updated = [];
    for (const update of updates) {
      const { songId, notes, rating } = update;
      if (!songId) continue;
      try {
        const song = await prisma.song.update({
          where: { id: songId },
          data: {
            notes: notes || undefined,
            rating: isNaN(Number(rating)) ? undefined : Number(rating),
          },
        });
        updated.push(song);
      } catch (err) {
        // Optionally log or collect errors
      }
    }
    return res.status(200).json({ updatedCount: updated.length, updated });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}; 