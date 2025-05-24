import React, { useEffect, useState, useCallback, useRef } from "react";
import LogoHeader from '../components/LogoHeader';
import HamburgerMenu from '../components/HamburgerMenu';
import { FaSpotify, FaStar, FaRegEdit, FaHistory, FaRegStar } from 'react-icons/fa';
import { useNightMode } from '../App';
import Skeleton from '../components/Skeleton';
import useSWR from 'swr';
import { SiGenius } from 'react-icons/si';
import GeniusLyricsModal from '../components/GeniusLyricsModal';

function EditableStarRating({ rating, onRatingChange, size = 56, nightMode, emptyColor }) {
  return (
    <div className="flex gap-2 mt-2 mb-4 w-full max-w-lg justify-center sm:gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        star <= rating ? (
          <FaStar
            key={star}
            className={nightMode ? 'text-red-800 cursor-pointer' : 'text-yellow-400 cursor-pointer'}
            onClick={() => {
              if (star === 1 && rating === 1) {
                onRatingChange(null);
              } else {
                onRatingChange(star);
              }
            }}
            size={size}
          />
        ) : (
          <FaRegStar
            key={star}
            className={nightMode ? 'text-red-900 cursor-pointer' : 'text-gray-400 cursor-pointer'}
            onClick={() => {
              if (star === 1 && rating === 1) {
                onRatingChange(null);
              } else {
                onRatingChange(star);
              }
            }}
            size={size}
          />
        )
      ))}
    </div>
  );
}

