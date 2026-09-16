import { expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
const { controlPlayback } = createRequire(import.meta.url)('../lib/spotifyPlayback');
const playing = { item: { id: 'song', type: 'track' }, device: { id: 'phone' }, is_playing: true };
const response = (data, status = 200) => ({ ok: status < 300, status, json: async () => data, headers: new Headers() });
const args = { accessToken: 'test-token', deviceId: 'phone', trackId: 'song' };

it('targets the observed device when pausing', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(response(playing)).mockResolvedValueOnce(response(null, 204));
  expect(await controlPlayback({ ...args, fetch, action: 'pause' })).toEqual({ status: 200, body: { success: true } });
  expect(fetch.mock.calls[1][0]).toBe('https://api.spotify.com/v1/me/player/pause?device_id=phone');
});
it('restarts at zero while preserving the Spotify queue', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(response({ ...playing, is_playing: false })).mockResolvedValueOnce(response(null, 204));
  await controlPlayback({ ...args, fetch, action: 'play', positionMs: 0 });
  expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ position_ms: 0 });
});
it.each([
  ['play', { ...playing, item: { id: 'different', type: 'track' }, is_playing: false }],
  ['play', { ...playing, device: { id: 'other' }, is_playing: false }],
  ['play', playing],
  ['pause', { ...playing, is_playing: false }],
  ['pause', { ...playing, device: { id: 'phone', is_restricted: true } }],
])('skips %s when playback no longer matches', async (action, state) => {
  const fetch = vi.fn().mockResolvedValue(response(state));
  expect((await controlPlayback({ ...args, fetch, action })).body).toEqual({ skipped: true });
  expect(fetch).toHaveBeenCalledTimes(1);
});
it('propagates rate limits and retry timing', async () => {
  const limited = response({ error: 'limited' }, 429);
  limited.headers.set('retry-after', '30');
  const fetch = vi.fn().mockResolvedValue(limited);
  const result = await controlPlayback({ ...args, fetch, action: 'pause' });
  expect(result.status).toBe(429);
  expect(result.retryAfter).toBe('30');
  expect(fetch).toHaveBeenCalledTimes(1);
});
it('does not treat a forbidden pause as success', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(response(playing)).mockResolvedValueOnce(response({ error: 'Premium required' }, 403));
  const result = await controlPlayback({ ...args, fetch, action: 'pause' });
  expect(result.status).toBe(403);
  expect(result.body.success).toBeUndefined();
});
