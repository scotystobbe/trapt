import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaBars, FaMoon, FaSun } from 'react-icons/fa';
import { useNightMode } from '../App';
import { useAuth } from './AuthProvider';

export default function HamburgerMenu({ className = '' }) {
  const [open, setOpen] = useState(false);
  const { nightMode, setNightMode } = useNightMode();
  const { user, logout } = useAuth();
  const menuRef = useRef(null);
  const navigate = useNavigate();
  const [showLogoutMsg, setShowLogoutMsg] = useState(false);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  const handleLogout = () => {
    logout();
    setOpen(false);
    setShowLogoutMsg(true);
    navigate('/');
    setTimeout(() => setShowLogoutMsg(false), 2000);
  };

  return (
    <div ref={menuRef} className={"relative inline-block text-left z-50 " + className}>
      <button
        onClick={() => setOpen(!open)}
        className={"p-2 rounded hover:bg-gray-700 focus:outline-none " + className}
        aria-label="Open menu"
      >
        <FaBars className="text-2xl text-white" />
      </button>
      {open && (
        <div style={{ backgroundColor: '#27272a', border: '1px solid #3f3f46' }} className="absolute right-0 mt-2 w-40 rounded shadow-lg flex flex-col">
          <Link
            to="/"
            className="block px-4 py-2 text-white hover:bg-[#3f3f46]"
            onClick={() => setOpen(false)}
          >
            Home
          </Link>
          <Link
            to="/now-playing"
            className="block px-4 py-2 text-white hover:bg-[#3f3f46]"
            onClick={() => setOpen(false)}
          >
            Now Playing
          </Link>
          <Link
            to="/browse"
            className="block px-4 py-2 text-white hover:bg-[#3f3f46]"
            onClick={() => setOpen(false)}
          >
            Browse
          </Link>
          {user?.role === 'ADMIN' && (
            <Link
              to="/admin"
              className="block px-4 py-2 text-white hover:bg-[#3f3f46]"
              onClick={() => setOpen(false)}
            >
              Admin
            </Link>
          )}
          {user && (
            <Link
              to="/profile"
              className="block px-4 py-2 text-white hover:bg-[#3f3f46]"
              onClick={() => setOpen(false)}
            >
              Profile
            </Link>
          )}
          <div className="border-t mt-2 pt-4 pb-4 flex flex-col items-center gap-2" style={{ borderColor: '#3f3f46' }}>
            <button
              onClick={() => setNightMode((v) => !v)}
              className={`relative w-12 h-6 rounded-full transition-colors duration-300 focus:outline-none ${nightMode ? 'bg-red-600' : ''}`}
              style={{ backgroundColor: nightMode ? '#991b1b' : '#3f3f46' }}
              aria-label="Toggle Night Mode"
            >
              <span
                className={`absolute left-0 top-0 w-6 h-6 rounded-full bg-white shadow-md flex items-center justify-center transition-transform duration-300 ${nightMode ? 'translate-x-6' : ''}`}
              >
                {nightMode ? <FaMoon className="text-gray-700 w-4 h-4" /> : <FaSun className="text-yellow-500 w-4 h-4" />}
              </span>
            </button>
            {user ? (
              <button
                onClick={handleLogout}
                className="mt-2 px-4 py-2 rounded bg-red-600 text-white font-semibold hover:bg-red-500 transition"
              >
                Logout
              </button>
            ) : (
              <Link
                to="/login"
                className="mt-2 px-4 py-2 rounded bg-green-600 text-white font-semibold hover:bg-green-500 transition text-center"
                onClick={() => setOpen(false)}
              >
                Log In
              </Link>
            )}
          </div>
        </div>
      )}
      {showLogoutMsg && (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 bg-green-700 text-white px-6 py-2 rounded shadow-lg z-[9999] text-lg font-semibold">
          Successfully logged out
        </div>
      )}
    </div>
  );
} 