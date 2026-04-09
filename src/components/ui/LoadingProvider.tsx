'use client';

import { useState, useEffect } from 'react';
import Preloader from './Preloader';

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    // Start fading in content when preloader starts exiting (2s)
    // Content fade-in (0.8s) overlaps with preloader exit animation (0.7s)
    const timer = setTimeout(() => setShowContent(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <Preloader />
      <div
        style={{
          opacity: showContent ? 1 : 0,
          visibility: showContent ? 'visible' : 'hidden',
          transition: 'opacity 0.8s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        {children}
      </div>
    </>
  );
}
