import React from "react";
import { useState } from 'react';
import StarRating from './StarRating';
import { FaRegEdit } from 'react-icons/fa';

export default function SongCard({ song, playlistName, onSongUpdate }) {
  const [rating, setRating] = useState(song.rating);
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(song.notes || '');
  const [error, setError] = useState('');

  const saveSongUpdate = async (fields) => {
    setError('');
    try {
      const res = await fetch('/api/songs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: song.id, ...fields }),
      });
      if (!res.ok) throw new Error('Failed to save');
      if (onSongUpdate) onSongUpdate();
    } catch (err) {
      setError('Could not save changes.');
    }
  };

  const handleRatingChange = (newRating) => {
    if (newRating === 1 && rating === 1) {
      setRating(null);
      saveSongUpdate({ rating: null });
    } else {
      setRating(newRating);
      saveSongUpdate({ rating: newRating });
    }
  };

  const handleNoteSave = () => {
    setEditing(false);
    saveSongUpdate({ notes });
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
            <h2 className="text-lg font-semibold text-white">{song.title}</h2>
            <p className="text-sm text-gray-300">{song.artist}</p>
            <p className="text-sm text-gray-400 italic">{playlistName}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-2">
          <div className="flex items-center">
            <StarRating rating={rating} onRatingChange={handleRatingChange} size={32} />
          </div>
          <div className="text-sm text-gray-300">
            {editing ? (
              <div className="flex flex-col gap-2">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-2 rounded bg-gray-900 border border-gray-700 text-white"
                />
                <button
                  onClick={handleNoteSave}
                  className="self-end px-3 py-1 bg-blue-600 rounded hover:bg-blue-500"
                >Save</button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="whitespace-pre-wrap flex-1">{notes || <em>No notes</em>}</p>
                <button onClick={() => setEditing(true)} className="ml-2 text-gray-400 hover:text-white">
                  <FaRegEdit />
                </button>
              </div>
            )}
          </div>
          {error && <div className="text-red-500 text-xs mt-1">{error}</div>}
        </div>
      </div>
    </div>
  );
}