import React from "react";
import { FaStar } from 'react-icons/fa';

export default function StarRating({ rating, onRatingChange }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <FaStar
          key={star}
          className={`cursor-pointer ${star <= rating ? 'text-yellow-400' : 'text-gray-600'}`}
          onClick={() => onRatingChange(star)}
        />
      ))}
    </div>
  );
}