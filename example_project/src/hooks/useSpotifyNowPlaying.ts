// src/hooks/useNowPlaying.ts
import { useEffect, useState, useCallback, useRef } from "react";
import { fetchSpotifyApi } from "../lib/spotifyAuth";
import { useSpotifyAuth } from "./useSpotifyAuth";

interface NowPlayingTrack {
  title: string;
  artist: string;
  album: string;
  albumArt: string;
  fullQuery: string;
}

export function useNowPlaying(token: string | null) {
  const [track, setTrack] = useState<NowPlayingTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem("spotify_song_history");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [reconnecting, setReconnecting] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const emptyCountRef = useRef(0);
  const { login, refreshAccessToken } = useSpotifyAuth();
  const fetchNowPlayingRef = useRef<() => Promise<void>>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchNowPlaying = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchSpotifyApi(
        "https://api.spotify.com/v1/me/player",
        token,
        () => {
          login();
        },
        refreshAccessToken
      );
      if (res.status === 429) {
        setError(null);
        setReconnecting(true);
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = setTimeout(() => {
          setError(null);
          setReconnecting(false);
          fetchNowPlaying();
          pollingIntervalRef.current = setInterval(fetchNowPlaying, 45000);
        }, 120000);
        return;
      }
      if (res.status === 204) {
        emptyCountRef.current += 1;
        if (emptyCountRef.current >= 3) {
          setTrack(null);
          setIsPlaying(null);
        }
        setReconnecting(emptyCountRef.current > 1);
      } else if (res.ok) {
        const data = await res.json();
        setIsPlaying(!!data.is_playing);
        const item = data.item;
        if (!item) {
          if (!data.device || data.device === null) {
            emptyCountRef.current += 1;
            if (emptyCountRef.current >= 3) {
              setTrack(null);
              setIsPlaying(null);
            }
            setReconnecting(emptyCountRef.current > 1);
            return;
          }
          setReconnecting(false);
          return;
        }
        emptyCountRef.current = 0;
        setReconnecting(false);
        const title = item.name;
        const artist = item.artists.map((a: any) => a.name).join(", ");
        const album = item.album.name;
        const albumArt = item.album.images[0]?.url ?? "";
        const displayTitle = title.replace(/\s*\([^)]*\)/g, "").trim();
        setTrack(prev => {
          if (
            prev &&
            prev.title === displayTitle &&
            prev.artist === artist &&
            prev.album === album &&
            prev.albumArt === albumArt
          ) {
            return prev;
          }
          setHistory(prevHistory => {
            if (prevHistory[0] === displayTitle) return prevHistory;
            const newHistory = [displayTitle, ...prevHistory.filter(t => t !== displayTitle)].slice(0, 10);
            localStorage.setItem("spotify_song_history", JSON.stringify(newHistory));
            return newHistory;
          });
          return {
            title: displayTitle,
            artist,
            album,
            albumArt,
            fullQuery: title,
          };
        });
      } else {
        const errorText = await res.text();
        setError(errorText);
        setLastError(errorText);
        setReconnecting(true);
      }
    } catch (err: any) {
      setError(err.message);
      setLastError(err.message);
      setReconnecting(true);
    } finally {
      setLoading(false);
    }
  }, [token, login, refreshAccessToken]);

  // Store the latest fetchNowPlaying in a ref for external use
  fetchNowPlayingRef.current = fetchNowPlaying;

  // Fast polling for a short period (e.g. after playback command)
  const forceRefresh = useCallback((durationMs = 5000) => {
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    let elapsed = 0;
    fetchNowPlaying();
    pollingIntervalRef.current = setInterval(() => {
      fetchNowPlaying();
      elapsed += 1000;
      if (elapsed >= durationMs) {
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = setInterval(fetchNowPlaying, 45000);
      }
    }, 1000);
  }, [fetchNowPlaying]);

  useEffect(() => {
    if (!token) return;
    fetchNowPlaying();
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    pollingIntervalRef.current = setInterval(fetchNowPlaying, 45000);
    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [token, fetchNowPlaying]);

  // Expose a stable refresh function for manual refresh
  const refresh = useCallback(() => {
    setError(null);
    fetchNowPlaying();
  }, [fetchNowPlaying]);

  return { track, isPlaying, loading, error, refresh, history, forceRefresh, reconnecting, lastError };
}
