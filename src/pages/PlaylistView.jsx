import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import SongCard from '../components/SongCard';
import HamburgerMenu from '../components/HamburgerMenu';
import LogoHeader from '../components/LogoHeader';
import Skeleton from '../components/Skeleton';
import { FaArrowLeft, FaSearch, FaStar, FaStarHalfAlt, FaRegStar } from 'react-icons/fa';
import useSWR from 'swr';
import { useAuth } from '../components/AuthProvider';

// --- Helper component ---
function CreateUnratedSpotifyModal({ open, onClose, playlist }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successUrl, setSuccessUrl] = useState(null);
  const [needsSpotifyAuth, setNeedsSpotifyAuth] = useState(false);

  const handleCreate = async () => {
    setLoading(true);
    setError(null);
    setSuccessUrl(null);
    setNeedsSpotifyAuth(false);
    try {
      const res = await fetch('/api/spotify-proxy/create-unrated-playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlistId: playlist.id }),
      });
      const data = await res.json();
      
      if (res.status === 401 && (data.code === 'SPOTIFY_AUTH_REQUIRED' || data.code === 'SPOTIFY_AUTH_EXPIRED')) {
        setNeedsSpotifyAuth(true);
        return;
      }
      
      if (!res.ok) throw new Error(data.error || 'Unknown error');
      setSuccessUrl(data.externalUrl);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSpotifyLogin = () => {
    window.location.href = '/api/spotify-proxy/login';
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
      <div className="bg-zinc-900 rounded-lg shadow-lg p-6 max-w-md w-full relative">
        <button onClick={onClose} className="absolute top-2 right-2 text-gray-400 hover:text-white text-2xl">&times;</button>
        <h2 className="text-xl font-bold mb-4 text-white">
          {playlist.unratedPlaylistId ? 'Sync Unrated Songs Playlist' : 'Create Unrated Songs Playlist'}
        </h2>
        <p className="text-gray-300 mb-4">
          {playlist.unratedPlaylistId 
            ? 'This will update the existing Spotify playlist with all unrated songs from '
            : 'This will create a new Spotify playlist with all unrated songs from '}
          <span className="font-semibold text-white">{playlist.name}</span>.
        </p>
        {error && <div className="text-red-400 mb-2">{error}</div>}
        {needsSpotifyAuth && (
          <div className="mb-4 p-4 bg-yellow-900 bg-opacity-50 rounded-lg">
            <p className="text-yellow-200 mb-2">You need to connect your Spotify account to create or sync playlists.</p>
            <button
              onClick={handleSpotifyLogin}
              className="px-4 py-2 bg-green-600 rounded text-white font-semibold hover:bg-green-500 w-full"
            >
              Connect to Spotify
            </button>
          </div>
        )}
        {successUrl ? (
          <div className="space-y-2">
            <a 
              href={successUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-green-400 underline font-semibold block"
            >
              Open Playlist on Spotify
            </a>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              Close
            </button>
          </div>
        ) : !needsSpotifyAuth && (
          <button
            className="px-4 py-2 bg-green-600 rounded text-white font-semibold hover:bg-green-500 disabled:opacity-50 w-full"
            onClick={handleCreate}
            disabled={loading}
          >
            {loading 
              ? (playlist.unratedPlaylistId ? 'Syncing...' : 'Creating...') 
              : (playlist.unratedPlaylistId ? 'Sync Playlist' : 'Create Playlist')}
          </button>
        )}
      </div>
    </div>
  );
}

function AverageStarRating({ value }) {
  // Clamp value between 0 and 5
  const avg = Math.max(0, Math.min(5, value));
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    if (avg >= i) {
      stars.push(<FaStar key={i} className="text-yellow-400 inline" />);
    } else if (avg >= i - 0.5) {
      stars.push(<FaStarHalfAlt key={i} className="text-yellow-400 inline" />);
    } else {
      stars.push(<FaRegStar key={i} className="text-yellow-400 inline" />);
    }
  }
  return (
    <span className="ml-2 select-none" style={{display: 'inline-flex', alignItems: 'baseline', position: 'relative', top: '2px'}}>
      {stars}
      <span className="text-gray-400 text-sm ml-1" style={{position: 'relative', top: '-2px'}}>
        ({avg.toFixed(1)})
      </span>
    </span>
  );
}

