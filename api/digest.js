const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticateJWT } = require('./middleware');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  authenticateJWT(req, res, async () => {
    try {
      const { days, startDate } = req.query;
      
      let startDateTime;
      if (startDate) {
        // Custom start date provided
        startDateTime = new Date(startDate);
      } else if (days) {
        // Number of days back
        const daysNum = parseInt(days, 10);
        if (isNaN(daysNum) || daysNum < 1) {
          return res.status(400).json({ error: 'Invalid days parameter' });
        }
        startDateTime = new Date();
        startDateTime.setDate(startDateTime.getDate() - daysNum);
      } else {
        return res.status(400).json({ error: 'Either days or startDate is required' });
      }

      // Find all songs that have comments created after the start date
      const recentComments = await prisma.comment.findMany({
        where: {
          createdAt: {
            gte: startDateTime,
          },
        },
        select: {
          songId: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      // Find all songs that have been updated (rating/notes) after the start date
      const recentUpdates = await prisma.song.findMany({
        where: {
          updatedAt: {
            gte: startDateTime,
          },
        },
        select: {
          id: true,
          updatedAt: true,
        },
      });

      // Get unique song IDs with their most recent activity date
      const songActivityMap = new Map();
      
      // Add comment activity
      recentComments.forEach(comment => {
        const existing = songActivityMap.get(comment.songId);
        if (!existing || comment.createdAt > existing) {
          songActivityMap.set(comment.songId, comment.createdAt);
        }
      });
      
      // Add update activity (rating/notes), keeping the most recent date
      recentUpdates.forEach(song => {
        const existing = songActivityMap.get(song.id);
        if (!existing || song.updatedAt > existing) {
          songActivityMap.set(song.id, song.updatedAt);
        }
      });

      const songIds = Array.from(songActivityMap.keys());
      
      if (songIds.length === 0) {
        return res.status(200).json([]);
      }

      // Fetch songs with their playlists
      const songs = await prisma.song.findMany({
        where: {
          id: { in: songIds },
        },
        include: {
          playlist: true,
        },
      });

      // Get comment counts in batch queries
      const commentCounts = await prisma.comment.groupBy({
        by: ['songId'],
        where: {
          songId: { in: songIds },
          parentCommentId: null,
        },
        _count: true,
      });
      
      const responseCounts = await prisma.comment.groupBy({
        by: ['songId'],
        where: {
          songId: { in: songIds },
          parentCommentId: { not: null },
        },
        _count: true,
      });
      
      // Create lookup maps
      const commentCountMap = new Map(commentCounts.map(c => [c.songId, c._count]));
      const responseCountMap = new Map(responseCounts.map(c => [c.songId, c._count]));

      // Add activity date and comment counts to each song
      const songsWithActivity = songs.map(song => {
        const activityDate = songActivityMap.get(song.id);
        const commentCount = commentCountMap.get(song.id) || 0;
        const responseCount = responseCountMap.get(song.id) || 0;
        
        return {
          ...song,
          activityDate,
          commentCount,
          responseCount,
          hasComments: commentCount > 0,
          hasResponses: responseCount > 0,
        };
      });

      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json(songsWithActivity);
    } catch (error) {
      console.error('Error fetching digest:', error);
      res.status(500).json({ error: 'Failed to fetch digest' });
    }
  });
};
