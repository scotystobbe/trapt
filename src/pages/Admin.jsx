import React, { useState, useEffect, useCallback } from 'react';
import HamburgerMenu from '../components/HamburgerMenu';
import LogoHeader from '../components/LogoHeader';
import { FaTrash, FaUserShield, FaSpinner } from 'react-icons/fa';
import Skeleton from '../components/Skeleton';
import { SiGenius } from 'react-icons/si';
import { FaSpotify } from 'react-icons/fa';
import Button from '../components/Button';
import { useAuth } from '../components/AuthProvider';
import { useNavigate } from 'react-router-dom';
// import AppleMusicConverter from '../components/AppleMusicConverter';

function extractPlaylistId(url) {
  // Handles URLs like https://open.spotify.com/playlist/{id} or spotify:playlist:{id}
  const match = url.match(/playlist[/:]([a-zA-Z0-9]+)(\?.*)?$/);
  return match ? match[1] : null;
}

function normalizeSpotifyPlaylistUrl(url) {
  return url.split('?')[0];
}

export default function Admin() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [tracks, setTracks] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [error, setError] = useState('');
  const [playlistName, setPlaylistName] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [playlists, setPlaylists] = useState([]);
  const [playlistStats, setPlaylistStats] = useState({}); // { playlistId: { matched, unmatched, noMatch } }
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [existingPlaylist, setExistingPlaylist] = useState(null);
  const [playlistArtworkUrl, setPlaylistArtworkUrl] = useState(null);
  const [users, setUsers] = useState([]);
  const [userLoading, setUserLoading] = useState(false);
  const [userError, setUserError] = useState('');
  const [roleUpdating, setRoleUpdating] = useState({});
  const [matchingGenius, setMatchingGenius] = useState(false);
  const [geniusMatchResult, setGeniusMatchResult] = useState(null);
  const [matchingPlaylistId, setMatchingPlaylistId] = useState(null);
  const [matchSelections, setMatchSelections] = useState({}); // { songId: { geniusId, geniusUrl } }
  const [manualEntries, setManualEntries] = useState({}); // { songId: { geniusUrl } }
  const [showManualEntry, setShowManualEntry] = useState({}); // { songId: boolean }
  const [savedMatches, setSavedMatches] = useState({}); // { songId: true } - tracks which matches have been saved
  const [showUnmatchedOnly, setShowUnmatchedOnly] = useState(true); // Filter to show only unmatched songs

  React.useEffect(() => {
    if (!loading && user?.role !== 'ADMIN') {
      navigate('/');
    }
  }, [user, loading, navigate]);

  if (loading || user?.role !== 'ADMIN') {
    return <div className="text-center text-gray-400 mt-12">Loading...</div>;
  }

  const handleFetch = async (e) => {
    e.preventDefault();
    setError('');
    setTracks([]);
    setPlaylistName('');
    setAdminLoading(true);
    setExistingPlaylist(null);
    const normalizedUrl = normalizeSpotifyPlaylistUrl(playlistUrl);
    const playlistId = extractPlaylistId(normalizedUrl);
    if (!playlistId) {
      setError('Invalid Spotify playlist URL');
      setAdminLoading(false);
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
      setAdminLoading(false);
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
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
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

  // Function to refresh stats for a specific playlist
  const refreshPlaylistStats = useCallback((playlistId) => {
    if (!playlistId) return;
    // Add cache-busting parameter to ensure fresh data
    fetch(`/api/songs?playlistId=${playlistId}&t=${Date.now()}`)
      .then(res => res.json())
      .then(songs => {
        const matched = songs.filter(s => s.geniusSongId != null && s.geniusSongId !== undefined).length;
        const noMatch = songs.filter(s => s.geniusNoMatch === true).length;
        const unmatched = songs.length - matched - noMatch;
        setPlaylistStats(prev => ({
          ...prev,
          [playlistId]: { matched, unmatched, noMatch }
        }));
      })
      .catch(() => {
        setPlaylistStats(prev => ({
          ...prev,
          [playlistId]: { matched: 0, unmatched: 0, noMatch: 0 }
        }));
      });
  }, []);

  // Fetch playlists for admin delete section
  useEffect(() => {
    // Always fetch fresh data on page load/refresh
    fetch(`/api/playlists?admin=1&t=${Date.now()}`)
      .then(res => res.json())
      .then(data => {
        // Sort by name descending (newest to oldest: Rob 2024, Rob 2023, etc.)
        const sorted = [...data].sort((a, b) => {
          // Compare in reverse order to get descending (newest first)
          return b.name.localeCompare(a.name, undefined, { numeric: true, sensitivity: 'base' });
        });
        setPlaylists(sorted);
        
        // Fetch stats for each playlist with cache-busting
        const statsPromises = sorted
          .filter(p => p.name !== 'TRAPT' && p.name !== 'TRAPT+')
          .map(playlist => 
            fetch(`/api/songs?playlistId=${playlist.id}&t=${Date.now()}`)
              .then(res => res.json())
              .then(songs => {
                const matched = songs.filter(s => s.geniusSongId != null && s.geniusSongId !== undefined).length;
                const noMatch = songs.filter(s => s.geniusNoMatch === true).length;
                const unmatched = songs.length - matched - noMatch;
                return { playlistId: playlist.id, matched, unmatched, noMatch };
              })
              .catch(() => ({ playlistId: playlist.id, matched: 0, unmatched: 0, noMatch: 0 }))
          );
        
        Promise.all(statsPromises).then(stats => {
          const statsObj = {};
          stats.forEach(stat => {
            statsObj[stat.playlistId] = {
              matched: stat.matched,
              unmatched: stat.unmatched,
              noMatch: stat.noMatch
            };
          });
          setPlaylistStats(statsObj);
        });
      });
  }, [importResult, deletingId, geniusMatchResult]);

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await fetch('/api/playlists', {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
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

  // Fetch users for user management
  useEffect(() => {
    if (user?.role === 'ADMIN') {
      setUserLoading(true);
      fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      })
        .then(res => res.json())
        .then(data => setUsers(data.users || []))
        .catch(() => setUserError('Failed to fetch users'))
        .finally(() => setUserLoading(false));
    }
  }, [user]);

  const handleRoleChange = async (id, newRole) => {
    // If the current user is changing their own role, confirm first
    if (user?.id === id) {
      const confirmed = window.confirm('Are you sure you want to change your own role? You may lose admin access.');
      if (!confirmed) return;
    }
    setRoleUpdating(r => ({ ...r, [id]: true }));
    setUserError('');
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ id, role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update role');
      setUsers(users => users.map(u => u.id === id ? { ...u, role: newRole } : u));
    } catch (err) {
      setUserError(err.message);
    } finally {
      setRoleUpdating(r => ({ ...r, [id]: false }));
    }
  };

  return (
    <div style={{ backgroundColor: '#18181b' }} className="min-h-screen">
      <LogoHeader>
        <HamburgerMenu />
      </LogoHeader>
      <div className="max-w-4xl mx-auto w-full p-6">
        <h1 className="text-2xl font-bold mb-8 text-white text-center">Admin</h1>

        {/* Apple Music to Spotify Converter - Hidden for now */}
        {/* <ExpandableSection title={<span><FaApple className="inline mr-2" />Convert Apple Music Playlist</span>} defaultOpen={false}>
          <AppleMusicConverter />
        </ExpandableSection> */}

        {/* Merge Sync/Import and Manage Playlists into one section */}
        <ExpandableSection title="Manage Playlists" defaultOpen={false}>
          {/* Import/Sync Form */}
          <form onSubmit={handleFetch} className="flex flex-col gap-4 mb-8">
            <input
              type="text"
              className="w-full px-4 py-2 rounded bg-gray-800 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-600"
              placeholder="Paste Spotify playlist URL"
              value={playlistUrl}
              onChange={e => setPlaylistUrl(e.target.value)}
              disabled={adminLoading}
            />
            <Button
              type="submit"
              variant="primary"
              disabled={adminLoading || !playlistUrl.trim()}
            >
              {adminLoading ? 'Loading...' : 'Fetch Playlist'}
            </Button>
          </form>
          {error && <div className="text-red-500 mb-4">{error}</div>}
          {adminLoading && (
            <div className="mt-4 space-y-2">
              <div className="text-white">Loading playlist...</div>
            </div>
          )}
          {tracks.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-2 text-white">Tracks to Import from <span className='italic text-white'>{playlistName}</span></h2>
              <ul className="space-y-1 max-h-64 overflow-y-auto mb-6">
                {tracks.map((track, idx) => (
                  <li key={idx} className="text-white">{track.title} - {track.artist}</li>
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
                <div className="mt-2">
                  <Button variant="primary" onClick={() => handleImport(false)} disabled={importing}>
                    {importing ? 'Importing...' : 'Import to Database'}
                  </Button>
                </div>
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
                  setAdminLoading(true);
                  setExistingPlaylist(null);
                  try {
                    const playlistId = extractPlaylistId(normalizedUrl);
                    if (!playlistId) {
                      setError('Invalid Spotify playlist URL');
                      setAdminLoading(false);
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
                    setAdminLoading(false);
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

        <ExpandableSection title={<span><SiGenius className="inline mr-2" />Match Genius Songs</span>} defaultOpen={false}>
          <div className="mb-4">
            <p className="text-gray-300 text-sm mb-4">
              Match songs in a playlist with Genius. This will search Genius for each song and store the match for faster access.
              Make sure you're connected to Genius first.
            </p>
            <div className="space-y-2">
              {playlists.filter(p => p.name !== 'TRAPT' && p.name !== 'TRAPT+').map(p => {
                const stats = playlistStats[p.id] || { matched: 0, unmatched: 0, noMatch: 0 };
                return (
                <div key={p.id} className="flex items-center gap-4 p-2 bg-gray-800 rounded">
                  {p.artworkUrl && (
                    <img src={p.artworkUrl} alt={p.name} className="w-8 h-8 object-cover rounded" />
                  )}
                  <div className="flex-1">
                    <div className="text-white">{p.name}</div>
                    <div className="text-xs text-gray-400 flex gap-3 mt-1">
                      <span className="text-green-400">Matched: {stats.matched}</span>
                      <span className="text-yellow-400">Unmatched: {stats.unmatched}</span>
                      <span className="text-gray-500">No Match: {stats.noMatch}</span>
                    </div>
                  </div>
                  <Button
                    variant="yellow"
                    onClick={async () => {
                      setMatchingGenius(true);
                      setGeniusMatchResult(null);
                      setMatchingPlaylistId(p.id);
                      setMatchSelections({});
                      setManualEntries({});
                      setShowManualEntry({});
                      setSavedMatches({});
                      try {
                        const res = await fetch('/api/admin/match-genius', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${localStorage.getItem('token')}`
                          },
                          body: JSON.stringify({ playlistId: p.id }),
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error || 'Failed to match Genius songs');
                        setGeniusMatchResult({ ...data, playlistId: p.id });
                      } catch (err) {
                        setGeniusMatchResult({ error: err.message, playlistId: p.id });
                      } finally {
                        setMatchingGenius(false);
                        setMatchingPlaylistId(null);
                      }
                    }}
                    disabled={matchingGenius}
                    className="text-sm"
                  >
                    {matchingGenius && matchingPlaylistId === p.id ? 'Searching...' : 'Match Songs'}
                  </Button>
                </div>
              );
              })}
            </div>
            {matchingGenius && matchingPlaylistId && (
              <div className="mt-4 p-4 bg-gray-800 rounded">
                <div className="flex items-center gap-2 text-yellow-400">
                  <FaSpinner className="animate-spin" />
                  <span>Searching Genius for matches... This may take a moment.</span>
                </div>
              </div>
            )}
            {geniusMatchResult && !geniusMatchResult.error && geniusMatchResult.results && (
              <div className="mt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-white font-semibold">
                    Review Matches ({geniusMatchResult.results.filter(r => !showUnmatchedOnly || r.status !== 'already_matched').length} tracks)
                  </div>
                  <label className="flex items-center gap-2 text-gray-300 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showUnmatchedOnly}
                      onChange={(e) => setShowUnmatchedOnly(e.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                    <span>Show unmatched only</span>
                  </label>
                </div>
                <div id="genius-matches-container" className="max-h-96 overflow-y-auto space-y-3">
                  {geniusMatchResult.results
                    .filter(result => {
                      if (result.status === 'no_match_available') return false; // Always hide no-match songs
                      if (showUnmatchedOnly && result.status === 'already_matched' && result.geniusId) return false; // Hide matched songs when filtered, but show cleared ones
                      return true;
                    })
                    .map((result) => {
                    const isSelected = matchSelections[result.songId];
                    const manualEntry = manualEntries[result.songId];
                    const isManualEntryVisible = showManualEntry[result.songId];
                    
                    return (
                      <div key={result.songId} className="bg-gray-800 rounded p-4 border border-gray-700">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="text-white font-semibold">{result.title}</div>
                            <div className="text-gray-400 text-sm">{result.artist}</div>
                            {result.status === 'already_matched' && (
                              <>
                                <div className="text-green-400 text-xs mt-1">✓ Already matched</div>
                                {result.thumbnail && (
                                  <div className="mt-2 flex items-center gap-3">
                                    <img src={result.thumbnail} alt="" className="w-16 h-16 rounded object-cover" />
                                    <div>
                                      <div className="text-white text-sm font-medium">{result.geniusTitle || 'Genius Song'}</div>
                                      <div className="text-gray-400 text-xs">{result.geniusArtist || 'Artist'}</div>
                                      {result.geniusUrl && (
                                        <a
                                          href={result.geniusUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-yellow-400 text-xs hover:underline mt-1 inline-block"
                                        >
                                          View on Genius →
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                            {result.status === 'error' && (
                              <div className="text-red-400 text-xs mt-1">✗ Error: {result.error}</div>
                            )}
                            {result.status === 'no_match_available' && (
                              <div className="text-gray-500 text-xs mt-1">⊘ No match available</div>
                            )}
                          </div>
                          {result.status === 'already_matched' && (
                            <div className="flex gap-2">
                              <button
                                onClick={async () => {
                                  if (!confirm('Clear this match? The song will be available for matching again.')) {
                                    return;
                                  }
                                  try {
                                    const res = await fetch('/api/admin/match-genius', {
                                      method: 'POST',
                                      headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                                      },
                                      body: JSON.stringify({
                                        action: 'clear-match',
                                        songIds: [result.songId]
                                      }),
                                    });
                                    const data = await res.json();
                                    if (!res.ok) throw new Error(data.error || 'Failed to clear match');
                                    
                                    // Update the result to show it needs to be re-searched
                                    // The song will now appear in the unmatched list
                                    setGeniusMatchResult(prev => ({
                                      ...prev,
                                      results: prev.results.map(r => 
                                        r.songId === result.songId 
                                          ? { ...r, status: 'cleared', geniusId: null, geniusUrl: null, thumbnail: null, geniusTitle: null, geniusArtist: null, potentialMatches: [] }
                                          : r
                                      )
                                    }));
                                    
                                    // Refresh stats for this playlist (with small delay to ensure DB update completes)
                                    if (geniusMatchResult?.playlistId) {
                                      setTimeout(() => {
                                        refreshPlaylistStats(geniusMatchResult.playlistId);
                                      }, 300);
                                    }
                                    
                                    // Clear saved match state
                                    setSavedMatches(prev => {
                                      const next = { ...prev };
                                      delete next[result.songId];
                                      return next;
                                    });
                                    setMatchSelections(prev => {
                                      const next = { ...prev };
                                      delete next[result.songId];
                                      return next;
                                    });
                                  } catch (err) {
                                    alert(`Error clearing match: ${err.message}`);
                                  }
                                }}
                                className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-500"
                                title="Clear this match"
                              >
                                Clear Match
                              </button>
                            </div>
                          )}
                          {result.status === 'cleared' && (
                            <div className="flex gap-2">
                              <div className="text-xs px-2 py-1 bg-gray-700 text-gray-400 rounded">
                                Match cleared - re-run search to find matches
                              </div>
                            </div>
                          )}
                          {(result.status !== 'already_matched' && result.status !== 'error' && result.status !== 'no_match_available' && result.status !== 'cleared') && (
                            <div className="flex gap-2">
                              {!isManualEntryVisible && (
                                <>
                                  <button
                                    onClick={() => setShowManualEntry(prev => ({ ...prev, [result.songId]: true }))}
                                    className="text-xs px-2 py-1 bg-gray-700 text-white rounded hover:bg-gray-600"
                                  >
                                    Manual Entry
                                  </button>
                                  <button
                                    onClick={async () => {
                                      if (!confirm('Mark this song as "No match available"? It will be hidden from future searches.')) {
                                        return;
                                      }
                                      try {
                                        const res = await fetch('/api/admin/match-genius', {
                                          method: 'POST',
                                          headers: {
                                            'Content-Type': 'application/json',
                                            'Authorization': `Bearer ${localStorage.getItem('token')}`
                                          },
                                          body: JSON.stringify({
                                            action: 'mark-no-match',
                                            songIds: [result.songId]
                                          }),
                                        });
                                        const data = await res.json();
                                        if (!res.ok) throw new Error(data.error || 'Failed to mark as no match');
                                        
                                        // Update the result status
                                        setGeniusMatchResult(prev => ({
                                          ...prev,
                                          results: prev.results.map(r => 
                                            r.songId === result.songId 
                                              ? { ...r, status: 'no_match_available' }
                                              : r
                                          )
                                        }));
                                        
                                        // Refresh stats for this playlist (with small delay to ensure DB update completes)
                                        if (geniusMatchResult?.playlistId) {
                                          setTimeout(() => {
                                            refreshPlaylistStats(geniusMatchResult.playlistId);
                                          }, 300);
                                        }
                                        
                                        // If showing unmatched only, the song will disappear automatically
                                      } catch (err) {
                                        alert(`Error marking as no match: ${err.message}`);
                                      }
                                    }}
                                    className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-500"
                                    title="Mark as no match available"
                                  >
                                    No Match
                                  </button>
                                </>
                              )}
                              {isSelected && (
                                <button
                                  onClick={() => {
                                    setMatchSelections(prev => {
                                      const next = { ...prev };
                                      delete next[result.songId];
                                      return next;
                                    });
                                  }}
                                  className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-500"
                                >
                                  Clear
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {isManualEntryVisible && (
                          <div className="mb-3 p-3 bg-gray-900 rounded">
                            <div className="text-sm text-gray-300 mb-2">Enter Genius URL:</div>
                            <input
                              type="text"
                              value={manualEntry?.geniusUrl || ''}
                              onChange={(e) => {
                                setManualEntries(prev => ({
                                  ...prev,
                                  [result.songId]: { geniusUrl: e.target.value }
                                }));
                              }}
                              placeholder="https://genius.com/artist-song-lyrics or https://genius.com/songs/12345"
                              className="w-full px-3 py-2 bg-gray-800 text-white rounded border border-gray-700 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                            />
                            <div className="flex gap-2 mt-2">
                              <button
                                onClick={async () => {
                                  if (!manualEntry?.geniusUrl) return;
                                  
                                  // Validate it's a Genius URL
                                  if (!manualEntry.geniusUrl.includes('genius.com')) {
                                    alert('Please enter a valid Genius URL');
                                    return;
                                  }
                                  
                                  // Save immediately - API will resolve the song ID from the URL
                                  try {
                                    const res = await fetch('/api/admin/match-genius', {
                                      method: 'PUT',
                                      headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                                      },
                                      body: JSON.stringify({
                                        matches: [{
                                          songId: result.songId,
                                          geniusUrl: manualEntry.geniusUrl
                                          // geniusId will be resolved by the API
                                        }]
                                      }),
                                    });
                                    const data = await res.json();
                                    if (!res.ok) throw new Error(data.error || 'Failed to save match');
                                    
                                    // Get the resolved genius ID from the response
                                    const savedSong = data.updatedSongs && data.updatedSongs[0];
                                    const resolvedGeniusId = savedSong?.geniusSongId;
                                    
                                    // Mark as saved
                                    setSavedMatches(prev => ({ ...prev, [result.songId]: true }));
                                    setMatchSelections(prev => ({
                                      ...prev,
                                      [result.songId]: {
                                        geniusId: resolvedGeniusId,
                                        geniusUrl: manualEntry.geniusUrl
                                      }
                                    }));
                                    setShowManualEntry(prev => ({ ...prev, [result.songId]: false }));
                                    
                                    // Update the result to show as already matched
                                    setGeniusMatchResult(prev => ({
                                      ...prev,
                                      results: prev.results.map(r => 
                                        r.songId === result.songId 
                                          ? { ...r, status: 'already_matched', geniusId: resolvedGeniusId, geniusUrl: manualEntry.geniusUrl }
                                          : r
                                      )
                                    }));
                                    
                                    // Scroll to top of matches container
                                    setTimeout(() => {
                                      const container = document.getElementById('genius-matches-container');
                                      if (container) {
                                        container.scrollTo({ top: 0, behavior: 'smooth' });
                                      }
                                    }, 100);
                                    
                                    // Refresh stats for this playlist (with small delay to ensure DB update completes)
                                    if (geniusMatchResult?.playlistId) {
                                      setTimeout(() => {
                                        refreshPlaylistStats(geniusMatchResult.playlistId);
                                      }, 300);
                                    }
                                    
                                      // If showing unmatched only, the song will disappear from the list automatically due to the filter
                                  } catch (err) {
                                    alert(`Error saving match: ${err.message}`);
                                  }
                                }}
                                className="text-xs px-3 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-500"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => {
                                  setShowManualEntry(prev => ({ ...prev, [result.songId]: false }));
                                  setManualEntries(prev => {
                                    const next = { ...prev };
                                    delete next[result.songId];
                                    return next;
                                  });
                                }}
                                className="text-xs px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}

                        {result.potentialMatches && result.potentialMatches.length > 0 && (
                          <div className="space-y-2">
                            <div className="text-sm text-gray-400 mb-2">Potential Matches:</div>
                            {result.potentialMatches.map((match, idx) => {
                              const isThisSelected = isSelected?.geniusId === match.id;
                              const isSaved = savedMatches[result.songId] && isThisSelected;
                              return (
                                <div
                                  key={match.id}
                                  className={`flex items-center gap-3 p-2 rounded transition ${
                                    isSaved
                                      ? 'bg-green-900 border-2 border-green-500 cursor-default'
                                      : isThisSelected
                                      ? 'bg-yellow-900 border-2 border-yellow-500 cursor-pointer'
                                      : match.matchType === 'exact'
                                      ? 'bg-green-800 border-2 border-green-600 cursor-pointer hover:bg-green-700'
                                      : 'bg-gray-700 hover:bg-gray-600 cursor-pointer'
                                  }`}
                                  onClick={async () => {
                                    if (isSaved || result.status === 'already_matched') {
                                      // Already saved, do nothing
                                      return;
                                    }
                                    if (isThisSelected) {
                                      // Deselect
                                      setMatchSelections(prev => {
                                        const next = { ...prev };
                                        delete next[result.songId];
                                        return next;
                                      });
                                      return;
                                    }
                                    
                                    // Save immediately
                                    try {
                                      const res = await fetch('/api/admin/match-genius', {
                                        method: 'PUT',
                                        headers: {
                                          'Content-Type': 'application/json',
                                          'Authorization': `Bearer ${localStorage.getItem('token')}`
                                        },
                                        body: JSON.stringify({
                                          matches: [{
                                            songId: result.songId,
                                            geniusId: match.id,
                                            geniusUrl: match.url
                                          }]
                                        }),
                                      });
                                      const data = await res.json();
                                      if (!res.ok) throw new Error(data.error || 'Failed to save match');
                                      
                                      // Mark as saved
                                      setSavedMatches(prev => ({ ...prev, [result.songId]: true }));
                                      setMatchSelections(prev => ({
                                        ...prev,
                                        [result.songId]: {
                                          geniusId: match.id,
                                          geniusUrl: match.url
                                        }
                                      }));
                                      setManualEntries(prev => {
                                        const next = { ...prev };
                                        delete next[result.songId];
                                        return next;
                                      });
                                      setShowManualEntry(prev => ({ ...prev, [result.songId]: false }));
                                      
                                      // Update the result to show as already matched
                                      setGeniusMatchResult(prev => ({
                                        ...prev,
                                        results: prev.results.map(r => 
                                          r.songId === result.songId 
                                            ? { ...r, status: 'already_matched', geniusId: match.id, geniusUrl: match.url, thumbnail: match.thumbnail, geniusTitle: match.title, geniusArtist: match.artist }
                                            : r
                                        )
                                      }));
                                      
                                      // Scroll to top of matches container
                                      setTimeout(() => {
                                        const container = document.getElementById('genius-matches-container');
                                        if (container) {
                                          container.scrollTo({ top: 0, behavior: 'smooth' });
                                        }
                                      }, 100);
                                      
                                      // Refresh stats for this playlist (with small delay to ensure DB update completes)
                                      if (geniusMatchResult?.playlistId) {
                                        setTimeout(() => {
                                          refreshPlaylistStats(geniusMatchResult.playlistId);
                                        }, 300);
                                      }
                                      
                                      // If showing unmatched only, the song will disappear from the list automatically due to the filter
                                    } catch (err) {
                                      alert(`Error saving match: ${err.message}`);
                                    }
                                  }}
                                >
                                  {match.thumbnail && (
                                    <img src={match.thumbnail} alt="" className="w-12 h-12 rounded object-cover" />
                                  )}
                                  <div className="flex-1">
                                    <div className="text-white font-medium">{match.title}</div>
                                    <div className="text-gray-400 text-sm">{match.artist}</div>
                                    <div className="text-xs text-gray-500 mt-1">
                                      {match.matchType === 'exact' && '✓ Exact match'}
                                      {match.matchType === 'partial' && '~ Partial match'}
                                      {match.matchType === 'possible' && '? Possible match'}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {isSaved && (
                                      <span className="text-green-400 text-sm font-semibold">✓ Saved</span>
                                    )}
                                    {isThisSelected && !isSaved && (
                                      <span className="text-yellow-400 text-sm">✓ Selected</span>
                                    )}
                                    <a
                                      href={match.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="text-xs px-2 py-1 bg-gray-600 text-white rounded hover:bg-gray-500"
                                    >
                                      View
                                    </a>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {result.status === 'no_results' && !isManualEntryVisible && (
                          <div className="text-gray-400 text-sm">No matches found. Use "Manual Entry" to add a link.</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {geniusMatchResult && geniusMatchResult.error && (
              <div className="mt-4 p-4 bg-red-900 rounded">
                <div className="text-red-200">{geniusMatchResult.error}</div>
              </div>
            )}
          </div>
        </ExpandableSection>

        <ExpandableSection title={<span><FaUserShield className="inline mr-2" />User Management</span>} defaultOpen={false}>
          {userLoading ? (
            <div className="text-gray-300">Loading users...</div>
          ) : userError ? (
            <div className="text-red-400">{userError}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-white text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="py-2 px-2 text-left">Username</th>
                    <th className="py-2 px-2 text-left">Email</th>
                    <th className="py-2 px-2 text-left">Role</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="border-b border-gray-800">
                      <td className="py-2 px-2">{u.username || <span className="italic text-gray-400">(none)</span>}</td>
                      <td className="py-2 px-2">{u.email}</td>
                      <td className="py-2 px-2">
                        <select
                          value={u.role}
                          onChange={e => handleRoleChange(u.id, e.target.value)}
                          className="bg-[#232326] border border-[#3f3f46] rounded px-2 py-1 text-white"
                          disabled={roleUpdating[u.id]}
                        >
                          <option value="ADMIN">ADMIN</option>
                          <option value="VIEWER">VIEWER</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ExpandableSection>

        <ExpandableSection title="Utilities" defaultOpen={false}>
          <div className="flex flex-col gap-4">
            <a
              href="/admin/stats"
              className="inline-block px-4 py-2 bg-indigo-700 rounded text-white hover:bg-indigo-600 font-semibold"
            >
              View Statistics & Reports
            </a>
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