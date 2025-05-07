import React, { useState, useEffect } from "react";
import { Card, CardContent } from "./ui/card";
import SongDialog from "./SongDialog";
import { Dialog, DialogContent } from "./ui/dialog";

interface Track {
  title: string;
  type: string;
  originalArtist?: string;
  originalSong?: string;
  searchAliases?: string[];
  featuredSongs?: string[];
}

interface Album {
  title: string;
  year: number;
  cover: string;
  tracks: Track[];
}

interface AlbumCardProps {
  album: Album;
  searchTerm?: string;
  trackSort?: 'original' | 'alpha';
}

export default function AlbumCard({ album, searchTerm = "", trackSort = 'original' }: AlbumCardProps) {
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [largeDialog, setLargeDialog] = useState(false);
  const [showFeatured, setShowFeatured] = useState(false);

  // Auto-expand if searchTerm matches album or any track
  useEffect(() => {
    if (!searchTerm) return setExpanded(false);
    const lower = searchTerm.toLowerCase();
    if (
      album.title.toLowerCase().includes(lower) ||
      album.tracks.some(track => track.title.toLowerCase().includes(lower))
    ) {
      setExpanded(true);
    } else {
      setExpanded(false);
    }
  }, [searchTerm, album]);

  // Helper to highlight search term or fuzzy match (remove tag logic)
  function highlight(text: string) {
    if (searchTerm) {
      const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
      return text.split(regex).map((part, i) =>
        regex.test(part)
          ? <span key={i} className="font-semibold">{part}</span>
          : part
      );
    }
    return text;
  }

  return (
    <Card className="transition-shadow duration-200 hover:shadow-lg cursor-pointer">
      <CardContent className="p-4 text-gray-900 dark:text-gray-100">
        {/* Header: artwork, title, year, arrow */}
        <div
          className="flex items-center space-x-4 select-none"
          onClick={() => setExpanded((prev) => !prev)}
          role="button"
          tabIndex={0}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setExpanded(prev => !prev); }}
          aria-expanded={expanded}
        >
          <img
            src={album.cover}
            alt={album.title}
            className="w-16 h-16 rounded-xl object-cover"
          />
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {highlight(album.title)}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{album.year}</p>
          </div>
          {/* Arrow indicator */}
          <span
            className="text-3xl text-gray-400 dark:text-gray-300 transition-transform duration-200 group-hover:text-gray-600 dark:group-hover:text-gray-100"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? '▾' : '▸'}
          </span>
        </div>

        {/* Track list only if expanded */}
        {expanded && (
          <ul className="mt-4 space-y-2">
            {(() => {
              let tracks: Track[];
              const lower = searchTerm.toLowerCase();
              if (searchTerm && album.title.toLowerCase().includes(lower)) {
                tracks = album.tracks;
              } else if (searchTerm) {
                tracks = album.tracks.filter(track =>
                  track.title.toLowerCase().includes(lower) ||
                  (Array.isArray(track.searchAliases) && track.searchAliases.some(alias => alias.toLowerCase().includes(lower)))
                );
              } else {
                tracks = album.tracks;
              }
              if (trackSort === 'alpha') {
                tracks = [...tracks].sort((a, b) => a.title.localeCompare(b.title));
              }
              return tracks.map((track, idx) => (
                <li key={idx}>
                  <button
                    onClick={e => { e.stopPropagation(); setSelectedTrack(track); }}
                    className="text-left w-full rounded-lg px-3 py-2 bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors border-0 outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-300"
                  >
                    {highlight(track.title)}
                  </button>
                </li>
              ));
            })()}
          </ul>
        )}
      </CardContent>

      {/* Dialog for song details, only if expanded */}
      {expanded && selectedTrack && (
        <Dialog>
          <DialogContent
            className={`relative ${largeDialog ? 'max-w-4xl w-full h-full max-h-[90vh] flex items-center justify-center' : ''}`}
            onClose={() => { setSelectedTrack(null); setLargeDialog(false); }}
          >
            {/* Close button */}
            <button
              onClick={() => { setSelectedTrack(null); setLargeDialog(false); }}
              className="absolute top-2 right-3 text-4xl font-extrabold text-white hover:text-red-500 z-20 bg-transparent border-none shadow-none p-0 m-0"
              aria-label="Close"
            >
              ×
            </button>
            <SongDialog track={selectedTrack} large={largeDialog} albumCover={album.cover} />
            {/* Large mode toggle button absolutely positioned in bottom right of dialog overlay */}
            <div className="absolute bottom-6 right-6 flex items-center gap-6 z-30">
              {Array.isArray(selectedTrack.featuredSongs) && selectedTrack.featuredSongs.length > 0 && (
                <button
                  className="px-3 py-2 rounded-md bg-gray-300 text-gray-900 hover:bg-gray-400 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600 transition whitespace-nowrap"
                  onClick={() => setShowFeatured(v => !v)}
                  aria-expanded={showFeatured}
                >
                  {showFeatured ? 'Hide Songs' : 'Show Songs'}
                </button>
              )}
              <a
                href={`https://www.google.com/search?q=${encodeURIComponent(selectedTrack.title + ' Weird Al Yankovic Lyrics')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center opacity-60 hover:opacity-90 transition-opacity ml-1"
                title="Search lyrics on Google"
                tabIndex={0}
              >
                <img src="/lyrics_icon.png" alt="Lyrics" className="h-7 w-7" style={{ filter: 'invert(1) brightness(2)' }} />
              </a>
              <button
                onClick={() => setLargeDialog(l => !l)}
                className="px-3 py-1 rounded-lg font-bold shadow border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-800 transition text-xl flex items-center gap-1"
                aria-label={largeDialog ? 'Show Smaller' : 'Show Larger'}
              >
                <span className={`${largeDialog ? 'opacity-50' : 'opacity-100'} transition`}>A</span>
                <span className={`text-2xl ${largeDialog ? 'opacity-100' : 'opacity-50'} transition`}>A</span>
              </button>
            </div>
            {/* Show featured songs list if toggled */}
            {showFeatured && Array.isArray(selectedTrack.featuredSongs) && selectedTrack.featuredSongs.length > 0 && (
              <ul className="absolute left-6 bottom-24 list-disc list-inside mt-2 space-y-1 bg-gray-50 dark:bg-gray-700 rounded-lg p-4 pr-6 z-40 shadow-lg max-h-60 overflow-y-auto">
                {selectedTrack.featuredSongs.map((song, i) => (
                  <li key={i} className="text-gray-800 dark:text-gray-200">{song}</li>
                ))}
              </ul>
            )}
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}
