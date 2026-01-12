const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticateJWT, requireRole } = require('../middleware');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  authenticateJWT(req, res, async () => {
      try {
        // Get all songs
        const allSongs = await prisma.song.findMany({
          include: { playlist: true },
        });

        // Get all playlists
        const allPlaylists = await prisma.playlist.findMany({
          include: { songs: true },
        });

        const totalSongs = allSongs.length;
        const totalPlaylists = allPlaylists.length;

        // Rating distribution
        const ratingCounts = {
          5: allSongs.filter(s => s.rating === 5).length,
          4: allSongs.filter(s => s.rating === 4).length,
          3: allSongs.filter(s => s.rating === 3).length,
          2: allSongs.filter(s => s.rating === 2).length,
          1: allSongs.filter(s => s.rating === 1).length,
          unrated: allSongs.filter(s => s.rating === null || s.rating === 0).length,
        };

        // Rated songs (excluding unrated)
        const ratedSongs = allSongs.filter(s => s.rating !== null && s.rating !== 0);
        const ratedCount = ratedSongs.length;

        // Average rating
        const avgRating = ratedCount > 0
          ? ratedSongs.reduce((sum, s) => sum + s.rating, 0) / ratedCount
          : 0;

        // Songs with notes
        const songsWithNotes = allSongs.filter(s => s.notes && s.notes.trim().length > 0).length;
        const songsWithoutNotes = totalSongs - songsWithNotes;

        // Songs with artwork
        const songsWithArtwork = allSongs.filter(s => s.artworkUrl && s.artworkUrl.trim().length > 0).length;
        const songsWithoutArtwork = totalSongs - songsWithArtwork;

        // Average songs per playlist
        const avgSongsPerPlaylist = totalPlaylists > 0
          ? totalSongs / totalPlaylists
          : 0;

        // Playlist stats
        const playlistStats = allPlaylists.map(playlist => {
          const songs = playlist.songs || [];
          const rated = songs.filter(s => s.rating !== null && s.rating !== 0);
          const avg = rated.length > 0
            ? rated.reduce((sum, s) => sum + s.rating, 0) / rated.length
            : null;
          return {
            id: playlist.id,
            name: playlist.name,
            songCount: songs.length,
            ratedCount: rated.length,
            avgRating: avg,
            year: playlist.year,
          };
        });

        // Most/least songs in playlists
        const playlistsBySongCount = [...playlistStats].sort((a, b) => b.songCount - a.songCount);
        const mostSongsPlaylist = playlistsBySongCount[0];
        const leastSongsPlaylist = playlistsBySongCount[playlistsBySongCount.length - 1];

        // Highest/lowest average rating playlists (with at least 5 rated songs)
        const playlistsWithRatings = playlistStats.filter(p => p.avgRating !== null && p.ratedCount >= 5);
        const playlistsByRating = [...playlistsWithRatings].sort((a, b) => b.avgRating - a.avgRating);
        const highestRatedPlaylist = playlistsByRating[0];
        const lowestRatedPlaylist = playlistsByRating[playlistsByRating.length - 1];

        // Top artists by song count
        const artistCounts = {};
        const artistRatings = {};
        allSongs.forEach(song => {
          const artist = song.artist || 'Unknown';
          artistCounts[artist] = (artistCounts[artist] || 0) + 1;
          
          // Track ratings for average calculation
          if (!artistRatings[artist]) {
            artistRatings[artist] = { total: 0, count: 0 };
          }
          if (song.rating !== null && song.rating !== 0) {
            artistRatings[artist].total += song.rating;
            artistRatings[artist].count += 1;
          }
        });
        
        // Top 10 artists by count
        const topArtistsByCount = Object.entries(artistCounts)
          .map(([artist, count]) => ({ artist, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);
        
        // Top 10 artists by average rating (minimum 3 rated songs)
        const topArtistsByRating = Object.entries(artistRatings)
          .filter(([artist, data]) => data.count >= 3)
          .map(([artist, data]) => ({
            artist,
            avgRating: data.total / data.count,
            ratedCount: data.count,
            totalCount: artistCounts[artist],
          }))
          .sort((a, b) => b.avgRating - a.avgRating)
          .slice(0, 10);
        
        // Most featured artist (highest count)
        const mostFeaturedArtist = topArtistsByCount[0] || null;
        
        // Highest rated artist
        const highestRatedArtist = topArtistsByRating[0] || null;

        // Songs by year (if playlists have years)
        const songsByYear = {};
        allSongs.forEach(song => {
          const year = song.playlist?.year;
          if (year) {
            songsByYear[year] = (songsByYear[year] || 0) + 1;
          }
        });
        const yearStats = Object.entries(songsByYear)
          .map(([year, count]) => ({ year: parseInt(year), count }))
          .sort((a, b) => a.year - b.year);

        res.status(200).json({
          totalSongs,
          totalPlaylists,
          avgSongsPerPlaylist: Math.round(avgSongsPerPlaylist * 10) / 10,
          ratingCounts,
          ratingPercentages: {
            5: totalSongs > 0 ? Math.round((ratingCounts[5] / totalSongs) * 1000) / 10 : 0,
            4: totalSongs > 0 ? Math.round((ratingCounts[4] / totalSongs) * 1000) / 10 : 0,
            3: totalSongs > 0 ? Math.round((ratingCounts[3] / totalSongs) * 1000) / 10 : 0,
            2: totalSongs > 0 ? Math.round((ratingCounts[2] / totalSongs) * 1000) / 10 : 0,
            1: totalSongs > 0 ? Math.round((ratingCounts[1] / totalSongs) * 1000) / 10 : 0,
            unrated: totalSongs > 0 ? Math.round((ratingCounts.unrated / totalSongs) * 1000) / 10 : 0,
          },
          ratedCount,
          avgRating: Math.round(avgRating * 100) / 100,
          songsWithNotes,
          songsWithoutNotes,
          songsWithArtwork,
          songsWithoutArtwork,
          mostSongsPlaylist,
          leastSongsPlaylist,
          highestRatedPlaylist,
          lowestRatedPlaylist,
          topArtistsByCount,
          topArtistsByRating,
          mostFeaturedArtist,
          highestRatedArtist,
          yearStats,
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats', details: error.message });
      }
  });
};
