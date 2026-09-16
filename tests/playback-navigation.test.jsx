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
vi.mock('swr', () => {
  const songs = [{ id: 'db-song', spotifyLink: 'https://open.spotify.com/track/first', title: 'First', artist: 'Artist' }];
  return { default: () => ({ data: songs, mutate: vi.fn() }) };
});

let synth;
let currentTrack;
beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  sessionStorage.clear();
  Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'iPhone' });
  window.matchMedia = vi.fn(() => ({ matches: true }));
  synth = { speak: vi.fn(), cancel: vi.fn(), speaking: false, getVoices: () => [{ name: 'Samantha', lang: 'en-US', localService: true }] };
  vi.stubGlobal('speechSynthesis', synth);
  vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(text) { this.text = text; } });
  currentTrack = { id: 'first', name: 'First', artists: [{ name: 'Artist' }], duration_ms: 180000 };
  vi.stubGlobal('fetch', vi.fn(async () => ({ status: 200, json: async () => ({ item: currentTrack, progress_ms: 30000, is_playing: true }) })));
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
  await advance(3000);
  await advance(1500);
  expect(synth.speak).toHaveBeenCalledTimes(1);
  expect(synth.speak.mock.calls[0][0].text).toBe('This is Second by Artist');
  page.unmount();
  synth.speak.mockClear();
  render(<NowPlaying />);
  await advance(5000);
  expect(synth.speak).not.toHaveBeenCalled();
  expect(synth.cancel).not.toHaveBeenCalled();
  expect(fetch.mock.calls.every(([url]) => url === '/api/spotify-proxy/currently-playing')).toBe(true);
});
