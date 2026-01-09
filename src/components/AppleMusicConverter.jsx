import React, { useState, useRef, useEffect } from 'react';
import Button from './Button';
import TrackMatchSelector from './TrackMatchSelector';
import { FaApple, FaSpotify, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';

export default function AppleMusicConverter({ onComplete }) {
  const [step, setStep] = useState('input'); // input, matching, review, creating, complete
  const [playlistId, setPlaylistId] = useState('');
  const [userToken, setUserToken] = useState('');
  const [playlistName, setPlaylistName] = useState('');
  const [playlistDescription, setPlaylistDescription] = useState('');
  const [tracks, setTracks] = useState([]);
  const [matches, setMatches] = useState([]);
  const [unmatched, setUnmatched] = useState([]);
  const [confirmedTracks, setConfirmedTracks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [summary, setSummary] = useState(null);
  const [spotifyPlaylistUrl, setSpotifyPlaylistUrl] = useState('');
  const matchingStartedRef = useRef(false);

  // Step 1: Fetch Apple Music playlist
  const handleFetchPlaylist = async () => {
    setError('');
    setLoading(true);
    setProgress(0);

    try {
      const res = await fetch('/api/apple-music/fetch-playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlistId, userToken }),
      });

      const data = await res.json();

      if (res.status === 401 && data.code === 'APPLE_MUSIC_AUTH_REQUIRED') {
        setError('Apple Music authentication required. Please provide a valid user token.');
        setLoading(false);
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch playlist');
      }

      setPlaylistName(data.playlistName);
      setPlaylistDescription(`Converted from Apple Music`);
      setTracks(data.tracks);
      matchingStartedRef.current = false;
      setStep('matching');
      setProgress(0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Match tracks
  const handleMatchTracks = async () => {
    setError('');
    setLoading(true);
    setProgress(0);

    try {
      // Get Spotify token from cookies (we'll need to pass it from the backend)
      // For now, we'll get it via a proxy endpoint or pass it from the frontend
      const res = await fetch('/api/apple-music/match-tracks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracks }),
      });

      const data = await res.json();

      if (res.status === 401 && data.code === 'SPOTIFY_AUTH_REQUIRED') {
        setError('Spotify authentication required. Please log in to Spotify first.');
        setLoading(false);
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || 'Failed to match tracks');
      }

      setMatches(data.matches);
      setUnmatched(data.unmatched);
      setSummary(data.summary);
      setConfirmedTracks(data.matches.map(m => ({
        ...m.spotifyTrack,
        position: m.position,
        matchType: m.matchType,
      })));
      setStep('review');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Handle track confirmation
  const handleTrackConfirmed = (appleTrack, spotifyTrack) => {
    const newConfirmed = [...confirmedTracks];
    const existingIndex = newConfirmed.findIndex(t => t.position === appleTrack.position);
    
    if (spotifyTrack) {
      const track = {
        ...spotifyTrack,
        position: appleTrack.position,
        matchType: 'manual',
      };
      
      if (existingIndex >= 0) {
        newConfirmed[existingIndex] = track;
      } else {
        newConfirmed.push(track);
      }
    } else {
      // Track was skipped
      if (existingIndex >= 0) {
        newConfirmed.splice(existingIndex, 1);
      }
    }

    setConfirmedTracks(newConfirmed);
    
    // Remove from unmatched list
    setUnmatched(prev => prev.filter(u => u.position !== appleTrack.position));
  };

  // Step 4: Create Spotify playlist
  const handleCreatePlaylist = async () => {
    if (confirmedTracks.length === 0) {
      setError('No tracks selected. Please confirm at least one track.');
      return;
    }

    setError('');
    setLoading(true);
    setProgress(0);

    try {
      const res = await fetch('/api/apple-music/create-spotify-playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playlistName,
          playlistDescription,
          tracks: confirmedTracks.map(t => ({
            spotifyUri: t.uri,
            position: t.position,
          })),
        }),
      });

      const data = await res.json();

      if (res.status === 401 && (data.code === 'SPOTIFY_AUTH_REQUIRED' || data.code === 'SPOTIFY_AUTH_EXPIRED')) {
        setError('Spotify authentication required. Please log in to Spotify first.');
        setLoading(false);
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create playlist');
      }

      setSpotifyPlaylistUrl(data.spotifyPlaylistUrl);
      setSummary({
        ...summary,
        tracksAdded: data.tracksAdded,
        tracksFailed: data.tracksFailed,
      });
      setStep('complete');
      
      if (onComplete) {
        onComplete(data.spotifyPlaylistUrl);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep('input');
    setPlaylistId('');
    setUserToken('');
    setPlaylistName('');
    setPlaylistDescription('');
    setTracks([]);
    setMatches([]);
    setUnmatched([]);
    setConfirmedTracks([]);
    setError('');
    setProgress(0);
    setSummary(null);
    setSpotifyPlaylistUrl('');
  };

  // Render based on current step
  if (step === 'input') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <FaApple className="text-pink-500 text-2xl" />
          <h3 className="text-xl font-bold text-white">Convert Apple Music Playlist</h3>
        </div>
        
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Apple Music Playlist ID or URL
            </label>
            <input
              type="text"
              className="w-full px-4 py-2 rounded bg-gray-800 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-600"
              placeholder="pl.u-xxx or https://music.apple.com/.../playlist/pl.u-xxx"
              value={playlistId}
              onChange={e => setPlaylistId(e.target.value)}
              disabled={loading}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Apple Music User Token
            </label>
            <input
              type="text"
              className="w-full px-4 py-2 rounded bg-gray-800 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-600"
              placeholder="Your Apple Music user token"
              value={userToken}
              onChange={e => setUserToken(e.target.value)}
              disabled={loading}
            />
            <p className="text-xs text-gray-400 mt-1">
              You need to authenticate with Apple Music and provide your user token.
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-700 text-red-300 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <Button
          variant="primary"
          onClick={handleFetchPlaylist}
          disabled={loading || !playlistId.trim() || !userToken.trim()}
        >
          {loading ? 'Fetching...' : 'Fetch Playlist'}
        </Button>
      </div>
    );
  }

  // Auto-start matching when we reach matching step
  useEffect(() => {
    if (step === 'matching' && tracks.length > 0 && !loading && !matchingStartedRef.current) {
      matchingStartedRef.current = true;
      handleMatchTracks();
    }
  }, [step, tracks.length, loading]);

  if (step === 'matching') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-white">Matching Tracks...</h3>
          <Button variant="secondary" onClick={() => {
            matchingStartedRef.current = false;
            setStep('input');
          }} disabled={loading}>
            Cancel
          </Button>
        </div>

        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 bg-gray-700 rounded-full h-2">
              <div
                className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-sm text-gray-300">{progress}%</span>
          </div>
          <p className="text-sm text-gray-400">
            Searching Spotify for {tracks.length} tracks...
          </p>
        </div>

        {!loading && (
          <Button variant="primary" onClick={() => {
            matchingStartedRef.current = false;
            handleMatchTracks();
          }}>
            Retry Matching
          </Button>
        )}
      </div>
    );
  }

  if (step === 'review') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-white">Review Matches</h3>
            <p className="text-sm text-gray-400">
              {matches.length} auto-matched, {unmatched.length} need confirmation
            </p>
          </div>
          <Button variant="secondary" onClick={handleReset}>
            Start Over
          </Button>
        </div>

        {summary && (
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-gray-400">Total</div>
                <div className="text-white font-bold">{summary.total}</div>
              </div>
              <div>
                <div className="text-gray-400">Exact Matches</div>
                <div className="text-green-400 font-bold">{summary.exactMatches}</div>
              </div>
              <div>
                <div className="text-gray-400">Fuzzy Matches</div>
                <div className="text-yellow-400 font-bold">{summary.fuzzyMatches}</div>
              </div>
              <div>
                <div className="text-gray-400">Needs Review</div>
                <div className="text-orange-400 font-bold">{unmatched.length}</div>
              </div>
            </div>
          </div>
        )}

        {/* Matched tracks preview */}
        {matches.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <FaCheckCircle className="text-green-400" />
              <h4 className="font-semibold text-white">
                Auto-Matched Tracks ({matches.length})
              </h4>
            </div>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {matches.slice(0, 10).map((match, idx) => (
                <div key={idx} className="text-sm text-gray-300 flex items-center gap-2">
                  <span className="text-gray-500">{match.position}.</span>
                  <span>{match.appleTrack.title}</span>
                  <span className="text-gray-500">-</span>
                  <span>{match.appleTrack.artist}</span>
                  {match.matchType === 'fuzzy' && (
                    <span className="text-xs text-yellow-400 ml-2">(fuzzy match)</span>
                  )}
                </div>
              ))}
              {matches.length > 10 && (
                <div className="text-xs text-gray-400">...and {matches.length - 10} more</div>
              )}
            </div>
          </div>
        )}

        {/* Unmatched tracks for review */}
        {unmatched.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <FaExclamationTriangle className="text-orange-400" />
              <h4 className="font-semibold text-white">
                Tracks Needing Confirmation ({unmatched.length})
              </h4>
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {unmatched.map((item) => (
                <TrackMatchSelector
                  key={item.position}
                  appleTrack={item.appleTrack}
                  suggestions={item.suggestions}
                  onConfirm={(spotifyTrack) => handleTrackConfirmed(item.appleTrack, spotifyTrack)}
                  onSkip={() => handleTrackConfirmed(item.appleTrack, null)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Playlist settings */}
        <div className="bg-gray-800 rounded-lg p-4 space-y-3">
          <h4 className="font-semibold text-white">Playlist Settings</h4>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Playlist Name
            </label>
            <input
              type="text"
              className="w-full px-4 py-2 rounded bg-gray-900 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-600"
              value={playlistName}
              onChange={e => setPlaylistName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Description
            </label>
            <textarea
              className="w-full px-4 py-2 rounded bg-gray-900 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-600"
              rows="2"
              value={playlistDescription}
              onChange={e => setPlaylistDescription(e.target.value)}
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-700 text-red-300 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <Button
            variant="primary"
            onClick={handleCreatePlaylist}
            disabled={loading || confirmedTracks.length === 0}
          >
            {loading ? 'Creating...' : `Create Spotify Playlist (${confirmedTracks.length} tracks)`}
          </Button>
          <Button variant="secondary" onClick={handleReset}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (step === 'creating') {
    return (
      <div className="space-y-4">
        <h3 className="text-xl font-bold text-white">Creating Playlist...</h3>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 bg-gray-700 rounded-full h-2">
              <div
                className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-sm text-gray-300">{progress}%</span>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'complete') {
    return (
      <div className="space-y-4">
        <div className="bg-green-900/20 border border-green-700 rounded-lg p-6 text-center">
          <FaCheckCircle className="text-green-400 text-4xl mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Playlist Created Successfully!</h3>
          {spotifyPlaylistUrl && (
            <a
              href={spotifyPlaylistUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-400 hover:text-green-300 underline inline-flex items-center gap-2"
            >
              <FaSpotify className="text-xl" />
              Open in Spotify
            </a>
          )}
        </div>

        {summary && (
          <div className="bg-gray-800 rounded-lg p-4">
            <h4 className="font-semibold text-white mb-3">Summary</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-400">Tracks Added</div>
                <div className="text-white font-bold">{summary.tracksAdded || confirmedTracks.length}</div>
              </div>
              {summary.tracksFailed > 0 && (
                <div>
                  <div className="text-gray-400">Failed</div>
                  <div className="text-red-400 font-bold">{summary.tracksFailed}</div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <Button variant="primary" onClick={handleReset}>
            Convert Another Playlist
          </Button>
          {onComplete && (
            <Button variant="secondary" onClick={() => onComplete(spotifyPlaylistUrl)}>
              Done
            </Button>
          )}
        </div>
      </div>
    );
  }

  return null;
}

