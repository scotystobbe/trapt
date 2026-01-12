import { useRef, useCallback } from 'react';

const SPEECH_STORAGE_KEY = 'trapt_speech_setting';

export const SPEECH_MODES = {
  OFF: 'off',
  BEGINNING_ONLY: 'beginning',
  END_ONLY: 'end',
  BOTH: 'both',
};

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

  const speak = useCallback((text) => {
    // Check if speech synthesis is available
    if (!('speechSynthesis' in window)) {
      console.warn('Speech synthesis not supported');
      return;
    }

    // Cancel any ongoing speech
    if (synthRef.current) {
      window.speechSynthesis.cancel();
    }

    // Don't speak if already speaking
    if (isSpeakingRef.current) {
      return;
    }

    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 0.8;
      
      utterance.onstart = () => {
        isSpeakingRef.current = true;
      };
      
      utterance.onend = () => {
        isSpeakingRef.current = false;
      };
      
      utterance.onerror = () => {
        isSpeakingRef.current = false;
      };

      synthRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error('Speech error:', err);
      isSpeakingRef.current = false;
    }
  }, []);

  const cancel = useCallback(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      isSpeakingRef.current = false;
    }
  }, []);

  return { speak, cancel };
}
