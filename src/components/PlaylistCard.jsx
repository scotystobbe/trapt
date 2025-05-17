import React from "react";
import { Link } from 'react-router-dom';

export default function PlaylistCard({ playlist }) {
  return (
    <Link to={`/playlist/${playlist.id}`} className="block bg-gray-800 p-4 rounded-xl hover:bg-gray-700 transition">
      <div className="aspect-square bg-gray-700 rounded-md mb-2"></div>
      <h2 className="text-lg font-semibold">{playlist.name}</h2>
    </Link>
  );
}