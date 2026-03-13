/**
 * Debug компонент для отслеживания редиректов
 * Добавьте его в корневой layout или dashboard page для отладки
 */

"use client";

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export default function RedirectDebug() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    console.log('🔍 [RedirectDebug] Page loaded:', {
      pathname,
      searchParams: searchParams.toString(),
      timestamp: new Date().toISOString(),
      referrer: document.referrer || 'direct',
    });
  }, [pathname, searchParams]);

  return null;
}
