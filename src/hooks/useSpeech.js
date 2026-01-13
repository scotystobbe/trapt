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
      
      // Use more natural speech parameters
      // Rate: 0.85-0.9 is optimal for natural speech (slower = more natural)
      utterance.rate = 0.88; // Slightly slower for more natural, conversational pace
      // Pitch: Slightly lower (0.95-1.0) sounds more natural than default
      utterance.pitch = 0.98; // Slightly lower pitch for more natural sound
      utterance.volume = 0.95; // High volume for clarity
      
      // Find and use the best available voice
      const bestVoice = findBestVoice();
      if (bestVoice) {
        utterance.voice = bestVoice;
        console.log('[Speech] Selected voice:', bestVoice.name, 'Lang:', bestVoice.lang, 'Local:', bestVoice.localService);
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
      
      // Ensure voices are loaded before speaking (important for neural voices)
      const voices = window.speechSynthesis.getVoices();
      
      // If voices aren't loaded yet, wait for them (especially important for neural voices)
      if (voices.length === 0) {
        console.log('[Speech] Voices not loaded yet, waiting...');
        const loadVoices = () => {
          const loadedVoices = window.speechSynthesis.getVoices();
          if (loadedVoices.length > 0) {
            // Re-select best voice now that voices are loaded
            const bestVoice = findBestVoice();
            if (bestVoice) {
              utterance.voice = bestVoice;
              console.log('[Speech] Updated voice after load:', bestVoice.name);
            }
            window.speechSynthesis.speak(utterance);
            console.log('[Speech] Speech queued (voices loaded)');
          } else {
            // Fallback: speak without voice selection if voices still not available
            window.speechSynthesis.speak(utterance);
            console.log('[Speech] Speech queued (no voices available)');
          }
        };
        
        // Listen for voices to be loaded
        if ('onvoiceschanged' in window.speechSynthesis) {
          const originalHandler = window.speechSynthesis.onvoiceschanged;
          window.speechSynthesis.onvoiceschanged = () => {
            loadVoices();
            // Restore original handler if it existed
            if (originalHandler) {
              window.speechSynthesis.onvoiceschanged = originalHandler;
            } else {
              window.speechSynthesis.onvoiceschanged = null;
            }
          };
        }
        
        // Also try immediately in case voices are already loading
        // Trigger voices to load by calling getVoices (some browsers need this)
        window.speechSynthesis.getVoices();
        
        // Fallback timeout: if voices don't load within 500ms, speak anyway
        setTimeout(() => {
          const loadedVoices = window.speechSynthesis.getVoices();
          if (loadedVoices.length > 0) {
            const bestVoice = findBestVoice();
            if (bestVoice) {
              utterance.voice = bestVoice;
            }
          }
          if (!window.speechSynthesis.speaking) {
            window.speechSynthesis.speak(utterance);
            console.log('[Speech] Speech queued (timeout fallback)');
          }
        }, 500);
      } else {
        // Voices are already loaded, ensure we have the best voice selected
        const bestVoice = findBestVoice();
        if (bestVoice && (!utterance.voice || utterance.voice.name !== bestVoice.name)) {
          utterance.voice = bestVoice;
          console.log('[Speech] Updated to best voice:', bestVoice.name);
        }
        window.speechSynthesis.speak(utterance);
        console.log('[Speech] Speech queued');
      }
    } catch (err) {
      console.error('[Speech] Speech error:', err);
      isSpeakingRef.current = false;
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
