import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FaBars, FaMoon, FaSun } from 'react-icons/fa';
import { useNightMode } from '../App';

export default function HamburgerMenu({ className = '' }) {
  const [open, setOpen] = useState(false);
  const { nightMode, setNightMode } = useNightMode();
  const menuRef = useRef(null);

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
          <Link
            to="/admin"
            className="block px-4 py-2 text-white hover:bg-[#3f3f46]"
            onClick={() => setOpen(false)}
          >
            Admin
          </Link>
          <div className="border-t mt-2 pt-4 pb-4 flex justify-center" style={{ borderColor: '#3f3f46' }}>
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
          </div>
        </div>
      )}
    </div>
  );
} 