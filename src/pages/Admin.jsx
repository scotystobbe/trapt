import React, { useState, useEffect } from 'react';
import HamburgerMenu from '../components/HamburgerMenu';
import LogoHeader from '../components/LogoHeader';
import { FaTrash } from 'react-icons/fa';
import Skeleton from '../components/Skeleton';

function extractPlaylistId(url) {
  // Handles URLs like https://open.spotify.com/playlist/{id} or spotify:playlist:{id}
  const match = url.match(/playlist[/:]([a-zA-Z0-9]+)(\?.*)?$/);
  return match ? match[1] : null;
}

function normalizeSpotifyPlaylistUrl(url) {
  return url.split('?')[0];
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
  const [existingPlaylist, setExistingPlaylist] = useState(null);
  const [playlistArtworkUrl, setPlaylistArtworkUrl] = useState(null);

  const handleFetch = async (e) => {
    e.preventDefault();
    setError('');
    setTracks([]);
    setPlaylistName('');
    setLoading(true);
    setExistingPlaylist(null);
    const normalizedUrl = normalizeSpotifyPlaylistUrl(playlistUrl);
    const playlistId = extractPlaylistId(normalizedUrl);
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
      setPlaylistArtworkUrl(data.images?.[0]?.url || null);
      setTracks(
        (data.tracks.items || []).map(item => ({
          title: item.track.name,
          artist: item.track.artists.map(a => a.name).join(', '),
          album: item.track.album.name,
          spotifyLink: item.track.external_urls.spotify,
          artworkUrl: item.track.album.images?.[0]?.url || null,
        }))
      );
      // Check if playlist exists in DB
      const checkRes = await fetch('/api/playlists?admin=1');
      const playlists = await checkRes.json();
      const found = playlists.find(p => p.name === data.name);
      setExistingPlaylist(found || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (overwrite = false, importData = null) => {
    setImporting(true);
    setError('');
    setImportResult(null);
    try {
      const dataToImport = importData || {
        playlistName,
        playlistArtworkUrl,
        playlistSpotifyLink: normalizeSpotifyPlaylistUrl(playlistUrl),
        songs: tracks,
        overwrite,
      };
      const res = await fetch('/api/import-playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToImport),
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

  useEffect(() => {
    if (importResult && importResult.success) {
      setPlaylistUrl('');
      setTracks([]);
      setPlaylistName('');
      const timer = setTimeout(() => setImportResult(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [importResult]);

  return (
    <div style={{ backgroundColor: '#18181b' }} className="min-h-screen">
      <LogoHeader>
        <HamburgerMenu />
      </LogoHeader>
      <div className="max-w-4xl mx-auto w-full p-6">
        <h1 className="text-2xl font-bold mb-4 text-white">Admin: Import Spotify Playlist</h1>
        <form onSubmit={handleFetch} className="flex flex-col gap-4 mb-6">
          <input
            type="text"
            placeholder="Paste Spotify playlist URL here..."
            value={playlistUrl}
            onChange={e => setPlaylistUrl(e.target.value)}
            className="p-2 rounded" style={{ backgroundColor: '#27272a', color: 'white', border: '1px solid #3f3f46' }}
          />
          <button
            type="submit"
            className="px-4 py-2 bg-green-600 rounded text-white hover:bg-green-500"
            disabled={loading || !playlistUrl.trim()}
          >
            {loading ? <Skeleton className="w-24 h-6" /> : 'Fetch Playlist'}
          </button>
        </form>
        {error && <div className="text-red-500 mb-4">{error}</div>}
        {loading && (
          <div className="mt-4 space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="w-full h-6 rounded" />
            ))}
          </div>
        )}
        {tracks.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-2 text-white">Tracks to Import from <span className='italic text-white'>{playlistName}</span></h2>
            <ul className="space-y-1 max-h-64 overflow-y-auto">
              {tracks.map((track, idx) => (
                <li key={idx}>{track.title} - {track.artist}</li>
              ))}
            </ul>
            {existingPlaylist ? (
              <div className="flex gap-4 mt-4">
                <button className="px-4 py-2 bg-blue-600 rounded text-white hover:bg-blue-500" onClick={() => handleImport(false)} disabled={importing}>
                  {importing ? <Skeleton className="w-20 h-6" /> : 'Update Playlist'}
                </button>
                <button className="px-4 py-2 bg-red-600 rounded text-white hover:bg-red-500" onClick={() => handleImport(true)} disabled={importing}>
                  {importing ? <Skeleton className="w-24 h-6" /> : 'Overwrite Playlist'}
                </button>
              </div>
            ) : (
              <button className="mt-4 px-4 py-2 bg-blue-600 rounded text-white hover:bg-blue-500" onClick={() => handleImport(false)} disabled={importing}>
                {importing ? <Skeleton className="w-28 h-6" /> : 'Import to Database'}
              </button>
            )}
          </div>
        )}
        {importResult && importResult.success && (
          <div className="text-green-400 mt-4">
            Update Successful!{importResult.count > 0 ? ` ${importResult.count} song${importResult.count === 1 ? '' : 's'} added.` : ''}
          </div>
        )}
        {importResult && !importResult.success && (
          <div className="text-red-500 mt-4">Failed to import playlist.</div>
        )}
        <div className="mt-10">
          <h2 className="text-lg font-bold mb-2 text-white">Manage Playlists</h2>
          <ul className="space-y-2">
            {playlists.map(p => (
              <li key={p.id} className="flex items-center gap-4">
                {p.artworkUrl ? (
                  <img src={p.artworkUrl} alt={p.name} className="w-8 h-8 object-cover rounded mr-2" />
                ) : (
                  <div className="w-8 h-8 bg-gray-700 rounded mr-2" />
                )}
                <span className="text-white">{p.name}</span>
                <button className="px-2 py-1 bg-blue-600 text-white rounded" onClick={async () => {
                  if (!p.spotifyLink) {
                    setError('No Spotify link available for this playlist.');
                    return;
                  }
                  const normalizedUrl = normalizeSpotifyPlaylistUrl(p.spotifyLink);
                  setPlaylistUrl(normalizedUrl);
                  setError('');
                  setTracks([]);
                  setPlaylistName('');
                  setLoading(true);
                  setExistingPlaylist(null);
                  try {
                    const playlistId = extractPlaylistId(normalizedUrl);
                    if (!playlistId) {
                      setError('Invalid Spotify playlist URL');
                      setLoading(false);
                      return;
                    }
                    const res = await fetch(`/api/spotify-proxy?playlistId=${playlistId}`);
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || 'Failed to fetch playlist');
                    // After fetching, trigger the import as update with fresh data
                    await handleImport(false, {
                      playlistName: data.name,
                      playlistArtworkUrl: data.images?.[0]?.url || null,
                      playlistSpotifyLink: normalizedUrl,
                      songs: (data.tracks.items || []).map(item => ({
                        title: item.track.name,
                        artist: item.track.artists.map(a => a.name).join(', '),
                        album: item.track.album.name,
                        spotifyLink: item.track.external_urls.spotify,
                        artworkUrl: item.track.album.images?.[0]?.url || null,
                      })),
                      overwrite: false,
                    });
                  } catch (err) {
                    setError(err.message);
                  } finally {
                    setLoading(false);
                  }
                }}>Update</button>
                {confirmDeleteId === p.id ? (
                  <>
                    <button className="px-2 py-1 bg-red-600 text-white rounded" onClick={() => handleDelete(p.id)} disabled={deletingId === p.id}>Confirm Delete</button>
                    <button className="px-2 py-1 bg-gray-600 text-white rounded" onClick={() => setConfirmDeleteId(null)} disabled={deletingId === p.id}>Cancel</button>
                  </>
                ) : (
                  <button className="p-2 text-gray-400 hover:text-red-600 transition-colors" onClick={() => setConfirmDeleteId(p.id)} disabled={deletingId === p.id} title="Delete Playlist">
                    <FaTrash />
                  </button>
                )}
                {deletingId === p.id && <span className="ml-2 text-xs text-gray-400">Deleting...</span>}
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-10">
          <a
            href="/admin/ImportRatings"
            className="inline-block px-4 py-2 bg-purple-700 rounded text-white hover:bg-purple-600 font-semibold mt-8"
          >
            Import Ratings from CSV
          </a>
        </div>
      </div>
    </div>
  );
} 