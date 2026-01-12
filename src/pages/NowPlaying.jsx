import React, { useEffect, useState, useCallback, useRef } from "react";
import LogoHeader from '../components/LogoHeader';
import HamburgerMenu from '../components/HamburgerMenu';
import { FaSpotify, FaStar, FaRegEdit, FaHistory, FaRegStar } from 'react-icons/fa';
import { useNightMode } from '../App';
import Skeleton from '../components/Skeleton';
import useSWR from 'swr';
import { SiGenius } from 'react-icons/si';
import usePrevTrackStore from '../data/usePrevTrackStore';
import { useAuth } from '../components/AuthProvider';
import { useSpeech, getSpeechMode, SPEECH_MODES, isPWA } from '../hooks/useSpeech';
import SpeechPermissionBanner from '../components/SpeechPermissionBanner';

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

// Add helper function to open Genius app or fallback to web
function openGeniusAppOrWeb(songId, webUrl) {
  // Use direct link to avoid blank browser issue
  // Open the web URL directly - it will open in the Genius app if installed, otherwise in browser
  window.open(webUrl, '_blank', 'noopener,noreferrer');
}

// Scrolling text component for artist/album
function ScrollingText({ text, className }) {
  const containerRef = React.useRef(null);
  const textRef = React.useRef(null);
  const [needsScroll, setNeedsScroll] = React.useState(false);
  const [scrollDistance, setScrollDistance] = React.useState(0);
  const animationIdRef = React.useRef(null);
  const uniqueIdRef = React.useRef(Math.random().toString(36).substr(2, 9));

  React.useEffect(() => {
    if (!containerRef.current || !textRef.current || !text) return;
    
    const updateSizes = () => {
      // Ensure text is set to nowrap for measurement
      textRef.current.style.whiteSpace = 'nowrap';
      textRef.current.style.display = 'inline-block';
      
      // Force a reflow
      void textRef.current.offsetWidth;
      
      const containerWidth = containerRef.current.offsetWidth;
      const textWidth = textRef.current.scrollWidth;
      
      if (textWidth > containerWidth && containerWidth > 0) {
        setNeedsScroll(true);
        setScrollDistance(textWidth - containerWidth);
      } else {
        setNeedsScroll(false);
        setScrollDistance(0);
      }
    };
    
    // Use multiple delays to ensure DOM is ready
    const timeout1 = setTimeout(() => {
      updateSizes();
    }, 50);
    
    const timeout2 = setTimeout(() => {
      updateSizes();
    }, 300);
    
    window.addEventListener('resize', updateSizes);
    return () => {
      clearTimeout(timeout1);
      clearTimeout(timeout2);
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      window.removeEventListener('resize', updateSizes);
    };
  }, [text, className]);

  if (!needsScroll || scrollDistance === 0) {
    return (
      <div ref={containerRef} className="overflow-hidden w-full text-center" style={{ whiteSpace: 'nowrap', maxWidth: '100%' }}>
        <span ref={textRef} className={className} style={{ whiteSpace: 'nowrap', display: 'inline-block' }}>{text}</span>
      </div>
    );
  }

  const pauseTime = 3; // seconds to pause at start/end
  const scrollTime = 8; // seconds to scroll
  const totalTime = pauseTime * 2 + scrollTime;
  const pausePercent = (pauseTime / totalTime) * 100;
  const scrollEndPercent = ((pauseTime + scrollTime) / totalTime) * 100;

  return (
    <div ref={containerRef} className="overflow-hidden w-full text-center relative" style={{ whiteSpace: 'nowrap', maxWidth: '100%' }}>
      <span
        ref={textRef}
        className={className}
        style={{
          display: 'inline-block',
          whiteSpace: 'nowrap',
          animation: `scroll-text-${uniqueIdRef.current} ${totalTime}s linear infinite`,
        }}
      >
        {text}
      </span>
      <style>{`
        @keyframes scroll-text-${uniqueIdRef.current} {
          0%, ${pausePercent}% {
            transform: translateX(0);
          }
          ${scrollEndPercent}%, 100% {
            transform: translateX(-${scrollDistance}px);
          }
        }
      `}</style>
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
  const prevTrack = usePrevTrackStore(state => state.prevTrack);
  const prevDbSong = usePrevTrackStore(state => state.prevDbSong);
  const setPrevTrack = usePrevTrackStore(state => state.setPrevTrack);
  const setPrevDbSong = usePrevTrackStore(state => state.setPrevDbSong);
  const [showGeniusModal, setShowGeniusModal] = useState(false);
  const [showCustomGeniusModal, setShowCustomGeniusModal] = useState(false);
  const [showLyricsModal, setShowLyricsModal] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const { speak } = useSpeech();
  const trackProgressRef = useRef(null);
  const trackDurationRef = useRef(null);
  const hasSpokenStartRef = useRef(false);
  const hasSpokenEndRef = useRef(false);
  const endCheckIntervalRef = useRef(null);

  // SWR for songs
  const fetcher = url => fetch(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now()).then(res => res.json());
  const { data: songs = [], error: songsError, mutate: mutateSongs } = useSWR('/api/songs', fetcher);

  // Helper to speak track information
  const speakTrackInfo = useCallback((isStart = true) => {
    const speechMode = getSpeechMode();
    if (speechMode === SPEECH_MODES.OFF) {
      console.log('[Speech] Mode is OFF, skipping');
      return;
    }
    if (isStart && speechMode !== SPEECH_MODES.BEGINNING_ONLY && speechMode !== SPEECH_MODES.BOTH) {
      console.log('[Speech] Start speech disabled for mode:', speechMode);
      return;
    }
    if (!isStart && speechMode !== SPEECH_MODES.END_ONLY && speechMode !== SPEECH_MODES.BOTH) {
      console.log('[Speech] End speech disabled for mode:', speechMode);
      return;
    }

    // Use dbSong if available (more accurate), otherwise use track data from Spotify
    const trackName = dbSong?.title || track?.name || '';
    const artistName = dbSong?.artist || (track?.artists?.[0]?.name) || '';

    if (!trackName || !artistName) {
      console.log('[Speech] Missing track info:', { trackName, artistName, hasTrack: !!track, hasDbSong: !!dbSong });
      return;
    }

    const text = isStart 
      ? `This is ${trackName} by ${artistName}`
      : `That was ${trackName} by ${artistName}`;
    
    console.log('[Speech] Speaking:', text);
    speak(text);
  }, [track, dbSong, speak]);

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
        // Clear tracking when nothing is playing
        trackProgressRef.current = null;
        trackDurationRef.current = null;
        hasSpokenStartRef.current = false;
        hasSpokenEndRef.current = false;
        if (endCheckIntervalRef.current) {
          clearInterval(endCheckIntervalRef.current);
          endCheckIntervalRef.current = null;
        }
        return;
      }

      // Store progress and duration for end detection (update on every poll)
      trackProgressRef.current = data.progress_ms || 0;
      trackDurationRef.current = data.item.duration_ms || 0;

      // Only update if the track has changed
      if (lastTrackId.current !== data.item.id) {
        console.log('[Speech] Track changed:', data.item.name, 'Previous:', lastTrackId.current);
        if (editingNotes) {
          // Don't update if editing notes
          return;
        }
        // Only save current track as previous if we actually have a track and dbSong
        if (track && dbSong) {
          setPrevTrack(track);
          setPrevDbSong(dbSong);
        }
        setTrack(data.item);
        lastTrackId.current = data.item.id;
        // Use SWR-cached songs
        const match = songs.find(s => s.spotifyLink && s.spotifyLink.includes(data.item.id));
        setDbSong(match || null);
        setNotes(match?.notes || '');
        setEditingNotes(false);
        
        // Reset speech flags for new track
        hasSpokenStartRef.current = false;
        hasSpokenEndRef.current = false;
        
        // Clear any existing end check interval
        if (endCheckIntervalRef.current) {
          clearInterval(endCheckIntervalRef.current);
          endCheckIntervalRef.current = null;
        }
      }
      if (isInitial) setInitialLoading(false);
    } catch (err) {
      setError('Failed to fetch currently playing track.');
      if (isInitial) setInitialLoading(false);
    }
  }, [editingNotes, track, dbSong, songs, setPrevTrack, setPrevDbSong]);


  // Effect to speak at track start
  useEffect(() => {
    if (!track) {
      console.log('[Speech] No track, skipping start speech');
      return;
    }
    if (hasSpokenStartRef.current) {
      console.log('[Speech] Already spoken start for track:', track.id);
      return;
    }
    
    console.log('[Speech] Setting up start speech for track:', track.name);
    // Small delay to ensure track data is fully loaded (and dbSong if available)
    const timeout = setTimeout(() => {
      console.log('[Speech] Executing start speech, hasDbSong:', !!dbSong);
      speakTrackInfo(true);
      hasSpokenStartRef.current = true;
    }, 1000); // Increased delay to allow dbSong to match
    
    return () => clearTimeout(timeout);
  }, [track?.id, speakTrackInfo, dbSong?.id]);

  // Effect to monitor track progress and speak at end
  useEffect(() => {
    if (!track) return;
    if (!trackDurationRef.current) {
      console.log('[Speech] No duration yet, waiting...');
      return;
    }
    
    console.log('[Speech] Setting up end detection for track:', track.name, 'Duration:', trackDurationRef.current);
    // Check every second if we're near the end
    endCheckIntervalRef.current = setInterval(() => {
      const progress = trackProgressRef.current || 0;
      const duration = trackDurationRef.current || 0;
      
      // Speak when we're within 2 seconds of the end (or if progress >= duration)
      if (duration > 0 && progress > 0 && !hasSpokenEndRef.current) {
        const remaining = duration - progress;
        if (remaining <= 2000 || progress >= duration) {
          console.log('[Speech] Track ending, speaking. Progress:', progress, 'Duration:', duration, 'Remaining:', remaining);
          speakTrackInfo(false);
          hasSpokenEndRef.current = true;
        }
      }
    }, 1000);
    
    return () => {
      if (endCheckIntervalRef.current) {
        clearInterval(endCheckIntervalRef.current);
        endCheckIntervalRef.current = null;
      }
    };
  }, [track?.id, speakTrackInfo]);

  useEffect(() => {
    if (songs.length === 0 && !songsError) return; // Wait for songs to load or error
    fetchCurrentlyPlaying(true);
    // Poll every 3 seconds for faster track data updates (reduced from 5 seconds)
    const interval = setInterval(() => fetchCurrentlyPlaying(false), 3000);
    return () => clearInterval(interval);
    // eslint-disable-next-line
  }, [fetchCurrentlyPlaying, songs.length, songsError]);

  const handleConnect = () => {
    window.location.href = '/api/spotify-proxy/login';
  };

  const handleRatingChange = async (newRating) => {
    if (!isAdmin || !dbSong) return;
    setDbSong({ ...dbSong, rating: newRating });
    try {
      await fetch('/api/songs', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ id: dbSong.id, rating: newRating }),
      });
      mutateSongs();
    } catch (err) {
      setError('Could not save rating.');
    }
  };

  const handleNoteSave = async () => {
    if (!isAdmin || !dbSong) return;
    setSaving(true);
    setError('');
    try {
      await fetch('/api/songs', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
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
    
    // If we have a stored Genius ID, use it directly
    if (dbSong.geniusSongId && dbSong.geniusUrl) {
      openGeniusAppOrWeb(dbSong.geniusSongId, dbSong.geniusUrl);
      return;
    }
    
    // Otherwise, search (only for admin users on desktop)
    if (!isAdmin) {
      // Non-admin users can't search, open web search
      const searchUrl = `https://genius.com/search?q=${encodeURIComponent(dbSong.artist + ' ' + dbSong.title)}`;
      window.open(searchUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    
    setSearchLoading(true);
    setSearchError('');
    setShowResults(false);
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
        // Store the match for future use
        try {
          await fetch('/api/songs', {
            method: 'PUT',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ 
              id: dbSong.id, 
              geniusSongId: exact.result.id, 
              geniusUrl: exact.result.url 
            }),
          });
          setDbSong({ ...dbSong, geniusSongId: exact.result.id, geniusUrl: exact.result.url });
        } catch (err) {
          console.error('Failed to save Genius ID:', err);
        }
        openGeniusAppOrWeb(exact.result.id, exact.result.url);
      } else {
        setSearchResults(hits);
        setShowResults(true);
      }
    } catch (err) {
      setSearchError('Could not search Genius.');
      setShowResults(true);
    } finally {
      setSearchLoading(false);
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
      <div className="max-w-2xl mx-auto w-full px-4 pt-8 pb-4 flex flex-col items-center">
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
        ) : track ? (
          <div className="w-full flex flex-col items-center">
            <div className={"relative mb-8 " + dimClass}>
              {(dbSong?.artworkUrl || track?.album?.images?.[0]?.url) && (
                <img 
                  src={dbSong?.artworkUrl || track?.album?.images?.[0]?.url} 
                  alt={dbSong?.title || track?.name || ''} 
                  className={"w-56 h-56 rounded-2xl object-cover shadow-lg " + dimClass} 
                />
              )}
            </div>
            <h2
              className={"text-4xl font-bold mb-2 text-center line-clamp-2 " + (nightMode ? 'text-red-800' : 'text-white')}
              onClick={() => dbSong && setShowCustomGeniusModal(true)}
              style={{ 
                cursor: dbSong ? 'pointer' : 'default',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '100%',
              }}
            >
              {dbSong?.title || track?.name || ''}
            </h2>
            <div className="mb-1 w-full max-w-full" style={{ overflow: 'hidden' }}>
              <ScrollingText 
                text={dbSong?.artist || track?.artists?.[0]?.name || ''} 
                className={"text-3xl " + (nightMode ? 'text-red-800' : 'text-white')}
              />
            </div>
            <div className="mb-2 w-full max-w-full" style={{ overflow: 'hidden' }}>
              <ScrollingText 
                text={dbSong?.album || track?.album?.name || ''} 
                className={"text-lg " + (nightMode ? 'text-red-900' : 'text-gray-500')}
              />
            </div>
            {dbSong && (
              <>
            <EditableStarRating rating={dbSong.rating} onRatingChange={isAdmin ? handleRatingChange : undefined} size={72} nightMode={nightMode} emptyColor={nightMode ? '#18181b' : undefined} />
            <div
              className={"rounded-lg p-4 w-full max-w-lg mt-2 min-h-[60px] text-left " + textClass}
              style={{ backgroundColor: nightMode ? '#141416' : '#27272a', cursor: editingNotes ? 'auto' : 'text' }}
              onClick={() => isAdmin && !editingNotes && setEditingNotes(true)}
            >
              {editingNotes ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className={"w-full p-2 rounded bg-[#27272a] border border-[#3f3f46] text-white placeholder-gray-500 focus:ring-0 focus:border-[#3f3f46] focus:outline-none caret-white selection:bg-[#3f3f46] selection:text-white autofill:bg-[#27272a] autofill:text-white " + textClass}
                    autoFocus
                    disabled={!isAdmin}
                  />
                  {isAdmin && (
                    <button
                      onClick={handleNoteSave}
                      className={"self-end px-3 py-1 bg-[#3f3f46] text-white rounded hover:bg-[#27272a] " + dimClass}
                      disabled={saving}
                    >{saving ? 'Saving...' : 'Save'}</button>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between w-full">
                  <p className={"whitespace-pre-wrap flex-1 " + (dbSong.notes ? (nightMode ? 'text-red-800' : 'text-gray-400') : textClass)}>{dbSong.notes || <em className="text-gray-400">No notes</em>}</p>
                </div>
              )}
            </div>
              </>
            )}
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
                    headers: { 
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
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
              className="text-yellow-400 hover:text-yellow-300 focus:outline-none flex flex-col items-center gap-2"
              title="View on Genius"
              disabled={!dbSong || searchLoading}
            >
              <SiGenius style={{ fontSize: 36 }} />
              <span className="text-sm font-medium">Open Lyrics</span>
            </button>
            {searchLoading && <div className="text-gray-300 mt-4">Loading...</div>}
            {showResults && (
              <div className="absolute left-0 right-0 top-full mt-4 bg-zinc-900 border border-yellow-400 rounded shadow-lg p-4 w-full z-50">
                <div className="text-gray-300 mb-2">Select the correct song:</div>
                {searchError && <div className="text-red-500 mb-2">{searchError}</div>}
                <ul className="space-y-2 max-h-60 overflow-y-auto">
                  {searchResults.map(hit => (
                    <li key={hit.result.id} className="flex items-center gap-2 bg-zinc-800 rounded p-2 cursor-pointer hover:bg-zinc-700" onClick={async () => { 
                      // Store the selected match for future use
                      if (isAdmin && dbSong) {
                        try {
                          await fetch('/api/songs', {
                            method: 'PUT',
                            headers: { 
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${localStorage.getItem('token')}`
                            },
                            body: JSON.stringify({ 
                              id: dbSong.id, 
                              geniusSongId: hit.result.id, 
                              geniusUrl: hit.result.url 
                            }),
                          });
                          setDbSong({ ...dbSong, geniusSongId: hit.result.id, geniusUrl: hit.result.url });
                        } catch (err) {
                          console.error('Failed to save Genius ID:', err);
                        }
                      }
                      openGeniusAppOrWeb(hit.result.id, hit.result.url); 
                      setShowResults(false); 
                      setShowCustomGeniusModal(false); 
                    }}>
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
                <button onClick={() => setShowResults(false)} className="mt-2 px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600">Cancel</button>
              </div>
            )}
          </div>
        </div>
      )}
      <SpeechPermissionBanner />
    </div>
  );
} 