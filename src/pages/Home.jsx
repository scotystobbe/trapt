import React from "react";
import { useEffect, useState } from 'react';
import PlaylistCard from '../components/PlaylistCard';
import SongCard from '../components/SongCard';

export default function Home() {
  const [playlists, setPlaylists] = useState([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    fetch('/api/playlists')
      .then(res => res.json())
      .then(data => setPlaylists(data));
  }, []);

  const allSongs = playlists.flatMap(p => p.songs.map(s => ({ ...s, playlistName: p.name })));
  const filteredSongs = allSongs.filter(song =>
    song.title.toLowerCase().includes(query.toLowerCase()) ||
    song.artist.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-3xl font-bold text-center">My Playlists</h1>

      <input
        type="text"
        placeholder="Global song search..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full p-2 rounded bg-gray-800 text-white border border-gray-700"
      />

      {query.trim() ? (
        <div className="space-y-4">
          {filteredSongs.length === 0 && <p className="text-gray-400">No matching songs found.</p>}
          {filteredSongs.map(song => (
            <SongCard key={song.id} song={song} playlistName={song.playlistName} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {playlists.map(playlist => (
            <PlaylistCard key={playlist.id} playlist={playlist} />
          ))}
        </div>
      )}
    </div>
  );
}