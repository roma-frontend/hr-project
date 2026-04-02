'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

/**
 * Lazy-loaded Three.js/R3F component.
 * three.js + @react-three/fiber load ONLY when needed.
 */
const ThreeScene = dynamic(
  () => import('@/components/three/ThreeScene').then((mod) => mod.default || mod),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    ),
  }
);

export default ThreeScene;