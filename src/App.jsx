import React, { createContext, useContext, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home.jsx';
import PlaylistView from './pages/PlaylistView.jsx';
import Admin from './pages/Admin.jsx';
import NowPlaying from './pages/NowPlaying.jsx';
import Browse from './pages/Browse.jsx';
import ImportRatings from './pages/admin/ImportRatings.tsx';
import { FaMoon, FaSun } from 'react-icons/fa';

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
  return (
    <NightModeProvider>
      <div className="safe-area-top-overlay"></div>
      <NightModeBodyWrapper>
        <div className="dark" style={{ backgroundColor: '#18181b', paddingTop: 'calc(63px + env(safe-area-inset-top, 20px))' }}>
          <Router>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/browse" element={<Browse />} />
              <Route path="/browse/playlist/:id" element={<PlaylistView />} />
              <Route path="/playlist/:id" element={<Navigate to="/browse/playlist/:id" replace />} />
              <Route path="/now-playing" element={<NowPlaying />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/admin/ImportRatings" element={<ImportRatings />} />
            </Routes>
          </Router>
        </div>
      </NightModeBodyWrapper>
    </NightModeProvider>
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
  }, [nightMode]);
  return children;
}