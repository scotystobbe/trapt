// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook } from '@testing-library/react';
import { useSpeech, setSpeechMode } from '../src/hooks/useSpeech';
import NowPlaying from '../src/pages/NowPlaying';

vi.mock('../src/App', () => ({ useNightMode: () => ({ nightMode: false }) }));
vi.mock('../src/components/AuthProvider', () => ({ useAuth: () => ({ user: {} }) }));
vi.mock('../src/components/LogoHeader', () => ({ default: () => null }));
vi.mock('../src/components/HamburgerMenu', () => ({ default: () => null }));
const library = vi.hoisted(() => ({ songs: [] }));
vi.mock('swr', () => ({ default: () => ({ data: library.songs, mutate: vi.fn() }) }));

let synth;
let currentTrack;
let isPlaying;
let progress;
beforeEach(() => {
  vi.useFakeTimers();
  library.songs = [{ id: 'db-song', spotifyLink: 'https://open.spotify.com/track/first', title: 'First', artist: 'Artist' }];
  localStorage.clear();
  sessionStorage.clear();
  Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'iPhone' });
  window.matchMedia = vi.fn(() => ({ matches: true }));
  synth = { speak: vi.fn(), cancel: vi.fn(), speaking: false, getVoices: () => [{ name: 'Samantha', lang: 'en-US', localService: true }] };
  vi.stubGlobal('speechSynthesis', synth);
  vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(text) { this.text = text; } });
  currentTrack = { id: 'first', type: 'track', name: 'First', artists: [{ name: 'Artist' }], duration_ms: 180000 };
  isPlaying = true;
  progress = 30000;
  vi.stubGlobal('fetch', vi.fn(async url => {
    if (url.includes('/pause?')) isPlaying = false;
    if (url.includes('/play?')) isPlaying = true;
    return { status: 200, ok: true, json: async () => url.includes('?') ? { success: true } :
      { item: currentTrack, progress_ms: progress, is_playing: isPlaying, device: { id: 'phone' } } };
  }));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
async function advance(ms) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}

it.each(['off', 'beginning', 'end', 'both'])('does not warm up audio on mount, navigation gestures, or remount with mode %s', async mode => {
  setSpeechMode(mode);
  for (const permission of [false, true]) {
    sessionStorage.setItem('trapt_speech_permission_granted', String(permission));
    const first = renderHook(() => useSpeech());
    for (const name of ['touchstart', 'touchend', 'click', 'keydown']) fireEvent(document, new Event(name));
    await advance(2000);
    first.unmount();
    const second = renderHook(() => useSpeech());
    await advance(2000);
    second.unmount();
  }
  expect(synth.speak).not.toHaveBeenCalled();
  expect(synth.cancel).not.toHaveBeenCalled();
});

it('does not activate speech through either entry point when announcements are off', () => {
  const { result } = renderHook(() => useSpeech());
  act(() => {
    window.dispatchEvent(new Event('speech-manual-init'));
    result.current.speak('Ignored');
  });
  expect(synth.speak).not.toHaveBeenCalled();
  expect(synth.cancel).not.toHaveBeenCalled();
});

it('enables speech once through the banner and still announces subsequent tracks', async () => {
  setSpeechMode('beginning');
  const page = render(<NowPlaying />);
  await advance(2000);
  expect(synth.speak).not.toHaveBeenCalled();
  fireEvent.click(page.getByRole('button', { name: 'Enable' }));
  expect(synth.speak).toHaveBeenCalledTimes(1);
  expect(page.queryByRole('button', { name: 'Enable' })).toBeNull();
  synth.speak.mockClear();
  synth.cancel.mockClear();
  currentTrack = { ...currentTrack, id: 'second', name: 'Second' };
  progress = 0;
  await advance(3000);
  await advance(1500);
  expect(synth.speak).toHaveBeenCalledTimes(1);
  expect(synth.speak.mock.calls[0][0].text).toBe('This is Second by Artist');
  expect(isPlaying).toBe(false);
  await act(async () => { synth.speak.mock.calls[0][0].onend(); });
  expect(isPlaying).toBe(true);
  expect(fetch.mock.calls.some(([url]) => url.includes('/play?') && url.includes('position_ms=0'))).toBe(true);
  page.unmount();
  synth.speak.mockClear();
  fetch.mockClear();
  render(<NowPlaying />);
  await advance(5000);
  expect(synth.speak).not.toHaveBeenCalled();
  expect(synth.cancel).not.toHaveBeenCalled();
  expect(fetch.mock.calls.every(([url]) => url === '/api/spotify-proxy/currently-playing')).toBe(true);
});


it('waits for speech completion and cleans up on cancellation', async () => {
  setSpeechMode('beginning');
  sessionStorage.setItem('trapt_speech_permission_granted', 'true');
  const { result } = renderHook(() => useSpeech());
  const abort = new AbortController();
  const done = result.current.speak('This is a song', { signal: abort.signal });
  const rejected = expect(done).rejects.toMatchObject({ name: 'AbortError' });
  abort.abort();
  await rejected;
  expect(synth.cancel).toHaveBeenCalledTimes(1);
});

it('times out a stuck speech engine so playback can recover', async () => {
  setSpeechMode('beginning');
  sessionStorage.setItem('trapt_speech_permission_granted', 'true');
  const { result } = renderHook(() => useSpeech());
  const done = result.current.speak('This is a song');
  const rejected = expect(done).rejects.toThrow('timed out');
  await advance(15000);
  await rejected;
  expect(synth.cancel).toHaveBeenCalledTimes(1);
});

it('queues speech once when voices load before the fallback timer', async () => {
  setSpeechMode('beginning');
  sessionStorage.setItem('trapt_speech_permission_granted', 'true');
  let voicesReady;
  synth.getVoices = () => [];
  synth.addEventListener = (_event, listener) => { voicesReady = listener; };
  synth.removeEventListener = vi.fn();
  const { result } = renderHook(() => useSpeech());
  const done = result.current.speak('This is a song');
  expect(synth.speak).not.toHaveBeenCalled();
  voicesReady();
  await advance(1000);
  expect(synth.speak).toHaveBeenCalledTimes(1);
  synth.speak.mock.calls[0][0].onend();
  await done;
});


it('loads ratings and notes when the song library arrives after Spotify', async () => {
  const songs = library.songs;
  library.songs = [];
  const page = render(<NowPlaying />);
  await advance(100);
  expect(page.queryByText('Library notes')).toBeNull();
  library.songs = [{ ...songs[0], notes: 'Library notes' }];
  page.rerender(<NowPlaying />);
  expect(page.getByText('Library notes')).toBeTruthy();
  expect(synth.speak).not.toHaveBeenCalled();
  expect(fetch.mock.calls.every(([url]) => url === '/api/spotify-proxy/currently-playing')).toBe(true);
});
