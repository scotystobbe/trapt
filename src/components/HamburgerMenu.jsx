import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FaBars } from 'react-icons/fa';

export default function HamburgerMenu({ className = '' }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={"relative inline-block text-left z-50 " + className}>
      <button
        onClick={() => setOpen(!open)}
        className={"p-2 rounded hover:bg-gray-700 focus:outline-none " + className}
        aria-label="Open menu"
      >
        <FaBars className="text-2xl text-white" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-40 bg-gray-800 border border-gray-700 rounded shadow-lg">
          <Link
            to="/"
            className="block px-4 py-2 text-white hover:bg-gray-700"
            onClick={() => setOpen(false)}
          >
            Home
          </Link>
          <Link
            to="/admin"
            className="block px-4 py-2 text-white hover:bg-gray-700"
            onClick={() => setOpen(false)}
          >
            Admin
          </Link>
        </div>
      )}
    </div>
  );
} 