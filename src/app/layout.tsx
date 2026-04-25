import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans, Inter, Noto_Sans_Armenian } from 'next/font/google';
import React, { Suspense } from 'react';
import './globals.css';
import { validateEnvironment } from '@/lib/env-validation';
import { AppProviders } from '@/components/AppProviders';
import PerformanceMonitor from '@/components/PerformanceMonitor';
import { Analytics } from '@vercel/analytics/next';

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
        url: '/opengraph-image',
        width: 1200,
        height: 630,
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
    images: ['/opengraph-image'],
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
  alternates: {
    canonical: '/',
    languages: {
      'en-US': '/en',
      'ru-RU': '/ru',
      'hy-AM': '/hy',
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
    apple: [{ url: '/apple-touch-icon.svg?v=3', sizes: '180x180', type: 'image/svg+xml' }],
  },
  manifest: '/site.webmanifest',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Safari pinned tab */}
        <link rel="mask-icon" href="/favicon.svg?v=3" color="#2563eb" />

        {/* ── Resource hints: preconnect to critical origins ── */}
        {/* Preconnect to Sentry for error monitoring (critical for error tracking) */}
        <link rel="preconnect" href="https://o4505283179249664.ingest.us.sentry.io" />
        {/* Preconnect to Cloudinary for images (LCP optimization) */}
        <link rel="preconnect" href="https://res.cloudinary.com" />
        {/* Preconnect to Google for OAuth (user authentication) */}
        <link rel="preconnect" href="https://accounts.google.com" />
        <link rel="preconnect" href="https://oauth2.googleapis.com" />
      </head>
      <body
        className={`${ibmPlexSans.variable} ${inter.variable} ${notoSansArmenian.variable} antialiased`}
        suppressHydrationWarning
      >
        <Suspense
          fallback={
            <div className="flex h-screen items-center justify-center bg-(--background)">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-(--primary)" />
            </div>
          }
        >
          <AppProviders>
            {children}
            {/* Defer Analytics loading to reduce main thread work */}
            <Analytics />
          </AppProviders>
        </Suspense>
        {/* Performance monitoring (только в dev) */}
        {process.env.NODE_ENV === 'development' && <PerformanceMonitor />}
      </body>
    </html>
  );
}
