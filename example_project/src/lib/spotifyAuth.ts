export const SPOTIFY_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
export const REDIRECT_URI = "https://weird-al-discography.vercel.app/callback";
export const SCOPES = [
  "user-read-playback-state",
  "user-read-currently-playing",
  "user-modify-playback-state",
  "streaming"
];

function base64encode(buffer: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
export async function generateCodeChallenge(verifier: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64encode(digest);
}

export function generateRandomString(length: number) {
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length })
    .map(() => possible[Math.floor(Math.random() * possible.length)])
    .join("");
}

/**
 * Wrapper for Spotify API fetch that handles 401 (expired token) and triggers re-auth.
 * @param url Spotify API endpoint
 * @param token Access token
 * @param onAuthError Callback to trigger re-auth prompt
 * @param refreshAccessToken Function to refresh the access token
 * @param options Additional fetch options
 */
export async function fetchSpotifyApi(
  url: string,
  token: string,
  onAuthError: () => void,
  refreshAccessToken: (() => Promise<string | null>) | null = null,
  options: RequestInit = {}
) {
  let res = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });
  if (res.status === 401 && refreshAccessToken) {
    // Try to refresh the token
    const newToken = await refreshAccessToken();
    if (newToken) {
      res = await fetch(url, {
        ...options,
        headers: {
          ...(options.headers || {}),
          Authorization: `Bearer ${newToken}`,
        },
      });
      if (res.status !== 401) {
        return res;
      }
    }
    // If refresh fails or still 401, trigger re-auth
    onAuthError();
    throw new Error("Spotify token expired");
  }
  return res;
}
