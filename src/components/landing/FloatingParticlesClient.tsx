'use client';

import dynamic from 'next/dynamic';

// Three.js requires browser APIs — client-only
const FloatingParticles = dynamic(() => import('./FloatingParticles'), {
  ssr: false,
  loading: () => null,
});

export default function FloatingParticlesClient() {
  return <FloatingParticles />;
}
