import React, { useState } from "react";

interface Track {
  title: string;
  type: string;
  originalArtist?: string;
  originalSong?: string;
  featuredSongs?: string[];
}

interface SongDialogProps {
  track: Track;
  large?: boolean;
  albumCover?: string;
  onToggleLarge?: () => void;
  renderBottomLeftButtons?: React.ReactNode;
}

export default function SongDialog({ track, large = false, albumCover, onToggleLarge, renderBottomLeftButtons }: SongDialogProps) {
  const [showFeatured, setShowFeatured] = useState(false);

  return (
    <div className={`relative p-6 text-left bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-xl transition-all ${large ? 'text-3xl p-12' : ''} ${large ? 'space-y-8' : 'space-y-2'}${!large ? ' pb-24' : ''}`}>
      {/* Album art in large mode */}
      {large && albumCover && (
        <div className="flex justify-center mb-6">
          <img src={albumCover} alt="Album cover" className="rounded-xl max-w-md max-h-52 object-contain shadow-lg" />
        </div>
      )}
      <div className="flex items-center gap-2 mb-2">
        <h3 className={`font-bold ${large ? 'text-4xl' : 'text-xl'} m-0`}>{track.title}</h3>
      </div>
      {large ? (
        <div>
          <div className="flex items-center gap-2"><span>Type:</span><span className="font-bold">{track.type}</span></div>
          {track.type === 'Parody' && (track.originalSong || track.originalArtist) && (
            <div className="mt-4">
              <div>Original:</div>
              <div className="font-bold block mt-1">
                {track.originalSong}
                {track.originalSong && track.originalArtist ? ' by ' : ''}
                {track.originalArtist}
              </div>
            </div>
          )}
          {track.type === 'Style Parody' && track.originalArtist && (
            <div className="mt-4 font-bold">{track.originalArtist}</div>
          )}
        </div>
      ) : (
        <>
          <p><strong>Type:</strong> {track.type}</p>
          {track.type === 'Parody' && (track.originalSong || track.originalArtist) && (
            <div className="mt-2">
              <div><strong>Original:</strong></div>
              <div className="font-normal block mt-1">
                {track.originalSong}
                {track.originalSong && track.originalArtist ? ' by ' : ''}
                {track.originalArtist}
              </div>
              {/* Show Spotify button only in regular mode */}
              {!large && track.originalSong && track.originalArtist && (
                <div className="mt-2">
                  <a
                    href={`https://open.spotify.com/search/${encodeURIComponent(track.originalSong + ' ' + track.originalArtist)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-gray-300 text-gray-400 hover:bg-gray-400 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600 transition whitespace-nowrap mt-1 shadow"
                    title="Open Original in Spotify"
                    tabIndex={0}
                  >
                    <img src="/spotify_icon.png" alt="Spotify" className="h-5 w-5 grayscale" />
                    Open Original in Spotify
                  </a>
                </div>
              )}
            </div>
          )}
          {track.type === 'Style Parody' && track.originalArtist && (
            <p className="font-bold">{track.originalArtist}</p>
          )}
        </>
      )}
      {/* Bottom left buttons and lyrics icon */}
      {renderBottomLeftButtons && (
        <div className="absolute left-6 bottom-6 flex items-center gap-3 z-20">
          {renderBottomLeftButtons}
        </div>
      )}
    </div>
  );
}
