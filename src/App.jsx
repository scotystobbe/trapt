import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home.jsx';
import PlaylistView from './pages/PlaylistView.jsx';
import Admin from './pages/Admin.jsx';
import NowPlaying from './pages/NowPlaying.jsx';

function Browse() {
  // This can be refactored to the old Home browser logic if needed
  return <Home />;
}

export default function App() {
  return (
    <div className="dark bg-gray-900 text-white min-h-screen">
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/browse" element={<Browse />} />
          <Route path="/browse/playlist/:id" element={<PlaylistView />} />
          <Route path="/playlist/:id" element={<Navigate to="/browse/playlist/:id" replace />} />
          <Route path="/now-playing" element={<NowPlaying />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </Router>
    </div>
  );
}