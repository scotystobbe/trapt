import React, { useEffect, useState, useCallback, useRef } from "react";
import LogoHeader from '../components/LogoHeader';
import HamburgerMenu from '../components/HamburgerMenu';
import { FaSpotify, FaStar, FaRegEdit } from 'react-icons/fa';

function EditableStarRating({ rating, onRatingChange, size = 40 }) {
  return (
    <div className="flex gap-1 mt-2 mb-4">
      {[1, 2, 3, 4, 5].map((star) => (
        <FaStar
          key={star}
          className={star <= rating ? 'text-yellow-400 cursor-pointer' : 'text-gray-600 cursor-pointer'}
          size={size}
          onClick={() => onRatingChange(star)}
        />
      ))}
    </div>
  );
}

export default function NowPlaying() {
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

  return (
    <div className="bg-gray-900 min-h-screen">
      <LogoHeader>
        <HamburgerMenu />
      </LogoHeader>
      <div className="max-w-2xl mx-auto w-full p-4 flex flex-col items-center pt-8">
        {initialLoading ? (
          <p className="text-gray-300">Loading...</p>
        ) : !isAuthenticated ? (
          <button
            onClick={handleConnect}
            className="px-6 py-3 bg-green-600 text-white rounded-lg text-lg font-semibold hover:bg-green-500 transition"
          >
            Connect to Spotify
          </button>
        ) : !track ? (
          <p className="text-gray-300">No track currently playing.</p>
        ) : dbSong ? (
          <div className="w-full flex flex-col items-center">
            <div className="relative mb-8">
              {dbSong.artworkUrl && (
                <img src={dbSong.artworkUrl} alt={dbSong.title} className="w-72 h-72 rounded-2xl object-cover shadow-lg" />
              )}
              <FaSpotify className="absolute bottom-3 left-3 text-green-500 opacity-50 w-12 h-12 pointer-events-none" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-2 text-center">{dbSong.title}</h2>
            <p className="text-xl text-gray-200 mb-1 text-center">{dbSong.artist}</p>
            <p className="text-lg text-gray-400 mb-2 text-center">{dbSong.playlist?.name}</p>
            <EditableStarRating rating={dbSong.rating} onRatingChange={handleRatingChange} size={40} />
            <div className="bg-gray-800 rounded-lg p-4 w-full max-w-lg mt-2 text-gray-200 min-h-[60px] text-left">
              {editingNotes ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="w-full p-2 rounded bg-gray-900 border border-gray-700 text-white"
                  />
                  <button
                    onClick={handleNoteSave}
                    className="self-end px-3 py-1 bg-blue-600 rounded hover:bg-blue-500"
                    disabled={saving}
                  >{saving ? 'Saving...' : 'Save'}</button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <p className="whitespace-pre-wrap flex-1">{dbSong.notes || <em className="text-gray-400">No notes</em>}</p>
                  <button onClick={() => setEditingNotes(true)} className="ml-2 text-gray-400 hover:text-white">
                    <FaRegEdit />
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center w-full">
            <div className="relative mb-8">
              {track.album.images?.[0]?.url && (
                <img src={track.album.images[0].url} alt={track.name} className="w-72 h-72 rounded-2xl object-cover shadow-lg" />
              )}
              <FaSpotify className="absolute bottom-3 left-3 text-green-500 opacity-50 w-12 h-12 pointer-events-none" />
            </div>
            <h3 className="text-3xl font-bold text-white mb-2 text-center">{track.name}</h3>
            <p className="text-xl text-gray-200 mb-1 text-center">{track.artists.map(a => a.name).join(', ')}</p>
            <p className="text-lg text-gray-400 mb-2 text-center">{track.album.name}</p>
            <a href={track.external_urls.spotify} target="_blank" rel="noopener noreferrer" className="text-green-400 underline">Open in Spotify</a>
          </div>
        )}
        {error && <div className="text-red-400 mt-4">{error}</div>}
      </div>
    </div>
  );
} 