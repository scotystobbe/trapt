import React, { useEffect } from 'react';
import { RATING_KEY_ROWS } from '../data/ratingKey';

export default function RatingKeyModal({ open, onClose }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-w-lg w-full rounded-xl border border-zinc-600 bg-zinc-900 shadow-xl p-5 sm:p-6 text-left"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rating-key-title"
      >
        <h2 id="rating-key-title" className="text-lg font-semibold text-white mb-4">
          Rating key
        </h2>
        <p className="text-zinc-400 text-sm mb-4">
          Tap and hold any star to open this guide.
        </p>
        <ul className="space-y-3 text-sm">
          {RATING_KEY_ROWS.map(({ stars, title, detail }) => (
            <li key={stars} className="flex gap-3">
              <span className="flex-shrink-0 w-6 font-mono font-semibold text-yellow-400 tabular-nums">
                {stars}
              </span>
              <span className="text-zinc-100">
                <span className="font-medium">{title}</span>
                <span className="text-zinc-400"> ({detail})</span>
              </span>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="mt-6 w-full rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white py-2.5 text-sm font-medium transition"
          onClick={onClose}
        >
          Got it
        </button>
      </div>
    </div>
  );
}
