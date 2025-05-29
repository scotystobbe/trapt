const { authenticateJWT } = require('./middleware');

module.exports = function (req, res) {
  authenticateJWT(req, res, function () {
    res.json({ user: req.user });
  });
}; 