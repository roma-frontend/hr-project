'use client';

import { useRef, useEffect, useState, RefObject } from 'react';

interface UseRevealOptions {
  threshold?: number;
  rootMargin?: string;
  once?: boolean;
}

/**
 * Shared IntersectionObserver hook for reveal-on-scroll animations.
 * Eliminates duplicate IntersectionObserver instances across components.
 */
export function useReveal(options: UseRevealOptions = {}): {
  ref: RefObject<HTMLDivElement | null>;
  visible: boolean;
} {
  const { threshold = 0.1, rootMargin = '-40px', once = true } = options;
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          if (once) observer.disconnect();
        }
      },
      { threshold, rootMargin },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin, once]);

  return { ref, visible };
}
