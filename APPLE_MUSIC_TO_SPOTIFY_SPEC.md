# Apple Music to Spotify Playlist Converter - Feature Specification

## Overview
This feature will allow users to convert an existing Apple Music playlist to a Spotify playlist. The conversion process will:
- Automatically match tracks that have direct matches
- Present manual confirmation options for tracks without direct matches
- Maintain the original track order from the Apple Music playlist
- Create a Spotify playlist (but NOT automatically add it to the app's database)

## Decisions Made

### 1. Input Method
✅ **Selected: Option A - Apple Music API integration**
- User has Apple Developer access
- Will use Apple Music API to fetch playlist data directly
- Requires user authentication with Apple Music

### 2. Direct Match Criteria
✅ **Selected: Option D - Combination with visual indicator**
- Exact match on title + artist first (confidence = 1.0)
- Fuzzy matching fallback with high threshold (85-90%) for automatic matching
- Visual indicator when fuzzy match is used (different from exact match)
- Lower confidence matches (70-85%) go to manual review

### 3. Manual Confirmation UI
✅ **Selected: Top 5 matches with full details**
- Show top 5 Spotify matches per unmatched track
- Display: artwork, album name, duration
- Allow users to skip tracks
- Allow manual search if suggestions don't match

### 4. User Access
✅ **Selected: Admin only**
- Feature accessible only to users with ADMIN role
- Can be expanded later if needed

### 5. UI Location
✅ **Selected: Admin page section + Home page card**
- New section in Admin page (alongside existing Spotify import)
- Card on Home page to promote the feature

### 6. Playlist Creation
✅ **Selected: User-customizable with public visibility**
- User can customize playlist name (defaults to Apple Music playlist name)
- User can customize description (defaults to "Converted from Apple Music")
- Playlist will be **public** (not private)
- **Do NOT preserve artwork** - let Spotify auto-generate cover art

### 7. Error Handling
✅ **Selected: Follow recommendations**
- Show clear error messages
- Allow users to retry failed tracks
- Save progress/state so users can resume if interrupted
- Provide a summary report at the end

### 8. Batch Processing
✅ **Selected: Follow recommendations**
- Process in batches of 20-50 tracks
- Show progress bar
- Allow cancellation mid-process

## Technical Implementation Plan

### Backend API Endpoints

#### 1. `/api/apple-music/parse-playlist` (POST)
**Purpose:** Parse uploaded Apple Music playlist file (CSV/JSON)
**Input:**
```json
{
  "playlistData": "..." // CSV string or JSON object
}
```
**Output:**
```json
{
  "playlistName": "My Playlist",
  "tracks": [
    {
      "title": "Song Title",
      "artist": "Artist Name",
      "album": "Album Name",
      "position": 1
    }
  ]
}
```

#### 2. `/api/apple-music/match-tracks` (POST)
**Purpose:** Match Apple Music tracks to Spotify tracks
**Input:**
```json
{
  "tracks": [
    {
      "title": "Song Title",
      "artist": "Artist Name",
      "album": "Album Name",
      "position": 1
    }
  ]
}
```
**Output:**
```json
{
  "matches": [
    {
      "appleTrack": { ... },
      "spotifyTrack": { ... }, // null if no match
      "matchType": "direct" | "fuzzy" | "none",
      "confidence": 0.95,
      "position": 1
    }
  ],
  "unmatched": [
    {
      "appleTrack": { ... },
      "suggestions": [ /* top 5 Spotify matches */ ],
      "position": 2
    }
  ]
}
```

#### 3. `/api/apple-music/create-spotify-playlist` (POST)
**Purpose:** Create Spotify playlist with confirmed matches
**Input:**
```json
{
  "playlistName": "My Playlist",
  "playlistDescription": "Converted from Apple Music",
  "tracks": [
    {
      "spotifyUri": "spotify:track:...",
      "position": 1
    }
  ],
  "artworkUrl": "..." // optional
}
```
**Output:**
```json
{
  "spotifyPlaylistId": "...",
  "spotifyPlaylistUrl": "https://open.spotify.com/playlist/...",
  "tracksAdded": 50,
  "tracksSkipped": 2
}
```

### Frontend Components

#### 1. `AppleMusicConverter` Component
- File upload/input for Apple Music playlist
- Progress indicator during matching
- Match review interface for unmatched tracks
- Summary and success message

#### 2. `TrackMatchSelector` Component
- Display Apple Music track info
- Show Spotify match suggestions
- Allow selection, skip, or manual search
- Preview track artwork and metadata

### Matching Algorithm

1. **Direct Match:**
   - Normalize track title and artist (lowercase, remove special chars)
   - Exact match on normalized title + artist
   - If match found, confidence = 1.0

2. **Fuzzy Match:**
   - Use string similarity (e.g., Levenshtein distance)
   - Search Spotify API with "track:title artist:artist"
   - Calculate similarity score
   - If score > 0.85, consider automatic match
   - If score 0.70-0.85, add to suggestions for manual review

3. **Manual Search:**
   - Allow user to search Spotify API directly
   - Display search results for selection

### Data Flow

```
1. User uploads Apple Music playlist file
   ↓
2. Parse file and extract tracks (maintain order)
   ↓
3. For each track:
   - Search Spotify API
   - Determine match type (direct/fuzzy/none)
   ↓
4. Group tracks:
   - Direct matches → auto-add
   - Fuzzy matches (high confidence) → auto-add
   - No matches / low confidence → manual review
   ↓
5. User reviews unmatched tracks:
   - Select from suggestions
   - Search manually
   - Skip track
   ↓
6. Create Spotify playlist with all confirmed tracks (maintain order)
   ↓
7. Return Spotify playlist URL (user can then import via normal flow)
```

## Dependencies

### New npm packages needed:
- `csv-parse` (already in dependencies) - for parsing CSV exports
- `string-similarity` (already in dependencies) - for fuzzy matching
- Potentially: `music-metadata` if we need to parse audio files

### Environment Variables:
- `SPOTIFY_CLIENT_ID` (already exists)
- `SPOTIFY_CLIENT_SECRET` (already exists)
- `APPLE_MUSIC_DEVELOPER_TOKEN` (if using Apple Music API - optional)

## Edge Cases to Handle

1. **Duplicate tracks in Apple Music playlist** - Should we deduplicate or preserve?
2. **Tracks with multiple artists** - How to match? (e.g., "Artist A, Artist B" vs "Artist A & Artist B")
3. **Remixes, live versions, explicit vs clean** - Should these be considered different tracks?
4. **Very long playlists** (1000+ tracks) - Batch processing and progress saving
5. **Spotify API rate limits** - Implement exponential backoff and retry logic
6. **Network timeouts** - Retry mechanism and error recovery

## Success Criteria

- ✅ Successfully convert Apple Music playlist to Spotify playlist
- ✅ Maintain original track order
- ✅ Handle direct matches automatically
- ✅ Provide intuitive UI for manual track confirmation
- ✅ Handle errors gracefully with clear user feedback
- ✅ Support playlists of various sizes (10-1000+ tracks)
- ✅ Do NOT automatically add playlist to app database (user imports separately)

## Open Questions

Please answer the questions in sections 1-8 above to proceed with implementation.



