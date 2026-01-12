const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticateJWT, requireRole } = require('../middleware');
const fetch = require('node-fetch');

const GENIUS_BASE_URL = 'https://api.genius.com';
const CLIENT_ID = process.env.GENIUS_CLIENT_ID;
const CLIENT_SECRET = process.env.GENIUS_CLIENT_SECRET;
const REDIRECT_URI = process.env.GENIUS_REDIRECT_URI;
const GENIUS_TOKEN_URL = 'https://api.genius.com/oauth/token';

// Helper: Get access token from cookie
function getTokenFromCookie(req) {
  const cookie = req.headers.cookie || '';
  const match = cookie.match(/genius_token=([^;]+)/);
  return match ? match[1] : null;
}

// Helper: Search Genius for a song
async function searchGeniusSong(query, token) {
  try {
    const searchRes = await fetch(`${GENIUS_BASE_URL}/search?q=${encodeURIComponent(query)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!searchRes.ok) {
      return null;
    }
    const searchData = await searchRes.json();
    return searchData.response?.hits || [];
  } catch (err) {
    console.error('Error searching Genius:', err);
    return null;
  }
}

// Helper: Find exact match in search results
function findExactMatch(hits, title, artist) {
  if (!hits || hits.length === 0) return null;
  
  const normalizedTitle = title.trim().toLowerCase();
  const normalizedArtist = artist.trim().toLowerCase();
  
  // Try exact match first
  const exact = hits.find(h => {
    const t = h.result.title.trim().toLowerCase();
    const a = h.result.primary_artist.name.trim().toLowerCase();
    return t === normalizedTitle && a === normalizedArtist;
  });
  
  if (exact) {
    return {
      id: exact.result.id,
      url: exact.result.url,
      title: exact.result.title,
      artist: exact.result.primary_artist.name,
    };
  }
  
  // Try partial match (title matches, artist contains or vice versa)
  const partial = hits.find(h => {
    const t = h.result.title.trim().toLowerCase();
    const a = h.result.primary_artist.name.trim().toLowerCase();
    return (t === normalizedTitle && a.includes(normalizedArtist)) ||
           (t.includes(normalizedTitle) && a === normalizedArtist);
  });
  
  if (partial) {
    return {
      id: partial.result.id,
      url: partial.result.url,
      title: partial.result.title,
      artist: partial.result.primary_artist.name,
      matchType: 'partial',
    };
  }
  
  return null;
}

module.exports = async (req, res) => {
  authenticateJWT(req, res, () => {
    requireRole('ADMIN')(req, res, async () => {
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      const { playlistId } = req.body;
      if (!playlistId) {
        return res.status(400).json({ error: 'Missing playlistId' });
      }

      const token = getTokenFromCookie(req);
      if (!token) {
        return res.status(401).json({ error: 'Not authenticated with Genius. Please connect to Genius first.' });
      }

      try {
        // Get all songs in the playlist
        const songs = await prisma.song.findMany({
          where: { playlistId: parseInt(playlistId) },
          orderBy: { sortOrder: 'asc' },
        });

        if (songs.length === 0) {
          return res.status(404).json({ error: 'No songs found in playlist' });
        }

        const results = [];
        let matched = 0;
        let skipped = 0;
        let errors = 0;

        // Process each song
        for (const song of songs) {
          // Skip if already has a Genius ID
          if (song.geniusSongId) {
            results.push({
              songId: song.id,
              title: song.title,
              artist: song.artist,
              status: 'skipped',
              reason: 'Already has Genius ID',
            });
            skipped++;
            continue;
          }

          try {
            // Search Genius
            const query = `${song.artist} ${song.title}`;
            const hits = await searchGeniusSong(query, token);
            
            if (!hits) {
              results.push({
                songId: song.id,
                title: song.title,
                artist: song.artist,
                status: 'error',
                reason: 'Search failed',
              });
              errors++;
              continue;
            }

            // Find match
            const match = findExactMatch(hits, song.title, song.artist);
            
            if (match) {
              // Update song with Genius ID
              await prisma.song.update({
                where: { id: song.id },
                data: {
                  geniusSongId: match.id,
                  geniusUrl: match.url,
                },
              });
              
              results.push({
                songId: song.id,
                title: song.title,
                artist: song.artist,
                status: 'matched',
                geniusId: match.id,
                geniusTitle: match.title,
                geniusArtist: match.artist,
                matchType: match.matchType || 'exact',
              });
              matched++;
            } else {
              results.push({
                songId: song.id,
                title: song.title,
                artist: song.artist,
                status: 'no_match',
                reason: 'No matching song found',
                topResult: hits[0] ? {
                  title: hits[0].result.title,
                  artist: hits[0].result.primary_artist.name,
                } : null,
              });
            }
          } catch (err) {
            console.error(`Error processing song ${song.id}:`, err);
            results.push({
              songId: song.id,
              title: song.title,
              artist: song.artist,
              status: 'error',
              reason: err.message,
            });
            errors++;
          }

          // Add small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
        }

        return res.status(200).json({
          success: true,
          total: songs.length,
          matched,
          skipped,
          errors,
          noMatch: songs.length - matched - skipped - errors,
          results,
        });
      } catch (err) {
        console.error('Error matching Genius songs:', err);
        return res.status(500).json({ error: 'Failed to match Genius songs', details: err.message });
      }
    });
  });
};
