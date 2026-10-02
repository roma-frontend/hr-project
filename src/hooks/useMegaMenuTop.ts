'use client';

import { useLayoutEffect, useState } from 'react';

/**
 * Viewport-anchored top for mega menus.
 *
 * The navbar is `fixed` and its height changes (island vs full-bleed, scrolled).
 * Mega panels must sit just below it regardless of breakpoint/zoom. Measuring the
 * live `nav` bottom on open + on scroll/resize keeps the gap stable without
 * hardcoding 64/72px (which breaks on zoom or when the island card toggles).
 */
export function useMegaMenuTop(open: boolean): number {
  const [top, setTop] = useState(72);

  useLayoutEffect(() => {
    if (!open) return;

    const update = () => {
      const nav = document.querySelector('nav');
      const bottom = nav ? Math.round(nav.getBoundingClientRect().bottom) : 64;
      setTop(bottom + 8);
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [open]);

  return top;
}
