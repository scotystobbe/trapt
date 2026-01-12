const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticateJWT } = require('./middleware');

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    try {
      const songId = req.query.songId ? Number(req.query.songId) : undefined;
      if (!songId) {
        return res.status(400).json({ error: 'songId is required' });
      }

      const comments = await prisma.comment.findMany({
        where: {
          songId,
          parentCommentId: null, // Only get top-level comments
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              name: true,
              role: true,
            },
          },
          replies: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  name: true,
                  role: true,
                },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      res.status(200).json(comments);
    } catch (error) {
      console.error('Error fetching comments:', error);
      res.status(500).json({ error: 'Failed to fetch comments' });
    }
  } else if (req.method === 'POST') {
    authenticateJWT(req, res, async () => {
      try {
        const { songId, content, parentCommentId } = req.body;
        const userId = req.user.id;

        if (!songId || !content) {
          return res.status(400).json({ error: 'songId and content are required' });
        }

        // Verify song exists
        const song = await prisma.song.findUnique({ where: { id: songId } });
        if (!song) {
          return res.status(404).json({ error: 'Song not found' });
        }

        // If parentCommentId is provided, verify it exists and belongs to the same song
        if (parentCommentId) {
          const parentComment = await prisma.comment.findUnique({
            where: { id: parentCommentId },
          });
          if (!parentComment || parentComment.songId !== songId) {
            return res.status(400).json({ error: 'Invalid parent comment' });
          }
        }

        const comment = await prisma.comment.create({
          data: {
            songId,
            userId,
            content,
            parentCommentId: parentCommentId || null,
          },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                name: true,
                role: true,
              },
            },
          },
        });

        res.status(201).json(comment);
      } catch (error) {
        console.error('Error creating comment:', error);
        res.status(500).json({ error: 'Failed to create comment' });
      }
    });
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};
