import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { getServerTranslation } from '@/lib/i18n/server-translation';
import PublicPageShell from '@/components/landing/PublicPageShell';
import {
  MARKETPLACE_APPS,
  appStatus,
  populatedCategories,
  type MarketplaceApp,
} from '@/lib/marketplace';

/**
 * Public integrations directory (`/integrations`) — the SEO entry point for
 * "does this platform connect to X" searches, and the honest public version of
 * what the in-app marketplace installs.
 *
 * Copy discipline: this page renders the SAME catalog the app does
 * (`src/lib/marketplace.ts`), and availability is derived from each app's setup
 * path rather than written by hand — so a vendor can never appear as
 * "available" here unless a real install path exists in the product.
 */
export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const locale = cookieStore.get('i18nextLng')?.value || 'en';
  const { t } = await getServerTranslation('marketplace', locale);

  const available = MARKETPLACE_APPS.filter((app) => appStatus(app) === 'available').length;

  return {
    // The suffix is a key, not a literal: a Russian searcher saw "Интеграции —
    // 21+ integrations" in the tab title.
    title: `${t('marketplace.title')} — ${t('marketplace.metaTitleSuffix').replace(
      '{{count}}',
      String(available),
    )}`,
    description: t('marketplace.subtitle'),
    alternates: { canonical: '/integrations' },
  };
}

function AppCard({ app, t }: { app: MarketplaceApp; t: (key: string) => string }) {
  const available = appStatus(app) === 'available';
  return (
    <div className="flex h-full flex-col gap-3 rounded-2xl border border-border/60 bg-card/40 p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium">{app.name}</p>
        <span
          className={
            available
              ? 'shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-600 dark:text-emerald-400'
              : 'shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground'
          }
        >
          {t(available ? 'marketplace.statusAvailable' : 'marketplace.statusComing')}
        </span>
      </div>
      <p className="flex-1 text-sm text-muted-foreground">
        {t(`marketplace.apps.${app.id}.description`)}
      </p>
      {app.docsUrl && (
        <a
          href={app.docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          {t('marketplace.docs')}
        </a>
      )}
    </div>
  );
}

export default async function IntegrationsPage() {
  const cookieStore = await cookies();
  const locale = cookieStore.get('i18nextLng')?.value || 'en';
  const { t } = await getServerTranslation('marketplace', locale);
  const { t: tc } = await getServerTranslation('common', locale);

  const categories = populatedCategories();
  const apps = (category: string) =>
    MARKETPLACE_APPS.filter((app) => app.category === category).sort((a, b) => b.weight - a.weight);

  const available = MARKETPLACE_APPS.filter((app) => appStatus(app) === 'available').length;
  const coming = MARKETPLACE_APPS.length - available;

  return (
    <PublicPageShell language={locale}>
      <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
        <header className="max-w-3xl">
          <h1 className="text-4xl font-semibold tracking-tight">{t('marketplace.title')}</h1>
          <p className="mt-4 text-lg text-muted-foreground">{t('marketplace.subtitle')}</p>
          <p className="mt-6 flex flex-wrap gap-3 text-sm">
            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-emerald-600 dark:text-emerald-400">
              {t('marketplace.statsAvailable').replace('{{count}}', String(available))}
            </span>
            <span className="rounded-full border border-border px-3 py-1 text-muted-foreground">
              {t('marketplace.statsComing').replace('{{count}}', String(coming))}
            </span>
          </p>
        </header>

        {categories.map((category) => (
          <section key={category} className="mt-14">
            <h2 className="text-xl font-medium">{t(`marketplace.categories.${category}`)}</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {apps(category).map((app) => (
                <AppCard key={app.id} app={app} t={t} />
              ))}
            </div>
          </section>
        ))}

        <footer className="mt-16 rounded-2xl border border-border/60 bg-card/40 p-6">
          <p className="text-sm text-muted-foreground">{t('marketplace.footnote')}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/register"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              {tc('buttons.getStarted')}
            </Link>
            <Link
              href="/compare"
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium"
            >
              {tc('buttons.learnMore')}
            </Link>
          </div>
        </footer>
      </div>
    </PublicPageShell>
  );
}
