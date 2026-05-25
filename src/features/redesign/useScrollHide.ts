import { useCallback, useEffect, useRef, useState } from 'react';

type UseScrollHideOptions = {
  threshold?: number;
  topPin?: number;
};

export const useScrollHide = ({
  threshold = 8,
  topPin = 32,
}: UseScrollHideOptions = {}) => {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);
  const elementRef = useRef<HTMLElement | null>(null);

  const onScrollDelta = useCallback(
    (current: number) => {
      const previous = lastY.current;
      const delta = current - previous;

      if (current <= topPin) {
        setHidden(false);
      } else if (delta > threshold) {
        setHidden(true);
      } else if (delta < -threshold) {
        setHidden(false);
      }

      lastY.current = current;
    },
    [threshold, topPin],
  );

  useEffect(() => {
    const node = elementRef.current;
    if (!node) {
      return;
    }

    const handler = () => onScrollDelta(node.scrollTop);
    node.addEventListener('scroll', handler, { passive: true });

    return () => node.removeEventListener('scroll', handler);
  }, [onScrollDelta]);

  return { hidden, elementRef };
};
