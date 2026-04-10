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

    // Preloader displays for 2s minimum, then content fades in
    // Content (including dynamic imports) shows loading skeletons while chunks load
    const timer = setTimeout(() => setShowContent(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <Preloader />
      <div
        style={{
          opacity: showContent ? 1 : 0,
          transition: 'opacity 0.7s cubic-bezier(0.22, 1, 0.36, 1)',
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
