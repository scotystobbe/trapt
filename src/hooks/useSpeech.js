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

export function useSpeech() {
  const synthRef = useRef(null);
  const isSpeakingRef = useRef(false);
  const isInitializedRef = useRef(false);
  const pendingSpeechesRef = useRef([]);
  const isIOSDevice = useRef(isIOS());
  const isPWAMode = useRef(isPWA());
  const executeSpeakRef = useRef(null);
  
  // Check if we already have permission from a previous session
  useEffect(() => {
    if (hasSpeechPermission() && (isIOSDevice.current || isPWAMode.current)) {
      // Try to initialize immediately if we have permission
      try {
        const dummyUtterance = new SpeechSynthesisUtterance('');
        dummyUtterance.volume = 0;
        dummyUtterance.rate = 0.1;
        window.speechSynthesis.speak(dummyUtterance);
        window.speechSynthesis.cancel();
        isInitializedRef.current = true;
        console.log('[Speech] Auto-initialized with stored permission');
      } catch (err) {
        console.error('[Speech] Auto-initialization failed:', err);
      }
    }
  }, []);

  // Helper to find the best voice for natural speech
  const findBestVoice = useCallback(() => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) return null;

    // Prefer enhanced/premium voices for better quality
    // On macOS: Look for "Samantha", "Alex", "Victoria", "Daniel", "Fiona"
    // On iOS: Look for "Siri" voices or enhanced voices
    // On other platforms: Look for "Google" voices or enhanced voices
    
    const preferredNames = [
      'Samantha', 'Alex', 'Victoria', 'Daniel', 'Fiona', // macOS
      'Siri', 'Enhanced', // iOS
      'Google', 'Microsoft', // Other platforms
    ];

    // First, try to find a preferred voice
    for (const name of preferredNames) {
      const voice = voices.find(v => 
        v.name.includes(name) || v.name.toLowerCase().includes(name.toLowerCase())
      );
      if (voice) {
        console.log('[Speech] Using preferred voice:', voice.name);
        return voice;
      }
    }

    // Look for enhanced voices
    const enhancedVoice = voices.find(v => 
      v.name.toLowerCase().includes('enhanced') || 
      v.name.toLowerCase().includes('premium') ||
      v.localService === false // Cloud voices are often better quality
    );
    if (enhancedVoice) {
      console.log('[Speech] Using enhanced voice:', enhancedVoice.name);
      return enhancedVoice;
    }

    // Use default voice if available
    const defaultVoice = voices.find(v => v.default);
    if (defaultVoice) {
      console.log('[Speech] Using default voice:', defaultVoice.name);
      return defaultVoice;
    }

    // Fallback to first available voice
    console.log('[Speech] Using fallback voice:', voices[0].name);
    return voices[0];
  }, []);

  // The actual speech execution function
  const executeSpeak = useCallback(async (text) => {
    // Cancel any ongoing speech to allow new speech
    if (window.speechSynthesis.speaking) {
      console.log('[Speech] Cancelling previous speech');
      window.speechSynthesis.cancel();
      // Wait a bit for cancellation to complete
      setTimeout(() => {
        isSpeakingRef.current = false;
      }, 100);
    }

    // Pause Spotify playback before speaking
    let wasPlaying = false;
    try {
      const pauseRes = await fetch('/api/spotify-proxy/pause', { method: 'POST' });
      if (pauseRes.ok) {
        wasPlaying = true;
        console.log('[Speech] Paused Spotify playback');
      }
    } catch (err) {
      console.warn('[Speech] Could not pause Spotify:', err);
    }

    try {
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Use more natural speech parameters
      utterance.rate = 0.95; // Slightly slower for more natural speech
      utterance.pitch = 1.0; // Natural pitch
      utterance.volume = 0.9; // Slightly louder for clarity
      
      // Find and use the best available voice
      const bestVoice = findBestVoice();
      if (bestVoice) {
        utterance.voice = bestVoice;
      }
      
      utterance.onstart = () => {
        console.log('[Speech] Speech started');
        isSpeakingRef.current = true;
      };
      
      utterance.onend = () => {
        console.log('[Speech] Speech ended');
        isSpeakingRef.current = false;
        
        // Resume Spotify playback after speech ends
        if (wasPlaying) {
          setTimeout(async () => {
            try {
              await fetch('/api/spotify-proxy/play', { method: 'POST' });
              console.log('[Speech] Resumed Spotify playback');
            } catch (err) {
              console.warn('[Speech] Could not resume Spotify:', err);
            }
          }, 200); // Small delay to ensure speech is fully done
        }
      };
      
      utterance.onerror = (event) => {
        console.error('[Speech] Speech error:', event.error);
        isSpeakingRef.current = false;
        
        // Resume Spotify even on error
        if (wasPlaying) {
          setTimeout(async () => {
            try {
              await fetch('/api/spotify-proxy/play', { method: 'POST' });
            } catch (err) {
              console.warn('[Speech] Could not resume Spotify:', err);
            }
          }, 200);
        }
      };

      synthRef.current = utterance;
      
      // For iOS, ensure voices are loaded
      if (isIOSDevice.current && window.speechSynthesis.getVoices().length === 0) {
        // Wait for voices to load
        const loadVoices = () => {
          const voices = window.speechSynthesis.getVoices();
          if (voices.length > 0) {
            const bestVoice = findBestVoice();
            if (bestVoice) {
              utterance.voice = bestVoice;
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
        // Try to get voices if not already loaded (for better voice selection)
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          const bestVoice = findBestVoice();
          if (bestVoice && !utterance.voice) {
            utterance.voice = bestVoice;
          }
        }
        window.speechSynthesis.speak(utterance);
        console.log('[Speech] Speech queued');
      }
    } catch (err) {
      console.error('[Speech] Speech error:', err);
      isSpeakingRef.current = false;
      
      // Resume Spotify on error
      if (wasPlaying) {
        setTimeout(async () => {
          try {
            await fetch('/api/spotify-proxy/play', { method: 'POST' });
          } catch (err) {
            console.warn('[Speech] Could not resume Spotify:', err);
          }
        }, 200);
      }
    }
  }, [findBestVoice]);

  // Store reference for use in initialization
  executeSpeakRef.current = executeSpeak;

  // The initialization function
  const initializeSpeech = useCallback(() => {
    if (isInitializedRef.current) return;
    
    try {
      // Create a dummy utterance to initialize the speech synthesis engine
      const dummyUtterance = new SpeechSynthesisUtterance('');
      dummyUtterance.volume = 0;
      dummyUtterance.rate = 0.1;
      window.speechSynthesis.speak(dummyUtterance);
      window.speechSynthesis.cancel(); // Cancel immediately
      isInitializedRef.current = true;
      grantSpeechPermission(); // Store permission for this session
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
      
      // Dispatch event to hide permission banner
      window.dispatchEvent(new CustomEvent('speech-initialized'));
    } catch (err) {
      console.error('[Speech] Initialization error:', err);
    }
  }, []);

  // Initialize speech synthesis on iOS/PWA - this needs to happen on user interaction
  useEffect(() => {
    if (!('speechSynthesis' in window)) return;

    // Initialize on any user interaction
    const events = ['touchstart', 'touchend', 'click', 'keydown'];
    events.forEach(event => {
      document.addEventListener(event, initializeSpeech, { once: true, passive: true });
    });

    // Listen for manual initialization from banner
    const handleManualInit = () => {
      initializeSpeech();
    };
    window.addEventListener('speech-manual-init', handleManualInit);

    // Also try to initialize after a short delay (in case user already interacted)
    const timeout = setTimeout(initializeSpeech, 1000);

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, initializeSpeech);
      });
      window.removeEventListener('speech-manual-init', handleManualInit);
      clearTimeout(timeout);
    };
  }, [initializeSpeech]);

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
        grantSpeechPermission(); // Store permission
        // Dispatch event to hide permission banner
        window.dispatchEvent(new CustomEvent('speech-initialized'));
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
