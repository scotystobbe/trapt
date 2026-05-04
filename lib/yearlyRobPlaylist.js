/**
 * Yearly source playlists (e.g. Rob 2025). Excludes TRAPT / TRAPT+ compilations.
 * Browse.jsx duplicates this matcher for the client bundle — keep in sync.
 */
function isYearlyRobPlaylist(name) {
  return /^Rob \d{4}$/.test(name);
}

module.exports = { isYearlyRobPlaylist };
