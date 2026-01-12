const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticateJWT, requireRole } = require('./middleware');

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    try {
      // If ?admin=1, return all playlists (id and name only)
      if (req.query.admin === '1') {
        const playlists = await prisma.playlist.findMany({ select: { id: true, name: true, spotifyLink: true, artworkUrl: true } });
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).json(playlists);
      }
      const playlists = await prisma.playlist.findMany({
        include: { songs: true },
        orderBy: { name: 'asc' },
      });

      // Handle special playlists: TRAPT+ and TRAPT
      // These should show songs from the database based on ratings, not their stored songs
      for (const playlist of playlists) {
        if (playlist.name === 'TRAPT+') {
          // TRAPT+ shows all 5-star rated songs, ordered by database id
          const traptPlusSongs = await prisma.song.findMany({
            where: { rating: 5 },
            orderBy: { id: 'asc' },
          });
          playlist.songs = traptPlusSongs;
        } else if (playlist.name === 'TRAPT') {
          // TRAPT shows all 4- and 5-star rated songs, ordered by database id
          const traptSongs = await prisma.song.findMany({
            where: { rating: { gte: 4 } },
            orderBy: { id: 'asc' },
          });
          playlist.songs = traptSongs;
        }
      }

      // Add comment counts to all songs for filtering (optimized with batch queries)
      try {
        // Get all song IDs from all playlists
        const allSongIds = playlists
          .flatMap(p => (p.songs || []).map(s => s.id))
          .filter(id => id != null);
        
        if (allSongIds.length > 0) {
          // Get all comment counts in batch queries
          const commentCounts = await prisma.comment.groupBy({
            by: ['songId'],
            where: {
              songId: { in: allSongIds },
              parentCommentId: null,
            },
            _count: true,
          });
          
          const responseCounts = await prisma.comment.groupBy({
            by: ['songId'],
            where: {
              songId: { in: allSongIds },
              parentCommentId: { not: null },
            },
            _count: true,
          });
          
          // Create lookup maps
          const commentCountMap = new Map(commentCounts.map(c => [c.songId, c._count]));
          const responseCountMap = new Map(responseCounts.map(c => [c.songId, c._count]));
          
          // Apply counts to songs
          for (const playlist of playlists) {
            if (playlist.songs && Array.isArray(playlist.songs)) {
              for (const song of playlist.songs) {
                const commentCount = commentCountMap.get(song.id) || 0;
                const responseCount = responseCountMap.get(song.id) || 0;
                song.commentCount = commentCount;
                song.responseCount = responseCount;
                song.hasComments = commentCount > 0;
                song.hasResponses = responseCount > 0;
              }
            }
          }
        } else {
          // No songs, set defaults for all
          for (const playlist of playlists) {
            if (playlist.songs && Array.isArray(playlist.songs)) {
              for (const song of playlist.songs) {
                song.commentCount = 0;
                song.responseCount = 0;
                song.hasComments = false;
                song.hasResponses = false;
              }
            }
          }
        }
      } catch (err) {
        // If comment counting fails, set defaults for all songs
        console.error('Error counting comments:', err);
        for (const playlist of playlists) {
          if (playlist.songs && Array.isArray(playlist.songs)) {
            for (const song of playlist.songs) {
              song.commentCount = 0;
              song.responseCount = 0;
              song.hasComments = false;
              song.hasResponses = false;
            }
          }
        }
      }

      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json(playlists);
    } catch (error) {
      console.error('Error fetching playlists:', error);
      res.status(500).json({ error: 'Failed to fetch playlists' });
    }
  } else {
    authenticateJWT(req, res, () => {
      requireRole('ADMIN')(req, res, async () => {
        if (req.method === 'POST') {
          try {
            const { name, spotifyLink } = req.body;
            const playlist = await prisma.playlist.create({
              data: { name, spotifyLink },
            });
            res.status(201).json(playlist);
          } catch (error) {
            console.error('Error creating playlist:', error);
            res.status(500).json({ error: 'Failed to create playlist' });
          }
        } else if (req.method === 'PUT') {
          try {
            const { id, ...data } = req.body;
            const playlist = await prisma.playlist.update({
              where: { id },
              data,
            });
            res.status(200).json(playlist);
          } catch (error) {
            console.error('Error updating playlist:', error);
            res.status(500).json({ error: 'Failed to update playlist' });
          }
        } else if (req.method === 'DELETE') {
          try {
            const { id } = req.body;
            // Delete all songs in the playlist first
            await prisma.song.deleteMany({ where: { playlistId: id } });
            // Then delete the playlist
            await prisma.playlist.delete({ where: { id } });
            res.status(204).end();
          } catch (error) {
            console.error('Error deleting playlist:', error);
            res.status(500).json({ error: 'Failed to delete playlist' });
          }
        } else {
          res.status(405).json({ message: 'Method not allowed' });
        }
      });
    });
  }
}; 