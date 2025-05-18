module.exports = (req, res) => {
  const url = req.url;
  const matched = url.replace(/^\/api\/test\/?/, '').split('/').filter(Boolean);

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    message: 'Catch-all route hit!',
    method: req.method,
    url,
    matchedSegments: matched
  }));
};
