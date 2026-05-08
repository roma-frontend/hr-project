'use client';

/**
 * Patches Radix UI's scroll-lock mechanism to prevent it from adding
 * margin-right/padding-right/position styles to <body>.
 *
 * Radix sets inline styles with !important which CSS cannot override.
 * This patches Element.prototype.style.setProperty to silently ignore
 * scroll-lock properties on <body>.
 *
 * Must be called before React hydrates — use <Script strategy="beforeInteractive">.
 */
export function initRadixScrollLockPatch() {
  if (typeof window === 'undefined') return;

  const originalSetProperty = CSSStyleDeclaration.prototype.setProperty;

  CSSStyleDeclaration.prototype.setProperty = function (
    property: string,
    value: string,
    priority?: string
  ) {
    if (
      this === document.body.style &&
      (property === 'margin-right' ||
        property === 'padding-right' ||
        property === 'position')
    ) {
      return; // Silently ignore Radix scroll-lock styles
    }
    return originalSetProperty.call(this, property, value, priority);
  };
}

// Auto-initialize in browser
if (typeof window !== 'undefined') {
  initRadixScrollLockPatch();
}
    return originalSetProperty.call(this, property, value, priority);
  };
}

// Auto-initialize in browser
if (typeof window !== 'undefined') {
  initRadixScrollLockPatch();
}
