import React, { useState, useEffect, useCallback } from 'react';
import HamburgerMenu from '../components/HamburgerMenu';
import LogoHeader from '../components/LogoHeader';
import { FaTrash } from 'react-icons/fa';
import Skeleton from '../components/Skeleton';
import { SiGenius } from 'react-icons/si';
import { FaSpotify } from 'react-icons/fa';
import Button from '../components/Button';

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

        {/* Merge Sync/Import and Manage Playlists into one section */}
        <ExpandableSection title="Manage Playlists" defaultOpen={false}>
          {/* Import/Sync Form */}
          <form onSubmit={handleFetch} className="flex flex-col gap-4 mb-6">
            <input
              type="text"
              placeholder="Paste Spotify playlist URL here..."
              value={playlistUrl}
              onChange={e => setPlaylistUrl(e.target.value)}
              className="p-2 rounded" style={{ backgroundColor: '#27272a', color: 'white', border: '1px solid #3f3f46' }}
            />
            <Button
              type="submit"
              variant="primary"
              disabled={loading || !playlistUrl.trim()}
            >
              {loading ? 'Loading...' : 'Fetch Playlist'}
            </Button>
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
                  <Button variant="primary" onClick={() => handleImport(false)} disabled={importing}>
                    {importing ? 'Updating...' : 'Update Playlist'}
                  </Button>
                  <Button variant="danger" onClick={() => handleImport(true)} disabled={importing}>
                    {importing ? 'Overwriting...' : 'Overwrite Playlist'}
                  </Button>
                </div>
              ) : (
                <Button variant="primary" onClick={() => handleImport(false)} disabled={importing}>
                  {importing ? 'Importing...' : 'Import to Database'}
                </Button>
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

          {/* Playlist Management List */}
          <ul className="space-y-2 mt-8">
            {playlists.map(p => (
              <li key={p.id} className="flex items-center gap-4">
                {p.artworkUrl ? (
                  <img src={p.artworkUrl} alt={p.name} className="w-8 h-8 object-cover rounded mr-2" />
                ) : (
                  <div className="w-8 h-8 bg-gray-700 rounded mr-2" />
                )}
                <span className="text-white">{p.name}</span>
                <Button variant="primary" onClick={async () => {
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
                }}>Update</Button>
                {confirmDeleteId === p.id ? (
                  <>
                    <Button variant="danger" onClick={() => handleDelete(p.id)} disabled={deletingId === p.id}>Confirm Delete</Button>
                    <Button variant="secondary" onClick={() => setConfirmDeleteId(null)} disabled={deletingId === p.id}>Cancel</Button>
                  </>
                ) : (
                  <Button variant="secondary" onClick={() => setConfirmDeleteId(p.id)} disabled={deletingId === p.id} title="Delete Playlist">
                    <FaTrash />
                  </Button>
                )}
                {deletingId === p.id && <span className="ml-2 text-xs text-gray-400">Deleting...</span>}
              </li>
            ))}
          </ul>
        </ExpandableSection>

        <ExpandableSection title="Utilities" defaultOpen={false}>
          <div className="flex flex-col gap-4">
            <a
              href="/admin/ImportRatings"
              className="inline-block px-4 py-2 bg-purple-700 rounded text-white hover:bg-purple-600 font-semibold"
            >
              Import Ratings from CSV
            </a>
            <a
              href="/scroll-test"
              className="inline-block px-4 py-2 bg-yellow-700 rounded text-white hover:bg-yellow-600 font-semibold"
            >
              ScrollTest (Safe Area Demo)
            </a>
          </div>
        </ExpandableSection>

        {/* Update playlist buttons, now in-line */}
        <div className="flex flex-col sm:flex-row gap-4 mt-8 mb-8 items-center justify-center">
          <UpdateBothTraptButton />
        </div>

        <div className="mt-16 mb-8 flex flex-col items-center gap-4">
          <SpotifyConnectButton />
          <SpotifyLogoutButton />
        </div>
        {/* Login with Genius button at the bottom */}
        <div className="flex justify-center mt-12">
          <GeniusConnectButton />
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
    <Button
      variant="secondary"
      onClick={handleLogout}
      disabled={loading}
      title="Log out of Spotify"
      className="flex items-center justify-center gap-2 font-semibold"
    >
      <FaSpotify className="text-2xl text-white" />
      {loading ? 'Logging out...' : 'Log out of Spotify'}
      {error && <span className="text-red-400 ml-2">{error}</span>}
    </Button>
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

// --- UpdateBothTraptButton helper ---
function UpdateBothTraptButton() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);

  const handleClick = async () => {
    setLoading(true);
    setSuccess(null);
    setError(null);
    try {
      // Update TRAPT+ (id 16, minRating 5)
      let res = await fetch('/api/spotify-proxy/admin/update-star-playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlistId: 16, minRating: 5 }),
      });
      let data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unknown error updating TRAPT+');
      // Update TRAPT (id 15, minRating 4)
      res = await fetch('/api/spotify-proxy/admin/update-star-playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlistId: 15, minRating: 4 }),
      });
      data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unknown error updating TRAPT');
      setSuccess('Both TRAPT+ and TRAPT playlists updated successfully.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <Button
        variant="gray-yellow"
        onClick={handleClick}
        disabled={loading}
        className="font-semibold"
      >
        {loading ? 'Updating...' : 'Update TRAPT on Spotify'}
      </Button>
      {success && <div className="text-green-400 text-sm mt-2">{success}</div>}
      {error && <div className="text-red-400 text-sm mt-2">{error}</div>}
    </div>
  );
}

// --- SpotifyConnectButton helper ---
function SpotifyConnectButton() {
  return (
    <Button
      variant="success"
      href="/api/spotify-proxy/login"
      title="Connect to Spotify"
      className="flex items-center justify-center gap-2 font-semibold"
    >
      <span className="flex items-center gap-2 text-black">
        <FaSpotify className="text-2xl" />
        Connect to Spotify
      </span>
    </Button>
  );
}

function GeniusConnectButton() {
  const handleGeniusLogin = useCallback(() => {
    window.location = '/api/genius?action=auth';
  }, []);
  return (
    <div className="flex flex-col items-center">
      <Button
        variant="yellow"
        onClick={handleGeniusLogin}
        className="flex items-center justify-center gap-2 font-semibold"
      >
        <SiGenius className="text-2xl" />
        Connect to Genius
      </Button>
      <span className="text-xs text-gray-400 mt-2 text-center max-w-xs">After login, return to the app if you are not redirected automatically.</span>
    </div>
  );
} 