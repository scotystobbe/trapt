import React from 'react';

export default function SafeAreaView({ children, className = '', style = {} }) {
  const mergedStyle = {
    backgroundColor: '#18181b',
    paddingTop: 'env(safe-area-inset-top)',
    paddingBottom: 'env(safe-area-inset-bottom)',
    paddingLeft: 'env(safe-area-inset-left)',
    paddingRight: 'env(safe-area-inset-right)',
    ...style,
  };

  return (
    <div style={mergedStyle} className={`min-h-screen ${className}`}>
      {children}
    </div>
  );
} 