import React from "react";
import { Link } from 'react-router-dom';

export default function PlaylistCard({ playlist }) {
  return (
    <Link to={`/browse/playlist/${playlist.id}`} className="block" style={{ backgroundColor: '#27272a', borderRadius: '0.75rem', padding: '1rem', transition: 'background 0.2s' }}>
      {playlist.artworkUrl ? (
        <img src={playlist.artworkUrl} alt={playlist.name} className="aspect-square w-full rounded-md mb-2 object-cover" />
      ) : (
        <div style={{ backgroundColor: '#3f3f46' }} className="aspect-square rounded-md mb-2"></div>
      )}
      <h2 className="text-lg font-semibold text-white">{playlist.name}</h2>
      {Array.isArray(playlist.songs) && playlist.songs.length > 0 && (
        (() => {
          const rated = playlist.songs.filter(s => s.rating != null && s.rating !== 0);
          const ratedCount = rated.length;
          const totalCount = playlist.songs.length;
          const avg = ratedCount > 0 ? (rated.reduce((sum, s) => sum + s.rating, 0) / ratedCount).toFixed(2) : null;
          return (
            <div className="text-gray-400 text-sm mt-1">
              {ratedCount}/{totalCount} rated{avg ? `  Avg: ${avg}` : ''}
            </div>
          );
        })()
      )}
    </Link>
  );
}