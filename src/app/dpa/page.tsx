import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { getServerTranslation } from '@/lib/i18n/server-translation';
import PublicPageShell from '@/components/landing/PublicPageShell';

/**
 * Data Processing Agreement page (`/dpa`).
 *
 * The executable text is a template that lives with the other legal documents;
 * this page states what it covers and how to get a signed copy rather than
 * publishing a contract-shaped page that no one has reviewed.
 */
export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const locale = cookieStore.get('i18nextLng')?.value || 'en';
  const { t } = await getServerTranslation('trust', locale);

  return {
    title: t('trust.dpa.metaTitle'),
    description: t('trust.dpa.metaDescription'),
    alternates: { canonical: '/dpa' },
  };
}

export default async function DpaPage() {
  const cookieStore = await cookies();
  const locale = cookieStore.get('i18nextLng')?.value || 'en';
  const { t } = await getServerTranslation('trust', locale);

  const covers = ['covers1', 'covers2', 'covers3', 'covers4', 'covers5'];

  return (
    <PublicPageShell language={locale}>
      <div className="mx-auto max-w-3xl px-6 pb-16">
        <h1 className="text-4xl font-semibold tracking-tight">{t('trust.dpa.title')}</h1>
        <p className="mt-4 text-lg text-muted-foreground">{t('trust.dpa.subtitle')}</p>

        <section className="mt-12">
          <h2 className="text-xl font-medium">{t('trust.dpa.coversTitle')}</h2>
          <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
            {covers.map((key) => (
              <li key={key} className="flex gap-3">
                <span aria-hidden="true">—</span>
                <span>{t(`trust.dpa.${key}`)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-medium">{t('trust.dpa.howTitle')}</h2>
          <p className="mt-3 text-sm text-muted-foreground">{t('trust.dpa.howBody')}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/contact"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              {t('trust.dpa.howCta')}
            </Link>
            <Link
              href="/subprocessors"
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium"
            >
              {t('trust.dpa.subprocessorsCta')}
            </Link>
          </div>
        </section>

        <section className="mt-12 rounded-2xl border border-border/60 bg-card/40 p-6 text-sm text-muted-foreground">
          {t('trust.dpa.templateNote')}
        </section>
      </div>
    </PublicPageShell>
  );
}
