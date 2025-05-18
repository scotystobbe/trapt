import React, { useEffect, useState, useCallback } from "react";
import LogoHeader from '../components/LogoHeader';
import HamburgerMenu from '../components/HamburgerMenu';
import SongCard from '../components/SongCard';

export default function NowPlaying() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [track, setTrack] = useState(null);
  const [dbSong, setDbSong] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Helper to check auth and fetch currently playing
  const fetchCurrentlyPlaying = useCallback(async () => {
    setLoading(true);
    setError('');
    setDbSong(null);
    try {
      const res = await fetch('/api/spotify-proxy/currently-playing');
      if (res.status === 401) {
        setIsAuthenticated(false);
        setTrack(null);
        setLoading(false);
        return;
      }
      setIsAuthenticated(true);
      const data = await res.json();
      if (!data || data.playing === false || !data.item) {
        setTrack(null);
        setLoading(false);
        return;
      }
      setTrack(data.item);
      // Try to match with DB by spotifyLink
      const songRes = await fetch('/api/songs');
      const songs = await songRes.json();
      const match = songs.find(s => s.spotifyLink && s.spotifyLink.includes(data.item.id));
      setDbSong(match || null);
    } catch (err) {
      setError('Failed to fetch currently playing track.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentlyPlaying();
    const interval = setInterval(fetchCurrentlyPlaying, 5000);
    return () => clearInterval(interval);
  }, [fetchCurrentlyPlaying]);

  const handleConnect = () => {
    window.location.href = '/api/spotify-proxy/login';
  };

  return (
    <div className="bg-gray-900 min-h-screen">
      <LogoHeader>
        <HamburgerMenu />
      </LogoHeader>
      <div className="max-w-2xl mx-auto w-full p-4 flex flex-col items-center justify-center min-h-[70vh]">
        <div className="bg-green-900 rounded-2xl p-8 shadow-lg w-full flex flex-col items-center">
          <h2 className="text-3xl font-bold text-white mb-4">Now Playing</h2>
          {loading ? (
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
            <div className="w-full">
              <SongCard song={dbSong} playlistName={dbSong.playlist?.name} />
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <img src={track.album.images?.[0]?.url} alt={track.name} className="w-40 h-40 rounded-lg mb-4 object-cover" />
              <h3 className="text-2xl font-bold text-white mb-1">{track.name}</h3>
              <p className="text-lg text-gray-200 mb-1">{track.artists.map(a => a.name).join(', ')}</p>
              <p className="text-gray-400 mb-2">{track.album.name}</p>
              <a href={track.external_urls.spotify} target="_blank" rel="noopener noreferrer" className="text-green-400 underline">Open in Spotify</a>
            </div>
          )}
          {error && <div className="text-red-400 mt-4">{error}</div>}
        </div>
      </div>
    </div>
  );
} 