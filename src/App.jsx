import React, { createContext, useContext, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home.jsx';
import PlaylistView from './pages/PlaylistView.jsx';
import Admin from './pages/Admin.jsx';
import NowPlaying from './pages/NowPlaying.jsx';
import Browse from './pages/Browse.jsx';
import ImportRatings from './pages/admin/ImportRatings.tsx';
import Stats from './pages/admin/Stats.jsx';
import ScrollTest from './pages/ScrollTest.jsx';
import GeniusEmbedPage from './pages/genius-embed/[songId]';
import Login from './pages/Login.jsx';
import Profile from './pages/Profile.jsx';
import { FaMoon, FaSun } from 'react-icons/fa';
import ScrollToTop from './components/ScrollToTop';
import { AuthProvider } from './components/AuthProvider';

const NightModeContext = createContext();
export function useNightMode() {
  return useContext(NightModeContext);
}

function NightModeProvider({ children }) {
  const [nightMode, setNightMode] = useState(false);
  return (
    <NightModeContext.Provider value={{ nightMode, setNightMode }}>
      {children}
    </NightModeContext.Provider>
  );
}

function NightModeToggle() {
  const { nightMode, setNightMode } = useNightMode();
  return (
    <button
      onClick={() => setNightMode((v) => !v)}
      className="fixed top-4 left-4 z-50 bg-gray-800 bg-opacity-80 rounded-full p-3 shadow-lg border border-gray-700 hover:bg-gray-700 transition"
      title={nightMode ? 'Disable Night Mode' : 'Enable Night Mode'}
      aria-label="Toggle Night Mode"
    >
      {nightMode ? <FaSun className="text-red-800 w-6 h-6" /> : <FaMoon className="text-red-500 w-6 h-6" />}
    </button>
  );
}

export default function App() {
  // Ensure safe area background is set for PWA mode
  React.useEffect(() => {
    // Set body and html background for PWA standalone mode
    document.body.style.backgroundColor = '#18181b';
    document.documentElement.style.backgroundColor = '#18181b';
    // Also set it on the safe area overlays directly
    const overlays = document.querySelectorAll('.safe-area-top-overlay, .safe-area-absolute-overlay');
    overlays.forEach(overlay => {
      overlay.style.setProperty('background-color', '#18181b', 'important');
      overlay.style.setProperty('background', '#18181b', 'important');
      overlay.style.setProperty('opacity', '1', 'important');
      overlay.style.setProperty('mix-blend-mode', 'normal', 'important');
      overlay.style.setProperty('backdrop-filter', 'none', 'important');
      overlay.style.setProperty('-webkit-backdrop-filter', 'none', 'important');
    });
    
    // Force set on body and html
    document.body.style.setProperty('background-color', '#18181b', 'important');
    document.documentElement.style.setProperty('background-color', '#18181b', 'important');
    
    // Create additional overlay divs as backup
    const createOverlay = (zIndex) => {
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: env(safe-area-inset-top, 60px);
        height: constant(safe-area-inset-top, 60px);
        background-color: #18181b !important;
        background: #18181b !important;
        opacity: 1 !important;
        mix-blend-mode: normal !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
        z-index: ${zIndex};
        pointer-events: none;
      `;
      document.body.appendChild(overlay);
    };
    
    // Add multiple overlay layers
    createOverlay(9999999);
    createOverlay(9999998);
  }, []);

  return (
    <AuthProvider>
      <NightModeProvider>
        <div className="safe-area-top-overlay"></div>
        <NightModeBodyWrapper>
          <div className="dark" style={{ backgroundColor: '#18181b', paddingTop: 'calc(84px + env(safe-area-inset-top, 0px))' }}>
            <Router>
              <ScrollToTop />
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/browse" element={<Browse />} />
                <Route path="/browse/playlist/:id" element={<PlaylistView />} />
                <Route path="/playlist/:id" element={<Navigate to="/browse/playlist/:id" replace />} />
                <Route path="/now-playing" element={<NowPlaying />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/admin/ImportRatings" element={<ImportRatings />} />
                <Route path="/admin/stats" element={<Stats />} />
                <Route path="/scroll-test" element={<ScrollTest />} />
                <Route path="/genius-embed/:songId" element={<GeniusEmbedPage />} />
                <Route path="/login" element={<Login />} />
                <Route path="/profile" element={<Profile />} />
              </Routes>
            </Router>
          </div>
        </NightModeBodyWrapper>
      </NightModeProvider>
    </AuthProvider>
  );
}

function NightModeBodyWrapper({ children }) {
  const { nightMode } = useNightMode();
  React.useEffect(() => {
    if (nightMode) {
      document.body.classList.add('night-mode');
    } else {
      document.body.classList.remove('night-mode');
    }
    // Ensure body and html have correct background for safe area
    document.body.style.backgroundColor = '#18181b';
    document.documentElement.style.backgroundColor = '#18181b';
  }, [nightMode]);
  return children;
}