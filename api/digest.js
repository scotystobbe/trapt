const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticateJWT } = require('./middleware');

/** Prisma/DB may return FK ids as number or BigInt; Map keys must match lookups. */
function songIdKey(id) {
  if (id == null) return null;
  const n = typeof id === 'bigint' ? Number(id) : Number(id);
  return Number.isFinite(n) ? n : null;
}

function toIsoOrNull(d) {
  if (d == null || d === '') return null;
  const t = d instanceof Date ? d.getTime() : new Date(d).getTime();
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  authenticateJWT(req, res, async () => {
    try {
      const days = Array.isArray(req.query.days) ? req.query.days[0] : req.query.days;
      const startDate = Array.isArray(req.query.startDate)
        ? req.query.startDate[0]
        : req.query.startDate;
      const activityRaw = Array.isArray(req.query.activity)
        ? req.query.activity[0]
        : req.query.activity;
      const activity = String(activityRaw || 'both').toLowerCase();
      const activityFilter =
        activity === 'comments' || activity === 'ratings' || activity === 'both'
          ? activity
          : 'both';

      let startDateTime;
      if (startDate) {
        startDateTime = new Date(startDate);
      } else if (days) {
        const daysNum = parseInt(days, 10);
        if (isNaN(daysNum) || daysNum < 1) {
          return res.status(400).json({ error: 'Invalid days parameter' });
        }
        startDateTime = new Date();
        startDateTime.setDate(startDateTime.getDate() - daysNum);
      } else {
        return res.status(400).json({ error: 'Either days or startDate is required' });
      }

      if (Number.isNaN(startDateTime.getTime())) {
        return res.status(400).json({ error: 'Invalid date range' });
      }

      // Latest comment time per song in range (top-level + replies)
      const recentCommentRows = await prisma.comment.findMany({
        where: {
          createdAt: { gte: startDateTime },
        },
        select: {
          songId: true,
          createdAt: true,
        },
      });

      // Song row updates in range; include notes so we can detect "discussion" threads
      // (admin notes drive the reply UI even when there are zero Comment rows).
      const recentUpdates = await prisma.song.findMany({
        where: {
          updatedAt: {
            gte: startDateTime,
          },
        },
        select: {
          id: true,
          updatedAt: true,
          notes: true,
        },
      });

      const commentActivityMap = new Map();
      for (const row of recentCommentRows) {
        const sid = songIdKey(row.songId);
        if (sid == null || !row.createdAt) continue;
        const prev = commentActivityMap.get(sid);
        if (!prev || row.createdAt > prev) {
          commentActivityMap.set(sid, row.createdAt);
        }
      }

      const ratingActivityMap = new Map();
      /** Songs with non-empty admin notes touched in this window (updatedAt in range). */
      const noteThreadActivityMap = new Map();
      recentUpdates.forEach(song => {
        const sid = songIdKey(song.id);
        if (sid == null) return;
        ratingActivityMap.set(sid, song.updatedAt);
        if (song.notes != null && String(song.notes).trim() !== '') {
          noteThreadActivityMap.set(sid, song.updatedAt);
        }
      });

      let songIds;
      if (activityFilter === 'comments') {
        // "Discussion": saved replies (Comment) OR admin note text updated in range
        songIds = Array.from(
          new Set([...commentActivityMap.keys(), ...noteThreadActivityMap.keys()])
        );
      } else if (activityFilter === 'ratings') {
        songIds = Array.from(ratingActivityMap.keys());
      } else {
        songIds = Array.from(
          new Set([...commentActivityMap.keys(), ...ratingActivityMap.keys()])
        );
      }

      const activityDateForSong = (songId) => {
        const id = songIdKey(songId);
        if (id == null) return null;
        const c = commentActivityMap.get(id);
        const r = ratingActivityMap.get(id);
        const n = noteThreadActivityMap.get(id);
        let best = null;
        for (const t of [c, r, n]) {
          if (t && (!best || t > best)) best = t;
        }
        return best;
      };
      
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
      
      // Create lookup maps (normalize ids for consistent Map.get)
      const commentCountMap = new Map();
      commentCounts.forEach(c => {
        const sid = songIdKey(c.songId);
        if (sid != null) commentCountMap.set(sid, c._count);
      });
      const responseCountMap = new Map();
      responseCounts.forEach(c => {
        const sid = songIdKey(c.songId);
        if (sid != null) responseCountMap.set(sid, c._count);
      });

      // Add activity dates and comment counts to each song
      const songsWithActivity = songs.map(song => {
        const id = songIdKey(song.id);
        const commentAt = id != null ? commentActivityMap.get(id) || null : null;
        const ratingAt = id != null ? ratingActivityMap.get(id) || null : null;
        const noteThreadAt = id != null ? noteThreadActivityMap.get(id) || null : null;
        const activityAt = activityDateForSong(song.id);
        const commentCount = id != null ? commentCountMap.get(id) || 0 : 0;
        const responseCount = id != null ? responseCountMap.get(id) || 0 : 0;

        return {
          ...song,
          activityDate: toIsoOrNull(activityAt),
          commentActivityAt: toIsoOrNull(commentAt),
          noteThreadActivityAt: toIsoOrNull(noteThreadAt),
          ratingActivityAt: toIsoOrNull(ratingAt),
          hasCommentActivityInRange: id != null && commentActivityMap.has(id),
          hasNoteThreadActivityInRange: id != null && noteThreadActivityMap.has(id),
          hasRatingActivityInRange: id != null && ratingActivityMap.has(id),
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