export default function NowPlaying() {
  const { nightMode } = useNightMode();
  const [error, setError] = useState('');
  const [track, setTrack] = useState(null);
  const [dbSong, setDbSong] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const lastTrackId = useRef(null);
  const [prevTrack, setPrevTrack] = useState(null);
  const [prevDbSong, setPrevDbSong] = useState(null);
  const [showGeniusModal, setShowGeniusModal] = useState(false);
  const [showCustomGeniusModal, setShowCustomGeniusModal] = useState(false);
  const [showLyricsModal, setShowLyricsModal] = useState(false);

  // SWR for songs
  const fetcher = url => fetch(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now()).then(res => res.json());
  const { data: songs = [], error: songsError, mutate: mutateSongs } = useSWR('/api/songs', fetcher);

  // Helper to check auth and fetch currently playing
  const fetchCurrentlyPlaying = useCallback(async (isInitial = false) => {
    try {
      const res = await fetch('/api/spotify-proxy/currently-playing');
      if (res.status === 401) {
        setIsAuthenticated(false);
        if (isInitial) setInitialLoading(false);
        return;
      }
      setIsAuthenticated(true);
      const data = await res.json();
      if (!data || data.playing === false || !data.item) {
        if (isInitial) setTrack(null);
        if (isInitial) setDbSong(null);
        if (isInitial) setInitialLoading(false);
        return;
      }
      // Only update if the track has changed
      if (lastTrackId.current !== data.item.id) {
        if (editingNotes) {
          // Don't update if editing notes
          return;
        }
        setPrevTrack(track);
        setPrevDbSong(dbSong);
        setTrack(data.item);
        lastTrackId.current = data.item.id;
        // Use SWR-cached songs
        const match = songs.find(s => s.spotifyLink && s.spotifyLink.includes(data.item.id));
        setDbSong(match || null);
        setNotes(match?.notes || '');
        setEditingNotes(false);
      }
      if (isInitial) setInitialLoading(false);
    } catch (err) {
      setError('Failed to fetch currently playing track.');
      if (isInitial) setInitialLoading(false);
    }
  }, [editingNotes, track, dbSong, songs]);

  useEffect(() => {
    if (songs.length === 0 && !songsError) return; // Wait for songs to load or error
    fetchCurrentlyPlaying(true);
    const interval = setInterval(() => fetchCurrentlyPlaying(false), 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line
  }, [fetchCurrentlyPlaying, songs.length, songsError]);

  const handleConnect = () => {
    window.location.href = '/api/spotify-proxy/login';
  };

  const handleRatingChange = async (newRating) => {
    if (!dbSong) return;
    setDbSong({ ...dbSong, rating: newRating });
    try {
      await fetch('/api/songs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: dbSong.id, rating: newRating }),
      });
      mutateSongs();
    } catch (err) {
      setError('Could not save rating.');
    }
  };

  const handleNoteSave = async () => {
    if (!dbSong) return;
    setSaving(true);
    setError('');
    try {
      await fetch('/api/songs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: dbSong.id, notes }),
      });
      setDbSong({ ...dbSong, notes });
      setEditingNotes(false);
      mutateSongs();
    } catch (err) {
      setError('Could not save notes.');
    } finally {
      setSaving(false);
    }
  };

  // Helper for dimming
  const dimClass = nightMode ? 'opacity-40' : '';
  const textClass = nightMode ? 'text-red-800' : '';

  // Helper to build Genius search link
  const geniusUrl = dbSong
    ? `https://genius.com/search?q=${encodeURIComponent(dbSong.artist + ' ' + dbSong.title)}`
    : '#';
  // Find the playlist for the current song
  const playlistForSong = songs.find(
    playlist => Array.isArray(playlist.songs) && playlist.songs.some(s => s.id === dbSong?.id)
  );
  const playlistArtworkUrl = playlistForSong?.artworkUrl || null;

  const handleGeniusIconClick = async () => {
    if (!dbSong) return;
    try {
      const q = encodeURIComponent(`${dbSong.artist} ${dbSong.title}`);
      const res = await fetch(`/api/genius?action=search&q=${q}`);
      if (!res.ok) throw new Error('Search failed');
      const hits = await res.json();
      const exact = hits.find(h => {
        const t = h.result.title.trim().toLowerCase();
        const a = h.result.primary_artist.name.trim().toLowerCase();
        return t === dbSong.title.trim().toLowerCase() && a === dbSong.artist.trim().toLowerCase();
      });
      if (exact) {
        window.open(`/genius-embed/${exact.result.id}`, '_blank', 'noopener,noreferrer');
      } else {
        setShowLyricsModal(true);
      }
    } catch (err) {
      setShowLyricsModal(true);
    }
  };

  return (
    <div style={{ backgroundColor: nightMode ? '#000' : '#18181b' }} className={"min-h-screen " + (nightMode ? 'night-mode' : '')}>
      <LogoHeader logoClassName={dimClass}>
        <HamburgerMenu className={dimClass} />
      </LogoHeader>
      <style>{`
        .night-mode .logo-header {
          background: #000 !important;
        }
      `}</style>
      <div className="max-w-2xl mx-auto w-full p-4 flex flex-col items-center pt-8">
        {initialLoading ? (
          <div className="w-full flex flex-col items-center">
            <div className="relative mb-8">
              <Skeleton className="w-56 h-56 rounded-2xl" />
            </div>
            <Skeleton className="w-48 h-10 mb-2 rounded" />
            <Skeleton className="w-40 h-7 mb-1 rounded" />
            <Skeleton className="w-32 h-5 mb-2 rounded" />
            <div className="flex gap-2 mt-2 mb-2 justify-center w-full max-w-lg">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="w-12 h-12 rounded-full" />
              ))}
            </div>
            <Skeleton className="rounded-lg w-full max-w-lg h-24 mt-2" />
          </div>
        ) : !isAuthenticated ? (
          <button
            onClick={handleConnect}
            className={"px-6 py-3 bg-green-600 text-white rounded-lg text-lg font-semibold hover:bg-green-500 transition " + dimClass}
          >
            Connect to Spotify
          </button>
        ) : !track ? (
          <p className={"text-gray-300 " + textClass}>No track currently playing.</p>
        ) : dbSong ? (
          <div className="w-full flex flex-col items-center">
            <div className={"relative mb-8 " + dimClass}>
              {dbSong.artworkUrl && (
                <img src={dbSong.artworkUrl} alt={dbSong.title} className={"w-56 h-56 rounded-2xl object-cover shadow-lg " + dimClass} />
              )}
            </div>
            <h2
              className={"text-4xl font-bold mb-2 text-center " + (nightMode ? 'text-red-800' : 'text-white')}
              onClick={() => dbSong && setShowCustomGeniusModal(true)}
              style={{ cursor: dbSong ? 'pointer' : 'default' }}
            >
              {dbSong ? dbSong.title : ''}
            </h2>
            <p className={"text-3xl mb-1 text-center " + (nightMode ? 'text-red-800' : 'text-white')}>{dbSong.artist}</p>
            <p className={"text-lg mb-2 text-center " + (nightMode ? 'text-red-900' : 'text-gray-500')}>{dbSong.album || track?.album?.name}</p>
            <EditableStarRating rating={dbSong.rating} onRatingChange={handleRatingChange} size={72} nightMode={nightMode} emptyColor={nightMode ? '#18181b' : undefined} />
            <div
              className={"rounded-lg p-4 w-full max-w-lg mt-2 min-h-[60px] text-left " + textClass}
              style={{ backgroundColor: nightMode ? '#141416' : '#27272a', cursor: editingNotes ? 'auto' : 'text' }}
              onClick={() => !editingNotes && setEditingNotes(true)}
            >
              {editingNotes ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className={"w-full p-2 rounded bg-[#27272a] border border-[#3f3f46] text-white placeholder-gray-500 focus:ring-0 focus:border-[#3f3f46] focus:outline-none caret-white selection:bg-[#3f3f46] selection:text-white autofill:bg-[#27272a] autofill:text-white " + textClass}
                    autoFocus
                  />
                  <button
                    onClick={handleNoteSave}
                    className={"self-end px-3 py-1 bg-[#3f3f46] text-white rounded hover:bg-[#27272a] " + dimClass}
                    disabled={saving}
                  >{saving ? 'Saving...' : 'Save'}</button>
                </div>
              ) : (
                <div className="flex items-center justify-between w-full">
                  <p className={"whitespace-pre-wrap flex-1 " + (dbSong.notes ? (nightMode ? 'text-red-800' : 'text-gray-400') : textClass)}>{dbSong.notes || <em className="text-gray-400">No notes</em>}</p>
                </div>
              )}
            </div>
          </div>
        ) : null}
        {error && <div className={"text-red-400 mt-4 " + textClass}>{error}</div>}
      </div>
      {/* Previous Song Card */}
      {prevDbSong && prevTrack && !editingNotes && (
        <div className="fixed left-1/2 bottom-8 transform -translate-x-1/2 bg-[#27272a] rounded-xl shadow-lg p-2 flex flex-col items-center z-[100] w-[320px] max-w-full min-h-[64px]" style={{ pointerEvents: 'auto' }}>
          <div className="relative w-full flex flex-col flex-1 justify-center items-center">
            <div className="flex justify-center w-full">
              <span className="font-bold text-gray-400 text-base leading-tight text-center truncate" style={{maxWidth: 'calc(100% - 2.5rem)'}}>{prevDbSong.title}</span>
            </div>
            <div className="mt-2 text-xs text-gray-500 truncate leading-tight text-center w-full">{prevDbSong.artist}</div>
            <div className="mt-1 mb-[-4px] flex justify-center w-full">
              <EditableStarRating
                rating={typeof prevDbSong.rating === 'number' ? prevDbSong.rating : 0}
                onRatingChange={async (newRating) => {
                  setPrevDbSong({ ...prevDbSong, rating: newRating });
                  await fetch('/api/songs', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: prevDbSong.id, rating: newRating }),
                  });
                }}
                size={40}
                nightMode={nightMode}
                emptyColor="#18181b"
              />
            </div>
          </div>
        </div>
      )}

      {/* Custom Genius Modal */}
      {showCustomGeniusModal && dbSong && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70"
          onClick={() => setShowCustomGeniusModal(false)}
        >
          <div
            className="bg-zinc-900 rounded-lg shadow-lg p-6 max-w-xs w-full relative flex flex-col items-center"
            onClick={e => e.stopPropagation()}
          >
            <button onClick={() => setShowCustomGeniusModal(false)} className="absolute top-2 right-2 text-gray-400 hover:text-white text-2xl">&times;</button>
            {playlistArtworkUrl && (
              <img
                src={playlistArtworkUrl}
                alt="Playlist Art"
                className="w-16 h-16 rounded mb-4 border border-gray-700"
              />
            )}
            <button
              onClick={handleGeniusIconClick}
              className="text-yellow-400 hover:text-yellow-300 focus:outline-none"
              style={{ fontSize: 36 }}
              title="View on Genius"
              disabled={!dbSong}
            >
              <SiGenius />
            </button>
          </div>
        </div>
      )}
      {/* GeniusLyricsModal */}
      <GeniusLyricsModal
        open={showLyricsModal}
        onClose={() => setShowLyricsModal(false)}
        songTitle={dbSong ? dbSong.title : ''}
        songArtist={dbSong ? dbSong.artist : ''}
      />
    </div>
  );
} 