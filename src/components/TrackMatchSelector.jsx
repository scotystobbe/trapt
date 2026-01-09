import React, { useState } from 'react';
import Button from './Button';
import { FaSearch, FaTimes, FaMusic } from 'react-icons/fa';

export default function TrackMatchSelector({ appleTrack, suggestions, onConfirm, onSkip }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      const res = await fetch('/api/apple-music/search-spotify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery }),
      });

      const data = await res.json();

      if (res.status === 401 && (data.code === 'SPOTIFY_AUTH_REQUIRED' || data.code === 'SPOTIFY_AUTH_EXPIRED')) {
        alert('Spotify authentication required. Please log in to Spotify first.');
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || 'Search failed');
      }

      setSearchResults(data.tracks || []);
    } catch (err) {
      console.error('Search error:', err);
      alert('Search failed: ' + err.message);
    } finally {
      setSearching(false);
    }
  };

  const formatDuration = (ms) => {
    if (!ms) return 'Unknown';
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleSelect = (track) => {
    onConfirm(track);
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      {/* Apple Music Track Info */}
      <div className="mb-3 pb-3 border-b border-gray-700">
        <div className="flex items-start gap-3">
          {appleTrack.artworkUrl ? (
            <img
              src={appleTrack.artworkUrl}
              alt={appleTrack.title}
              className="w-16 h-16 rounded object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-16 h-16 rounded bg-gray-700 flex items-center justify-center flex-shrink-0">
              <FaMusic className="text-gray-500" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm text-gray-400 mb-1">#{appleTrack.position} - Apple Music</div>
            <h4 className="font-semibold text-white truncate">{appleTrack.title}</h4>
            <p className="text-sm text-gray-300 truncate">{appleTrack.artist}</p>
            {appleTrack.album && (
              <p className="text-xs text-gray-400 truncate">{appleTrack.album}</p>
            )}
          </div>
        </div>
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && !showSearch && (
        <div className="mb-3">
          <div className="text-sm font-medium text-gray-300 mb-2">Spotify Suggestions:</div>
          <div className="space-y-2">
            {suggestions.map((track, idx) => (
              <button
                key={track.id}
                onClick={() => handleSelect(track)}
                className="w-full text-left bg-gray-900 hover:bg-gray-700 rounded p-3 transition flex items-center gap-3"
              >
                {track.images && track.images.length > 0 ? (
                  <img
                    src={track.images[0].url}
                    alt={track.name}
                    className="w-12 h-12 rounded object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded bg-gray-700 flex items-center justify-center flex-shrink-0">
                    <FaMusic className="text-gray-500" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-white truncate">{track.name}</div>
                  <div className="text-sm text-gray-300 truncate">
                    {track.artists.map(a => a.name).join(', ')}
                  </div>
                  <div className="text-xs text-gray-400">
                    {track.album?.name} • {formatDuration(track.duration_ms)}
                  </div>
                </div>
                {track.matchScore && (
                  <div className="text-xs text-gray-500">
                    {Math.round(track.matchScore * 100)}% match
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Manual Search */}
      {showSearch && (
        <div className="mb-3 space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              className="flex-1 px-3 py-2 rounded bg-gray-900 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-600"
              placeholder="Search Spotify..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && handleSearch()}
            />
            <Button
              variant="primary"
              onClick={handleSearch}
              disabled={searching || !searchQuery.trim()}
            >
              {searching ? '...' : <FaSearch />}
            </Button>
            <Button variant="secondary" onClick={() => {
              setShowSearch(false);
              setSearchQuery('');
              setSearchResults([]);
            }}>
              <FaTimes />
            </Button>
          </div>

          {searchResults.length > 0 && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {searchResults.map((track) => (
                <button
                  key={track.id}
                  onClick={() => handleSelect(track)}
                  className="w-full text-left bg-gray-900 hover:bg-gray-700 rounded p-3 transition flex items-center gap-3"
                >
                  {track.images && track.images.length > 0 ? (
                    <img
                      src={track.images[0].url}
                      alt={track.name}
                      className="w-12 h-12 rounded object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded bg-gray-700 flex items-center justify-center flex-shrink-0">
                      <FaMusic className="text-gray-500" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-white truncate">{track.name}</div>
                    <div className="text-sm text-gray-300 truncate">
                      {track.artists.map(a => a.name).join(', ')}
                    </div>
                    <div className="text-xs text-gray-400">
                      {track.album?.name} • {formatDuration(track.duration_ms)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {!showSearch && (
          <>
            {suggestions.length === 0 && (
              <Button
                variant="primary"
                onClick={() => setShowSearch(true)}
                className="flex-1"
              >
                <FaSearch className="mr-2" />
                Search Spotify
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={onSkip}
            >
              Skip
            </Button>
          </>
        )}
      </div>
    </div>
  );
}




