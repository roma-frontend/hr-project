'use client';

import React from 'react';
import dynamic from 'next/dynamic';

/**
 * Shell for standalone public pages (`/integrations`, `/security`, `/privacy`,
 * `/terms`, …).
 *
 * These pages are reached from the landing footer and from search engines, so
 * "how do I get back?" must be answered on the page itself. Several of them
 * shipped with only a small "back to home" bar — or, in the newest, nothing at
 * all — which stranded a visitor arriving from Google with no way into pricing,
 * features or sign-up.
 *
 * It renders the same Navbar and Footer the landing uses (single source of
 * truth: a link added to the landing navigation is added here). i18n is already
 * initialised app-wide by `I18nProvider` in the root layout, so the Navbar's
 * `useTranslation()` resolves here without a local import.
 *
 * Navbar and Footer are loaded through `next/dynamic` *inside* the shell, and
 * the shell itself is imported statically: the pages own server-rendered
 * content must never sit behind a lazy boundary (the server-page tests call the
 * page components directly and assert on that content).
 *
 * The navbar is fixed, so the shell — not each page — owns the top offset
 * (`pt-20 sm:pt-32`, the same clearance `/compare`, `/features` and `/careers`
 * use). Pages therefore start their own container at `pb-*` only; every page
 * that adds its own `pt-*` on top of this will push its heading further down
 * than the rest of the site.
 */
const NavbarWrapper = dynamic(() => import('./NavbarWrapper'), { ssr: true });
const Footer = dynamic(() => import('./Footer'), { ssr: true });

export default function PublicPageShell({
  children,
  language = 'en',
}: {
  children: React.ReactNode;
  language?: string;
}) {
  return (
    <div className="min-h-screen" style={{ background: 'var(--landing-bg)' }}>
      <NavbarWrapper />
      <main className="pt-20 sm:pt-32">{children}</main>
      <Footer initialLanguage={language} />
    </div>
  );
}
