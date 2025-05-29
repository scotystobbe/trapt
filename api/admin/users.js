const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticateJWT, requireRole } = require('../middleware');

module.exports = async (req, res) => {
  authenticateJWT(req, res, () => {
    requireRole('ADMIN')(req, res, async () => {
      try {
        if (req.method === 'GET') {
          const users = await prisma.user.findMany({ select: { id: true, username: true, email: true, role: true, name: true } });
          res.json({ users });
        } else if (req.method === 'PUT') {
          const { id, role } = req.body;
          if (!id || !role) return res.status(400).json({ error: 'Missing id or role' });
          const updated = await prisma.user.update({ where: { id }, data: { role } });
          res.json({ user: { id: updated.id, username: updated.username, email: updated.email, role: updated.role, name: updated.name } });
        } else {
          res.status(405).json({ error: 'Method not allowed' });
        }
      } catch (error) {
        console.error('Error in /api/admin/users:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
      }
    });
  });
}; 