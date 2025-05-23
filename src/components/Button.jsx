import React from 'react';

const VARIANT_STYLES = {
  primary: 'bg-blue-600 hover:bg-blue-500 text-white',
  danger: 'bg-red-600 hover:bg-red-500 text-white',
  secondary: 'bg-gray-600 hover:bg-gray-500 text-white',
  success: 'bg-green-600 hover:bg-green-500 text-white',
  yellow: 'bg-yellow-400 hover:bg-yellow-300 text-black font-bold',
  'gray-yellow': 'bg-gray-700 hover:bg-gray-600 text-yellow-400 font-bold',
};

export default function Button({
  children,
  onClick,
  type = 'button',
  disabled = false,
  className = '',
  variant = 'primary',
  href,
  ...props
}) {
  const baseClass = `w-64 py-2 rounded-md text-base font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
    VARIANT_STYLES[variant] || VARIANT_STYLES.primary
  } ${className}`;
  if (href) {
    return (
      <a
        href={href}
        className={baseClass}
        {...props}
      >
        {children}
      </a>
    );
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={baseClass}
      {...props}
    >
      {children}
    </button>
  );
} 