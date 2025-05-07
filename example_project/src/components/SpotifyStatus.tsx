import { useSpotifyAuth } from "../hooks/useSpotifyAuth";

export default function SpotifyStatus() {
  const { token, login } = useSpotifyAuth();

  if (!token) {
    return (
      <div className="mb-4">
        <button
          onClick={login}
          className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded"
        >
          Connect to Spotify
        </button>
      </div>
    );
  }
  
  return null; // 👈 nothing visible when connected
  
}
