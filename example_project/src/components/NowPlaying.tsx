import React, { useState } from "react";
import { useSpotifyAuth } from "../hooks/useSpotifyAuth";
import { useNowPlaying } from "../hooks/useSpotifyNowPlaying";
import PlaybackControls from "./PlaybackControls";

export default function NowPlaying() {
  const { token } = useSpotifyAuth();
  const { track, loading, error, refresh, history } = useNowPlaying(token);
  const [showHistory, setShowHistory] = useState(false);

  if (!token) return null;

  return (
    <div className="relative flex items-center justify-between mb-4 p-3 border rounded-lg shadow-sm bg-white dark:bg-gray-800 min-h-[80px]">
      {/* History Icon Button */}
      <button
        className="absolute bottom-2 right-2 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
        aria-label="Show song history"
        onClick={() => setShowHistory(h => !h)}
      >
        {/* Simple history SVG icon */}
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500 dark:text-gray-300">
          <path d="M3 3v5h5" />
          <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
          <path d="M12 7v5l4 2" />
        </svg>
      </button>
      {/* History Dropdown and Backdrop */}
      {showHistory && (
        <>
          {/* Backdrop for outside click */}
          <div
            className="fixed inset-0 z-10"
            style={{ background: 'transparent' }}
            onClick={() => setShowHistory(false)}
          />
          <div className="absolute right-2 bottom-[-180px] z-20 w-64 max-w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded shadow-lg p-3">
            <button
              className="absolute top-1 right-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-xs p-1"
              aria-label="Close history"
              onClick={() => setShowHistory(false)}
              tabIndex={0}
            >
              &#10005;
            </button>
            <div className="font-semibold mb-2 text-sm text-gray-700 dark:text-gray-200">Last 10 Songs</div>
            {history.length === 0 ? (
              <div className="text-xs text-gray-400">No history yet.</div>
            ) : (
              <ol className="list-decimal list-inside space-y-1">
                {history.map((title, i) => (
                  <li key={i} className="truncate text-xs text-gray-700 dark:text-gray-200" title={title}>{title}</li>
                ))}
              </ol>
            )}
          </div>
        </>
      )}
      <div className="flex items-center min-w-0 flex-1">
        {track ? (
          <div className="relative w-16 h-16 mr-4 flex-shrink-0 flex items-center justify-center">
            <img
              src={track.albumArt}
              alt={track.album}
              className="w-16 h-16 rounded object-cover"
              onClick={refresh}
              aria-label="Refresh now playing from Spotify"
              title="Refresh now playing from Spotify"
            />
          </div>
        ) : (
          <div className="w-16 h-16 mr-4 rounded shrink-0 bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
            <span className="text-gray-400 dark:text-gray-500 text-2xl">♪</span>
          </div>
        )}
        <div className="min-w-0">
          {error && (
            <div className="text-xs text-red-500 mb-1">{error}</div>
          )}
          {track ? (
            <>
              <p className="text-base font-semibold break-words whitespace-normal" title={track.title}>
                {track.title}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-300 break-words whitespace-normal" title={track.album}>
                {track.album}
              </p>
            </>
          ) : !loading && !error ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Nothing is currently playing on Spotify.</p>
          ) : null}
        </div>
      </div>
      {/* Remove playback controls for now */}
      {/* <div className="flex-shrink-0 ml-4">
        <PlaybackControls token={token} onSkip={refresh} />
      </div> */}
      {/* Spotify logo in bottom left, green and black */}
      <span className="absolute bottom-2 left-2 w-5 h-5 pointer-events-none select-none" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg" role="img">
          <title>Spotify</title>
          <circle cx="12" cy="12" r="12" fill="#1DB954"/>
          <path
            d="M17.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"
            fill="#191414"
          />
        </svg>
      </span>
    </div>
  );
}

