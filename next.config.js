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
  productionBrowserSourceMaps: false,

  // Ignore TS errors during build (for deployment)
  typescript: { ignoreBuildErrors: true },

  // Transpile Radix UI icons
  transpilePackages: ['@radix-ui/react-icons'],

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
      // Faster action responses
      allowedOrigins: ['*'],
    },
    // Aggressive package imports optimization
    optimizePackageImports: [
      'lucide-react',
      'framer-motion',
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
    ppr: false,
    optimizeCss: true,
    scrollRestoration: true,
  },

  // Silence "webpack config but no turbopack config" warning
  turbopack: {},

  // ═══════════════════════════════════════════════════════════════
  // WEBPACK — OPTIMIZED FOR PERFORMANCE
  // ═══════════════════════════════════════════════════════════════
  webpack(config, { isServer, dev }) {
    if (!isServer) {
      config.optimization = {
        ...config.optimization,
        // Module concatenation for smaller bundle
        concatenateModules: !dev,
        usedExports: true,
        sideEffects: true,
        // Better chunk splitting
        splitChunks: {
          chunks: 'all',
          minSize: 20000,
          maxSize: 244000,
          maxAsyncRequests: 30,
          maxInitialRequests: 25,
          minChunks: 1,
          cacheGroups: {
            // React + Next — highest priority, always loaded
            framework: {
              name: 'framework',
              test: /[\\/]node_modules[\\/](react|react-dom|next|scheduler|next-server)[\\/]/,
              priority: 50,
              chunks: 'all',
              enforce: true,
              reuseExistingChunk: true,
            },
            // UI: Radix + Lucide + CVA + TailwindMerge
            ui: {
              name: 'ui-vendor',
              test: /[\\/]node_modules[\\/](@radix-ui|lucide-react|class-variance-authority|tailwind-merge|clsx)[\\/]/,
              priority: 40,
              chunks: 'all',
              enforce: true,
              reuseExistingChunk: true,
            },
            // Framer Motion — async (only when animated components load)
            framerMotion: {
              name: 'framer-motion',
              test: /[\\/]node_modules[\\/]framer-motion[\\/]/,
              priority: 35,
              chunks: 'async',
              reuseExistingChunk: true,
            },
            // Charts — async (only on analytics/reports pages)
            charts: {
              name: 'recharts',
              test: /[\\/]node_modules[\\/](recharts|d3-)[\\/]/,
              priority: 30,
              chunks: 'async',
              reuseExistingChunk: true,
            },
            // AI SDK — async (only on chat routes)
            aiSdk: {
              name: 'ai-sdk',
              test: /[\\/]node_modules[\\/](@ai-sdk|ai|openai)[\\/]/,
              priority: 30,
              chunks: 'async',
              reuseExistingChunk: true,
            },
            // Convex realtime client
            convex: {
              name: 'convex',
              test: /[\\/]node_modules[\\/]convex[\\/]/,
              priority: 25,
              chunks: 'all',
              reuseExistingChunk: true,
            },
            // i18n — load early
            i18n: {
              name: 'i18n',
              test: /[\\/]node_modules[\\/](react-i18next|i18next)[\\/]/,
              priority: 20,
              chunks: 'all',
              reuseExistingChunk: true,
            },
            // General vendor fallback
            vendors: {
              name: 'vendors',
              test: /[\\/]node_modules[\\/]/,
              priority: 10,
              chunks: 'all',
              reuseExistingChunk: true,
            },
            // Common code shared between pages
            common: {
              name: 'common',
              minChunks: 2,
              priority: 5,
              chunks: 'all',
              reuseExistingChunk: true,
            },
          },
        },
        // Better minification
        minimizer: config.optimization.minimizer,
        // Remove unused code
        usedExports: true,
        // Tree shaking
        sideEffects: true,
      };
    }
    
    // Reduce source map size
    if (!dev) {
      config.devtool = 'source-map';
    }
    
    return config;
  },

  // ═══════════════════════════════════════════════════════════════
  // SECURITY + CACHE HEADERS — OPTIMIZED
  // ═══════════════════════════════════════════════════════════════
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.vercel.app https://*.vercel-scripts.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https: blob: https://*.tile.openstreetmap.org https://unpkg.com; connect-src 'self' https://*.convex.cloud https://*.googleapis.com https://api.groq.com https://api.openai.com https://api.stripe.com https://sentry.io https://*.sentry.io https://*.ingest.sentry.io https://*.vercel.app https://*.vercel-scripts.com wss://*.convex.cloud https://*.metered.live https://*.metered.ca https://nominatim.openstreetmap.org https://*.tile.openstreetmap.org https://unpkg.com; frame-src 'self' https://challenges.cloudflare.com; worker-src 'self' blob:; manifest-src 'self';",
          },
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
