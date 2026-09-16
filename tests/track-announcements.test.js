import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { createTrackAnnouncer } from '../src/lib/trackAnnouncements';

const track = (id, progress = 0, extras = {}) => ({
  item: { id, name: id, type: 'track', duration_ms: 180000 },
  device: { id: 'phone' }, is_playing: true, progress_ms: progress, ...extras,
});
let controller, mode, state, commands, spoken, errors, speechQueue, permission;
beforeEach(() => {
  vi.useFakeTimers();
  mode = 'both';
  state = track('a', 179500);
  commands = []; spoken = []; errors = []; speechQueue = [];
  permission = true;
  controller = createTrackAnnouncer({
    getMode: () => mode,
    canSpeak: () => permission,
    readPlayback: async () => state,
    command: vi.fn(async (action, expected, position) => {
      commands.push([action, expected.item.id, position]);
      if (state.item?.id !== expected.item.id || state.device?.id !== expected.device.id ||
          (action === 'play' && state.is_playing)) return { skipped: true };
      state = { ...state, is_playing: action === 'play', progress_ms: position ?? state.progress_ms };
      return { success: true };
    }),
    describe: (item, start) => `${start ? 'This is' : 'That was'} ${item.id}`,
    speak: (text, { signal }) => new Promise((resolve, reject) => {
      spoken.push(text);
      speechQueue.push(resolve);
      signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true });
    }),
    onError: error => errors.push(error.message),
  });
});
afterEach(() => { controller.dispose(); vi.useRealTimers(); });
async function flush() { await vi.advanceTimersByTimeAsync(0); }
async function transition(next = track('b', 0)) {
  await controller.observe(state);
  await vi.advanceTimersByTimeAsync(500);
  state = next;
  const pending = controller.observe(state);
  await flush();
  return { pending };
}
async function finishSpeech() { speechQueue.shift()(); await flush(); }

it('pauses, says the old ending then the new beginning, and only then resumes at zero', async () => {
  const { pending } = await transition();
  expect(commands).toEqual([['pause', 'b', undefined]]);
  expect(spoken).toEqual(['That was a']);
  expect(state.is_playing).toBe(false);
  await finishSpeech();
  expect(spoken).toEqual(['That was a', 'This is b']);
  expect(commands).toHaveLength(1);
  await finishSpeech();
  await pending;
  expect(commands).toEqual([['pause', 'b', undefined], ['play', 'b', 0]]);
  expect(state.is_playing).toBe(true);
});

it.each([['beginning', 'This is b'], ['end', 'That was a']])('respects %s-only mode', async (setting, text) => {
  mode = setting;
  const { pending } = await transition();
  expect(spoken).toEqual([text]);
  await finishSpeech(); await pending;
  expect(commands.at(-1)).toEqual(['play', 'b', 0]);
});

it('never speaks over the last seconds of the old track', async () => {
  await controller.observe(state);
  await vi.advanceTimersByTimeAsync(250);
  state = track('a', 179750);
  await controller.observe(state);
  expect(commands).toEqual([]);
  expect(spoken).toEqual([]);
});

it.each(['off', 'no-permission', 'initial', 'paused', 'device-change', 'stale', 'late', 'ad'])('does not interfere for %s', async situation => {
  if (situation === 'off') mode = 'off';
  if (situation === 'no-permission') permission = false;
  if (situation !== 'initial') await controller.observe(state);
  await vi.advanceTimersByTimeAsync(situation === 'stale' ? 30000 : 500);
  state = track('b', situation === 'late' ? 20000 : 0);
  if (situation === 'paused') { state.is_playing = false; mode = 'beginning'; }
  if (situation === 'device-change') state.device.id = 'other';
  if (situation === 'ad') state.item.type = 'ad';
  await controller.observe(state);
  expect(commands).toEqual([]);
  expect(spoken).toEqual([]);
});

it('does not announce an ending for a manually skipped song', async () => {
  state = track('a', 30000);
  const { pending } = await transition();
  expect(spoken).toEqual(['This is b']);
  await finishSpeech(); await pending;
});

it('announces when playback starts after an initially idle page', async () => {
  state = { playing: false };
  const { pending } = await transition();
  expect(spoken).toEqual(['This is b']);
  await finishSpeech(); await pending;
});

it('announces after the final song ends without restarting it', async () => {
  const { pending } = await transition(track('a', 180000, { is_playing: false }));
  expect(spoken).toEqual(['That was a']);
  expect(commands).toEqual([]);
  await finishSpeech(); await pending;
  await controller.observe(state);
  expect(spoken).toHaveLength(1);
});

it('announces at the end of a queue when Spotify clears its playback item', async () => {
  const { pending } = await transition({ playing: false });
  expect(spoken).toEqual(['That was a']);
  await finishSpeech(); await pending;
  expect(commands).toEqual([]);
});

