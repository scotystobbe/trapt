const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();
const { authenticateJWT } = require('./middleware');

module.exports = async function profile(req, res) {
  authenticateJWT(req, res, async () => {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    const userId = req.user.id;
    const { username, currentPassword, newPassword } = req.body;
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return res.status(404).json({ error: 'User not found' });
      // If changing password, verify current password
      if (newPassword) {
        if (!currentPassword) return res.status(400).json({ error: 'Current password required' });
        const valid = await bcrypt.compare(currentPassword, user.password);
        if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });
      }
      // If changing username, check for uniqueness
      if (username && username !== user.username) {
        const exists = await prisma.user.findUnique({ where: { username } });
        if (exists) return res.status(400).json({ error: 'Username already taken' });
      }
      // Update fields
      const updateData = {};
      if (username && username !== user.username) updateData.username = username;
      if (newPassword) updateData.password = await bcrypt.hash(newPassword, 10);
      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: 'No changes to update' });
      }
      await prisma.user.update({ where: { id: userId }, data: updateData });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to update profile', details: err.message });
    }
  });
}; 