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
      // Handle saving confirmed matches
      if (req.method === 'PUT') {
        const { matches } = req.body;
        if (!Array.isArray(matches)) {
          return res.status(400).json({ error: 'Missing or invalid matches array' });
        }

        try {
          const updated = [];
          for (const match of matches) {
            const { songId, geniusId, geniusUrl } = match;
            if (!songId || !geniusId || !geniusUrl) {
              continue;
            }
            const song = await prisma.song.update({
              where: { id: parseInt(songId) },
              data: {
                geniusSongId: parseInt(geniusId),
                geniusUrl: geniusUrl,
              },
            });
            updated.push(song);
          }
          return res.status(200).json({ success: true, updated: updated.length });
        } catch (err) {
          console.error('Error saving matches:', err);
          return res.status(500).json({ error: 'Failed to save matches', details: err.message });
        }
      }

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

        // Process each song
        for (const song of songs) {
          // Skip if already has a Genius ID, but still include it in results
          if (song.geniusSongId) {
            results.push({
              songId: song.id,
              title: song.title,
              artist: song.artist,
              status: 'already_matched',
              geniusId: song.geniusSongId,
              geniusUrl: song.geniusUrl,
            });
            continue;
          }

          try {
            // Search Genius
            const query = `${song.artist} ${song.title}`;
            const hits = await searchGeniusSong(query, token);
            
            if (!hits || hits.length === 0) {
              results.push({
                songId: song.id,
                title: song.title,
                artist: song.artist,
                status: 'no_results',
                potentialMatches: [],
              });
              continue;
            }

            // Return top 5 potential matches
            const potentialMatches = hits.slice(0, 5).map(hit => ({
              id: hit.result.id,
              url: hit.result.url,
              title: hit.result.title,
              artist: hit.result.primary_artist.name,
              thumbnail: hit.result.song_art_image_thumbnail_url,
              matchType: (() => {
                const t = hit.result.title.trim().toLowerCase();
                const a = hit.result.primary_artist.name.trim().toLowerCase();
                const songTitle = song.title.trim().toLowerCase();
                const songArtist = song.artist.trim().toLowerCase();
                if (t === songTitle && a === songArtist) return 'exact';
                if (t === songTitle || a === songArtist) return 'partial';
                return 'possible';
              })(),
            }));

            // Check if there's an exact match
            const exactMatch = potentialMatches.find(m => m.matchType === 'exact');
            
            results.push({
              songId: song.id,
              title: song.title,
              artist: song.artist,
              status: exactMatch ? 'exact_match_found' : 'matches_found',
              potentialMatches,
              suggestedMatch: exactMatch || potentialMatches[0],
            });
          } catch (err) {
            console.error(`Error processing song ${song.id}:`, err);
            results.push({
              songId: song.id,
              title: song.title,
              artist: song.artist,
              status: 'error',
              error: err.message,
              potentialMatches: [],
            });
          }

          // Add small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
        }

        return res.status(200).json({
          success: true,
          total: songs.length,
          results,
        });
      } catch (err) {
        console.error('Error matching Genius songs:', err);
        return res.status(500).json({ error: 'Failed to match Genius songs', details: err.message });
      }
    });
  });
};
