import React, { useState } from 'react';

export default function GeniusLyricsModal({ open, onClose, songTitle, songArtist }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);

  React.useEffect(() => {
    if (open && songTitle && songArtist) {
      setSearchResults([]);
      setError('');
      setSearchPerformed(false);
      setNeedsAuth(false);
      searchGenius();
    }
    // eslint-disable-next-line
  }, [open, songTitle, songArtist]);

  async function searchGenius() {
    setLoading(true);
    setError('');
    setNeedsAuth(false);
    try {
      const q = encodeURIComponent(`${songArtist} ${songTitle}`);
      const res = await fetch(`/api/genius?action=search&q=${q}`);
      if (res.status === 401) {
        setNeedsAuth(true);
        setError('You need to log in with Genius to view lyrics.');
        return;
      }
      if (!res.ok) throw new Error('Search failed');
      const hits = await res.json();
      setSearchPerformed(true);
      // Try to find an exact match
      const exact = hits.find(h => {
        const t = h.result.title.trim().toLowerCase();
        const a = h.result.primary_artist.name.trim().toLowerCase();
        return t === songTitle.trim().toLowerCase() && a === songArtist.trim().toLowerCase();
      });
      if (exact) {
        window.open(`/genius-embed/${exact.result.id}`, '_blank', 'noopener,noreferrer');
        onClose();
      } else {
        setSearchResults(hits);
      }
    } catch (err) {
      setError('Could not search Genius.');
    } finally {
      setLoading(false);
    }
  }

  function handleResultClick(songId) {
    window.open(`/genius-embed/${songId}`, '_blank', 'noopener,noreferrer');
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
      <div className="bg-zinc-900 rounded-lg shadow-lg p-6 max-w-lg w-full relative">
        <button onClick={onClose} className="absolute top-2 right-2 text-gray-400 hover:text-white text-2xl">&times;</button>
        <h2 className="text-xl font-bold mb-4 text-white">Genius Lyrics</h2>
        {loading && <div className="text-gray-300">Loading...</div>}
        {error && <div className="text-red-500 mb-2">{error}</div>}
        {!loading && searchResults.length > 0 && (
          <div>
            <div className="text-gray-300 mb-2">Select the correct song:</div>
            <ul className="space-y-2">
              {searchResults.map(hit => (
                <li key={hit.result.id} className="flex items-center gap-2 bg-zinc-800 rounded p-2 cursor-pointer hover:bg-zinc-700" onClick={() => handleResultClick(hit.result.id)}>
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
          </div>
        )}
        {!loading && searchPerformed && searchResults.length === 0 && (
          <div className="text-gray-400">No results found.</div>
        )}
        {needsAuth && (
          <div className="mb-4">
            <a href="/api/genius?action=auth" className="px-4 py-2 bg-yellow-400 text-black rounded font-bold hover:bg-yellow-300 transition">Login with Genius</a>
          </div>
        )}
      </div>
    </div>
  );
} 