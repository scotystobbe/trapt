const fetch = require('node-fetch');
require('dotenv').config();
const url = require('url');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function setCookie(res, name, value, options = {}) {
  let cookie = `${name}=${value}; Path=/; HttpOnly; SameSite=Lax`;
  if (options.maxAge) cookie += `; Max-Age=${options.maxAge}`;
  if (options.secure) cookie += '; Secure';
  res.setHeader('Set-Cookie', [...(res.getHeader('Set-Cookie') || []), cookie]);
}

function getCookie(req, name) {
  const cookies = req.headers.cookie || '';
  const match = cookies.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : null;
}

async function handlePlaylistFetch(req, res, playlistId) {
  try {
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64'),
      },
      body: 'grant_type=client_credentials',
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      res.statusCode = 500;
      return res.end(JSON.stringify({ error: 'Failed to get Spotify access token', details: tokenData }));
    }

    const accessToken = tokenData.access_token;

    // Fetch playlist tracks (with pagination)
    let allTracks = [];
    let nextUrl = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100&offset=0`;
    while (nextUrl) {
      const tracksRes = await fetch(nextUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const tracksData = await tracksRes.json();
      if (tracksData.error) {
        res.statusCode = 500;
        return res.end(JSON.stringify({ error: 'Failed to fetch playlist tracks', details: tracksData.error }));
      }
      allTracks = allTracks.concat(tracksData.items);
      nextUrl = tracksData.next;
    }

    // Fetch playlist metadata
    const playlistRes = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const playlistData = await playlistRes.json();
    if (playlistData.error) {
      res.statusCode = 500;
      return res.end(JSON.stringify({ error: 'Failed to fetch playlist', details: playlistData.error }));
    }

    // Return combined response
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ ...playlistData, tracks: { items: allTracks } }));
  } catch (err) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: 'Unexpected error', details: err.message }));
  }
}

async function handleLogin(res) {
  const scopes = [
    'user-read-currently-playing',
    'user-read-playback-state',
    'playlist-modify-private',
    'playlist-modify-public'
  ];
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.SPOTIFY_CLIENT_ID,
    scope: scopes.join(' '),
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
    state: Math.random().toString(36).substring(2),
  });

  res.writeHead(302, { Location: `https://accounts.spotify.com/authorize?${params.toString()}` });
  res.end();
}

async function handleCallback(req, res, query) {
  const code = query.code;
  if (!code) {
    res.statusCode = 400;
    return res.end('Missing code');
  }

  try {
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
        client_id: process.env.SPOTIFY_CLIENT_ID,
        client_secret: process.env.SPOTIFY_CLIENT_SECRET,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      res.statusCode = 500;
      return res.end('Failed to get access token');
    }

    setCookie(res, 'spotify_access_token', tokenData.access_token, { maxAge: tokenData.expires_in });
    setCookie(res, 'spotify_refresh_token', tokenData.refresh_token, { maxAge: 30 * 24 * 60 * 60 });
    setCookie(res, 'spotify_expires_at', Date.now() + tokenData.expires_in * 1000, { maxAge: tokenData.expires_in });

    res.writeHead(302, { Location: '/now-playing' });
    res.end();
  } catch (err) {
    res.statusCode = 500;
    res.end('OAuth error');
  }
}

async function handleCurrentlyPlaying(req, res) {
  let accessToken = getCookie(req, 'spotify_access_token');
  const refreshToken = getCookie(req, 'spotify_refresh_token');
  const expiresAt = parseInt(getCookie(req, 'spotify_expires_at'), 10);

  // Refresh access token if expired
  if (expiresAt && Date.now() > expiresAt && refreshToken) {
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
        accessToken = refreshData.access_token;
        setCookie(res, 'spotify_access_token', accessToken, { maxAge: refreshData.expires_in });
        setCookie(res, 'spotify_expires_at', Date.now() + (refreshData.expires_in || 3600) * 1000, { maxAge: refreshData.expires_in });
      } else {
        res.statusCode = 401;
        return res.end(JSON.stringify({ error: 'Failed to refresh token', details: refreshData }));
      }
    } catch (err) {
      res.statusCode = 500;
      return res.end(JSON.stringify({ error: 'Token refresh error', details: err.message }));
    }
  }

  if (!accessToken) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ error: 'Not authenticated with Spotify' }));
  }

  try {
    const nowRes = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (nowRes.status === 204) {
      res.statusCode = 200;
      return res.end(JSON.stringify({ playing: false }));
    }

    const nowData = await nowRes.json();
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify(nowData));
  } catch (err) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'Failed to fetch currently playing', details: err.message }));
  }
}

