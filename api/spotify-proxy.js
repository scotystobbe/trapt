const fetch = require('node-fetch');
require('dotenv').config();

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

module.exports = async (req, res) => {
  const { pathname, searchParams } = new URL(req.url, `http://${req.headers.host}`);

  // 1. Login: /api/spotify-proxy/login
  if (pathname.endsWith('/login')) {
    const scopes = [
      'user-read-currently-playing',
      'user-read-playback-state',
    ];
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.SPOTIFY_CLIENT_ID,
      scope: scopes.join(' '),
      redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
      state: Math.random().toString(36).substring(2),
    });
    res.writeHead(302, { Location: 'https://accounts.spotify.com/authorize?' + params.toString() });
    res.end();
    return;
  }

  // 2. Callback: /api/spotify-proxy/callback
  if (pathname.endsWith('/callback')) {
    const code = searchParams.get('code');
    if (!code) {
      res.statusCode = 400;
      res.end('Missing code');
      return;
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
        res.end('Failed to get access token');
        return;
      }
      // Store tokens in cookies (for demo; for production, encrypt or use JWT)
      setCookie(res, 'spotify_access_token', tokenData.access_token, { maxAge: tokenData.expires_in });
      setCookie(res, 'spotify_refresh_token', tokenData.refresh_token, { maxAge: 30 * 24 * 60 * 60 });
      setCookie(res, 'spotify_expires_at', Date.now() + tokenData.expires_in * 1000, { maxAge: tokenData.expires_in });
      res.writeHead(302, { Location: '/now-playing' });
      res.end();
    } catch (err) {
      res.statusCode = 500;
      res.end('OAuth error');
    }
    return;
  }

  // 3. Currently Playing: /api/spotify-proxy/currently-playing
  if (pathname.endsWith('/currently-playing')) {
    let access_token = getCookie(req, 'spotify_access_token');
    let refresh_token = getCookie(req, 'spotify_refresh_token');
    let expires_at = parseInt(getCookie(req, 'spotify_expires_at'), 10);

    // Refresh token if expired
    if (expires_at && Date.now() > expires_at && refresh_token) {
      try {
        const refreshRes = await fetch('https://accounts.spotify.com/api/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token,
            client_id: process.env.SPOTIFY_CLIENT_ID,
            client_secret: process.env.SPOTIFY_CLIENT_SECRET,
          }),
        });
        const refreshData = await refreshRes.json();
        if (refreshData.access_token) {
          access_token = refreshData.access_token;
          setCookie(res, 'spotify_access_token', access_token, { maxAge: refreshData.expires_in });
          setCookie(res, 'spotify_expires_at', Date.now() + (refreshData.expires_in || 3600) * 1000, { maxAge: refreshData.expires_in });
        } else {
          res.statusCode = 401;
          res.end(JSON.stringify({ error: 'Failed to refresh token', details: refreshData }));
          return;
        }
      } catch (err) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: 'Token refresh error', details: err.message }));
        return;
      }
    }

    if (!access_token) {
      res.statusCode = 401;
      res.end(JSON.stringify({ error: 'Not authenticated with Spotify' }));
      return;
    }

    try {
      const nowRes = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
        headers: { 'Authorization': `Bearer ${access_token}` },
      });
      if (nowRes.status === 204) {
        res.statusCode = 200;
        res.end(JSON.stringify({ playing: false }));
        return;
      }
      const nowData = await nowRes.json();
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(nowData));
    } catch (err) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: 'Failed to fetch currently playing', details: err.message }));
    }
    return;
  }

  // 4. Playlist proxy (unchanged)
  if (req.method === 'GET' && searchParams.has('playlistId')) {
    try {
      const playlistId = searchParams.get('playlistId');
      // Get Spotify access token (client credentials)
      const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + Buffer.from(process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET).toString('base64'),
        },
        body: 'grant_type=client_credentials',
      });
      const tokenData = await tokenRes.json();
      if (!tokenData.access_token) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: 'Failed to get Spotify access token', details: tokenData }));
        return;
      }
      // Fetch all playlist tracks (handle pagination)
      let allTracks = [];
      let nextUrl = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100&offset=0`;
      while (nextUrl) {
        const tracksRes = await fetch(nextUrl, {
          headers: {
            'Authorization': `Bearer ${tokenData.access_token}`,
          },
        });
        const tracksData = await tracksRes.json();
        if (tracksData.error) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'Failed to fetch playlist tracks', details: tracksData.error }));
          return;
        }
        allTracks = allTracks.concat(tracksData.items);
        nextUrl = tracksData.next;
      }
      // Fetch playlist metadata (name, etc.)
      const playlistRes = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}`, {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
        },
      });
      const playlistData = await playlistRes.json();
      if (playlistData.error) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: 'Failed to fetch playlist', details: playlistData.error }));
        return;
      }
      // Return playlist info and all tracks
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        ...playlistData,
        tracks: { items: allTracks }
      }));
    } catch (err) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: 'Unexpected error', details: err.message }));
    }
    return;
  }

  // Not found
  res.statusCode = 404;
  res.end('Not found');
}; 