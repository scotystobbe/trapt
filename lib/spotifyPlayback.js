// Keep commands tied to the track/device we observed. Never replace the user's
// queue or resume a different track selected while an announcement was running.
async function controlPlayback({ fetch, accessToken, action, deviceId, trackId, positionMs }) {
  const headers = { Authorization: `Bearer ${accessToken}` };
  const stateRes = await fetch('https://api.spotify.com/v1/me/player', { headers, timeout: 8000 });
  if (stateRes.status === 204) return { status: 200, body: { skipped: true } };
  if (!stateRes.ok) return spotifyError(stateRes);
  const state = await stateRes.json();
  if (state.item?.id !== trackId || state.device?.id !== deviceId ||
      state.device?.is_restricted || state.item?.type !== 'track' ||
      (action === 'pause' ? !state.is_playing : state.is_playing)) {
    return { status: 200, body: { skipped: true } };
  }
  const response = await fetch(`https://api.spotify.com/v1/me/player/${action}?device_id=${encodeURIComponent(deviceId)}`, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    // No URI/context: preserve Spotify's queue, shuffle and repeat settings.
    ...(action === 'play' && positionMs !== undefined ? { body: JSON.stringify({ position_ms: positionMs }) } : {}),
    timeout: 8000,
  });
  if (!response.ok) return spotifyError(response);
  return { status: 200, body: { success: true } };
}

async function spotifyError(response) {
  return {
    status: response.status,
    retryAfter: response.headers.get('retry-after'),
    body: { error: 'Spotify playback control failed', details: await response.json().catch(() => ({})) },
  };
}

module.exports = { controlPlayback };