export default function PlaylistView() {
  const { id } = useParams();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [sort, setSort] = useState('sortOrder');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // 'all', 'withComments', 'withResponses'
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const sortButtonRef = useRef(null);
  const sortDropdownRef = useRef(null);
  const searchInputRef = useRef(null);
  const [showStickyHeader, setShowStickyHeader] = useState(false);
  const headerRef = useRef(null);
  const [showUnratedModal, setShowUnratedModal] = useState(false);

  const fetcher = url => fetch(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now()).then(res => res.json());
  const { data: playlists = [], error, mutate } = useSWR('/api/playlists', fetcher);
  const playlist = playlists.find(p => p.id === parseInt(id));

  // Close dropdown on outside click
  useEffect(() => {
    if (!sortDropdownOpen) return;
    function handleClick(e) {
      if (
        sortButtonRef.current && sortButtonRef.current.contains(e.target)
      ) return;
      if (
        sortDropdownRef.current && sortDropdownRef.current.contains(e.target)
      ) return;
      setSortDropdownOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [sortDropdownOpen]);

  useEffect(() => {
    const handleScroll = () => {
      if (!headerRef.current) return;
      const rect = headerRef.current.getBoundingClientRect();
      setShowStickyHeader(rect.bottom <= 0);
    };
    window.addEventListener('scroll', handleScroll);
    // Delay initial call until after paint to avoid sticky header flash
    const raf = requestAnimationFrame(handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  const refreshPlaylist = () => {
    mutate();
  };

  // Set theme color for iOS PWA and background for html/body
  if (typeof document !== 'undefined') {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      const m = document.createElement('meta');
      m.name = 'theme-color';
      m.content = '#18181b';
      document.head.appendChild(m);
    } else {
      meta.content = '#18181b';
    }
    document.documentElement.style.background = '#18181b';
    document.body.style.background = '#18181b';
  }

  if (!playlist) return (
    <div style={{ backgroundColor: '#18181b' }} className="min-h-screen">
      <LogoHeader>
        <HamburgerMenu />
      </LogoHeader>
      <div className="max-w-4xl mx-auto w-full p-4 space-y-4">
        <div className="flex flex-col items-center gap-3 mb-4">
          <Skeleton className="w-32 h-32 rounded-xl mb-2" />
          <Skeleton className="w-56 h-7" />
        </div>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} style={{ backgroundColor: '#27272a' }} className="p-4 rounded-xl flex flex-row gap-4 items-start">
              <Skeleton className="flex-shrink-0 w-24 h-24 rounded-md" />
              <div className="flex-1 flex flex-col justify-between w-full">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="flex-1">
                    <Skeleton className="h-6 w-32 mb-2" />
                    <Skeleton className="h-4 w-24 mb-1" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  <div className="flex items-center gap-2 mb-2">
                    {[...Array(5)].map((_, j) => (
                      <Skeleton key={j} className="w-8 h-8 rounded-full" />
                    ))}
                  </div>
                  <Skeleton className="h-5 w-full max-w-xs mb-1" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // For TRAPT and TRAPT+, use id-based sorting for "sortOrder" since songs come from multiple playlists
  const isSpecialPlaylist = playlist.name === 'TRAPT' || playlist.name === 'TRAPT+';
  
  // Apply filters
  let filteredSongs = [...playlist.songs];
  if (filter === 'withComments') {
    // Show songs with any comments (top-level comments or responses)
    filteredSongs = filteredSongs.filter(song => 
      (song.commentCount > 0) || (song.responseCount > 0) || song.notes
    );
  } else if (filter === 'withResponses' && isAdmin) {
    // Show songs with responses/threads (replies to comments)
    filteredSongs = filteredSongs.filter(song => song.responseCount > 0);
  }
  
  const sortedSongs = filteredSongs
    .filter(song => song.title.toLowerCase().includes(search.toLowerCase()) || song.artist.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title);
      if (sort === 'artist') return a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title);
      // For special playlists, sort by id; otherwise use sortOrder
      if (isSpecialPlaylist) return a.id - b.id;
      return a.sortOrder - b.sortOrder;
    });

  return (
    <div style={{ backgroundColor: '#18181b' }} className="min-h-screen">
      <LogoHeader>
        <HamburgerMenu />
        <Link to="/browse" className="p-2 rounded hover:bg-gray-700 focus:outline-none absolute z-30" style={{ left: 20, top: 16 }} title="Back to Browse">
          <span className="block min-w-[44px] min-h-[44px] p-2 -m-2 flex items-center justify-center">
            <FaArrowLeft className="text-2xl text-white" />
          </span>
        </Link>
      </LogoHeader>
      <div
        className={`sticky z-20 bg-[#18181b] flex items-center justify-center gap-3 px-4 py-2 shadow transition-all duration-300 ${showStickyHeader ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full pointer-events-none'}`}
        style={{ minHeight: 56, top: 'calc(63px + env(safe-area-inset-top, 0px))' }}
      >
        {playlist.artworkUrl && (
          <img src={playlist.artworkUrl} alt={playlist.name} className="w-10 h-10 rounded-md object-cover" />
        )}
        <span className="text-white font-semibold text-base truncate text-center">{playlist.name}</span>
        <button
          className="ml-2 p-2 rounded hover:bg-gray-700 focus:outline-none"
          title="Search"
          onClick={() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            setTimeout(() => {
              if (searchInputRef.current) {
                searchInputRef.current.focus();
              }
            }, 400);
          }}
        >
          <FaSearch className="text-xl text-white" />
        </button>
      </div>
      <div className="max-w-4xl mx-auto w-full p-4 space-y-4">
        <div ref={headerRef} className="flex flex-col items-center gap-3 mb-4 -mt-10">
          {playlist.artworkUrl && (
            <div className="w-32 h-32 bg-gray-800 rounded-xl flex items-center justify-center overflow-hidden">
              <img src={playlist.artworkUrl} alt={playlist.name} className="object-cover w-full h-full" />
            </div>
          )}
          <div className="flex items-center gap-2 text-center text-xl font-semibold text-white">
            <span>{playlist.name}</span>
            <span className="text-gray-400">&bull;</span>
            <span className="text-gray-400">{playlist.songs.length} tracks</span>
          </div>
          {Array.isArray(playlist.songs) && playlist.songs.length > 0 && (() => {
            const rated = playlist.songs.filter(s => s.rating != null && s.rating !== 0);
            const ratedCount = rated.length;
            const totalCount = playlist.songs.length;
            const avg = ratedCount > 0 ? (rated.reduce((sum, s) => sum + s.rating, 0) / ratedCount) : null;
            const isFullyRated = ratedCount === totalCount;
            return (
              <div className="flex items-center gap-2 text-gray-400 text-base mt-1">
                {isFullyRated ? (
                  <span>{ratedCount}/{totalCount} rated</span>
                ) : (
                  <button
                    className="font-semibold focus:outline-none"
                    onClick={() => setShowUnratedModal(true)}
                    style={{ background: 'none', border: 'none', padding: 0, margin: 0 }}
                  >
                    {ratedCount}/{totalCount} rated
                  </button>
                )}
                {avg !== null && (
                  <span className="flex items-baseline" style={{gap: '0.08rem'}}>
                    <span className="mr-2" style={{position: 'relative', top: '-1px'}}>&bull;</span>
                    <span className="text-gray-400">Avg:</span>
                    <AverageStarRating value={avg} />
                  </span>
                )}
              </div>
            );
          })()}
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row items-center gap-2 justify-between">
            <div className="flex flex-row items-center gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-80">
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search songs..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full p-2 rounded" style={{ backgroundColor: '#27272a', color: 'white', border: '1px solid #3f3f46' }}
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 z-20 text-gray-400 hover:text-white focus:outline-none"
                    aria-label="Clear search"
                  >
                    <span className="flex items-center justify-center min-w-[32px] min-h-[32px] p-1 text-xl">×</span>
                  </button>
                )}
              </div>
              <div className="relative flex items-center">
                <button
                  ref={sortButtonRef}
                  type="button"
                  className="flex items-center gap-1 px-2 py-1 rounded text-gray-300 focus:outline-none"
                  style={{ backgroundColor: '#232326', border: '1px solid #3f3f46' }}
                  onMouseOver={e => e.currentTarget.style.backgroundColor = '#27272a'}
                  onMouseOut={e => e.currentTarget.style.backgroundColor = '#232326'}
                  onClick={() => setSortDropdownOpen((open) => !open)}
                  title="Sort"
                >
                  <img src="/sort_icon.svg" alt="Sort" className="w-5 h-5" style={{ filter: 'invert(80%)' }} />
                </button>
                {sortDropdownOpen && (
                  <div
                    ref={sortDropdownRef}
                    className="absolute right-0 top-full mt-2 w-36 rounded shadow-lg z-10"
                    style={{ backgroundColor: '#27272a', border: '1px solid #3f3f46' }}
                  >
                    <button
                      className={`block w-full text-left px-4 py-2 text-gray-200 hover:bg-[#3f3f46] ${sort === 'sortOrder' ? 'font-bold' : ''}`}
                      onClick={() => { setSort('sortOrder'); setSortDropdownOpen(false); }}
                    >Original Order</button>
                    <button
                      className={`block w-full text-left px-4 py-2 text-gray-200 hover:bg-[#3f3f46] ${sort === 'title' ? 'font-bold' : ''}`}
                      onClick={() => { setSort('title'); setSortDropdownOpen(false); }}
                    >Title</button>
                    <button
                      className={`block w-full text-left px-4 py-2 text-gray-200 hover:bg-[#3f3f46] ${sort === 'artist' ? 'font-bold' : ''}`}
                      onClick={() => { setSort('artist'); setSortDropdownOpen(false); }}
                    >Artist</button>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded text-sm ${
                filter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-[#27272a] text-gray-300 hover:bg-[#3f3f46]'
              }`}
            >
              All Songs
            </button>
            <button
              onClick={() => setFilter('withComments')}
              className={`px-4 py-2 rounded text-sm ${
                filter === 'withComments'
                  ? 'bg-blue-600 text-white'
                  : 'bg-[#27272a] text-gray-300 hover:bg-[#3f3f46]'
              }`}
            >
              With Comments
            </button>
            {isAdmin ? (
              <button
                onClick={() => setFilter('withResponses')}
                className={`px-4 py-2 rounded text-sm ${
                  filter === 'withResponses'
                    ? 'bg-blue-600 text-white'
                    : 'bg-[#27272a] text-gray-300 hover:bg-[#3f3f46]'
                }`}
              >
                Show Responses
              </button>
            ) : (
              <button
                onClick={() => setFilter('withComments')}
                className={`px-4 py-2 rounded text-sm ${
                  filter === 'withComments'
                    ? 'bg-blue-600 text-white'
                    : 'bg-[#27272a] text-gray-300 hover:bg-[#3f3f46]'
                }`}
                title="Filter to show songs with notes you can respond to"
              >
                Add a Response
              </button>
            )}
          </div>
        </div>
        <div className="space-y-4">
          {sortedSongs.map(song => (
            <SongCard key={song.id} song={song} playlistName={playlist.name} onSongUpdate={refreshPlaylist} />
          ))}
        </div>
        <CreateUnratedSpotifyModal open={showUnratedModal} onClose={() => setShowUnratedModal(false)} playlist={playlist} />
      </div>
    </div>
  );
}