import React, { useEffect, useState, useCallback, useRef } from "react";
import LogoHeader from '../components/LogoHeader';
import HamburgerMenu from '../components/HamburgerMenu';
import { FaSpotify, FaStar, FaRegEdit } from 'react-icons/fa';
import { useNightMode } from '../App';
import Skeleton from '../components/Skeleton';

function EditableStarRating({ rating, onRatingChange, size = 56, nightMode }) {
  return (
    <div className="flex gap-2 mt-2 mb-4 w-full max-w-lg justify-center sm:gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <FaStar
          key={star}
          className={
            star <= rating
              ? nightMode
                ? 'text-red-800 cursor-pointer'
                : 'text-yellow-400 cursor-pointer'
              : nightMode
                ? 'text-red-900 cursor-pointer'
                : 'text-[#27272a] cursor-pointer'
          }
          size={size}
          onClick={() => onRatingChange(star)}
        />
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
        setTrack(data.item);
        lastTrackId.current = data.item.id;
        // Try to match with DB by spotifyLink
        const songRes = await fetch('/api/songs');
        const songs = await songRes.json();
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
  }, []);

  useEffect(() => {
    fetchCurrentlyPlaying(true);
    const interval = setInterval(() => fetchCurrentlyPlaying(false), 5000);
    return () => clearInterval(interval);
  }, [fetchCurrentlyPlaying]);

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
    } catch (err) {
      setError('Could not save notes.');
    } finally {
      setSaving(false);
    }
  };

  // Helper for dimming
  const dimClass = nightMode ? 'opacity-40' : '';
  const textClass = nightMode ? 'text-red-800' : '';

  return (
    <div style={{ backgroundColor: '#18181b' }} className={"min-h-screen " + (nightMode ? 'night-mode' : '')}>
      <LogoHeader logoClassName={dimClass}>
        <HamburgerMenu className={dimClass} />
      </LogoHeader>
      <div className="max-w-2xl mx-auto w-full p-4 flex flex-col items-center pt-8">
        {initialLoading ? (
          <div className="flex flex-col items-center w-full">
            <Skeleton className="w-72 h-72 mb-8" />
            <Skeleton className="w-48 h-8 mb-2" />
            <Skeleton className="w-32 h-6 mb-1" />
            <Skeleton className="w-40 h-5 mb-4" />
            <div className="flex gap-2 mb-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="w-10 h-10 rounded-full" />
              ))}
            </div>
            <Skeleton className="w-full max-w-lg h-16" />
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
              <FaSpotify className={"absolute bottom-3 left-3 text-green-500 opacity-50 w-12 h-12 pointer-events-none " + dimClass} />
            </div>
            <h2 className="text-4xl font-bold mb-2 text-center text-white">{dbSong.title}</h2>
            <p className="text-3xl mb-1 text-center text-white">{dbSong.artist}</p>
            <p className={"text-lg mb-2 text-center " + (nightMode ? 'text-red-900' : 'text-gray-500')}>{dbSong.album || track?.album?.name}</p>
            <EditableStarRating rating={dbSong.rating} onRatingChange={handleRatingChange} size={72} nightMode={nightMode} />
            <div
              className={"bg-gray-800 rounded-lg p-4 w-full max-w-lg mt-2 min-h-[60px] text-left " + textClass}
              onClick={() => !editingNotes && setEditingNotes(true)}
              style={{ cursor: editingNotes ? 'auto' : 'text' }}
            >
              {editingNotes ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className={"w-full p-2 rounded bg-[#27272a] border border-[#3f3f46] text-white placeholder-gray-500 focus:ring-0 focus:border-[#3f3f46] " + textClass}
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
                  <p className={"whitespace-pre-wrap flex-1 " + textClass}>{dbSong.notes || <em className="text-gray-400">No notes</em>}</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center w-full">
            <div className={"relative mb-8 " + dimClass}>
              {track.album.images?.[0]?.url && (
                <img src={track.album.images[0].url} alt={track.name} className={"w-72 h-72 rounded-2xl object-cover shadow-lg " + dimClass} />
              )}
              <FaSpotify className={"absolute bottom-3 left-3 text-green-500 opacity-50 w-12 h-12 pointer-events-none " + dimClass} />
            </div>
            <h3 className={"text-3xl font-bold mb-2 text-center " + textClass}>{track.name}</h3>
            <p className={"text-2xl mb-1 text-center " + textClass}>{track.artists.map(a => a.name).join(', ')}</p>
            <p className={"text-lg mb-2 text-center " + (nightMode ? 'text-red-900' : 'text-gray-500')}>{track.album.name}</p>
            <a href={track.external_urls.spotify} target="_blank" rel="noopener noreferrer" className={"text-green-400 underline " + dimClass}>Open in Spotify</a>
          </div>
        )}
        {error && <div className={"text-red-400 mt-4 " + textClass}>{error}</div>}
      </div>
    </div>
  );
} 