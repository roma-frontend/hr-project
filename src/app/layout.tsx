import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans, Inter, Noto_Sans_Armenian } from 'next/font/google';
import './globals.css';
import { validateEnvironment } from '@/lib/env-validation';
import { AppProviders } from '@/components/AppProviders';
import PerformanceMonitor from '@/components/PerformanceMonitor';

// Validate environment variables at startup
validateEnvironment();

// Primary text font — IBM Plex Sans (Corporate & Professional)
const ibmPlexSans = IBM_Plex_Sans({
  variable: '--font-ibm-plex',
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
  preload: true,
  weight: ['400', '500', '600', '700'],
  fallback: ['sans-serif'],
  adjustFontFallback: true,
});

// UI elements — Inter (clean, highly legible)
const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
  preload: true,
  weight: ['400', '500', '600'],
  fallback: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
  adjustFontFallback: true,
});

// Armenian language support (lazy loaded — only used for Armenian text)
const notoSansArmenian = Noto_Sans_Armenian({
  variable: '--font-armenian',
  subsets: ['armenian'],
  display: 'swap',
  preload: false,
  weight: ['400', '500', '600', '700'],
  fallback: ['sans-serif'],
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://hroffice.app';

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#2563eb' },
    { media: '(prefers-color-scheme: dark)', color: '#60a5fa' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  colorScheme: 'light dark',
};

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: 'HR Office — All-in-One HR Management Platform',
    template: '%s | HR Office',
  },
  description:
    'HR Office is a powerful all-in-one HR platform with real-time attendance tracking, leave management, task management, employee analytics, face recognition check-in, and AI assistant. Built for modern teams.',
  keywords: [
    'HR software',
    'HR management',
    'leave management',
    'attendance tracking',
    'employee management',
    'task management',
    'HR platform',
    'absence management',
    'face recognition HR',
    'AI HR assistant',
    'workforce management',
    'employee scheduling',
    'HR analytics',
    'team management',
    'remote work tracking',
    'performance management',
  ],
  authors: [{ name: 'HR Office Team', url: APP_URL }],
  creator: 'HR Office',
  publisher: 'HR Office',
  category: 'Business Software',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: APP_URL,
    title: 'HR Office — All-in-One HR Management Platform',
    description:
      'Manage your entire workforce with real-time attendance, AI-powered analytics, task management, and smart leave tracking.',
    siteName: 'HR Office',
    images: [
      {
        url: '/icon-192x192.png',
        width: 192,
        height: 192,
        alt: 'HR Office — All-in-One HR Management Platform',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'HR Office — All-in-One HR Management Platform',
    description:
      'Manage your entire workforce with real-time attendance, AI-powered analytics, and smart task management.',
    images: ['/icon-192x192.png'],
    creator: '@hrofficeapp',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/favicon-animated.svg?v=3', type: 'image/svg+xml' },
      { url: '/favicon.svg?v=3', type: 'image/svg+xml' },
      { url: '/favicon-32x32.svg?v=3', sizes: '32x32', type: 'image/svg+xml' },
      { url: '/favicon-16x16.svg?v=3', sizes: '16x16', type: 'image/svg+xml' },
    ],
    shortcut: '/favicon-animated.svg?v=3',
    apple: [
      { url: '/apple-touch-icon.svg?v=3', sizes: '180x180', type: 'image/svg+xml' },
      { url: '/apple-touch-icon.png?v=3', sizes: '180x180' },
    ],
  },
  manifest: '/site.webmanifest',
  alternates: {
    canonical: '/',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Safari pinned tab */}
        <link rel="mask-icon" href="/favicon.svg?v=3" color="#2563eb" />

        {/* ── Resource hints: only 3 most critical preconnects ── */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="preconnect"
          href="https://steady-jaguar-712.convex.cloud"
          crossOrigin="anonymous"
        />
        <link rel="dns-prefetch" href="https://res.cloudinary.com" />
        <link rel="dns-prefetch" href="https://lh3.googleusercontent.com" />

        {/* ── Preload only critical fonts (IBM Plex Sans + Inter) ── */}
        <link
          rel="preload"
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap"
          as="style"
        />
      </head>
      <body
        className={`${ibmPlexSans.variable} ${inter.variable} ${notoSansArmenian.variable} antialiased`}
        suppressHydrationWarning
      >
        <AppProviders>{children}</AppProviders>
        {/* Performance monitoring (только в dev) */}
        {process.env.NODE_ENV === 'development' && <PerformanceMonitor />}
      </body>
    </html>
  );
}
