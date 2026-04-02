/**
 * Dynamic imports for heavy libraries.
 * Use these instead of direct imports to reduce initial bundle size.
 *
 * face-api.js ≈ 2MB — should NEVER be in the initial bundle
 * three.js + @react-three/fiber — only needed on specific pages
 * recharts — only needed on analytics/reports pages
 * pdfmake — only needed when exporting PDFs
 * leaflet — only needed on map pages
 */

// ══════════════════════════════════════════════════════════════
// FACE-API.JS (~2MB) — dynamic import
// ══════════════════════════════════════════════════════════════
export const loadFaceApi = () =>
  import('face-api.js').then((mod) => mod);

// ══════════════════════════════════════════════════════════════
// THREE.JS — dynamic import for 3D components
// ══════════════════════════════════════════════════════════════
export const loadThree = () =>
  import('three').then((mod) => mod);

// ══════════════════════════════════════════════════════════════
// PDFMAKE — dynamic import for PDF generation
// ══════════════════════════════════════════════════════════════
export const loadPdfMake = () =>
  import('pdfmake/build/pdfmake').then((mod) => mod.default || mod);

// ══════════════════════════════════════════════════════════════
// LEAFLET — dynamic import for maps
// ══════════════════════════════════════════════════════════════
export const loadLeaflet = () =>
  import('leaflet').then((mod) => mod.default || mod);

// ══════════════════════════════════════════════════════════════
// QRCODE — dynamic import
// ══════════════════════════════════════════════════════════════
export const loadQRCode = () =>
  import('qrcode').then((mod) => mod.default || mod);