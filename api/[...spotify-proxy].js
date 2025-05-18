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

module.exports = (req, res) => {
  // Vercel puts the catch-all param in the query
  const parsed = url.parse(req.url, true);
  const subroute = parsed.query['spotify-proxy'];

  console.log('SUBROUTE:', subroute);

  if (subroute === 'currently-playing') {
    res.statusCode = 200;
    res.end('Subroute works!');
    return;
  }
  if (subroute === 'login') {
    res.statusCode = 200;
    res.end('Login works!');
    return;
  }
  if (subroute === 'callback') {
    res.statusCode = 200;
    res.end('Callback works!');
    return;
  }

  res.statusCode = 200;
  res.end('Spotify proxy root works!');
}; 

