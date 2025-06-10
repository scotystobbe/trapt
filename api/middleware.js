const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

function getCookie(req, name) {
  const cookies = req.headers.cookie || '';
  const match = cookies.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : null;
}

function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token' });
  const token = authHeader.split(' ')[1];
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
}

function authenticateSpotify(req, res, next) {
  const accessToken = getCookie(req, 'spotify_access_token');
  const refreshToken = getCookie(req, 'spotify_refresh_token');
  const expiresAt = parseInt(getCookie(req, 'spotify_expires_at'), 10);

  if (!accessToken) {
    return res.status(401).json({ 
      error: 'Not authenticated with Spotify',
      code: 'SPOTIFY_AUTH_REQUIRED'
    });
  }

  // Check if token is expired
  if (expiresAt && Date.now() > expiresAt) {
    return res.status(401).json({ 
      error: 'Spotify authentication expired',
      code: 'SPOTIFY_AUTH_EXPIRED'
    });
  }

  req.spotifyToken = accessToken;
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = {
  authenticateJWT,
  authenticateSpotify,
  requireRole
}; 