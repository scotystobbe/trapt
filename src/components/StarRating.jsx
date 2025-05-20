import React from "react";
import { FaStar, FaRegStar } from 'react-icons/fa';

export default function StarRating({ rating, onRatingChange, size = 20 }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        star <= rating ? (
          <FaStar
            key={star}
            className="cursor-pointer text-yellow-400"
            onClick={() => onRatingChange(star)}
            size={size}
          />
        ) : (
          <FaRegStar
            key={star}
            className="cursor-pointer text-gray-400"
            onClick={() => onRatingChange(star)}
            size={size}
          />
        )
      ))}
    </div>
  );
}