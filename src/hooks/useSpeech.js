import { useRef, useCallback, useEffect } from 'react';

const SPEECH_STORAGE_KEY = 'trapt_speech_setting';

export const SPEECH_MODES = {
  OFF: 'off',
  BEGINNING_ONLY: 'beginning',
  END_ONLY: 'end',
  BOTH: 'both',
};

// Detect iOS
export function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

// Detect if running as PWA
export function isPWA() {
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.navigator.standalone === true ||
         document.referrer.includes('android-app://');
}

export function getSpeechMode() {
  try {
    return localStorage.getItem(SPEECH_STORAGE_KEY) || SPEECH_MODES.OFF;
  } catch {
    return SPEECH_MODES.OFF;
  }
}

export function setSpeechMode(mode) {
  try {
    localStorage.setItem(SPEECH_STORAGE_KEY, mode);
    window.dispatchEvent(new Event('speech-mode-changed'));
  } catch (err) {
    console.error('Failed to save speech mode:', err);
  }
}

const SPEECH_PERMISSION_KEY = 'trapt_speech_permission_granted';

export function hasSpeechPermission() {
  try {
    return sessionStorage.getItem(SPEECH_PERMISSION_KEY) === 'true';
  } catch {
    return false;
  }
}

export function grantSpeechPermission() {
  try {
    sessionStorage.setItem(SPEECH_PERMISSION_KEY, 'true');
    return true;
  } catch {
    return false;
  }
}

export function canSpeak() {
  return 'speechSynthesis' in window &&
    (!(isIOS() || isPWA()) || hasSpeechPermission());
}

