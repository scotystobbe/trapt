import React from "react";
import { useState } from 'react';
import StarRating from './StarRating';
import { FaRegEdit } from 'react-icons/fa';

export default function SongCard({ song, playlistName }) {
  const [rating, setRating] = useState(song.rating);
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(song.notes || '');

  const handleNoteSave = () => {
    setEditing(false);
  };

  return (
    <div className="bg-gray-800 p-4 rounded-xl flex flex-col sm:flex-row gap-4">
      <div className="w-full sm:w-32 h-32 bg-gray-700 rounded-md flex-shrink-0"></div>
      <div className="flex-1">
        <h2 className="text-lg font-semibold">{song.title}</h2>
        <p className="text-sm text-gray-300">{song.artist}</p>
        <p className="text-sm text-gray-400 italic">{playlistName}</p>

        <div className="mt-2">
          <StarRating rating={rating} onRatingChange={setRating} />
        </div>

        <div className="mt-3 text-sm text-gray-300">
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
      </div>
    </div>
  );
}