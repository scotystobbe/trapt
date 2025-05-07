import React, { useEffect, useState } from "react";
import { Input } from "../components/ui/input";
import AlbumCard from "../components/AlbumCard";
import SpotifyStatus from "../components/SpotifyStatus";
import NowPlaying from "../components/NowPlaying";
import { useSpotifyAuth } from "../hooks/useSpotifyAuth";
import Fuse from "fuse.js";
import { useNowPlaying } from "../hooks/useSpotifyNowPlaying";

// Utility to normalize titles for flexible search
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\([^)]*\)/g, "") // Remove parentheticals
    .replace(/[^a-z0-9\s]/gi, "") // Remove punctuation
    .replace(/\s+/g, " ") // Collapse whitespace
    .trim();
}

// Type for track with optional searchAliases
interface Track {
  title: string;
  type: string;
  originalSong?: string;
  originalArtist?: string;
  searchAliases?: string[];
  [key: string]: any;
}

export default function Home() {
  const [searchTerm, setSearchTerm] = useState("");
  const [albumSort, setAlbumSort] = useState<'year' | 'alpha'>("year");
  const [trackSort, setTrackSort] = useState<'original' | 'alpha'>("original");
  const [showFilters, setShowFilters] = useState(false);
  const [useSpotifySearch, setUseSpotifySearch] = useState(() => {
    const stored = localStorage.getItem('useSpotifySearch');
    return stored === null ? true : stored === 'true';
  });
  const [albums, setAlbums] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const { token } = useSpotifyAuth();
  const { track, isPlaying } = useNowPlaying(token);

  // Handle toggle: fill or clear search box on toggle
  const handleToggle = () => {
    const newValue = !useSpotifySearch;
    setUseSpotifySearch(newValue);
    if (newValue) {
      if (track?.title) setSearchTerm(track.title);
    } else {
      setSearchTerm("");
    }
  };

  // Autofill search term and trigger search when track updates or playback state changes
  useEffect(() => {
    if (useSpotifySearch) {
      if (track?.title) {
        setSearchTerm(track.title);
      } else {
        setSearchTerm("");
      }
    }
  }, [track, isPlaying, useSpotifySearch]);

  // Ensure search box is always in sync with Spotify track every second
  useEffect(() => {
    if (!useSpotifySearch) return;
    const interval = setInterval(() => {
      if (useSpotifySearch) {
        if (track?.title && searchTerm !== track.title) {
          setSearchTerm(track.title);
        } else if (!track?.title && searchTerm !== "") {
          setSearchTerm("");
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [useSpotifySearch, track?.title, searchTerm]);

  // Persist toggle
  useEffect(() => {
    localStorage.setItem('useSpotifySearch', useSpotifySearch ? 'true' : 'false');
  }, [useSpotifySearch]);

  useEffect(() => {
    fetch('/api/albums')
      .then(res => res.json())
      .then(data => {
        setAlbums(data);
        setLoading(false);
      });
  }, []);

  let filteredAlbums: any[] = [];
  if (searchTerm) {
    const lowerSearch = searchTerm.toLowerCase();
    filteredAlbums = albums
      .map(album => {
        const matchingTracks = album.tracks.filter((track: any) =>
          track.title.toLowerCase().includes(lowerSearch) ||
          (track.searchAliases && track.searchAliases.some((alias: string) => alias.toLowerCase().includes(lowerSearch)))
        );
        return {
          ...album,
          tracks: matchingTracks,
        };
      })
      .filter(album => album.tracks.length > 0);
  } else {
    filteredAlbums = albums;
  }

  // Sort albums
  filteredAlbums = [...filteredAlbums].sort((a, b) => {
    if (albumSort === "year") {
      return a.year - b.year;
    } else {
      const aSort = a.sortTitle || a.title;
      const bSort = b.sortTitle || b.title;
      return aSort.localeCompare(bSort);
    }
  });

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <div className="rainbow-spinner" />
      <style>{`
        .rainbow-spinner {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: conic-gradient(
            red,
            orange,
            yellow,
            lime,
            cyan,
            blue,
            magenta,
            red
          );
          mask-image: radial-gradient(circle at center, transparent 50%, black 52%);
          -webkit-mask-image: radial-gradient(circle at center, transparent 50%, black 52%);
          animation: spin 1s linear infinite;
          box-shadow: 0 0 20px 4px rgba(255, 255, 255, 0.2),
                      0 0 40px 8px rgba(255, 255, 255, 0.1) inset;
        }
  
        @keyframes spin {
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
  

  return (
    <div className="p-4 max-w-screen-md mx-auto">
      <h1 className="text-2xl font-extrabold text-center text-gray-900 dark:text-white mb-4 whitespace-nowrap overflow-hidden text-ellipsis">
        Weird Al Discography
      </h1>

      <SpotifyStatus />
      <NowPlaying />
      <div className="relative mb-4 flex items-center gap-x-4">
        <div className={`relative ${searchTerm ? 'flex-1' : ''} w-full`}>
          {/* Search icon inside input */}
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z" />
            </svg>
          </span>
          <Input
            placeholder="Search..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 focus:outline-none"
              aria-label="Clear search"
              tabIndex={0}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm2.83-10.83a1 1 0 00-1.41 0L10 8.59 8.59 7.17a1 1 0 10-1.41 1.41L8.59 10l-1.41 1.41a1 1 0 101.41 1.41L10 11.41l1.41 1.41a1 1 0 001.41-1.41L11.41 10l1.41-1.41a1 1 0 000-1.42z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>
        {/* Sort icon only visible when searchTerm is empty, placed before the toggle */}
        {!searchTerm && (
          <button
            type="button"
            onClick={() => setShowFilters(f => !f)}
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none"
            aria-label="Show sorting options"
          >
            {/* Inline sort_icon.svg, theme-aware color */}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-6 w-6 text-gray-500 dark:text-gray-300" fill="currentColor">
              <path d="M9.25,5L12.5,1.75L15.75,5H9.25M15.75,19L12.5,22.25L9.25,19H15.75M8.89,14.3H6L5.28,17H2.91L6,7H9L12.13,17H9.67L8.89,14.3M6.33,12.68H8.56L7.93,10.56L7.67,9.59L7.42,8.63H7.39L7.17,9.6L6.93,10.58L6.33,12.68M13.05,17V15.74L17.8,8.97V8.91H13.5V7H20.73V8.34L16.09,15V15.08H20.8V17H13.05Z" />
            </svg>
          </button>
        )}
        {/* Spotify toggle switch always visible, now always last */}
        <div className="flex items-center">
          <button
            type="button"
            onClick={handleToggle}
            aria-pressed={useSpotifySearch}
            title="Toggle using Spotify track as search"
            className="relative w-14 h-8 flex items-center focus:outline-none"
          >
            {/* Track */}
            <span className={`absolute left-0 top-0 w-full h-full rounded-full transition-colors duration-200 ${useSpotifySearch ? 'bg-[#1dd65f]' : 'bg-gray-300 dark:bg-gray-700'}`}></span>
            {/* Thumb */}
            <span
              className={`absolute top-1 left-1 w-6 h-6 rounded-full border-2 border-black flex items-center justify-center transition-transform duration-200 bg-transparent shadow-none ${useSpotifySearch ? 'translate-x-6' : ''}`}
            >
              <img
                src="/spotify_icon.png"
                alt="Spotify"
                className={`h-5 w-5 transition duration-200 ${useSpotifySearch ? '' : 'opacity-50 grayscale'}`}
              />
            </span>
            {/* Label (visually hidden for accessibility) */}
            <span className="sr-only">Toggle Spotify search</span>
          </button>
        </div>
      </div>
      {showFilters && (
        <div className="flex gap-4 mb-4">
          <label className="flex items-center gap-2 text-sm">
            Album Sort:
            <select value={albumSort} onChange={e => setAlbumSort(e.target.value as 'year' | 'alpha')} className="border rounded px-2 py-1 bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700">
              <option value="year">Year</option>
              <option value="alpha">A-Z</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            Track Sort:
            <select value={trackSort} onChange={e => setTrackSort(e.target.value as 'original' | 'alpha')} className="border rounded px-2 py-1 bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700">
              <option value="original">Original</option>
              <option value="alpha">A-Z</option>
            </select>
          </label>
        </div>
      )}
      <div className="space-y-4">
        {filteredAlbums.map(album => (
          <AlbumCard
            key={album.title}
            album={album}
            searchTerm={searchTerm}
            trackSort={trackSort}
          />
        ))}
      </div>
    </div>
  );
}
