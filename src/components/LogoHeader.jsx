import React from 'react';
import { Link } from 'react-router-dom';

export default function LogoHeader({ children }) {
  return (
    <div className="relative max-w-4xl mx-auto w-full py-2 pt-4 flex items-center bg-gray-900">
      <Link to="/" className="absolute left-1/2 -translate-x-1/2">
        <img src="/trapt_logo.png" alt="Trapt Logo" style={{ height: 60 }} />
      </Link>
      <div className="ml-auto" style={{ marginRight: 20 }}>
        {children}
      </div>
    </div>
  );
} 