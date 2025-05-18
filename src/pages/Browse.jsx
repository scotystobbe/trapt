import React, { useEffect, useState } from "react";
import PlaylistCard from '../components/PlaylistCard';
import HamburgerMenu from '../components/HamburgerMenu';
import LogoHeader from '../components/LogoHeader';

export default function Browse() {
  const [playlists, setPlaylists] = useState([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    fetch('/api/playlists')
      .then(res => res.json())
      .then(data => setPlaylists(data));
  }, []);

  const filteredPlaylists = playlists.filter(p =>
    p.name.toLowerCase().includes(query.toLowerCase())
  );

  const sortedPlaylists = [...filteredPlaylists].sort((a, b) => b.name.localeCompare(a.name));

  return (
    <div className="bg-gray-900 min-h-screen">
      <LogoHeader>
        <HamburgerMenu />
      </LogoHeader>
      <div className="max-w-4xl mx-auto w-full p-4 space-y-6">
        <div className="relative w-full sm:w-80 mx-auto">
          <input
            type="text"
            placeholder="Search playlists..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full p-2 rounded bg-gray-800 text-white border border-gray-700 pr-8"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-20 text-gray-400 hover:text-white focus:outline-none text-xl"
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {sortedPlaylists.map(playlist => (
            <PlaylistCard key={playlist.id} playlist={playlist} />
          ))}
        </div>
      </div>
    </div>
  );
} 