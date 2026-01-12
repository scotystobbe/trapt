import React, { useState, useEffect } from 'react';
import { FaVolumeUp, FaTimes } from 'react-icons/fa';
import { getSpeechMode, SPEECH_MODES, hasSpeechPermission, isIOS, isPWA, grantSpeechPermission } from '../hooks/useSpeech';

// Export these for use in the hook
export { isIOS, isPWA };

export default function SpeechPermissionBanner() {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Only show on iOS/PWA when speech is enabled but not initialized
    const checkShouldShow = () => {
      const speechMode = getSpeechMode();
      const isIOSDevice = isIOS();
      const isPWAMode = isPWA();
      const hasPermission = hasSpeechPermission();
      
      // Show if:
      // 1. On iOS or PWA
      // 2. Speech mode is not OFF
      // 3. Permission hasn't been granted yet
      // 4. Not dismissed
      if ((isIOSDevice || isPWAMode) && 
          speechMode !== SPEECH_MODES.OFF && 
          !hasPermission && 
          !dismissed) {
        setShow(true);
      } else {
        setShow(false);
      }
    };

    checkShouldShow();

    // Listen for speech initialization
    const handleInitialized = () => {
      setShow(false);
    };

    // Listen for speech mode changes
    const handleModeChange = () => {
      checkShouldShow();
    };

    window.addEventListener('speech-initialized', handleInitialized);
    window.addEventListener('storage', handleModeChange);
    
    // Also check periodically in case speech mode changed
    const interval = setInterval(checkShouldShow, 1000);

    return () => {
      window.removeEventListener('speech-initialized', handleInitialized);
      window.removeEventListener('storage', handleModeChange);
      clearInterval(interval);
    };
  }, [dismissed]);

  const handleDismiss = () => {
    setDismissed(true);
    setShow(false);
    // Store dismissal in sessionStorage so it persists for this session
    try {
      sessionStorage.setItem('trapt_speech_banner_dismissed', 'true');
    } catch (err) {
      console.error('Failed to store dismissal:', err);
    }
  };

  // Don't show if dismissed in this session
  useEffect(() => {
    try {
      const wasDismissed = sessionStorage.getItem('trapt_speech_banner_dismissed') === 'true';
      if (wasDismissed) {
        setDismissed(true);
      }
    } catch (err) {
      // Ignore
    }
  }, []);

  const handleEnable = (e) => {
    e.stopPropagation();
    // Trigger initialization - this is a user interaction so it should work
    try {
      // Dispatch event to trigger speech hook initialization
      window.dispatchEvent(new CustomEvent('speech-manual-init'));
      // Also try direct initialization as backup
      const dummyUtterance = new SpeechSynthesisUtterance('');
      dummyUtterance.volume = 0;
      dummyUtterance.rate = 0.1;
      if (window.speechSynthesis) {
        window.speechSynthesis.speak(dummyUtterance);
        window.speechSynthesis.cancel();
      }
      grantSpeechPermission();
      // Dispatch event to notify that initialization is complete
      window.dispatchEvent(new CustomEvent('speech-initialized'));
      setShow(false);
    } catch (err) {
      console.error('Failed to enable speech:', err);
    }
  };

  if (!show) return null;

  return (
    <div 
      className="fixed bottom-0 left-0 right-0 z-[10000] p-4 bg-[#27272a] border-t border-[#3f3f46] shadow-lg"
      style={{ 
        paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))',
      }}
    >
      <div className="max-w-2xl mx-auto flex items-center gap-3">
        <FaVolumeUp className="text-purple-400 flex-shrink-0" size={20} />
        <div className="flex-1">
          <p className="text-white text-sm font-medium">
            Enable track announcements
          </p>
          <p className="text-gray-400 text-xs mt-0.5">
            iOS requires one tap to activate. After that, announcements work automatically.
          </p>
        </div>
        <button
          onClick={handleEnable}
          className="px-3 py-1.5 bg-purple-600 text-white text-sm font-medium rounded hover:bg-purple-500 transition flex-shrink-0"
        >
          Enable
        </button>
        <button
          onClick={handleDismiss}
          className="text-gray-400 hover:text-white flex-shrink-0 p-1"
          aria-label="Dismiss"
        >
          <FaTimes size={16} />
        </button>
      </div>
    </div>
  );
}
