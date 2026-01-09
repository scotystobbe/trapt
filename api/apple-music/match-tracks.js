const fetch = require('node-fetch');
const stringSimilarity = require('string-similarity');
const { authenticateJWT, requireRole } = require('../middleware');

function getCookie(req, name) {
  const cookies = req.headers.cookie || '';
  const match = cookies.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : null;
}

async function refreshSpotifyToken(req, res) {
  const refreshToken = getCookie(req, 'spotify_refresh_token');
  if (!refreshToken) {
    return null;
  }

  try {
    const refreshRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: process.env.SPOTIFY_CLIENT_ID,
        client_secret: process.env.SPOTIFY_CLIENT_SECRET,
      }),
    });

    const refreshData = await refreshRes.json();
    if (refreshData.access_token) {
      return refreshData.access_token;
    }
  } catch (err) {
    console.error('Error refreshing Spotify token:', err);
  }
  return null;
}

// Normalize strings for comparison
function normalizeString(str) {
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Calculate match score between Apple Music track and Spotify track
function calculateMatchScore(appleTrack, spotifyTrack) {
  const appleTitle = normalizeString(appleTrack.title);
  const appleArtist = normalizeString(appleTrack.artist);
  const spotifyTitle = normalizeString(spotifyTrack.name);
  const spotifyArtist = normalizeString(spotifyTrack.artists.map(a => a.name).join(', '));

  // Exact match
  if (appleTitle === spotifyTitle && appleArtist === spotifyArtist) {
    return { score: 1.0, type: 'exact' };
  }

  // Calculate similarity scores
  const titleSimilarity = stringSimilarity.compareTwoStrings(appleTitle, spotifyTitle);
  const artistSimilarity = stringSimilarity.compareTwoStrings(appleArtist, spotifyArtist);

  // Weighted average (title is more important)
  const combinedScore = (titleSimilarity * 0.7) + (artistSimilarity * 0.3);

  if (combinedScore >= 0.85) {
    return { score: combinedScore, type: 'fuzzy' };
  }

  return { score: combinedScore, type: 'none' };
}

// Search Spotify for a track
async function searchSpotifyTrack(appleTrack, spotifyToken) {
  const query = `track:"${appleTrack.title}" artist:"${appleTrack.artist}"`;
  const encodedQuery = encodeURIComponent(query);

  try {
    const searchRes = await fetch(
      `https://api.spotify.com/v1/search?q=${encodedQuery}&type=track&limit=5`,
      {
        headers: {
          'Authorization': `Bearer ${spotifyToken}`,
        },
      }
    );

    if (!searchRes.ok) {
      if (searchRes.status === 401) {
        throw new Error('SPOTIFY_AUTH_REQUIRED');
      }
      throw new Error('Spotify search failed');
    }

    const searchData = await searchRes.json();
    return searchData.tracks?.items || [];
  } catch (err) {
    if (err.message === 'SPOTIFY_AUTH_REQUIRED') {
      throw err;
    }
    console.error('Error searching Spotify:', err);
    return [];
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  authenticateJWT(req, res, () => {
    requireRole('ADMIN')(req, res, async () => {
      try {
        const { tracks } = req.body;

        if (!tracks || !Array.isArray(tracks)) {
          return res.status(400).json({ error: 'Missing or invalid tracks array' });
        }

        // Get Spotify access token from cookies
        let spotifyToken = getCookie(req, 'spotify_access_token');
        const expiresAt = parseInt(getCookie(req, 'spotify_expires_at'), 10);

        // Refresh token if expired
        if (expiresAt && Date.now() > expiresAt) {
          spotifyToken = await refreshSpotifyToken(req, res);
          if (!spotifyToken) {
            return res.status(401).json({
              error: 'Spotify authentication expired',
              code: 'SPOTIFY_AUTH_EXPIRED'
            });
          }
        }

        if (!spotifyToken) {
          return res.status(401).json({
            error: 'Not authenticated with Spotify',
            code: 'SPOTIFY_AUTH_REQUIRED'
          });
        }

        const matches = [];
        const unmatched = [];

        // Process tracks in batches to avoid rate limits
        const batchSize = 20;
        for (let i = 0; i < tracks.length; i += batchSize) {
          const batch = tracks.slice(i, i + batchSize);
          
          for (const appleTrack of batch) {
            try {
              const spotifyResults = await searchSpotifyTrack(appleTrack, spotifyToken);
              
              if (spotifyResults.length === 0) {
                unmatched.push({
                  appleTrack,
                  suggestions: [],
                  position: appleTrack.position,
                });
                continue;
              }

              // Calculate match scores for all results
              const scoredResults = spotifyResults.map(spotifyTrack => {
                const match = calculateMatchScore(appleTrack, spotifyTrack);
                return {
                  ...spotifyTrack,
                  matchScore: match.score,
                  matchType: match.type,
                };
              });

              // Sort by match score
              scoredResults.sort((a, b) => b.matchScore - a.matchScore);
              const bestMatch = scoredResults[0];

              // If we have a high-confidence match (exact or fuzzy >= 0.85), auto-match
              if (bestMatch.matchType === 'exact' || 
                  (bestMatch.matchType === 'fuzzy' && bestMatch.matchScore >= 0.85)) {
                matches.push({
                  appleTrack,
                  spotifyTrack: {
                    id: bestMatch.id,
                    uri: bestMatch.uri,
                    name: bestMatch.name,
                    artists: bestMatch.artists,
                    album: bestMatch.album,
                    duration_ms: bestMatch.duration_ms,
                    external_urls: bestMatch.external_urls,
                    images: bestMatch.album?.images || [],
                  },
                  matchType: bestMatch.matchType,
                  confidence: bestMatch.matchScore,
                  position: appleTrack.position,
                });
              } else {
                // Low confidence or no good match - send to manual review
                unmatched.push({
                  appleTrack,
                  suggestions: scoredResults.slice(0, 5).map(track => ({
                    id: track.id,
                    uri: track.uri,
                    name: track.name,
                    artists: track.artists,
                    album: track.album,
                    duration_ms: track.duration_ms,
                    external_urls: track.external_urls,
                    images: track.album?.images || [],
                    matchScore: track.matchScore,
                  })),
                  position: appleTrack.position,
                });
              }

              // Small delay to avoid rate limits
              await new Promise(resolve => setTimeout(resolve, 100));
            } catch (err) {
              if (err.message === 'SPOTIFY_AUTH_REQUIRED') {
                return res.status(401).json({
                  error: 'Spotify authentication required',
                  code: 'SPOTIFY_AUTH_REQUIRED'
                });
              }
              
              // If search fails, add to unmatched
              unmatched.push({
                appleTrack,
                suggestions: [],
                position: appleTrack.position,
                error: err.message,
              });
            }
          }

          // Progress update (optional - can be used for frontend progress bar)
          if (i + batchSize < tracks.length) {
            // Add delay between batches
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }

        res.json({
          matches,
          unmatched,
          summary: {
            total: tracks.length,
            matched: matches.length,
            unmatched: unmatched.length,
            exactMatches: matches.filter(m => m.matchType === 'exact').length,
            fuzzyMatches: matches.filter(m => m.matchType === 'fuzzy').length,
          },
        });
      } catch (err) {
        console.error('Error matching tracks:', err);
        res.status(500).json({ error: 'Failed to match tracks', details: err.message });
      }
    });
  });
};

