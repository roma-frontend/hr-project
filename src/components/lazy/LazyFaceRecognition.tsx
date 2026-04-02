'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

/**
 * Lazy-loaded face recognition component.
 * face-api.js (~2MB) loads ONLY when this component mounts.
 */
const FaceRecognitionInner = dynamic(
  () => import('@/components/attendance/FaceRecognition').then((mod) => mod.default || mod),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col items-center justify-center gap-3 py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">
          Loading face recognition...
        </p>
      </div>
    ),
  }
);

export default FaceRecognitionInner;