// iOS speech activation can interrupt other audio even for a silent utterance.
// Restore only the Spotify track/device that was playing when Enable was tapped.
// Never rewind, replace the queue, or resume media that was already paused.
export async function restorePlaybackAfterSpeechActivation(snapshot, {
  readPlayback, command, wait = ms => new Promise(resolve => setTimeout(resolve, ms)),
}) {
  if (!snapshot?.is_playing || snapshot.item?.type !== 'track' ||
      !snapshot.item.id || !snapshot.device?.id || snapshot.device.is_restricted) return;
  for (const delay of [300, 700, 1000]) {
    await wait(delay);
    const current = await readPlayback();
    if (current.item?.id !== snapshot.item.id || current.device?.id !== snapshot.device.id) return;
    if (current.is_playing === false) {
      // Server rechecks the track, device and paused state immediately before play.
      await command('play', snapshot);
      return;
    }
  }
}
