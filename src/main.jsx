import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Set body and html background immediately to fix safe area on iOS
if (typeof document !== 'undefined') {
  document.body.style.backgroundColor = '#18181b';
  document.body.style.margin = '0';
  document.body.style.padding = '0';
  document.documentElement.style.backgroundColor = '#18181b';
  document.documentElement.style.margin = '0';
  document.documentElement.style.padding = '0';
  
  // Force safe area overlay background
  const setSafeAreaBackground = () => {
    const overlays = document.querySelectorAll('.safe-area-absolute-overlay, .safe-area-top-overlay');
    overlays.forEach(overlay => {
      overlay.style.setProperty('background-color', '#18181b', 'important');
      overlay.style.setProperty('background', '#18181b', 'important');
    });
  };
  
  setSafeAreaBackground();
  // Also set it after a short delay to ensure it's applied
  setTimeout(setSafeAreaBackground, 100);
  setTimeout(setSafeAreaBackground, 500);
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);