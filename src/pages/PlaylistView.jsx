import React from "react";
import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import SongCard from '../components/SongCard';
import HamburgerMenu from '../components/HamburgerMenu';
import LogoHeader from '../components/LogoHeader';

export default function PlaylistView() {
  const { id } = useParams();
  const [playlist, setPlaylist] = useState(null);
  const [sort, setSort] = useState('sortOrder');
  const [search, setSearch] = useState('');
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);

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
    <div className="bg-gray-900 min-h-screen">
      <LogoHeader>
        <HamburgerMenu />
      </LogoHeader>
      <div className="max-w-4xl mx-auto w-full p-4 space-y-4">
        <div className="flex flex-col items-center gap-3 mb-4">
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
                type="text"
                placeholder="Search songs..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full p-2 rounded bg-gray-800 text-white border border-gray-700 pr-8"
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
                type="button"
                className="flex items-center gap-1 px-2 py-1 rounded bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 focus:outline-none"
                onClick={() => setSortDropdownOpen((open) => !open)}
                title="Sort"
              >
                <img src="/sort_icon.svg" alt="Sort" className="w-5 h-5" style={{ filter: 'invert(80%)' }} />
              </button>
              {sortDropdownOpen && (
                <div className="absolute right-0 mt-2 w-36 bg-gray-800 border border-gray-700 rounded shadow-lg z-10">
                  <button
                    className={`block w-full text-left px-4 py-2 text-gray-200 hover:bg-gray-700 ${sort === 'sortOrder' ? 'font-bold' : ''}`}
                    onClick={() => { setSort('sortOrder'); setSortDropdownOpen(false); }}
                  >Sort Order</button>
                  <button
                    className={`block w-full text-left px-4 py-2 text-gray-200 hover:bg-gray-700 ${sort === 'title' ? 'font-bold' : ''}`}
                    onClick={() => { setSort('title'); setSortDropdownOpen(false); }}
                  >Title</button>
                  <button
                    className={`block w-full text-left px-4 py-2 text-gray-200 hover:bg-gray-700 ${sort === 'artist' ? 'font-bold' : ''}`}
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