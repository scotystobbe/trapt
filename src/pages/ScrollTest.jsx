import React from 'react';
import HamburgerMenu from '../components/HamburgerMenu';

export default function ScrollTest() {
  // Dummy list of 100 items
  const items = Array.from({ length: 100 }, (_, i) => `Item ${i + 1}`);

  return (
    <div style={{ background: '#18181b', minHeight: '100vh' }}>
      {/* Fixed header with safe area inset */}
      <div
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4"
        style={{
          background: '#18181b',
          paddingTop: 'env(safe-area-inset-top, 0px)',
          height: 'calc(60px + env(safe-area-inset-top, 0px))',
          boxShadow: '0 2px 8px 0 rgba(0,0,0,0.1)'
        }}
      >
        <img src="/trapt_logo.png" alt="Trapt Logo" style={{ height: 60 }} />
        <HamburgerMenu />
      </div>
      {/* Main content, padded down for header + safe area */}
      <div
        style={{
          paddingTop: 'calc(60px + env(safe-area-inset-top, 0px))',
          background: '#18181b',
          color: 'white',
        }}
      >
        {items.map((item, idx) => (
          <div
            key={idx}
            style={{
              padding: '20px',
              borderBottom: '1px solid #27272a',
              background: idx % 2 === 0 ? '#232326' : '#18181b',
            }}
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
} 