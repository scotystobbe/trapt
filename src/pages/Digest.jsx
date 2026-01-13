import React, { useState, useRef, useEffect } from 'react';
import SongCard from '../components/SongCard';
import HamburgerMenu from '../components/HamburgerMenu';
import LogoHeader from '../components/LogoHeader';
import Skeleton from '../components/Skeleton';
import useSWR from 'swr';
import { useAuth } from '../components/AuthProvider';

export default function Digest() {
  const { user } = useAuth();
  const [dateMode, setDateMode] = useState('days'); // 'days', 'customDays', 'customDate'
  const [days, setDays] = useState(7);
  const [customDays, setCustomDays] = useState(30);
  const [customDate, setCustomDate] = useState('');
  const [sort, setSort] = useState('mostRecent'); // 'playlistOrder', 'mostRecent', 'leastRecent'
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const sortButtonRef = useRef(null);
  const sortDropdownRef = useRef(null);

  // Build API URL based on date mode
  const buildApiUrl = () => {
    const baseUrl = '/api/digest';
    if (dateMode === 'customDate') {
      if (!customDate) return null;
      // Format date as YYYY-MM-DD
      const dateStr = customDate;
      return `${baseUrl}?startDate=${dateStr}`;
    } else if (dateMode === 'customDays') {
      return `${baseUrl}?days=${customDays}`;
    } else {
      return `${baseUrl}?days=${days}`;
    }
  };

  const apiUrl = buildApiUrl();
  const fetcher = url => {
    if (!url) return Promise.resolve([]);
    return fetch(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now(), {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    }).then(res => {
      if (!res.ok) throw new Error('Failed to fetch digest');
      return res.json();
    });
  };

  const { data: songs = [], error, mutate } = useSWR(apiUrl, fetcher);

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

  // Sort songs
  const sortedSongs = [...songs].sort((a, b) => {
    if (sort === 'mostRecent') {
      const dateA = a.activityDate ? new Date(a.activityDate) : new Date(0);
      const dateB = b.activityDate ? new Date(b.activityDate) : new Date(0);
      return dateB - dateA; // Most recent first
    } else if (sort === 'leastRecent') {
      const dateA = a.activityDate ? new Date(a.activityDate) : new Date(0);
      const dateB = b.activityDate ? new Date(b.activityDate) : new Date(0);
      return dateA - dateB; // Least recent first
    } else {
      // Playlist order - sort by playlist name, then sortOrder
      const playlistCompare = a.playlist.name.localeCompare(b.playlist.name);
      if (playlistCompare !== 0) return playlistCompare;
      return a.sortOrder - b.sortOrder;
    }
  });

  const refreshDigest = () => {
    mutate();
  };

  return (
    <div style={{ backgroundColor: '#18181b' }} className="min-h-screen">
      <LogoHeader>
        <HamburgerMenu />
      </LogoHeader>
      <div className="max-w-4xl mx-auto w-full p-4 space-y-4">
        <div className="flex flex-col items-center gap-3 mb-4">
          <h1 className="text-2xl font-semibold text-white">Digest</h1>
          <p className="text-gray-400 text-sm text-center">
            Songs with recent activity (ratings, notes, comments, or responses)
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {/* Date Range Selector */}
          <div className="flex flex-col gap-3 p-4 rounded-lg" style={{ backgroundColor: '#27272a' }}>
            <label className="text-white font-semibold text-sm">Time Range</label>
            
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  id="days"
                  name="dateMode"
                  value="days"
                  checked={dateMode === 'days'}
                  onChange={(e) => setDateMode(e.target.value)}
                  className="text-blue-600"
                />
                <label htmlFor="days" className="text-white text-sm">Last</label>
                <select
                  value={days}
                  onChange={(e) => setDays(parseInt(e.target.value, 10))}
                  disabled={dateMode !== 'days'}
                  className="px-2 py-1 rounded bg-[#3f3f46] text-white text-sm border border-[#52525b] focus:outline-none focus:ring-1 focus:ring-blue-600 disabled:opacity-50"
                >
                  {[1, 2, 3, 4, 5, 6, 7].map(d => (
                    <option key={d} value={d}>{d} day{d !== 1 ? 's' : ''}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  id="customDays"
                  name="dateMode"
                  value="customDays"
                  checked={dateMode === 'customDays'}
                  onChange={(e) => setDateMode(e.target.value)}
                  className="text-blue-600"
                />
                <label htmlFor="customDays" className="text-white text-sm">Custom days:</label>
                <input
                  type="number"
                  min="1"
                  value={customDays}
                  onChange={(e) => setCustomDays(parseInt(e.target.value, 10) || 1)}
                  disabled={dateMode !== 'customDays'}
                  className="px-2 py-1 rounded bg-[#3f3f46] text-white text-sm border border-[#52525b] focus:outline-none focus:ring-1 focus:ring-blue-600 w-20 disabled:opacity-50"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  id="customDate"
                  name="dateMode"
                  value="customDate"
                  checked={dateMode === 'customDate'}
                  onChange={(e) => setDateMode(e.target.value)}
                  className="text-blue-600"
                />
                <label htmlFor="customDate" className="text-white text-sm">From date:</label>
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  disabled={dateMode !== 'customDate'}
                  className="px-2 py-1 rounded bg-[#3f3f46] text-white text-sm border border-[#52525b] focus:outline-none focus:ring-1 focus:ring-blue-600 disabled:opacity-50"
                />
              </div>
            </div>
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2">
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
                  className="absolute right-0 top-full mt-2 w-40 rounded shadow-lg z-10"
                  style={{ backgroundColor: '#27272a', border: '1px solid #3f3f46' }}
                >
                  <button
                    className={`block w-full text-left px-4 py-2 text-gray-200 hover:bg-[#3f3f46] ${sort === 'playlistOrder' ? 'font-bold' : ''}`}
                    onClick={() => { setSort('playlistOrder'); setSortDropdownOpen(false); }}
                  >Playlist Order</button>
                  <button
                    className={`block w-full text-left px-4 py-2 text-gray-200 hover:bg-[#3f3f46] ${sort === 'mostRecent' ? 'font-bold' : ''}`}
                    onClick={() => { setSort('mostRecent'); setSortDropdownOpen(false); }}
                  >Most Recent</button>
                  <button
                    className={`block w-full text-left px-4 py-2 text-gray-200 hover:bg-[#3f3f46] ${sort === 'leastRecent' ? 'font-bold' : ''}`}
                    onClick={() => { setSort('leastRecent'); setSortDropdownOpen(false); }}
                  >Least Recent</button>
                </div>
              )}
            </div>
            <span className="text-gray-400 text-sm">
              {sortedSongs.length} song{sortedSongs.length !== 1 ? 's' : ''} found
            </span>
          </div>
        </div>

        {/* Songs List */}
        {error && (
          <div className="text-red-400 p-4 rounded-lg bg-red-900 bg-opacity-20">
            Error loading digest: {error.message}
          </div>
        )}

        {!error && !songs && (
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
        )}

        {!error && songs && (
          <div className="space-y-4">
            {sortedSongs.length === 0 ? (
              <div className="text-gray-400 text-center p-8">
                No songs with activity in the selected time range.
              </div>
            ) : (
              sortedSongs.map(song => (
                <SongCard 
                  key={song.id} 
                  song={song} 
                  playlistName={song.playlist?.name || 'Unknown'} 
                  onSongUpdate={refreshDigest} 
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
