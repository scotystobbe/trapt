import React from "react";

export default function Skeleton({ className = '', animated = true }) {
  return (
    <div
      className={`rounded ${animated ? 'animate-pulse' : ''} ${className}`}
      style={{ backgroundColor: '#3f3f46' }}
      aria-busy="true"
      aria-label="Loading"
    />
  );
} 