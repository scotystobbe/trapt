import React from "react";
import { useState } from 'react';
import StarRating from './StarRating';
import { FaRegEdit } from 'react-icons/fa';
import { mutate } from 'swr';
import { SiGenius } from 'react-icons/si';
import { useAuth } from './AuthProvider';

export default function SongCard({ song, playlistName, onSongUpdate }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [rating, setRating] = useState(song.rating);
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(song.notes || '');
  const [error, setError] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');

  const saveSongUpdate = async (fields) => {
    if (!isAdmin) return;
    setError('');
    try {
      const res = await fetch('/api/songs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: song.id, ...fields }),
      });
      if (!res.ok) throw new Error('Failed to save');
      if (onSongUpdate) onSongUpdate();
      mutate('/api/playlists');
    } catch (err) {
      setError('Could not save changes.');
    }
  };

  const handleRatingChange = (newRating) => {
    if (!isAdmin) return;
    if (newRating === 1 && rating === 1) {
      setRating(null);
      saveSongUpdate({ rating: null });
    } else {
      setRating(newRating);
      saveSongUpdate({ rating: newRating });
    }
  };

  const handleNoteSave = () => {
    if (!isAdmin) return;
    setEditing(false);
    saveSongUpdate({ notes });
  };

  // Add helper function to open Genius app or fallback to web
  function openGeniusAppOrWeb(songId, webUrl) {
    const appUrl = `genius://songs/${songId}`;
    const timeout = setTimeout(() => {
      window.open(webUrl, '_blank', 'noopener,noreferrer');
    }, 800);
    window.location = appUrl;
    window.addEventListener('pagehide', () => clearTimeout(timeout), { once: true });
  }

  const handleGeniusClick = async (e) => {
    e.preventDefault();
    setSearchLoading(true);
    setSearchError('');
    setShowResults(false);
    try {
      const q = encodeURIComponent(`${song.artist} ${song.title}`);
      const res = await fetch(`/api/genius?action=search&q=${q}`);
      if (!res.ok) throw new Error('Search failed');
      const hits = await res.json();
      // Try to find an exact match
      const exact = hits.find(h => {
        const t = h.result.title.trim().toLowerCase();
        const a = h.result.primary_artist.name.trim().toLowerCase();
        return t === song.title.trim().toLowerCase() && a === song.artist.trim().toLowerCase();
      });
      if (exact) {
        openGeniusAppOrWeb(exact.result.id, exact.result.url);
      } else {
        setSearchResults(hits);
        setShowResults(true);
      }
    } catch (err) {
      setSearchError('Could not search Genius.');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleResultClick = (hit) => {
    openGeniusAppOrWeb(hit.result.id, hit.result.url);
    setShowResults(false);
  };

  return (
    <div style={{ backgroundColor: '#27272a' }} className="p-4 rounded-xl flex flex-row gap-4 items-start">
      <div className="flex-shrink-0 w-24 h-24 rounded-md overflow-hidden flex items-center justify-center" style={{ backgroundColor: '#3f3f46' }}>
        {song.artworkUrl ? (
          <img src={song.artworkUrl} alt={song.title} className="object-cover w-full h-full" />
        ) : (
          <span className="text-gray-400">No Art</span>
        )}
      </div>
      <div className="flex-1 flex flex-col justify-between w-full">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-white">{song.title}</h2>
              <button
                onClick={handleGeniusClick}
                title="View on Genius"
                className="text-yellow-400 hover:text-yellow-300 text-xl"
                disabled={searchLoading}
              >
                <SiGenius />
              </button>
            </div>
            <p className="text-sm text-gray-300">{song.artist}</p>
            <p className="text-sm text-gray-400 italic">{playlistName}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-2">
          <div className="flex items-center">
            <StarRating rating={rating} onRatingChange={isAdmin ? handleRatingChange : undefined} size={32} />
          </div>
          <div className="text-sm text-gray-300">
            {editing ? (
              <div className="flex flex-col gap-2">
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full p-2 rounded bg-gray-900 border border-gray-700 text-white"
                  disabled={!isAdmin}
                />
                {isAdmin && (
                  <button
                    onClick={handleNoteSave}
                    className="self-end px-3 py-1 bg-blue-600 rounded hover:bg-blue-500"
                  >Save</button>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className={`whitespace-pre-wrap flex-1 ${notes ? '' : 'text-gray-500'}`}>{notes || <em>No notes</em>}</p>
                {isAdmin && (
                  <button onClick={() => setEditing(true)} className="ml-2 text-gray-400 hover:text-white">
                    <FaRegEdit />
                  </button>
                )}
              </div>
            )}
          </div>
          {error && <div className="text-red-500 text-xs mt-1">{error}</div>}
        </div>
        {showResults && (
          <div className="absolute z-50 bg-zinc-900 border border-yellow-400 rounded shadow-lg mt-2 p-4 w-80">
            <div className="text-gray-300 mb-2">Select the correct song:</div>
            {searchError && <div className="text-red-500 mb-2">{searchError}</div>}
            <ul className="space-y-2 max-h-60 overflow-y-auto">
              {searchResults.map(hit => (
                <li key={hit.result.id} className="flex items-center gap-2 bg-zinc-800 rounded p-2 cursor-pointer hover:bg-zinc-700" onClick={() => handleResultClick(hit)}>
                  {hit.result.song_art_image_thumbnail_url && (
                    <img src={hit.result.song_art_image_thumbnail_url} alt="art" className="w-10 h-10 rounded" />
                  )}
                  <div>
                    <div className="text-white font-semibold">{hit.result.title}</div>
                    <div className="text-gray-400 text-sm">{hit.result.primary_artist.name}</div>
                  </div>
                </li>
              ))}
            </ul>
            <button onClick={() => setShowResults(false)} className="mt-2 px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600">Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}