module.exports = async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const { playlistId, proxyPath } = parsedUrl.query || {};

  // 🎯 1. Handle playlistId query directly
  if (req.method === 'GET' && playlistId) {
    return handlePlaylistFetch(req, res, playlistId);
  }

  const segments = (proxyPath || '').split('/').filter(Boolean);
  const subroute = segments[0];

  // 🎯 2. Route based on proxyPath
  if (subroute === 'login') {
    return handleLogin(res);
  }

  if (subroute === 'callback') {
    return handleCallback(req, res, parsedUrl.query);
  }

  if (subroute === 'currently-playing') {
    return handleCurrentlyPlaying(req, res);
  }

  if (subroute === 'create-unrated-playlist' && req.method === 'POST') {
    let accessToken = getCookie(req, 'spotify_access_token');
    const refreshToken = getCookie(req, 'spotify_refresh_token');
    const expiresAt = parseInt(getCookie(req, 'spotify_expires_at'), 10);

    // Refresh access token if expired
    if (expiresAt && Date.now() > expiresAt && refreshToken) {
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
          accessToken = refreshData.access_token;
          setCookie(res, 'spotify_access_token', accessToken, { maxAge: refreshData.expires_in });
          setCookie(res, 'spotify_expires_at', Date.now() + (refreshData.expires_in || 3600) * 1000, { maxAge: refreshData.expires_in });
        } else {
          res.statusCode = 401;
          return res.end(JSON.stringify({ error: 'Failed to refresh token', details: refreshData }));
        }
      } catch (err) {
        res.statusCode = 500;
        return res.end(JSON.stringify({ error: 'Token refresh error', details: err.message }));
      }
    }
    if (!accessToken) {
      res.statusCode = 401;
      return res.end(JSON.stringify({ error: 'Not authenticated with Spotify' }));
    }
    try {
      let body = '';
      await new Promise((resolve, reject) => {
        req.on('data', chunk => { body += chunk; });
        req.on('end', resolve);
        req.on('error', reject);
      });
      const { name, trackUris } = JSON.parse(body);
      // 1. Get current user ID
      const userRes = await fetch('https://api.spotify.com/v1/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const userData = await userRes.json();
      if (!userData.id) throw new Error('Failed to get user profile');
      // 2. Create playlist
      const description = `Playlist of songs from ${name.replace(/ - Not Rated$/, '')} that have not yet been given a star rating`;
      const createRes = await fetch(`https://api.spotify.com/v1/users/${userData.id}/playlists`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, public: false, description }),
      });
      const playlistData = await createRes.json();
      if (!playlistData.id) throw new Error('Failed to create playlist');
      // 3. Add tracks (in batches of 50)
      if (trackUris.length > 0) {
        const batchSize = 50;
        for (let i = 0; i < trackUris.length; i += batchSize) {
          const batch = trackUris.slice(i, i + batchSize);
          console.log(`Adding tracks batch [${i}-${i + batch.length - 1}] to Spotify playlist:`, batch);
          const addTracksRes = await fetch(`https://api.spotify.com/v1/playlists/${playlistData.id}/tracks`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ uris: batch }),
          });
          const addTracksData = await addTracksRes.json();
          if (!addTracksRes.ok) {
            console.error('Error adding tracks batch to Spotify playlist:', addTracksData);
          } else {
            console.log('Add tracks batch response:', addTracksData);
          }
        }
      }
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ playlistId: playlistData.id, externalUrl: playlistData.external_urls?.spotify }));
    } catch (err) {
      res.statusCode = 500;
      return res.end(JSON.stringify({ error: 'Failed to create playlist', details: err.message }));
    }
  }

  if (subroute === 'logout' && req.method === 'POST') {
    // Clear Spotify cookies
    res.setHeader('Set-Cookie', [
      'spotify_access_token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax',
      'spotify_refresh_token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax',
      'spotify_expires_at=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax',
    ]);
    res.statusCode = 200;
    res.end('Logged out');
    return;
  }

  if (segments[0] === 'admin' && segments[1] === 'update-star-playlist' && req.method === 'POST') {
    try {
      let body = '';
      await new Promise((resolve, reject) => {
        req.on('data', chunk => { body += chunk; });
        req.on('end', resolve);
        req.on('error', reject);
      });
      const { playlistId, minRating } = JSON.parse(body);
      if (!playlistId || !minRating) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: 'Missing playlistId or minRating' }));
      }
      // 1. Get the playlist from DB
      const playlist = await prisma.playlist.findUnique({ where: { id: playlistId } });
      if (!playlist || !playlist.spotifyLink) {
        res.statusCode = 404;
        return res.end(JSON.stringify({ error: 'Playlist not found or missing spotifyLink' }));
      }
      // 2. Extract Spotify playlist ID from spotifyLink
      const normalizedLink = playlist.spotifyLink.trim().split('?')[0].replace(/\/$/, '');
      console.log('Normalized Spotify link:', normalizedLink);
      const match = normalizedLink.match(/playlist[/:]([a-zA-Z0-9]+)$/);
      if (!match) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: 'Invalid spotifyLink format' }));
      }
      const spotifyPlaylistId = match[1];
      // 3. Get all songs with rating >= minRating, sorted by playlist year, then sortOrder
      const songs = await prisma.song.findMany({
        where: { rating: { gte: minRating } },
        include: { playlist: true },
      });
      // 3.5. Fetch all playlists to get their years
      const allPlaylists = await prisma.playlist.findMany({ select: { id: true, year: true } });
      const playlistYearMap = {};
      allPlaylists.forEach(p => {
        playlistYearMap[p.id] = typeof p.year === 'number' ? p.year : 9999;
      });
      // 3.6. Sort songs by playlist year, then by sortOrder
      songs.sort((a, b) => {
        const yearA = playlistYearMap[a.playlistId] || 9999;
        const yearB = playlistYearMap[b.playlistId] || 9999;
        if (yearA !== yearB) return yearA - yearB;
        return a.sortOrder - b.sortOrder;
      });
      // 4. Build trackUris
      const trackUris = songs
        .map(s => {
          if (s.spotifyLink) {
            const m = s.spotifyLink.match(/track\/([a-zA-Z0-9]+)/);
            if (m) return `spotify:track:${m[1]}`;
          }
          return null;
        })
        .filter(Boolean);
      // 5. Get user access token
      let accessToken = getCookie(req, 'spotify_access_token');
      const refreshToken = getCookie(req, 'spotify_refresh_token');
      const expiresAt = parseInt(getCookie(req, 'spotify_expires_at'), 10);
      if (expiresAt && Date.now() > expiresAt && refreshToken) {
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
            accessToken = refreshData.access_token;
            setCookie(res, 'spotify_access_token', accessToken, { maxAge: refreshData.expires_in });
            setCookie(res, 'spotify_expires_at', Date.now() + (refreshData.expires_in || 3600) * 1000, { maxAge: refreshData.expires_in });
          } else {
            res.statusCode = 401;
            return res.end(JSON.stringify({ error: 'Failed to refresh token', details: refreshData }));
          }
        } catch (err) {
          res.statusCode = 500;
          return res.end(JSON.stringify({ error: 'Token refresh error', details: err.message }));
        }
      }
      if (!accessToken) {
        res.statusCode = 401;
        return res.end(JSON.stringify({ error: 'Not authenticated with Spotify' }));
      }
      // 6. Remove all current tracks from the Spotify playlist
      // Get all current tracks
      let allTrackUris = [];
      let nextUrl = `https://api.spotify.com/v1/playlists/${spotifyPlaylistId}/tracks?limit=100&offset=0`;
      while (nextUrl) {
        const tracksRes = await fetch(nextUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const tracksData = await tracksRes.json();
        if (tracksData.error) break;
        allTrackUris = allTrackUris.concat(
          (tracksData.items || []).map(item => item.track && item.track.uri).filter(Boolean)
        );
        nextUrl = tracksData.next;
      }
      if (allTrackUris.length > 0) {
        // Remove all tracks in batches of 50
        for (let i = 0; i < allTrackUris.length; i += 50) {
          const batch = allTrackUris.slice(i, i + 50).map(uri => ({ uri }));
          const removeRes = await fetch(`https://api.spotify.com/v1/playlists/${spotifyPlaylistId}/tracks`, {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ tracks: batch }),
          });
          const removeData = await removeRes.json();
          if (!removeRes.ok) {
            console.error('Error removing tracks from Spotify playlist:', removeData);
          }
        }
      }
      // 7. Add new tracks in batches of 50
      for (let i = 0; i < trackUris.length; i += 50) {
        const batch = trackUris.slice(i, i + 50);
        const addTracksRes = await fetch(`https://api.spotify.com/v1/playlists/${spotifyPlaylistId}/tracks`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ uris: batch }),
        });
        const addTracksData = await addTracksRes.json();
        if (!addTracksRes.ok) {
          console.error('Error adding tracks to Spotify playlist:', addTracksData);
        }
      }
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ updated: trackUris.length }));
    } catch (err) {
      res.statusCode = 500;
      return res.end(JSON.stringify({ error: 'Failed to update playlist', details: err.message }));
    }
  }

  // 🎯 3. Default fallback
  res.statusCode = 200;
  res.end('Spotify proxy root works!');
};
