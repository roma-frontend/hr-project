'use client';

import { useEffect } from 'react';

/**
 * Radix UI adds inline styles (margin-right, padding-right, position) to <body>
 * when dropdowns/dialogs open to compensate for scrollbar disappearance.
 * This causes a visible layout shift. This component strips those styles
 * via MutationObserver since CSS !important cannot override inline !important.
 */
export function RadixScrollLockFix() {
  useEffect(() => {
    const strip = () => {
      const s = document.body.style;
      if (s.marginRight) s.removeProperty('margin-right');
      if (s.paddingRight) s.removeProperty('padding-right');
      if (s.position === 'relative') s.removeProperty('position');
    };

    // Strip immediately
    strip();

    // Watch for changes
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'attributes' && m.attributeName === 'style') {
          strip();
        }
      }
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['style'] });
    return () => observer.disconnect();
  }, []);

  return null;
}
