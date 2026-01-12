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

// Helper: Resolve a Genius URL to a song ID
async function resolveGeniusUrl(url, token) {
  // Check if it's a direct song URL with ID
  const songIdMatch = url.match(/genius\.com\/songs\/(\d+)/);
  if (songIdMatch) {
    return parseInt(songIdMatch[1]);
  }
  
  // Check if it's a lyrics page URL (genius.com/artist-song-lyrics)
  const lyricsMatch = url.match(/genius\.com\/([^\/]+)-lyrics/);
  if (lyricsMatch) {
    // Extract artist and song from the URL path
    // Format: artist-song-title-lyrics
    const path = lyricsMatch[1];
    // Try to split on common patterns - usually it's artist-song-title
    // For "Tenacious-d-baby-one-more-time", we need to identify where artist ends and song begins
    // This is tricky, so let's search Genius API for the full path
    const searchQuery = path.replace(/-/g, ' ');
    const hits = await searchGeniusSong(searchQuery, token);
    
    if (hits && hits.length > 0) {
      // Return the first result's ID - user can verify it's correct
      return hits[0].result.id;
    }
  }
  
  // Try to extract artist/song from any genius.com URL
  const urlMatch = url.match(/genius\.com\/([^\/\?]+)/);
  if (urlMatch) {
    const path = urlMatch[1];
    const searchQuery = path.replace(/-/g, ' ');
    const hits = await searchGeniusSong(searchQuery, token);
    
    if (hits && hits.length > 0) {
      return hits[0].result.id;
    }
  }
  
  return null;
}

module.exports = async (req, res) => {
  authenticateJWT(req, res, () => {
    requireRole('ADMIN')(req, res, async () => {
      // Handle saving confirmed matches
      if (req.method === 'PUT') {
        const { matches, resolveUrls } = req.body;
        
        // Handle URL resolution request
        if (resolveUrls && Array.isArray(resolveUrls)) {
          const token = getTokenFromCookie(req);
          if (!token) {
            return res.status(401).json({ error: 'Not authenticated with Genius' });
          }
          
          const resolved = [];
          for (const url of resolveUrls) {
            const songId = await resolveGeniusUrl(url, token);
            resolved.push({ url, songId });
          }
          return res.status(200).json({ resolved });
        }
        
        // Handle saving matches
        if (!Array.isArray(matches)) {
          return res.status(400).json({ error: 'Missing or invalid matches array' });
        }

        try {
          const updated = [];
          for (const match of matches) {
            const { songId, geniusId, geniusUrl } = match;
            if (!songId || !geniusUrl) {
              continue;
            }
            
            // If geniusId is not provided, try to resolve it from the URL
            let finalGeniusId = geniusId;
            if (!finalGeniusId) {
              const token = getTokenFromCookie(req);
              if (token) {
                finalGeniusId = await resolveGeniusUrl(geniusUrl, token);
              }
            }
            
            if (!finalGeniusId) {
              return res.status(400).json({ error: `Could not resolve song ID from URL: ${geniusUrl}` });
            }
            
            const song = await prisma.song.update({
              where: { id: parseInt(songId) },
              data: {
                geniusSongId: parseInt(finalGeniusId),
                geniusUrl: geniusUrl,
              },
            });
            updated.push(song);
          }
          return res.status(200).json({ success: true, updated: updated.length, updatedSongs: updated });
        } catch (err) {
          console.error('Error saving matches:', err);
          return res.status(500).json({ error: 'Failed to save matches', details: err.message });
        }
      }

      // Handle marking songs as no match available
      if (req.method === 'POST' && req.body.action === 'mark-no-match') {
        const { songIds } = req.body;
        if (!Array.isArray(songIds) || songIds.length === 0) {
          return res.status(400).json({ error: 'Missing or invalid songIds array' });
        }

        try {
          const updated = [];
          for (const songId of songIds) {
            const song = await prisma.song.update({
              where: { id: parseInt(songId) },
              data: {
                geniusNoMatch: true,
              },
            });
            updated.push(song);
          }
          return res.status(200).json({ success: true, updated: updated.length });
        } catch (err) {
          console.error('Error marking songs as no match:', err);
          return res.status(500).json({ error: 'Failed to mark songs as no match', details: err.message });
        }
      }

      // Handle clearing/removing a match
      if (req.method === 'POST' && req.body.action === 'clear-match') {
        const { songIds } = req.body;
        if (!Array.isArray(songIds) || songIds.length === 0) {
          return res.status(400).json({ error: 'Missing or invalid songIds array' });
        }

        try {
          const updated = [];
          for (const songId of songIds) {
            const song = await prisma.song.update({
              where: { id: parseInt(songId) },
              data: {
                geniusSongId: null,
                geniusUrl: null,
                geniusNoMatch: false, // Also clear the no-match flag so it can be searched again
              },
            });
            updated.push(song);
          }
          return res.status(200).json({ success: true, updated: updated.length, updatedSongs: updated });
        } catch (err) {
          console.error('Error clearing matches:', err);
          return res.status(500).json({ error: 'Failed to clear matches', details: err.message });
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
          // Skip if marked as no match available
          if (song.geniusNoMatch) {
            results.push({
              songId: song.id,
              title: song.title,
              artist: song.artist,
              status: 'no_match_available',
            });
            continue;
          }
          
          // Skip if already has a Genius ID - don't search for it
          if (song.geniusSongId) {
            // Fetch Genius song details to show thumbnail and info
            try {
              const songRes = await fetch(`${GENIUS_BASE_URL}/songs/${song.geniusSongId}`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              if (songRes.ok) {
                const songData = await songRes.json();
                const geniusSong = songData.response?.song;
                if (geniusSong) {
                  results.push({
                    songId: song.id,
                    title: song.title,
                    artist: song.artist,
                    status: 'already_matched',
                    geniusId: song.geniusSongId,
                    geniusUrl: song.geniusUrl || geniusSong.url,
                    geniusTitle: geniusSong.title,
                    geniusArtist: geniusSong.primary_artist?.name,
                    thumbnail: geniusSong.song_art_image_thumbnail_url,
                  });
                  continue;
                }
              }
            } catch (err) {
              console.error(`Error fetching Genius song ${song.geniusSongId}:`, err);
            }
            // Fallback if we can't fetch details
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
