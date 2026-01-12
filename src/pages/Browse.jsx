import React, { useState } from "react";
import PlaylistCard from '../components/PlaylistCard';
import HamburgerMenu from '../components/HamburgerMenu';
import LogoHeader from '../components/LogoHeader';
import Skeleton from '../components/Skeleton';
import SongCard from '../components/SongCard';
import useSWR from 'swr';
import { useAuth } from '../components/AuthProvider';

export default function Browse() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all'); // 'all', 'withComments', 'withResponses'

  const fetcher = url => fetch(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now()).then(res => res.json());
  const { data: playlists = [], error } = useSWR('/api/playlists', fetcher);

  const allSongs = playlists.flatMap(playlist =>
    (playlist.songs || [])
      .map(song => ({ ...song, playlistName: playlist.name, playlistId: playlist.id }))
  );

  // Apply filters
  let filteredByComments = allSongs;
  if (filter === 'withComments') {
    filteredByComments = allSongs.filter(song => song.hasComments);
  } else if (filter === 'withResponses' && isAdmin) {
    filteredByComments = allSongs.filter(song => song.hasResponses);
  }

  const filteredSongs = query
    ? filteredByComments.filter(song =>
        song.title?.toLowerCase().includes(query.toLowerCase()) ||
        song.artist?.toLowerCase().includes(query.toLowerCase())
      )
    : filteredByComments;

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
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <div className="relative w-full sm:w-80">
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
                className="absolute right-2 top-1/2 -translate-y-1/2 z-20 text-gray-400 hover:text-white focus:outline-none"
                aria-label="Clear search"
              >
                <span className="flex items-center justify-center min-w-[32px] min-h-[32px] p-1 text-xl">×</span>
              </button>
            )}
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
            {isAdmin && (
              <button
                onClick={() => setFilter('withResponses')}
                className={`px-4 py-2 rounded text-sm ${
                  filter === 'withResponses'
                    ? 'bg-blue-600 text-white'
                    : 'bg-[#27272a] text-gray-300 hover:bg-[#3f3f46]'
                }`}
              >
                With Responses
              </button>
            )}
          </div>
        </div>
        {(filter !== 'all' || query) && (
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-white mb-2">
              {query ? `Songs matching "${query}"` : 
               filter === 'withComments' ? 'Songs with Comments' :
               filter === 'withResponses' ? 'Songs with Responses' : 'Songs'}
              {filteredSongs.length > 0 && ` (${filteredSongs.length})`}
            </h2>
            {filteredSongs.length > 0 ? (
              filteredSongs.map((song, idx) => (
                <SongCard key={song.id + '-' + song.playlistId} song={song} playlistName={song.playlistName} />
              ))
            ) : (
              <div className="text-gray-400 text-center py-8">
                No songs found matching the current filter.
              </div>
            )}
          </div>
        )}
        {filter === 'all' && !query && (
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