import { expect, it, vi } from 'vitest';
import { restorePlaybackAfterSpeechActivation } from '../src/lib/enableAnnouncements';
const playing = { is_playing: true, item: { id: 'song', type: 'track' }, device: { id: 'phone' }, progress_ms: 60000 };
const paused = { ...playing, is_playing: false };
const setup = (...states) => ({
  readPlayback: vi.fn().mockImplementation(async () => states.length > 1 ? states.shift() : states[0]),
  command: vi.fn(async () => ({ success: true })),
  wait: vi.fn(async () => {}),
});
it('restores Spotify after the silent activation pauses it, without rewinding', async () => {
  const io = setup(paused);
  await restorePlaybackAfterSpeechActivation(playing, io);
  expect(io.command).toHaveBeenCalledTimes(1);
  expect(io.command).toHaveBeenCalledWith('play', playing);
});
it('allows for a delayed audio interruption', async () => {
  const io = setup(playing, paused);
  await restorePlaybackAfterSpeechActivation(playing, io);
  expect(io.readPlayback).toHaveBeenCalledTimes(2);
  expect(io.command).toHaveBeenCalledTimes(1);
  expect(io.command).toHaveBeenCalledWith('play', playing);
});
it('leaves uninterrupted playback alone', async () => {
  const io = setup(playing);
  await restorePlaybackAfterSpeechActivation(playing, io);
  expect(io.readPlayback).toHaveBeenCalledTimes(3);
  expect(io.command).not.toHaveBeenCalled();
});
it.each([null, paused, { ...playing, device: null }, { ...playing, device: { id: 'phone', is_restricted: true } }])('never resumes initially paused or unavailable media: %j', async snapshot => {
  const io = setup(paused);
  await restorePlaybackAfterSpeechActivation(snapshot, io);
  expect(io.readPlayback).not.toHaveBeenCalled();
  expect(io.command).not.toHaveBeenCalled();
});
it.each([
  { ...paused, item: { id: 'different', type: 'track' } },
  { ...paused, device: { id: 'different' } },
  { playing: false },
])('does not override a changed track/device: %j', async state => {
  const io = setup(state);
  await restorePlaybackAfterSpeechActivation(playing, io);
  expect(io.command).not.toHaveBeenCalled();
});
it('surfaces recovery errors instead of silently retrying playback', async () => {
  const io = setup(paused);
  io.command.mockRejectedValue(new Error('offline'));
  await expect(restorePlaybackAfterSpeechActivation(playing, io)).rejects.toThrow('offline');
  expect(io.command).toHaveBeenCalledTimes(1);
});
