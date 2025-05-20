import React, { useEffect, useState } from "react";
import PlaylistCard from '../components/PlaylistCard';
import HamburgerMenu from '../components/HamburgerMenu';
import LogoHeader from '../components/LogoHeader';
import Skeleton from '../components/Skeleton';
import SongCard from '../components/SongCard';

export default function Browse() {
  const [playlists, setPlaylists] = useState([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    fetch('/api/playlists')
      .then(res => res.json())
      .then(data => setPlaylists(data));
  }, []);

  const filteredSongs = query
    ? playlists.flatMap(playlist =>
        (playlist.songs || [])
          .filter(song =>
            song.title?.toLowerCase().includes(query.toLowerCase()) ||
            song.artist?.toLowerCase().includes(query.toLowerCase())
          )
          .map(song => ({ ...song, playlistName: playlist.name, playlistId: playlist.id }))
      )
    : [];

  const filteredPlaylists = playlists.filter(p => {
    const q = query.toLowerCase();
    if (p.name.toLowerCase().includes(q)) return true;
    if (Array.isArray(p.songs)) {
      return p.songs.some(song =>
        song.title?.toLowerCase().includes(q) ||
        song.artist?.toLowerCase().includes(q)
      );
    }
    return false;
  });

  const sortedPlaylists = [...filteredPlaylists].sort((a, b) => b.name.localeCompare(a.name));

  return (
    <div style={{ backgroundColor: '#18181b' }} className="min-h-screen">
      <LogoHeader>
        <HamburgerMenu />
      </LogoHeader>
      <div className="max-w-4xl mx-auto w-full p-4 space-y-6">
        <div className="relative w-full sm:w-80 mx-auto">
          <input
            type="text"
            placeholder="Search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full p-2 rounded" style={{ backgroundColor: '#27272a', color: 'white', border: '1px solid #3f3f46' }}
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
        {query && filteredSongs.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-white mb-2">Songs matching "{query}"</h2>
            {filteredSongs.map((song, idx) => (
              <SongCard key={song.id + '-' + song.playlistId} song={song} playlistName={song.playlistName} />
            ))}
          </div>
        )}
        {(!query || filteredSongs.length === 0) && (
          <div>
            <h2 className="text-lg font-bold text-white mb-2">Playlists</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {playlists.length === 0 ? (
                [...Array(6)].map((_, i) => (
                  <div key={i} style={{ backgroundColor: '#27272a' }} className="p-4 rounded-xl">
                    <Skeleton className="aspect-square w-full rounded-md mb-2" />
                    <Skeleton className="h-6 w-3/4" />
                  </div>
                ))
              ) : (
                sortedPlaylists.map(playlist => (
                  <PlaylistCard key={playlist.id} playlist={playlist} />
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 