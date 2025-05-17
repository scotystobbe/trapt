import React from "react";
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home.jsx';
import PlaylistView from './pages/PlaylistView.jsx';

function App() {
  return (
    <div className="dark bg-gray-900 text-white min-h-screen">
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/playlist/:id" element={<PlaylistView />} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;