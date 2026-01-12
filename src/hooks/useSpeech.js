import { useRef, useCallback, useEffect } from 'react';

const SPEECH_STORAGE_KEY = 'trapt_speech_setting';

export const SPEECH_MODES = {
  OFF: 'off',
  BEGINNING_ONLY: 'beginning',
  END_ONLY: 'end',
  BOTH: 'both',
};

// Detect iOS
function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

// Detect if running as PWA
function isPWA() {
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
  } catch (err) {
    console.error('Failed to save speech mode:', err);
  }
}

export function useSpeech() {
  const synthRef = useRef(null);
  const isSpeakingRef = useRef(false);
  const isInitializedRef = useRef(false);
  const pendingSpeechesRef = useRef([]);
  const isIOSDevice = useRef(isIOS());
  const isPWAMode = useRef(isPWA());
  const executeSpeakRef = useRef(null);

  // The actual speech execution function
  const executeSpeak = useCallback((text) => {
    // Cancel any ongoing speech to allow new speech
    if (window.speechSynthesis.speaking) {
      console.log('[Speech] Cancelling previous speech');
      window.speechSynthesis.cancel();
      // Wait a bit for cancellation to complete
      setTimeout(() => {
        isSpeakingRef.current = false;
      }, 100);
    }

    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 0.8;
      
      // For iOS, sometimes we need to set the voice explicitly
      if (isIOSDevice.current) {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          // Prefer a default voice, or use the first available
          const defaultVoice = voices.find(v => v.default) || voices[0];
          if (defaultVoice) {
            utterance.voice = defaultVoice;
          }
        }
      }
      
      utterance.onstart = () => {
        console.log('[Speech] Speech started');
        isSpeakingRef.current = true;
      };
      
      utterance.onend = () => {
        console.log('[Speech] Speech ended');
        isSpeakingRef.current = false;
      };
      
      utterance.onerror = (event) => {
        console.error('[Speech] Speech error:', event.error);
        isSpeakingRef.current = false;
      };

      synthRef.current = utterance;
      
      // For iOS, ensure voices are loaded
      if (isIOSDevice.current && window.speechSynthesis.getVoices().length === 0) {
        // Wait for voices to load
        const loadVoices = () => {
          const voices = window.speechSynthesis.getVoices();
          if (voices.length > 0) {
            const defaultVoice = voices.find(v => v.default) || voices[0];
            if (defaultVoice) {
              utterance.voice = defaultVoice;
            }
            window.speechSynthesis.speak(utterance);
            console.log('[Speech] Speech queued (voices loaded)');
          } else {
            // Fallback: speak without voice selection
            window.speechSynthesis.speak(utterance);
            console.log('[Speech] Speech queued (no voices available)');
          }
        };
        
        // iOS sometimes needs voices to be loaded
        if ('onvoiceschanged' in window.speechSynthesis) {
          window.speechSynthesis.onvoiceschanged = loadVoices;
        }
        loadVoices();
      } else {
        window.speechSynthesis.speak(utterance);
        console.log('[Speech] Speech queued');
      }
    } catch (err) {
      console.error('[Speech] Speech error:', err);
      isSpeakingRef.current = false;
    }
  }, []);

  // Store reference for use in initialization
  executeSpeakRef.current = executeSpeak;

  // Initialize speech synthesis on iOS/PWA - this needs to happen on user interaction
  useEffect(() => {
    if (!('speechSynthesis' in window)) return;

    // For iOS/PWA, we need to "warm up" speech synthesis on first user interaction
    const initializeSpeech = () => {
      if (isInitializedRef.current) return;
      
      try {
        // Create a dummy utterance to initialize the speech synthesis engine
        const dummyUtterance = new SpeechSynthesisUtterance('');
        dummyUtterance.volume = 0;
        dummyUtterance.rate = 0.1;
        window.speechSynthesis.speak(dummyUtterance);
        window.speechSynthesis.cancel(); // Cancel immediately
        isInitializedRef.current = true;
        console.log('[Speech] Initialized for iOS/PWA');
        
        // Process any pending speeches
        if (pendingSpeechesRef.current.length > 0) {
          const pending = pendingSpeechesRef.current.shift();
          setTimeout(() => {
            if (executeSpeakRef.current) {
              executeSpeakRef.current(pending.text);
            }
          }, 100);
        }
      } catch (err) {
        console.error('[Speech] Initialization error:', err);
      }
    };

    // Initialize on any user interaction
    const events = ['touchstart', 'touchend', 'click', 'keydown'];
    events.forEach(event => {
      document.addEventListener(event, initializeSpeech, { once: true, passive: true });
    });

    // Also try to initialize after a short delay (in case user already interacted)
    const timeout = setTimeout(initializeSpeech, 1000);

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, initializeSpeech);
      });
      clearTimeout(timeout);
    };
  }, []);

  // Public speak function that handles initialization
  const speak = useCallback((text) => {
    // Check if speech synthesis is available
    if (!('speechSynthesis' in window)) {
      console.warn('[Speech] Speech synthesis not supported in this browser');
      return;
    }

    console.log('[Speech] Attempting to speak:', text, 'iOS:', isIOSDevice.current, 'PWA:', isPWAMode.current);

    // For iOS/PWA, ensure we're initialized first
    if ((isIOSDevice.current || isPWAMode.current) && !isInitializedRef.current) {
      console.log('[Speech] Not initialized yet, queuing speech');
      pendingSpeechesRef.current.push({ text, timestamp: Date.now() });
      // Try to initialize now
      try {
        const dummyUtterance = new SpeechSynthesisUtterance('');
        dummyUtterance.volume = 0;
        dummyUtterance.rate = 0.1;
        window.speechSynthesis.speak(dummyUtterance);
        window.speechSynthesis.cancel();
        isInitializedRef.current = true;
        // Process the queued speech after a short delay
        setTimeout(() => {
          const pending = pendingSpeechesRef.current.shift();
          if (pending && executeSpeakRef.current) {
            executeSpeakRef.current(pending.text);
          }
        }, 200);
      } catch (err) {
        console.error('[Speech] Failed to initialize:', err);
      }
      return;
    }

    executeSpeak(text);
  }, [executeSpeak]);

  const cancel = useCallback(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      isSpeakingRef.current = false;
    }
  }, []);

  return { speak, cancel };
}
