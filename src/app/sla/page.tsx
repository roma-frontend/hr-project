import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { getServerTranslation } from '@/lib/i18n/server-translation';
import PublicPageShell from '@/components/landing/PublicPageShell';

/**
 * Service Level Agreement page (`/sla`).
 *
 * Copy discipline: the commitments below are what a signed Enterprise order
 * carries. This page deliberately does not claim a measured historical uptime —
 * no external uptime monitor feeds a number yet, and a marketing percentage that
 * nothing measures is the kind of claim an enterprise buyer checks first.
 */
export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const locale = cookieStore.get('i18nextLng')?.value || 'en';
  const { t } = await getServerTranslation('trust', locale);

  return {
    title: t('trust.sla.metaTitle'),
    description: t('trust.sla.metaDescription'),
    alternates: { canonical: '/sla' },
  };
}

export default async function SlaPage() {
  const cookieStore = await cookies();
  const locale = cookieStore.get('i18nextLng')?.value || 'en';
  const { t } = await getServerTranslation('trust', locale);

  const commitments = ['availability', 'supportHours', 'critical', 'high', 'normal', 'credits'];

  return (
    <PublicPageShell language={locale}>
      <div className="mx-auto max-w-3xl px-6 pb-16">
        <h1 className="text-4xl font-semibold tracking-tight">{t('trust.sla.title')}</h1>
        <p className="mt-4 text-lg text-muted-foreground">{t('trust.sla.subtitle')}</p>

        <section className="mt-12 overflow-x-auto">
          <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border/60 text-xs uppercase tracking-wider text-muted-foreground">
                <th className="py-2 pr-4 font-medium">{t('trust.sla.colCommitment')}</th>
                <th className="py-2 font-medium">{t('trust.sla.colValue')}</th>
              </tr>
            </thead>
            <tbody>
              {commitments.map((key) => (
                <tr key={key} className="border-b border-border/40 align-top">
                  <td className="py-3 pr-4 font-medium">{t(`trust.sla.rows.${key}.label`)}</td>
                  <td className="py-3 text-muted-foreground">{t(`trust.sla.rows.${key}.value`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-medium">{t('trust.sla.appliesTitle')}</h2>
          <p className="mt-3 text-sm text-muted-foreground">{t('trust.sla.appliesBody')}</p>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-medium">{t('trust.sla.reportTitle')}</h2>
          <p className="mt-3 text-sm text-muted-foreground">{t('trust.sla.reportBody')}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/contact"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              {t('trust.sla.reportCta')}
            </Link>
            <Link
              href="/security"
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium"
            >
              {t('trust.sla.securityCta')}
            </Link>
          </div>
        </section>

        <section className="mt-12 rounded-2xl border border-border/60 bg-card/40 p-6 text-sm text-muted-foreground">
          {t('trust.sla.legalNote')}
        </section>
      </div>
    </PublicPageShell>
  );
}
