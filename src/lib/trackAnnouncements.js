const START_MODES = new Set(['beginning', 'both']);
const END_MODES = new Set(['end', 'both']);
const STALE_MS = 10000;
const START_WINDOW_MS = 10000;

const trackId = state => state?.item?.type === 'track' ? state.item.id : null;
const samePlayback = (a, b) => trackId(a) && trackId(a) === trackId(b) &&
  a.device?.id === b.device?.id;
const abortError = () => new DOMException('Announcement cancelled', 'AbortError');

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    const onAbort = () => { clearTimeout(timer); reject(abortError()); };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

// This controls an external Spotify client. There is no before-track event in
// the Web API: observe a transition, confirm pause, speak in order, restart at 0.
export function createTrackAnnouncer({ getMode, canSpeak, speak, readPlayback,
  command, describe, onStatus = () => {}, onError = () => {}, now = Date.now }) {
  let previous;
  let initialized = false;
  let observedAt = 0;
  let active = null;
  let disposed = false;
  let suspended = false;
  let cooldownUntil = 0;

  function cancel() {
    active?.abort();
  }

  function isEligible() {
    return !disposed && !suspended && getMode() !== 'off' && canSpeak();
  }

  function check(signal) {
    if (signal.aborted || !isEligible()) throw abortError();
  }

  function report(error) {
    if (error.name === 'AbortError') return;
    cooldownUntil = now() + Math.max(30000, error.retryAfterMs || 0);
    onError(error);
  }

  async function speakLine(text, signal, status) {
    if (!text) return;
    check(signal);
    onStatus(status);
    await speak(text, { signal });
    check(signal);
  }

  async function announce(previousState, state, ended, mode) {
    const ending = ended && END_MODES.has(mode) ? describe(previousState.item, false) : '';
    const starting = START_MODES.has(mode) && trackId(state) ? describe(state.item, true) : '';
    if (!ending && !starting) return;
    const controller = new AbortController();
    active = controller;
    const { signal } = controller;
    let ownsPause = false;
    let completed = false;
    try {
      check(signal);
      if (state.is_playing) {
        onStatus('Pausing Spotify for announcements…');
        // Do not abort an in-flight pause: wait for its result so cleanup can
        // release it even if the user navigates away while it is in flight.
        const result = await command('pause', state);
        ownsPause = result.success === true;
        if (!ownsPause) return;
        check(signal);
        let paused = false;
        for (let attempt = 0; attempt < 5; attempt++) {
          const current = await readPlayback();
          check(signal);
          if (!samePlayback(state, current)) return;
          if (current.is_playing === false) { paused = true; break; }
          await wait(250, signal);
        }
        if (!paused) throw new Error('Spotify did not confirm the pause. Announcement skipped.');
      }
      if (ending) await speakLine(ending, signal, 'Announcing the previous song…');
      // Check again between announcements: don't describe a stale next track
      // if the user skipped, switched devices, or resumed in Spotify.
      if (starting) {
        const current = await readPlayback();
        check(signal);
        if (!samePlayback(state, current) || current.is_playing) return;
        await speakLine(starting, signal, 'Announcing the next song…');
      }
      completed = true;
    } catch (error) {
      report(error);
    } finally {
      if (ownsPause) {
        onStatus('Resuming Spotify…');
        try {
          // The server checks track/device/paused state again before resuming.
          // On cancellation or speech failure, release only our own pause.
          await command('play', state, completed ? 0 : undefined);
        } catch (error) {
          report(new Error('Could not resume Spotify. Press Play in Spotify to continue.'));
        }
      }
      if (active === controller) active = null;
      onStatus('');
    }
  }

  return {
    async observe(state) {
      if (disposed || active) return;
      const time = now();
      const elapsed = time - observedAt;
      const last = previous;
      const first = !initialized;
      initialized = true;
      previous = state;
      observedAt = time;
      if (first || elapsed > STALE_MS || time < cooldownUntil || !isEligible()) return;
      // A device change is a new baseline, never an invitation to take control.
      if (last?.device?.id && state.device?.id && state.device.id !== last.device.id) return;
      const oldId = trackId(last);
      const newId = trackId(state);
      const remaining = (last?.item?.duration_ms || 0) - (last?.progress_ms || 0);
      const reachedEnd = oldId && last.is_playing && remaining <= elapsed + 250;
      const repeated = samePlayback(last, state) && last.repeat_state === 'track' &&
        reachedEnd && state.is_playing && state.progress_ms < 1500 && last.progress_ms > state.progress_ms;
      const changed = oldId !== newId || repeated;
      const mode = getMode();
      // Speak an ending only after an observed boundary, never over the final
      // seconds. Manual skips don't count as the song finishing.
      const ended = reachedEnd && (changed || (state.is_playing === false &&
        samePlayback(last, state) && state.progress_ms >= state.item.duration_ms));
      const startedFromZero = samePlayback(last, state) && !last.is_playing &&
        last.progress_ms <= 1000 && state.is_playing;
      const start = (changed || startedFromZero) && newId && state.is_playing && state.progress_ms <= START_WINDOW_MS;
      if (!((ended && END_MODES.has(mode)) || (start && START_MODES.has(mode)))) return;
      // These flags apply to the current playback state. Spotify disallows
      // resuming while already playing; that says nothing about whether it can
      // resume after our pause. Only check the actions we need before pausing.
      const disallows = state.actions?.disallows ?? state.actions;
      if (state.is_playing && (!newId || !state.device?.id || state.device.is_restricted ||
          disallows?.pausing || disallows?.seeking || state.progress_ms > START_WINDOW_MS)) return;
      if (!state.is_playing && !ended) return;
      // At the end of a queue there is nothing to resume or introduce.
      await announce(last, state, ended, start ? mode : (END_MODES.has(mode) ? 'end' : 'off'));
    },
    nextPollDelay(state) {
      if (!isEligible() || !state?.is_playing || !trackId(state)) return 3000;
      // Only poll quickly near a boundary, keeping ordinary polling inexpensive.
      const remaining = state.item.duration_ms - state.progress_ms;
      if (remaining <= 4000) return 500;
      return Math.min(3000, Math.max(500, remaining - 4000));
    },
    cancel,
    suspend() { suspended = true; initialized = false; cancel(); },
    resume() { suspended = false; initialized = false; },
    dispose() { disposed = true; cancel(); },
  };
}

export async function spotifyRequest(path, options = {}) {
  const response = await fetch(`/api/spotify-proxy/${path}`, {
    ...options, cache: 'no-store', signal: AbortSignal.timeout(20000),
  });
  const data = await response.json();
  if (!response.ok) {
    const messages = {
      401: 'Reconnect Spotify to use track announcements.',
      403: 'Spotify denied playback control. Check Spotify Premium and reconnect Spotify.',
      429: 'Spotify is receiving too many requests. Announcements will retry shortly.',
    };
    const error = new Error(messages[response.status] || 'Could not control Spotify. Announcement skipped.');
    error.status = response.status;
    error.retryAfterMs = Number(response.headers.get('Retry-After') || 0) * 1000;
    throw error;
  }
  return data;
}

export function playbackCommand(action, state, position) {
  const query = new URLSearchParams({ device_id: state.device.id, track_id: state.item.id });
  if (position !== undefined) query.set('position_ms', String(position));
  return spotifyRequest(`${action}?${query}`, { method: 'POST' });
}
