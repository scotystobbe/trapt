import { useEffect, useState } from "react";
import {
  SPOTIFY_CLIENT_ID,
  REDIRECT_URI,
  SCOPES,
  generateCodeChallenge,
  generateRandomString,
} from "../lib/spotifyAuth";

export function useSpotifyAuth() {
  const [token, setToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    if (code) {
      const verifier = localStorage.getItem("spotify_code_verifier");
      if (!verifier) return;

      fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: SPOTIFY_CLIENT_ID,
          grant_type: "authorization_code",
          code,
          redirect_uri: REDIRECT_URI,
          code_verifier: verifier,
        }),
      })
        .then(async res => {
          const responseText = await res.text();
          console.log("Spotify token response:", responseText);
          return JSON.parse(responseText);
        })
        .then(data => {
          if (data.access_token) {
            setToken(data.access_token);
            localStorage.setItem("spotify_access_token", data.access_token);
            if (data.refresh_token) {
              setRefreshToken(data.refresh_token);
              localStorage.setItem("spotify_refresh_token", data.refresh_token);
              console.log("Stored new refresh token from initial grant.");
            } else {
              // If no new refresh token, keep the old one
              const oldRefresh = localStorage.getItem("spotify_refresh_token");
              if (oldRefresh) {
                setRefreshToken(oldRefresh);
                console.log("Kept existing refresh token after initial grant.");
              }
            }
            window.history.replaceState({}, "", "/");
          } else {
            console.error("Token exchange failed:", data);
          }
        });
    } else {
      // On load, always try to use existing tokens if present
      const saved = localStorage.getItem("spotify_access_token");
      const savedRefresh = localStorage.getItem("spotify_refresh_token");
      if (saved) setToken(saved);
      if (savedRefresh) setRefreshToken(savedRefresh);
      if (!saved || !savedRefresh) {
        console.log("No saved Spotify tokens found in localStorage.");
      } else {
        console.log("Loaded Spotify tokens from localStorage.");
      }
    }
  }, []);

  const login = async () => {
    const verifier = generateRandomString(128);
    const challenge = await generateCodeChallenge(verifier);
    localStorage.setItem("spotify_code_verifier", verifier);

    const url = new URL("https://accounts.spotify.com/authorize");
    url.searchParams.set("client_id", SPOTIFY_CLIENT_ID);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", REDIRECT_URI);
    url.searchParams.set("scope", SCOPES.join(" "));
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("code_challenge", challenge);

    console.log("Redirecting to Spotify:", url.toString());
    window.location.href = url.toString();
  };

  const refreshAccessToken = async () => {
    const storedRefreshToken = refreshToken || localStorage.getItem("spotify_refresh_token");
    if (!storedRefreshToken) {
      console.warn("No refresh token available for Spotify refresh.");
      return null;
    }
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: SPOTIFY_CLIENT_ID,
        grant_type: "refresh_token",
        refresh_token: storedRefreshToken,
      }),
    });
    const data = await res.json();
    if (data.access_token) {
      setToken(data.access_token);
      localStorage.setItem("spotify_access_token", data.access_token);
      if (data.refresh_token) {
        setRefreshToken(data.refresh_token);
        localStorage.setItem("spotify_refresh_token", data.refresh_token);
        console.log("Stored new refresh token from refresh.");
      } else {
        // If no new refresh token, keep the old one
        const oldRefresh = localStorage.getItem("spotify_refresh_token");
        if (oldRefresh) {
          setRefreshToken(oldRefresh);
          console.log("Kept existing refresh token after refresh.");
        }
      }
      console.log("Refreshed Spotify access token.");
      return data.access_token;
    } else {
      // Refresh failed, clear tokens
      setToken(null);
      setRefreshToken(null);
      localStorage.removeItem("spotify_access_token");
      localStorage.removeItem("spotify_refresh_token");
      console.warn("Spotify refresh failed, cleared tokens.");
      return null;
    }
  };

  return { token, login, refreshAccessToken };
}
