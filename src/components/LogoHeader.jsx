import React from 'react';
import { Link } from 'react-router-dom';
import { useNightMode } from '../App';

export default function LogoHeader({ children, logoClassName }) {
  const { nightMode } = useNightMode ? useNightMode() : { nightMode: false };
  return (
    <div
      className="sticky top-0 z-30 relative max-w-4xl mx-auto w-full py-2 pt-4 flex items-center"
      style={{
        backgroundColor: nightMode ? '#000' : '#18181b',
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)'
      }}
    >
      <Link to="/" className="absolute left-1/2 -translate-x-1/2">
        <img src="/trapt_logo.png" alt="Trapt Logo" style={{ height: 60 }} className={logoClassName} />
      </Link>
      <div className="ml-auto" style={{ marginRight: 20 }}>
        {children}
      </div>
    </div>
  );
} 