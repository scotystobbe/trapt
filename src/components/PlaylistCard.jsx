import React from "react";
import { Link } from 'react-router-dom';

export default function PlaylistCard({ playlist }) {
  return (
    <Link to={`/playlist/${playlist.id}`} className="block bg-gray-800 p-4 rounded-xl hover:bg-gray-700 transition">
      {playlist.artworkUrl ? (
        <img src={playlist.artworkUrl} alt={playlist.name} className="aspect-square w-full rounded-md mb-2 object-cover" />
      ) : (
        <div className="aspect-square bg-gray-700 rounded-md mb-2"></div>
      )}
      <h2 className="text-lg font-semibold">{playlist.name}</h2>
    </Link>
  );
}