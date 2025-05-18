import React from "react";
import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import SongCard from '../components/SongCard';
import HamburgerMenu from '../components/HamburgerMenu';

export default function PlaylistView() {
  const { id } = useParams();
  const [playlist, setPlaylist] = useState(null);
  const [sort, setSort] = useState('sortOrder');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/playlists')
      .then(res => res.json())
      .then(data => {
        const p = data.find(p => p.id === parseInt(id));
        setPlaylist(p);
      });
  }, [id]);

  const refreshPlaylist = () => {
    fetch('/api/playlists')
      .then(res => res.json())
      .then(data => {
        const p = data.find(p => p.id === parseInt(id));
        setPlaylist(p);
      });
  };

  if (!playlist) return <div className="p-4">Loading...</div>;

  const sortedSongs = [...playlist.songs]
    .filter(song => song.title.toLowerCase().includes(search.toLowerCase()) || song.artist.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title);
      if (sort === 'artist') return a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title);
      return a.sortOrder - b.sortOrder;
    });

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-end mb-2">
        <HamburgerMenu />
      </div>
      <h1 className="text-2xl font-bold text-center">{playlist.name} <span className="text-base font-normal text-gray-400">({playlist.songs.length} tracks)</span></h1>
      <div className="flex flex-col sm:flex-row items-center gap-2 justify-between">
        <input
          type="text"
          placeholder="Search songs..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full sm:w-1/2 p-2 rounded bg-gray-800 text-white border border-gray-700"
        />
        <select
          value={sort}
          onChange={e => setSort(e.target.value)}
          className="p-2 rounded bg-gray-800 text-white border border-gray-700"
        >
          <option value="sortOrder">Sort Order</option>
          <option value="title">Title</option>
          <option value="artist">Artist</option>
        </select>
      </div>
      <div className="space-y-4">
        {sortedSongs.map(song => (
          <SongCard key={song.id} song={song} playlistName={playlist.name} onSongUpdate={refreshPlaylist} />
        ))}
      </div>
    </div>
  );
}