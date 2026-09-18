import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { getServerTranslation } from '@/lib/i18n/server-translation';
import PublicPageShell from '@/components/landing/PublicPageShell';
import {
  SUBPROCESSOR_CHANGE_NOTICE_DAYS,
  subprocessorCounts,
  subprocessorsByKind,
  type Subprocessor,
} from '@/lib/subprocessors';

/**
 * Public subprocessor register (`/subprocessors`).
 *
 * Rendered from `src/lib/subprocessors.ts`, which lists only services the
 * repository actually calls — the same eight-vendor core set as the SOC 2
 * readiness register, plus the integrations that stay dormant until a tenant
 * enables them.
 */
export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const locale = cookieStore.get('i18nextLng')?.value || 'en';
  const { t } = await getServerTranslation('trust', locale);

  return {
    title: t('trust.subprocessors.metaTitle'),
    description: t('trust.subprocessors.metaDescription'),
    alternates: { canonical: '/subprocessors' },
  };
}

export default async function SubprocessorsPage() {
  const cookieStore = await cookies();
  const locale = cookieStore.get('i18nextLng')?.value || 'en';
  const { t } = await getServerTranslation('trust', locale);

  const counts = subprocessorCounts();
  const core = subprocessorsByKind('core');
  const optional = subprocessorsByKind('optional');

  const renderTable = (rows: readonly Subprocessor[]) => (
    <div className="mt-5 overflow-x-auto">
      <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-border/60 text-xs uppercase tracking-wider text-muted-foreground">
            <th className="py-2 pr-4 font-medium">{t('trust.subprocessors.colVendor')}</th>
            <th className="py-2 pr-4 font-medium">{t('trust.subprocessors.colPurpose')}</th>
            <th className="py-2 font-medium">{t('trust.subprocessors.colRegion')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((entry) => (
            <tr key={entry.id} className="border-b border-border/40 align-top">
              <td className="py-3 pr-4">
                <a
                  href={entry.site}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium underline underline-offset-2"
                >
                  {entry.name}
                </a>
              </td>
              <td className="py-3 pr-4 text-muted-foreground">
                {t(`trust.subprocessors.items.${entry.id}`)}
              </td>
              <td className="py-3 text-muted-foreground">{entry.region}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <PublicPageShell language={locale}>
      <div className="mx-auto max-w-4xl px-6 pb-16">
        <h1 className="text-4xl font-semibold tracking-tight">{t('trust.subprocessors.title')}</h1>
        <p className="mt-4 text-lg text-muted-foreground">{t('trust.subprocessors.subtitle')}</p>
        <p className="mt-3 text-sm text-muted-foreground">
          {t('trust.subprocessors.counts', {
            core: String(counts.core),
            optional: String(counts.optional),
          })}
        </p>

        <section className="mt-12">
          <h2 className="text-xl font-medium">{t('trust.subprocessors.coreTitle')}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('trust.subprocessors.coreSubtitle')}
          </p>
          {renderTable(core)}
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-medium">{t('trust.subprocessors.optionalTitle')}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('trust.subprocessors.optionalSubtitle')}
          </p>
          {renderTable(optional)}
        </section>

        <section className="mt-12 rounded-2xl border border-border/60 bg-card/40 p-6 text-sm">
          <p className="text-muted-foreground">
            {t('trust.subprocessors.changeNotice', {
              days: String(SUBPROCESSOR_CHANGE_NOTICE_DAYS),
            })}
          </p>
          <p className="mt-3 text-muted-foreground">{t('trust.subprocessors.regionsNote')}</p>
        </section>
      </div>
    </PublicPageShell>
  );
}
