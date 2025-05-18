const fetch = require('node-fetch');
require('dotenv').config();
const url = require('url');

module.exports = (req, res) => {
  const parsed = url.parse(req.url, true);
  const proxyPath = parsed.query.proxyPath; // e.g., "login" or "callback/foo"

  const segments = proxyPath?.split('/') || [];
  const subroute = segments[0];

  console.log('Segments:', segments);

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
