import React from "react";
import { FaStar, FaRegStar } from 'react-icons/fa';
import RatingKeyModal from './RatingKeyModal';
import { useLongPressRatingKey } from '../hooks/useLongPressRatingKey';

export default function StarRating({ rating, onRatingChange, size = 20 }) {
  const { keyOpen, setKeyOpen, longPressHandlers, wrapStarClick } = useLongPressRatingKey();

  return (
    <>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <span key={star} className="inline-flex touch-manipulation" {...longPressHandlers}>
            {star <= rating ? (
              <FaStar
                className="cursor-pointer text-yellow-400"
                onClick={wrapStarClick(() => onRatingChange?.(star))}
                size={size}
              />
            ) : (
              <FaRegStar
                className="cursor-pointer text-gray-400"
                onClick={wrapStarClick(() => onRatingChange?.(star))}
                size={size}
              />
            )}
          </span>
        ))}
      </div>
      <RatingKeyModal open={keyOpen} onClose={() => setKeyOpen(false)} />
    </>
  );
}
