const { authenticateJWT, requireRole } = require('../middleware');

module.exports = function (req, res) {
  authenticateJWT(req, res, function () {
    requireRole('ADMIN')(req, res, function () {
      res.json({ message: 'Welcome, admin!' });
    });
  });
}; 