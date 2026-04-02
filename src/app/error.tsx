'use client';

import { useEffect } from 'react';
import { AlertOctagon, RefreshCw, Home } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4">
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/30">
        <AlertOctagon className="h-12 w-12 text-red-600 dark:text-red-400" />
      </div>

      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Oops! Something broke
        </h1>
        <p className="text-muted-foreground max-w-lg">
          An unexpected error occurred. Our team has been notified.
          Please try refreshing the page.
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground/50 font-mono mt-4">
            Reference: {error.digest}
          </p>
        )}
      </div>

      <div className="flex gap-3 mt-2">
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh page
        </button>
        <a
          href="/"
          className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-6 py-3 text-sm font-medium shadow transition-colors hover:bg-accent"
        >
          <Home className="h-4 w-4" />
          Go home
        </a>
      </div>
    </div>
  );
}