import React, { useEffect, useState, useRef } from "react";
import LogoHeader from '../components/LogoHeader';
import HamburgerMenu from '../components/HamburgerMenu';
import { FaSpotify, FaStar, FaRegEdit, FaHistory, FaRegStar } from 'react-icons/fa';
import { useNightMode } from '../App';
import Skeleton from '../components/Skeleton';
import useSWR from 'swr';
import { SiGenius } from 'react-icons/si';
import usePrevTrackStore from '../data/usePrevTrackStore';
import { useAuth } from '../components/AuthProvider';
import { useSpeech, getSpeechMode, canSpeak } from '../hooks/useSpeech';
import { createTrackAnnouncer, spotifyRequest, playbackCommand } from '../lib/trackAnnouncements';
import SpeechPermissionBanner from '../components/SpeechPermissionBanner';
import RatingKeyModal from '../components/RatingKeyModal';
import { useLongPressRatingKey } from '../hooks/useLongPressRatingKey';

function EditableStarRating({ rating, onRatingChange, size = 56, nightMode, emptyColor }) {
  const { keyOpen, setKeyOpen, longPressHandlers, wrapStarClick } = useLongPressRatingKey();

  const setRating = (star) => {
    if (!onRatingChange) return;
    if (star === 1 && rating === 1) {
      onRatingChange(null);
    } else {
      onRatingChange(star);
    }
  };

  return (
    <>
      <div className="flex gap-2 mt-2 mb-4 w-full max-w-lg justify-center sm:gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <span key={star} className="inline-flex touch-manipulation" {...longPressHandlers}>
            {star <= rating ? (
              <FaStar
                className={nightMode ? 'text-red-800 cursor-pointer' : 'text-yellow-400 cursor-pointer'}
                onClick={wrapStarClick(() => setRating(star))}
                size={size}
              />
            ) : (
              <FaRegStar
                className={nightMode ? 'text-red-900 cursor-pointer' : 'text-gray-400 cursor-pointer'}
                onClick={wrapStarClick(() => setRating(star))}
                size={size}
              />
            )}
          </span>
        ))}
      </div>
      <RatingKeyModal open={keyOpen} onClose={() => setKeyOpen(false)} />
    </>
  );
}

// Add helper function to open Genius app or fallback to web
function openGeniusAppOrWeb(songId, webUrl, onOpen) {
  // Create a temporary anchor element to open externally
  // This avoids the blank internal browser issue in PWAs
  const link = document.createElement('a');
  link.href = webUrl;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  // Add to body, click, then remove
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Call callback if provided (e.g., to close modal)
  if (onOpen) {
    setTimeout(onOpen, 100);
  }
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
  const [announcementStatus, setAnnouncementStatus] = useState('');
  const [announcementError, setAnnouncementError] = useState('');

  // SWR for songs
  const fetcher = url => fetch(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now()).then(res => res.json());
  const { data: songs = [], mutate: mutateSongs } = useSWR('/api/songs', fetcher);

  // Spotify may respond before the song library. Attach ratings/notes once
  // that library arrives without restarting playback observation.
  useEffect(() => {
    if (!track || dbSong || editingNotes) return;
    const match = songs.find(song => song.spotifyLink?.includes(track.id));
    if (match) {
      setDbSong(match);
      setNotes(match.notes || '');
    }
  }, [songs, track, dbSong, editingNotes]);

  // Keep polling independent of renders, song edits and SWR cache refreshes.
  const pageRef = useRef();
  pageRef.current = { songs, editingNotes, track, dbSong };

  useEffect(() => {
    let mounted = true;
    let timer;
    let initial = true;
    const readPlayback = () => spotifyRequest('currently-playing');
    const announcer = createTrackAnnouncer({
      getMode: getSpeechMode,
      canSpeak,
      speak,
      readPlayback,
      command: playbackCommand,
      describe: (item, isStart) => {
        const match = pageRef.current.songs.find(song => song.spotifyLink?.includes(item.id));
        const title = match?.title || item.name;
        const artist = match?.artist || item.artists?.map(a => a.name).join(', ');
        return title && artist ? `${isStart ? 'This is' : 'That was'} ${title} by ${artist}` : '';
      },
      onStatus: status => {
        if (!mounted) return;
        setAnnouncementStatus(status);
        if (status === 'Pausing Spotify for announcements…') setAnnouncementError('');
      },
      onError: err => { if (mounted) setAnnouncementError(err.message); },
    });

    async function poll() {
      let delay = 3000;
      try {
        const data = await readPlayback();
        if (!mounted) return;
        setIsAuthenticated(true);
        setError('');
        const { songs, editingNotes, track, dbSong } = pageRef.current;
        if (!data.item) {
          if (!editingNotes) {
            setTrack(null);
            setDbSong(null);
            lastTrackId.current = null;
          }
        } else if (lastTrackId.current !== data.item.id && !editingNotes) {
          if (track && dbSong) {
            setPrevTrack(track);
            setPrevDbSong(dbSong);
          }
          lastTrackId.current = data.item.id;
          setTrack(data.item);
          const match = songs.find(song => song.spotifyLink?.includes(data.item.id));
          setDbSong(match || null);
          setNotes(match?.notes || '');
        }
        setInitialLoading(false);
        initial = false;
        await announcer.observe(data);
        delay = announcer.nextPollDelay(data);
      } catch (err) {
        if (!mounted) return;
        if (err.status === 401) {
          setIsAuthenticated(false);
          if (initial) {
            window.location.replace('/api/spotify-proxy/login');
            return;
          }
        } else {
          setError('Failed to fetch currently playing track.');
        }
        setInitialLoading(false);
        delay = Math.max(3000, err.retryAfterMs || 0);
      } finally {
        if (mounted) timer = setTimeout(poll, delay);
      }
    }
    const onModeChange = () => announcer.cancel();
    const onVisibilityChange = () => {
      if (document.hidden) announcer.suspend();
      else announcer.resume();
    };
    window.addEventListener('speech-mode-changed', onModeChange);
    document.addEventListener('visibilitychange', onVisibilityChange);
    if (document.hidden) announcer.suspend();
    poll();
    return () => {
      mounted = false;
      clearTimeout(timer);
      window.removeEventListener('speech-mode-changed', onModeChange);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      // Cancel speech and release any Spotify pause that we initiated.
      announcer.dispose();
    };
  }, [speak, setPrevTrack, setPrevDbSong]);

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
      openGeniusAppOrWeb(dbSong.geniusSongId, dbSong.geniusUrl, () => {
        setShowCustomGeniusModal(false);
      });
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
        openGeniusAppOrWeb(exact.result.id, exact.result.url, () => {
          setShowCustomGeniusModal(false);
        });
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
        {announcementStatus && <p role="status" className="text-gray-400 text-sm mt-4 text-center">{announcementStatus}</p>}
        {announcementError && <p role="alert" className="text-amber-400 text-sm mt-4 text-center">{announcementError}</p>}
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
                      openGeniusAppOrWeb(hit.result.id, hit.result.url, () => {
                        setShowResults(false);
                        setShowCustomGeniusModal(false);
                      }); 
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