export function useSpeech() {
  const activeRef = useRef(null);

  // Helper to find the best voice for natural speech
  const findBestVoice = useCallback(() => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) return null;

    // Priority 1: Neural voices (most natural sounding)
    // These are available in Chrome/Edge and sound much more natural
    const neuralVoice = voices.find(v => 
      v.name.toLowerCase().includes('neural') ||
      v.name.toLowerCase().includes('natural')
    );
    if (neuralVoice) {
      console.log('[Speech] Using neural voice:', neuralVoice.name);
      return neuralVoice;
    }

    // Priority 2: Cloud-based voices (often better quality than local)
    // These are typically more natural than system voices
    const cloudVoices = voices.filter(v => v.localService === false);
    if (cloudVoices.length > 0) {
      // Prefer cloud voices with specific quality indicators
      const preferredCloud = cloudVoices.find(v => 
        v.name.toLowerCase().includes('enhanced') ||
        v.name.toLowerCase().includes('premium') ||
        v.name.toLowerCase().includes('natural')
      );
      if (preferredCloud) {
        console.log('[Speech] Using preferred cloud voice:', preferredCloud.name);
        return preferredCloud;
      }
      // Use first cloud voice if no preferred found
      console.log('[Speech] Using cloud voice:', cloudVoices[0].name);
      return cloudVoices[0];
    }

    // Priority 3: Enhanced/premium local voices
    const enhancedVoice = voices.find(v => 
      v.name.toLowerCase().includes('enhanced') || 
      v.name.toLowerCase().includes('premium') ||
      v.name.toLowerCase().includes('natural')
    );
    if (enhancedVoice) {
      console.log('[Speech] Using enhanced voice:', enhancedVoice.name);
      return enhancedVoice;
    }

    // Priority 4: High-quality macOS voices (these are generally good)
    const preferredNames = [
      'Samantha', 'Alex', 'Victoria', 'Daniel', 'Fiona', 'Karen', 'Moira', // macOS
      'Siri', // iOS
    ];
    for (const name of preferredNames) {
      const voice = voices.find(v => 
        v.name.includes(name) || v.name.toLowerCase().includes(name.toLowerCase())
      );
      if (voice) {
        console.log('[Speech] Using preferred voice:', voice.name);
        return voice;
      }
    }

    // Priority 5: Avoid obviously robotic voices, prefer English voices
    const englishVoices = voices.filter(v => 
      v.lang.startsWith('en') && 
      !v.name.toLowerCase().includes('compact') &&
      !v.name.toLowerCase().includes('novelty')
    );
    if (englishVoices.length > 0) {
      // Prefer voices that aren't the system default (often more natural)
      const nonDefault = englishVoices.find(v => !v.default);
      if (nonDefault) {
        console.log('[Speech] Using English voice:', nonDefault.name);
        return nonDefault;
      }
      console.log('[Speech] Using English default voice:', englishVoices[0].name);
      return englishVoices[0];
    }

    // Fallback: Use default voice if available
    const defaultVoice = voices.find(v => v.default);
    if (defaultVoice) {
      console.log('[Speech] Using default voice:', defaultVoice.name);
      return defaultVoice;
    }

    // Last resort: first available voice
    console.log('[Speech] Using fallback voice:', voices[0].name);
    return voices[0];
  }, []);

  const cancel = useCallback(() => {
    const active = activeRef.current;
    if (!active) return;
    active.finish(new DOMException('Speech cancelled', 'AbortError'));
    if (active.started) window.speechSynthesis.cancel();
  }, []);

  // Resolve only when the utterance ends, so Spotify stays paused throughout.
  const speak = useCallback((text, { signal } = {}) => {
    if (getSpeechMode() === SPEECH_MODES.OFF) return Promise.resolve(false);
    if (signal?.aborted) return Promise.reject(new DOMException('Speech cancelled', 'AbortError'));
    if (!canSpeak()) return Promise.reject(new Error('Tap Enable to activate track announcements.'));
    cancel();

    return new Promise((resolve, reject) => {
      const synth = window.speechSynthesis;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.88;
      utterance.pitch = 0.98;
      utterance.volume = 0.95;
      let voiceTimer;
      let deadline;
      let settled = false;
      const onAbort = () => cancel();
      const active = {
        started: false,
        finish(error) {
          if (settled) return;
          settled = true;
          clearTimeout(voiceTimer);
          clearTimeout(deadline);
          synth.removeEventListener?.('voiceschanged', start);
          signal?.removeEventListener('abort', onAbort);
          utterance.onend = null;
          utterance.onerror = null;
          if (activeRef.current === active) activeRef.current = null;
          if (error) reject(error);
          else resolve(true);
        },
      };
      const start = () => {
        if (settled || active.started) return;
        clearTimeout(voiceTimer);
        synth.removeEventListener?.('voiceschanged', start);
        try {
          const voice = findBestVoice();
          if (voice) utterance.voice = voice;
          active.started = true;
          synth.speak(utterance);
        } catch (error) {
          active.finish(error);
        }
      };
      // Keep a strong reference until completion (required by some browsers).
      active.utterance = utterance;
      activeRef.current = active;
      utterance.onend = () => active.finish();
      utterance.onerror = event => active.finish(new Error(`Track announcement failed: ${event.error}`));
      signal?.addEventListener('abort', onAbort, { once: true });
      // A missing browser completion event must never leave Spotify paused forever.
      deadline = setTimeout(() => {
        active.finish(new Error('Track announcement timed out.'));
        if (active.started) synth.cancel();
      }, Math.min(60000, Math.max(15000, text.split(/\s+/).length * 1000)));
      if (synth.getVoices().length) start();
      else {
        synth.addEventListener?.('voiceschanged', start, { once: true });
        voiceTimer = setTimeout(start, 500);
      }
    });
  }, [cancel, findBestVoice]);

  // Only the explicit Enable button may warm up speech; navigation is silent.
  useEffect(() => {
    const initializeSpeech = () => {
      if (getSpeechMode() === SPEECH_MODES.OFF || !('speechSynthesis' in window)) return;
      if (!hasSpeechPermission()) {
        try {
          const utterance = new SpeechSynthesisUtterance('');
          utterance.volume = 0;
          window.speechSynthesis.speak(utterance);
          window.speechSynthesis.cancel();
          grantSpeechPermission();
        } catch (error) {
          console.error('Failed to enable speech:', error);
          return;
        }
      }
      window.dispatchEvent(new Event('speech-initialized'));
    };
    window.addEventListener('speech-manual-init', initializeSpeech);
    return () => {
      window.removeEventListener('speech-manual-init', initializeSpeech);
      cancel();
    };
  }, [cancel]);

  return { speak, cancel };
}
