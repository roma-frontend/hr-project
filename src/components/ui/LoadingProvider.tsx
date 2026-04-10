'use client';

import { useState, useEffect, useRef } from 'react';
import Preloader from './Preloader';

// Track if timer has been set (persists across StrictMode remounts)
let timerSet = false;

export function LoadingProvider({
  children,
  cookieBanner,
}: {
  children: React.ReactNode;
  cookieBanner?: React.ReactNode;
}) {
  const timerSetRef = useRef(false);
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    // Skip if already set (StrictMode double-mount protection)
    if (timerSet || timerSetRef.current) {
      setIsDone(true);
      return;
    }
    timerSet = true;
    timerSetRef.current = true;

    // Preloader exits at 2s (opacity transition starts) and is gone at 2.7s
    // Start content fade-in right when preloader starts exiting (2s)
    // so content is visible when preloader is fully gone
    const timer = setTimeout(() => setIsDone(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <Preloader />
      <div
        style={{
          opacity: isDone ? 1 : 0,
          transition: 'opacity 0.7s cubic-bezier(0.22, 1, 0.36, 1)',
          position: 'relative',
          width: '100%',
          minHeight: '100vh',
          pointerEvents: isDone ? 'auto' : 'none',
        }}
      >
        {children}
        {isDone && cookieBanner}
      </div>
    </>
  );
}
