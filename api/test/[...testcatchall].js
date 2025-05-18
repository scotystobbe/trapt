module.exports = (req, res) => {
  res.statusCode = 200;
  res.end('Catch-all works! URL: ' + req.url);
}
