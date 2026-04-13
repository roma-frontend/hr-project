/** @type {import('next').NextConfig} */

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig = {
  // ═══════════════════════════════════════════════════════════════
  // CORE SETTINGS
  // ═══════════════════════════════════════════════════════════════
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: true,

  // Target modern browsers only — removes unnecessary polyfills (Array.at, Array.flat, etc.)
  // This eliminates ~24 KiB of legacy JavaScript warned by Lighthouse
  env: {
    // Signal to browserslist to target evergreen browsers
    BROWSERSLIST: 'defaults, not IE 11, not dead',
  },

  // TypeScript: DO NOT ignore build errors — catch type issues early
  typescript: { ignoreBuildErrors: false },

  // Transpile Radix UI icons
  transpilePackages: ['@radix-ui/react-icons', '@vladmandic/face-api'],

  // ═══════════════════════════════════════════════════════════════
  // IMAGES — OPTIMIZED
  // ═══════════════════════════════════════════════════════════════
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com', pathname: '/**' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com', pathname: '/**' },
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
    dangerouslyAllowSVG: false,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // ═══════════════════════════════════════════════════════════════
  // COMPILER — strip console.log in production
  // ═══════════════════════════════════════════════════════════════
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production'
      ? { exclude: ['error', 'warn'] }
      : false,
  },

  // ═══════════════════════════════════════════════════════════════
  // EXPERIMENTAL — OPTIMIZED
  // ═══════════════════════════════════════════════════════════════
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
      // SECURITY: restrict to your actual domain(s)
      allowedOrigins: [
        process.env.NEXT_PUBLIC_APP_URL || 'https://hr-project.vercel.app',
        'https://hr-project.vercel.app',
      ],
    },
    // Aggressive package imports optimization
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-avatar',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-tabs',
      '@radix-ui/react-tooltip',
      '@radix-ui/react-popover',
      '@radix-ui/react-select',
      '@radix-ui/react-scroll-area',
      '@radix-ui/react-separator',
      '@radix-ui/react-switch',
      '@radix-ui/react-label',
      '@radix-ui/react-progress',
      'recharts',
      'date-fns',
      'sonner',
      'react-i18next',
      'convex',
    ],
    optimizeCss: true,
    scrollRestoration: true,
  },

  // Enable Turbopack for production builds (faster, smaller bundles)
  turbopack: {
    rules: {
      '*.svg': { loaders: ['@svgr/webpack'], as: '*.js' },
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // WEBPACK — OPTIMIZED FOR PERFORMANCE
  // ═══════════════════════════════════════════════════════════════
  webpack(config, { isServer, dev }) {
    if (!isServer) {
      // Enable tree shaking
      config.optimization.sideEffects = true;
      config.optimization.usedExports = true;
      
      // More aggressive code splitting
      config.optimization.splitChunks = {
        chunks: 'all',
        minSize: 24000,
        maxSize: 200000,
        maxAsyncRequests: 50,
        maxInitialRequests: 30,
        minChunks: 1,
        cacheGroups: {
          framework: {
            name: 'framework',
            test: /[\\/]node_modules[\\/](react|react-dom|next|scheduler|next-server)[\\/]/,
            priority: 60,
            chunks: 'all',
            enforce: true,
            reuseExistingChunk: true,
          },
          commons: {
            name: 'commons',
            test: /[\\/]node_modules[\\/]/,
            priority: 50,
            chunks: 'all',
            minChunks: 2,
            reuseExistingChunk: true,
          },
          ui: {
            name: 'ui-vendor',
            test: /[\\/]node_modules[\\/](@radix-ui|lucide-react|class-variance-authority|tailwind-merge|clsx)[\\/]/,
            priority: 40,
            chunks: 'all',
            enforce: true,
            reuseExistingChunk: true,
          },
          framerMotion: {
            name: 'framer-motion',
            test: /[\\/]node_modules[\\/]framer-motion[\\/]/,
            priority: 35,
            chunks: 'async',
            reuseExistingChunk: true,
          },
          charts: {
            name: 'recharts',
            test: /[\\/]node_modules[\\/](recharts|d3-)[\\/]/,
            priority: 30,
            chunks: 'async',
            reuseExistingChunk: true,
          },
          aiSdk: {
            name: 'ai-sdk',
            test: /[\\/]node_modules[\\/](@ai-sdk|ai|openai)[\\/]/,
            priority: 30,
            chunks: 'async',
            reuseExistingChunk: true,
          },
          convex: {
            name: 'convex',
            test: /[\\/]node_modules[\\/]convex[\\/]/,
            priority: 25,
            chunks: 'async',
            reuseExistingChunk: true,
          },
          i18n: {
            name: 'i18n',
            test: /[\\/]node_modules[\\/](react-i18next|i18next)[\\/]/,
            priority: 20,
            chunks: 'async',
            reuseExistingChunk: true,
          },
          vendors: {
            name: 'vendors',
            test: /[\\/]node_modules[\\/]/,
            priority: 10,
            chunks: 'async',
            reuseExistingChunk: true,
          },
        },
      };
    }

    if (!dev) {
      // Keep source maps for Lighthouse debugging (hidden-source-map is smaller)
      config.devtool = 'hidden-source-map';
    }

    return config;
  },

  // ═══════════════════════════════════════════════════════════════
  // CACHE HEADERS
  // NOTE: Security headers (CSP, HSTS, X-Frame-Options, etc.)
  //       are set ONLY in src/middleware.ts to avoid conflicts.
  // ═══════════════════════════════════════════════════════════════
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          // Content Security Policy
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // SECURITY: 'unsafe-eval' is needed in development for React debugging features.
              // In production, the middleware applies a stricter CSP without 'unsafe-eval'.
              process.env.NODE_ENV === 'production'
                ? "script-src 'self' 'unsafe-inline' https://*.sentry.io https://vercel.live blob:"
                : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.sentry.io https://vercel.live blob:",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' blob: data: https://res.cloudinary.com https://lh3.googleusercontent.com https://*.sentry.io",
              "font-src 'self' https://fonts.gstatic.com",
              "connect-src 'self' https://*.convex.cloud https://*.convex.site https://*.sentry.io https://vercel.live https://*.stripe.com https://*.js.stripe.com wss://*.convex.cloud wss://*.vercel.live",
              "worker-src 'self' blob:",
              "frame-src 'none'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
            ].join('; '),
          },
          // CORS
          { key: 'Access-Control-Allow-Origin', value: process.env.NEXT_PUBLIC_APP_URL || 'https://hr-project.vercel.app' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, X-Requested-With' },
          { key: 'Access-Control-Max-Age', value: '86400' },
          // Security headers
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=self, microphone=self, geolocation=self, fullscreen=self, clipboard=self, payment=(), usb=()' },
        ],
      },
      // Face recognition models — immutable cache
      {
        source: '/models/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      // Static Next.js assets — immutable cache
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      // Images — cache 7 days + stale-while-revalidate
      {
        source: '/:path*.{png,jpg,jpeg,gif,webp,avif,ico,svg}',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' },
        ],
      },
      // Fonts — immutable cache
      {
        source: '/:path*.{woff,woff2,ttf,otf,eot}',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      // Landing page — fast repeat visits
      {
        source: '/',
        headers: [
          { key: 'Cache-Control', value: 'public, s-maxage=3600, stale-while-revalidate=86400' },
          { key: 'Vary', value: 'Accept-Encoding' },
        ],
      },
      // Auth pages — short cache
      {
        source: '/(login|register|forgot-password|reset-password)',
        headers: [
          { key: 'Cache-Control', value: 'public, s-maxage=3600, stale-while-revalidate=86400' },
        ],
      },
      // API routes — no cache
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
        ],
      },
      // Chat pages — stale-while-revalidate for fast updates
      {
        source: '/chat',
        headers: [
          { key: 'Cache-Control', value: 'public, s-maxage=60, stale-while-revalidate=300' },
        ],
      },
    ];
  },

  // ═══════════════════════════════════════════════════════════════
  // REDIRECTS
  // ═══════════════════════════════════════════════════════════════
  async redirects() {
    return [
      { source: '/home', destination: '/', permanent: true },
      { source: '/superadmin', destination: '/superadmin/organizations', permanent: false },
    ];
  },
};

module.exports = withBundleAnalyzer(nextConfig);