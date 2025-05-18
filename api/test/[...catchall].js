module.exports = (req, res) => {
  const url = req.url;
  const method = req.method;

  // Split the URL manually to show what's being passed
  const matchedPath = url.split('/api/test/')[1]?.split('/') || [];

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    message: 'Catch-all route hit!',
    url,
    method,
    matchedPath
  }));
};
