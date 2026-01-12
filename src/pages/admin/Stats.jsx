import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import HamburgerMenu from '../../components/HamburgerMenu';
import LogoHeader from '../../components/LogoHeader';
import { FaArrowLeft, FaChartBar, FaMusic, FaStar, FaRegStar, FaTrophy, FaSortAmountDown } from 'react-icons/fa';
import { useAuth } from '../../components/AuthProvider';
import { useNavigate } from 'react-router-dom';
import Skeleton from '../../components/Skeleton';

export default function Stats() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    } else if (!loading && user) {
      fetchStats();
    }
  }, [user, loading, navigate]);

  const fetchStats = async () => {
    setLoadingStats(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch stats');
      setStats(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingStats(false);
    }
  };

  if (loading || !user) {
    return <div className="text-center text-gray-400 mt-12">Loading...</div>;
  }

  if (loadingStats) {
    return (
      <div style={{ backgroundColor: '#18181b' }} className="min-h-screen">
        <LogoHeader>
          <HamburgerMenu />
          <Link to="/" className="p-2 rounded hover:bg-gray-700 focus:outline-none absolute z-30" style={{ left: 20, top: 16 }} title="Back to Home">
            <span className="block min-w-[44px] min-h-[44px] p-2 -m-2 flex items-center justify-center">
              <FaArrowLeft className="text-2xl text-white" />
            </span>
          </Link>
        </LogoHeader>
        <div className="max-w-6xl mx-auto w-full p-6">
          <div className="text-center text-white text-2xl font-bold mb-8">Loading stats...</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} style={{ backgroundColor: '#27272a' }} className="p-6 rounded-xl">
                <Skeleton className="h-8 w-32 mb-4" />
                <Skeleton className="h-12 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ backgroundColor: '#18181b' }} className="min-h-screen">
        <LogoHeader>
          <HamburgerMenu />
          <Link to="/" className="p-2 rounded hover:bg-gray-700 focus:outline-none absolute z-30" style={{ left: 20, top: 16 }} title="Back to Home">
            <span className="block min-w-[44px] min-h-[44px] p-2 -m-2 flex items-center justify-center">
              <FaArrowLeft className="text-2xl text-white" />
            </span>
          </Link>
        </LogoHeader>
        <div className="max-w-6xl mx-auto w-full p-6">
          <div className="text-red-400 text-center">{error}</div>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const StatCard = ({ title, value, subtitle, icon: Icon, color = 'purple' }) => {
    const colorClasses = {
      purple: 'bg-purple-900/30 border-purple-700',
      blue: 'bg-blue-900/30 border-blue-700',
      green: 'bg-green-900/30 border-green-700',
      yellow: 'bg-yellow-900/30 border-yellow-700',
      red: 'bg-red-900/30 border-red-700',
      indigo: 'bg-indigo-900/30 border-indigo-700',
    };
    return (
      <div className={`p-6 rounded-xl border ${colorClasses[color]}`}>
        <div className="flex items-center gap-3 mb-4">
          {Icon && <Icon className="text-2xl text-white opacity-80" />}
          <h3 className="text-lg font-semibold text-white">{title}</h3>
        </div>
        <div className="text-3xl font-bold text-white mb-1">{value}</div>
        {subtitle && <div className="text-sm text-gray-400">{subtitle}</div>}
      </div>
    );
  };

  const RatingBar = ({ rating, count, percentage, total }) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <FaStar
          key={i}
          className={i <= rating ? 'text-yellow-400' : 'text-gray-600'}
        />
      );
    }
    return (
      <div className="flex items-center gap-4 py-2">
        <div className="flex items-center gap-1 w-24">{stars}</div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-white font-semibold">{count}</span>
            <span className="text-gray-400 text-sm">{percentage}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className="bg-yellow-500 h-2 rounded-full transition-all"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ backgroundColor: '#18181b' }} className="min-h-screen">
      <LogoHeader>
        <HamburgerMenu />
        <Link to="/" className="p-2 rounded hover:bg-gray-700 focus:outline-none absolute z-30" style={{ left: 20, top: 16 }} title="Back to Home">
          <span className="block min-w-[44px] min-h-[44px] p-2 -m-2 flex items-center justify-center">
            <FaArrowLeft className="text-2xl text-white" />
          </span>
        </Link>
      </LogoHeader>
      <div className="max-w-6xl mx-auto w-full p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Stats</h1>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <StatCard
            title="Total Songs"
            value={stats.totalSongs.toLocaleString()}
            subtitle={`Across ${stats.totalPlaylists} playlists`}
            icon={FaMusic}
            color="purple"
          />
          <StatCard
            title="Average Rating"
            value={stats.avgRating.toFixed(2)}
            subtitle={`Based on ${stats.ratedCount} rated songs`}
            icon={FaChartBar}
            color="green"
          />
          <StatCard
            title="Avg Songs/Playlist"
            value={stats.avgSongsPerPlaylist.toFixed(1)}
            subtitle={`${stats.totalPlaylists} playlists`}
            icon={FaSortAmountDown}
            color="blue"
          />
        </div>

        {/* Rating Distribution */}
        <div className="mb-8 p-6 rounded-xl" style={{ backgroundColor: '#27272a' }}>
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <FaStar className="text-yellow-400" />
            Rating Distribution
          </h2>
          <div className="space-y-2">
            <RatingBar
              rating={5}
              count={stats.ratingCounts[5]}
              percentage={stats.ratingPercentages[5]}
              total={stats.totalSongs}
            />
            <RatingBar
              rating={4}
              count={stats.ratingCounts[4]}
              percentage={stats.ratingPercentages[4]}
              total={stats.totalSongs}
            />
            <RatingBar
              rating={3}
              count={stats.ratingCounts[3]}
              percentage={stats.ratingPercentages[3]}
              total={stats.totalSongs}
            />
            <RatingBar
              rating={2}
              count={stats.ratingCounts[2]}
              percentage={stats.ratingPercentages[2]}
              total={stats.totalSongs}
            />
            <RatingBar
              rating={1}
              count={stats.ratingCounts[1]}
              percentage={stats.ratingPercentages[1]}
              total={stats.totalSongs}
            />
            <div className="flex items-center gap-4 py-2 mt-4 pt-4 border-t border-gray-700">
              <div className="flex items-center gap-1 w-24">
                <FaRegStar className="text-gray-400" />
                <span className="text-gray-400 text-sm ml-1">Unrated</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-white font-semibold">{stats.ratingCounts.unrated}</span>
                  <span className="text-gray-400 text-sm">{stats.ratingPercentages.unrated}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-gray-500 h-2 rounded-full transition-all"
                    style={{ width: `${stats.ratingPercentages.unrated}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>


        {/* Playlist Highlights */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {stats.highestRatedPlaylist && (
            <div style={{ backgroundColor: '#27272a' }} className="p-6 rounded-xl">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <FaStar className="text-yellow-400" />
                Highest Rated Playlist
              </h2>
              <div className="text-2xl font-bold text-white mb-1">{stats.highestRatedPlaylist.name}</div>
              <div className="text-gray-400">
                {stats.highestRatedPlaylist.avgRating.toFixed(2)} avg ({stats.highestRatedPlaylist.ratedCount} rated)
              </div>
            </div>
          )}
          {stats.lowestRatedPlaylist && (
            <div style={{ backgroundColor: '#27272a' }} className="p-6 rounded-xl">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <FaRegStar className="text-gray-400" />
                Lowest Rated Playlist
              </h2>
              <div className="text-2xl font-bold text-white mb-1">{stats.lowestRatedPlaylist.name}</div>
              <div className="text-gray-400">
                {stats.lowestRatedPlaylist.avgRating.toFixed(2)} avg ({stats.lowestRatedPlaylist.ratedCount} rated)
              </div>
            </div>
          )}
        </div>

        {/* Artist Highlights */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {stats.mostFeaturedArtist && (
            <div style={{ backgroundColor: '#27272a' }} className="p-6 rounded-xl">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <FaTrophy className="text-purple-400" />
                Most Featured Artist
              </h2>
              <div className="text-2xl font-bold text-white mb-1">{stats.mostFeaturedArtist.artist}</div>
              <div className="text-gray-400">{stats.mostFeaturedArtist.count} {stats.mostFeaturedArtist.count === 1 ? 'song' : 'songs'}</div>
            </div>
          )}
          {stats.highestRatedArtist && (
            <div style={{ backgroundColor: '#27272a' }} className="p-6 rounded-xl">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <FaStar className="text-yellow-400" />
                Highest Rated Artist
              </h2>
              <div className="text-2xl font-bold text-white mb-1">{stats.highestRatedArtist.artist}</div>
              <div className="text-gray-400">
                {stats.highestRatedArtist.avgRating.toFixed(2)} avg ({stats.highestRatedArtist.ratedCount} rated)
              </div>
            </div>
          )}
        </div>

        {/* Top Artists by Count */}
        {stats.topArtistsByCount && stats.topArtistsByCount.length > 0 && (
          <div style={{ backgroundColor: '#27272a' }} className="p-6 rounded-xl mb-8">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <FaMusic className="text-purple-400" />
              Top 10 Artists by Count
            </h2>
            <div className="space-y-2">
              {stats.topArtistsByCount.map(({ artist, count }, idx) => (
                <div key={artist} className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="text-gray-500 w-6 text-right">#{idx + 1}</span>
                    <span className="text-white">{artist}</span>
                  </div>
                  <span className="text-gray-400 font-semibold">{count} {count === 1 ? 'song' : 'songs'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Artists by Rating */}
        {stats.topArtistsByRating && stats.topArtistsByRating.length > 0 && (
          <div style={{ backgroundColor: '#27272a' }} className="p-6 rounded-xl mb-8">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <FaStar className="text-yellow-400" />
              Top 10 Artists by Rating
            </h2>
            <div className="space-y-2">
              {stats.topArtistsByRating.map(({ artist, avgRating, ratedCount, totalCount }, idx) => (
                <div key={artist} className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="text-gray-500 w-6 text-right">#{idx + 1}</span>
                    <div className="flex flex-col">
                      <span className="text-white">{artist}</span>
                      <span className="text-gray-500 text-sm">{ratedCount} rated of {totalCount} total</span>
                    </div>
                  </div>
                  <span className="text-yellow-400 font-semibold">{avgRating.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
