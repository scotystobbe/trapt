import { useRef, useCallback, useEffect, useState } from 'react';

const LONG_PRESS_MS = 500;

export function useLongPressRatingKey() {
  const [keyOpen, setKeyOpen] = useState(false);
  const timerRef = useRef(null);
  const suppressClickRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const onPointerDown = useCallback(() => {
    clearTimer();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      suppressClickRef.current = true;
      setKeyOpen(true);
    }, LONG_PRESS_MS);
  }, [clearTimer]);

  const onPointerUpOrLeave = useCallback(() => {
    clearTimer();
  }, [clearTimer]);

  const wrapStarClick = useCallback((fn) => {
    return (e) => {
      if (suppressClickRef.current) {
        suppressClickRef.current = false;
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      fn?.(e);
    };
  }, []);

  const longPressHandlers = {
    onMouseDown: onPointerDown,
    onMouseUp: onPointerUpOrLeave,
    onMouseLeave: onPointerUpOrLeave,
    onTouchStart: onPointerDown,
    onTouchEnd: onPointerUpOrLeave,
    onTouchCancel: onPointerUpOrLeave,
    onTouchMove: onPointerUpOrLeave,
  };

  return { keyOpen, setKeyOpen, longPressHandlers, wrapStarClick };
}