it('handles repeat-one as a new occurrence', async () => {
  state.repeat_state = 'track';
  const { pending } = await transition(track('a', 0, { repeat_state: 'track' }));
  expect(spoken).toEqual(['That was a']);
  await finishSpeech();
  expect(spoken).toEqual(['That was a', 'This is a']);
  await finishSpeech(); await pending;
  await controller.observe(state);
  expect(spoken).toHaveLength(2);
});

it.each(['cancel', 'dispose', 'suspend'])('releases its pause on %s without another announcement or a rewind', async method => {
  const { pending } = await transition(track('b', 300));
  controller[method]();
  await pending;
  expect(commands.at(-1)).toEqual(['play', 'b', undefined]);
  expect(spoken).toEqual(['That was a']);
  expect(errors).toEqual([]);
});

it('does not re-announce or rewind if the user selects a different track during speech', async () => {
  const { pending } = await transition();
  state = track('c', 40000);
  await finishSpeech(); await pending;
  expect(spoken).toEqual(['That was a']);
  expect(state.item.id).toBe('c');
  expect(state.progress_ms).toBe(40000);
});

it('ignores concurrent observations during an announcement', async () => {
  const { pending } = await transition();
  await controller.observe(state);
  expect(commands).toHaveLength(1);
  await finishSpeech(); await finishSpeech(); await pending;
});

it('polls faster only near track endings while announcements can run', () => {
  expect(controller.nextPollDelay(track('a', 30000))).toBe(3000);
  expect(controller.nextPollDelay(track('a', 179000))).toBe(500);
  mode = 'off';
  expect(controller.nextPollDelay(track('a', 179000))).toBe(3000);
});

it('announces a song started from a paused 0:00 but not an ordinary mid-song resume', async () => {
  state = track('b', 0, { is_playing: false });
  const { pending } = await transition();
  expect(spoken).toEqual(['This is b']);
  await finishSpeech(); await pending;
  state = track('b', 60000, { is_playing: false });
  await controller.observe(state);
  state = { ...state, is_playing: true };
  await controller.observe(state);
  expect(spoken).toHaveLength(1);
});

function errorController(overrides = {}) {
  controller.dispose();
  const command = vi.fn(async () => ({ success: true }));
  const speak = vi.fn(async () => true);
  controller = createTrackAnnouncer({
    getMode: () => 'both', canSpeak: () => true,
    readPlayback: async () => ({ ...state, is_playing: false }),
    command, speak, describe: item => item.id,
    onError: error => errors.push(error.message), ...overrides,
  });
  return { command, speak };
}

it('does not speak or resume when the pause command is rejected', async () => {
  const command = vi.fn(async () => { throw new Error('Premium required'); });
  const { speak } = errorController({ command });
  const { pending } = await transition(); await pending;
  expect(speak).not.toHaveBeenCalled();
  expect(command).toHaveBeenCalledTimes(1);
  expect(errors).toEqual(['Premium required']);
});

it('does not speak until the pause is confirmed, and skips if Spotify keeps playing', async () => {
  const { command, speak } = errorController({ readPlayback: async () => state });
  const { pending } = await transition();
  expect(speak).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(2000); await pending;
  expect(speak).not.toHaveBeenCalled();
  expect(command.mock.calls.at(-1)[0]).toBe('play');
  expect(errors[0]).toContain('did not confirm');
});

it('resumes safely after a speech error without starting another announcement', async () => {
  const speak = vi.fn(async () => { throw new Error('Speech unavailable'); });
  const { command } = errorController({ speak });
  const { pending } = await transition(); await pending;
  expect(command.mock.calls.map(c => c[0])).toEqual(['pause', 'play']);
  expect(command.mock.calls[1][2]).toBeUndefined();
  expect(speak).toHaveBeenCalledTimes(1);
  expect(errors).toEqual(['Speech unavailable']);
});

it('releases a pause that completes after navigation cancellation', async () => {
  let releasePause;
  const command = vi.fn(action => action === 'pause'
    ? new Promise(resolve => { releasePause = resolve; }) : Promise.resolve({ success: true }));
  const { speak } = errorController({ command });
  const { pending } = await transition();
  controller.dispose();
  releasePause({ success: true });
  await pending;
  expect(speak).not.toHaveBeenCalled();
  expect(command.mock.calls.map(c => c[0])).toEqual(['pause', 'play']);
  expect(command.mock.calls[1][2]).toBeUndefined();
});

it('reports a failed resume with instructions to recover in Spotify', async () => {
  const command = vi.fn(async action => {
    if (action === 'play') throw new Error('offline');
    return { success: true };
  });
  errorController({ command });
  const { pending } = await transition(); await pending;
  expect(errors).toEqual(['Could not resume Spotify. Press Play in Spotify to continue.']);
});
