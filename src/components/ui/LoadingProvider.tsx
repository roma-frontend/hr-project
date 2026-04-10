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
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    // Skip if already set (StrictMode double-mount protection)
    if (timerSet || timerSetRef.current) {
      setShowContent(true);
      return;
    }
    timerSet = true;
    timerSetRef.current = true;

    // Preloader: starts exiting at 2s, fully done at 2.7s
    // Show content exactly when Preloader is done (2.7s)
    const timer = setTimeout(() => setShowContent(true), 2700);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <Preloader />
      <div
        style={{
          opacity: showContent ? 1 : 0,
          transition: showContent ? 'opacity 0.7s cubic-bezier(0.22, 1, 0.36, 1)' : 'none',
          position: 'relative',
          width: '100%',
          minHeight: '100vh',
          pointerEvents: showContent ? 'auto' : 'none',
        }}
      >
        {children}
        {showContent && cookieBanner}
      </div>
    </>
  );
}
