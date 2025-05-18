module.exports = (req, res) => {
  const url = req.url;
  const method = req.method;

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');

  res.end(JSON.stringify({
    message: 'Catch-all route hit!',
    url,
    method
  }));
};
