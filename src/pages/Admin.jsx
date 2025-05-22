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
        <h1 className="text-2xl font-bold mb-8 text-white text-center">Admin</h1>

        {/* Expandable Playlist Sync Section */}
        <ExpandableSection title="Sync/Import Spotify Playlist" defaultOpen={false}>
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
              {loading ? 'Loading...' : 'Fetch Playlist'}
            </button>
          </form>
          {error && <div className="text-red-500 mb-4">{error}</div>}
          {loading && (
            <div className="mt-4 space-y-2">
              <div className="text-white">Loading playlist...</div>
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
                    {importing ? 'Updating...' : 'Update Playlist'}
                  </button>
                  <button className="px-4 py-2 bg-red-600 rounded text-white hover:bg-red-500" onClick={() => handleImport(true)} disabled={importing}>
                    {importing ? 'Overwriting...' : 'Overwrite Playlist'}
                  </button>
                </div>
              ) : (
                <button className="mt-4 px-4 py-2 bg-blue-600 rounded text-white hover:bg-blue-500" onClick={() => handleImport(false)} disabled={importing}>
                  {importing ? 'Importing...' : 'Import to Database'}
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
        </ExpandableSection>

        <ExpandableSection title="Update 5-Star Playlist on Spotify" defaultOpen={false}>
          <UpdateStarPlaylistButton playlistId={16} minRating={5} label="Update 5-Star Playlist" />
        </ExpandableSection>

        <ExpandableSection title="Update 4+5-Star Playlist on Spotify" defaultOpen={false}>
          <UpdateStarPlaylistButton playlistId={15} minRating={4} label="Update 4+5-Star Playlist" />
        </ExpandableSection>

        {/* Spotify Logout Button Section */}
        <div className="mt-8 mb-8 flex justify-center">
          <SpotifyLogoutButton />
        </div>

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
        <div className="mt-10">
          <a
            href="/scroll-test"
            className="inline-block px-4 py-2 bg-yellow-700 rounded text-white hover:bg-yellow-600 font-semibold mt-8"
          >
            ScrollTest (Safe Area Demo)
          </a>
        </div>
      </div>
    </div>
  );
}

function SpotifyLogoutButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogout = async () => {
    setLoading(true);
    setError(null);
    try {
      await fetch('/api/spotify-proxy/logout', { method: 'POST' });
      window.location.reload();
    } catch (err) {
      setError('Failed to log out of Spotify');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      className="ml-4 px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600"
      onClick={handleLogout}
      disabled={loading}
      title="Log out of Spotify"
    >
      {loading ? 'Logging out...' : 'Log out of Spotify'}
      {error && <span className="text-red-400 ml-2">{error}</span>}
    </button>
  );
}

// --- ExpandableSection helper ---
function ExpandableSection({ title, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-8 border border-gray-700 rounded-lg bg-[#232326]">
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-lg font-semibold text-white focus:outline-none hover:bg-[#27272a] rounded-t-lg"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span>{title}</span>
        <span className="ml-2">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="px-4 pb-4 pt-2">{children}</div>}
    </div>
  );
}

// --- UpdateStarPlaylistButton helper ---
function UpdateStarPlaylistButton({ playlistId, minRating, label }) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);

  const handleClick = async () => {
    setLoading(true);
    setSuccess(null);
    setError(null);
    try {
      const res = await fetch('/api/spotify-proxy/admin/update-star-playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlistId, minRating }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unknown error');
      setSuccess(`Playlist updated with ${data.updated} songs.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <button
        className="px-4 py-2 bg-blue-700 rounded text-white font-semibold hover:bg-blue-600 disabled:opacity-50"
        onClick={handleClick}
        disabled={loading}
      >
        {loading ? 'Updating...' : label}
      </button>
      {success && <div className="text-green-400 text-sm mt-2">{success}</div>}
      {error && <div className="text-red-400 text-sm mt-2">{error}</div>}
    </div>
  );
} 