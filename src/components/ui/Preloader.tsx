'use client';

import { useState, useEffect } from 'react';
import { Shield } from 'lucide-react';

export default function Preloader() {
  const [phase, setPhase] = useState<'loading' | 'exiting' | 'done'>('loading');

  useEffect(() => {
    const exitTimer = setTimeout(() => setPhase('exiting'), 2000);
    const doneTimer = setTimeout(() => setPhase('done'), 2700);
    return () => {
      clearTimeout(exitTimer);
      clearTimeout(doneTimer);
    };
  }, []);

  if (phase === 'done') return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'var(--background)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '32px',
        opacity: phase === 'exiting' ? 0 : 1,
        transition: 'opacity 0.7s cubic-bezier(0.22, 1, 0.36, 1)',
        pointerEvents: phase === 'exiting' ? 'none' : 'auto',
      }}
    >
      {/* Logo & Shield */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          opacity: 0,
          transform: 'translateY(40px) scale(0.95)',
          animation: 'preloader-logo 0.9s cubic-bezier(0.22, 1, 0.36, 1) 0.2s both',
        }}
      >
        <div
          className="p-5 rounded-2xl flex items-center justify-center"
          style={{
            background:
              'linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 80%, white))',
            boxShadow: '0 20px 50px -12px rgba(0,0,0,0.25)',
          }}
        >
          <Shield className="w-12 h-12 text-white" />
        </div>
        <span
          style={{
            fontSize: 'clamp(1.8rem, 5vw, 2.5rem)',
            fontWeight: 800,
            letterSpacing: '0.05em',
            color: 'var(--text-primary)',
          }}
        >
          HR Office
        </span>
        <span
          style={{
            fontSize: '0.85rem',
            fontWeight: 500,
            color: 'var(--text-muted)',
            marginTop: '-8px',
          }}
        >
          Human Resource Management
        </span>
      </div>

      {/* Loading bar */}
      <div
        style={{
          width: '160px',
          height: '3px',
          background: 'var(--border)',
          borderRadius: '4px',
          overflow: 'hidden',
          opacity: 0,
          animation: 'preloader-fade 0.5s ease 0.6s both',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '4px',
            background:
              'linear-gradient(90deg, var(--primary), color-mix(in srgb, var(--primary) 60%, white), var(--primary))',
            backgroundSize: '200% 100%',
            transformOrigin: 'left',
            transform: 'scaleX(0)',
            animation:
              'preloader-line 1.6s cubic-bezier(0.16, 1, 0.3, 1) 0.8s both, shimmer 1.5s linear infinite',
          }}
        />
      </div>

      {/* Dots */}
      <div
        style={{
          display: 'flex',
          gap: '10px',
          opacity: 0,
          animation: 'preloader-fade 0.5s ease 1.0s both',
        }}
      >
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: 'var(--primary)',
              opacity: 0.4,
              animation: `preloader-dot 1.4s ease-in-out ${index * 0.2}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
