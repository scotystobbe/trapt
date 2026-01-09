import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Set body and html background immediately to fix safe area on iOS
if (typeof document !== 'undefined') {
  document.body.style.backgroundColor = '#18181b';
  document.documentElement.style.backgroundColor = '#18181b';
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);