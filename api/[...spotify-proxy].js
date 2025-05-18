const url = require('url');

module.exports = (req, res) => {
  const parsedUrl = url.parse(req.url, true); // true enables query parsing
  const proxyPath = parsedUrl.query.proxyPath || ''; // comes from vercel.json rewrite

  const segments = proxyPath.split('/').filter(Boolean); // handles foo/bar/callback/etc.
  const subroute = segments[0]; // just the first part of the path

  console.log('proxyPath:', proxyPath);
  console.log('segments:', segments);
  console.log('subroute:', subroute);

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
