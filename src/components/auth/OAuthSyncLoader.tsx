'use client';

import { useSession } from 'next-auth/react';
import { useAuthStore } from '@/store/useAuthStore';
import { ShieldLoader } from '@/components/ui/ShieldLoader';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

export function OAuthSyncLoader() {
  const { status } = useSession();
  const { isAuthenticated } = useAuthStore();
  const pathname = usePathname();
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    console.log(
      '[OAuthSyncLoader] status:',
      status,
      'isAuthenticated:',
      isAuthenticated,
      'pathname:',
      pathname,
      'isSyncing:',
      isSyncing,
    );

    // Start showing loader when OAuth authenticated but not yet in useAuthStore
    if (status === 'authenticated' && !isAuthenticated && pathname === '/login') {
      console.log('[OAuthSyncLoader] ✅ Starting sync loader!');
      setIsSyncing(true);

      // Hide loader after successful sync or timeout
      const timer = setTimeout(() => {
        console.log('[OAuthSyncLoader] ⏰ Timeout - hiding loader');
        setIsSyncing(false);
      }, 8000); // Max 8 seconds to allow smooth transition

      return () => clearTimeout(timer);
    } else if (isAuthenticated && pathname === '/login') {
      // Keep showing for a bit longer after auth to prevent flash
      console.log('[OAuthSyncLoader] ✅ User authenticated - keeping loader briefly...');
      setTimeout(() => {
        setIsSyncing(false);
      }, 300);
    }
    return undefined;
  }, [status, isAuthenticated, pathname]);

  // Show loader during sync
  console.log('[OAuthSyncLoader] Render - isSyncing:', isSyncing);

  if (!isSyncing) {
    return null;
  }

  console.log('[OAuthSyncLoader] 🎉 Showing loader!');

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center min-h-screen"
      style={{ background: 'var(--background)' }}
    >
      <ShieldLoader message="Signing you in with Google..." />
    </div>
  );
}
