const fetch = require('node-fetch');
require('dotenv').config();
const url = require('url');

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
  const scopes = ['user-read-currently-playing', 'user-read-playback-state'];
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

  // 🎯 3. Default fallback
  res.statusCode = 200;
  res.end('Spotify proxy root works!');
};
