import React, { useState, useEffect } from 'react';
import HamburgerMenu from '../components/HamburgerMenu';

function extractPlaylistId(url) {
  // Handles URLs like https://open.spotify.com/playlist/{id} or spotify:playlist:{id}
  const match = url.match(/playlist[/:]([a-zA-Z0-9]+)(\?.*)?$/);
  return match ? match[1] : null;
}

export default function Admin() {
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [playlistName, setPlaylistName] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [playlists, setPlaylists] = useState([]);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const handleFetch = async (e) => {
    e.preventDefault();
    setError('');
    setTracks([]);
    setPlaylistName('');
    setLoading(true);
    const playlistId = extractPlaylistId(playlistUrl);
    if (!playlistId) {
      setError('Invalid Spotify playlist URL');
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/spotify-proxy?playlistId=${playlistId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch playlist');
      setPlaylistName(data.name);
      setTracks(
        (data.tracks.items || []).map(item => ({
          title: item.track.name,
          artist: item.track.artists.map(a => a.name).join(', '),
          album: item.track.album.name,
          spotifyLink: item.track.external_urls.spotify,
          artworkUrl: item.track.album.images?.[0]?.url || null,
        }))
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    setError('');
    setImportResult(null);
    try {
      const res = await fetch('/api/import-playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlistName, songs: tracks }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to import');
      setImportResult({ success: true, count: data.songs.length });
    } catch (err) {
      setError(err.message);
      setImportResult({ success: false });
    } finally {
      setImporting(false);
    }
  };

  // Fetch playlists for admin delete section
  useEffect(() => {
    fetch('/api/playlists?admin=1')
      .then(res => res.json())
      .then(setPlaylists);
  }, [importResult, deletingId]);

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await fetch('/api/playlists', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      setConfirmDeleteId(null);
    } catch (err) {
      alert('Failed to delete playlist');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="p-6 max-w-xl mx-auto">
      <div className="flex justify-end mb-2">
        <HamburgerMenu />
      </div>
      <h1 className="text-2xl font-bold mb-4">Admin: Import Spotify Playlist</h1>
      <form onSubmit={handleFetch} className="flex flex-col gap-4 mb-6">
        <input
          type="text"
          placeholder="Paste Spotify playlist URL here..."
          value={playlistUrl}
          onChange={e => setPlaylistUrl(e.target.value)}
          className="p-2 rounded bg-gray-800 text-white border border-gray-700"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-green-600 rounded text-white hover:bg-green-500"
          disabled={loading || !playlistUrl.trim()}
        >
          {loading ? 'Fetching...' : 'Fetch Playlist'}
        </button>
      </form>
      {error && <div className="text-red-500 mb-4">{error}</div>}
      {tracks.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-2">Tracks to Import from <span className='italic'>{playlistName}</span></h2>
          <ul className="space-y-1 max-h-64 overflow-y-auto">
            {tracks.map((track, idx) => (
              <li key={idx}>{track.title} - {track.artist}</li>
            ))}
          </ul>
          <button className="mt-4 px-4 py-2 bg-blue-600 rounded text-white hover:bg-blue-500" onClick={handleImport} disabled={importing}>
            {importing ? 'Importing...' : 'Import to Database'}
          </button>
        </div>
      )}
      {importResult && importResult.success && (
        <div className="text-green-400 mt-4">Successfully imported {importResult.count} songs!</div>
      )}
      {importResult && !importResult.success && (
        <div className="text-red-500 mt-4">Failed to import playlist.</div>
      )}
      <div className="mt-10">
        <h2 className="text-lg font-bold mb-2">Delete Playlists</h2>
        <ul className="space-y-2">
          {playlists.map(p => (
            <li key={p.id} className="flex items-center gap-4">
              <span>{p.name}</span>
              {confirmDeleteId === p.id ? (
                <>
                  <button className="px-2 py-1 bg-red-600 text-white rounded" onClick={() => handleDelete(p.id)} disabled={deletingId === p.id}>Confirm Delete</button>
                  <button className="px-2 py-1 bg-gray-600 text-white rounded" onClick={() => setConfirmDeleteId(null)} disabled={deletingId === p.id}>Cancel</button>
                </>
              ) : (
                <button className="px-2 py-1 bg-red-600 text-white rounded" onClick={() => setConfirmDeleteId(p.id)} disabled={deletingId === p.id}>Delete All</button>
              )}
              {deletingId === p.id && <span className="ml-2 text-xs text-gray-400">Deleting...</span>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
} 