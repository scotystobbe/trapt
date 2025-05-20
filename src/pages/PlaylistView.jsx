import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import SongCard from '../components/SongCard';
import HamburgerMenu from '../components/HamburgerMenu';
import LogoHeader from '../components/LogoHeader';
import Skeleton from '../components/Skeleton';
import { FaArrowLeft, FaSearch } from 'react-icons/fa';

export default function PlaylistView() {
  const { id } = useParams();
  const [playlist, setPlaylist] = useState(null);
  const [sort, setSort] = useState('sortOrder');
  const [search, setSearch] = useState('');
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const sortButtonRef = useRef(null);
  const sortDropdownRef = useRef(null);
  const searchInputRef = useRef(null);
  const [showStickyHeader, setShowStickyHeader] = useState(false);
  const headerRef = useRef(null);

  useEffect(() => {
    fetch('/api/playlists')
      .then(res => res.json())
      .then(data => {
        const p = data.find(p => p.id === parseInt(id));
        setPlaylist(p);
      });
  }, [id]);

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
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const refreshPlaylist = () => {
    fetch('/api/playlists')
      .then(res => res.json())
      .then(data => {
        const p = data.find(p => p.id === parseInt(id));
        setPlaylist(p);
      });
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

  const sortedSongs = [...playlist.songs]
    .filter(song => song.title.toLowerCase().includes(search.toLowerCase()) || song.artist.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title);
      if (sort === 'artist') return a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title);
      return a.sortOrder - b.sortOrder;
    });

  return (
    <div style={{ backgroundColor: '#18181b' }} className="min-h-screen">
      <LogoHeader>
        <HamburgerMenu />
        <Link to="/browse" className="p-2 rounded hover:bg-gray-700 focus:outline-none absolute z-30" style={{ left: 20, top: 16 }} title="Back to Browse">
          <FaArrowLeft className="text-2xl text-white" />
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
        </div>
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
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-20 text-gray-400 hover:text-white focus:outline-none text-xl"
                  aria-label="Clear search"
                >
                  ×
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
        <div className="space-y-4">
          {sortedSongs.map(song => (
            <SongCard key={song.id} song={song} playlistName={playlist.name} onSongUpdate={refreshPlaylist} />
          ))}
        </div>
      </div>
    </div>
  );
}