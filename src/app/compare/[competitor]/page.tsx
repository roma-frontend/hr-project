import type { Metadata } from 'next';
import nextDynamic from 'next/dynamic';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { getServerTranslation } from '@/lib/i18n/server-translation';
import { Skeleton } from '@/components/ui/skeleton';
import { COMPETITORS, isCompetitorSlug } from '@/lib/competitors';

const SUPPORTED = ['en', 'hy', 'ru', 'de'] as const;
type Lang = (typeof SUPPORTED)[number];

async function resolveLocale(): Promise<Lang> {
  const raw = (await cookies()).get('i18nextLng')?.value;
  return (SUPPORTED as readonly string[]).includes(raw ?? '') ? (raw as Lang) : 'en';
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ competitor: string }>;
}): Promise<Metadata> {
  const { competitor } = await params;
  const vendor = COMPETITORS.find((c) => c.slug === competitor);
  if (!vendor) return {};

  const locale = await resolveLocale();
  const { t } = await getServerTranslation('landing', locale);

  return {
    title: t('compare.meta.detailTitle', { name: vendor.name }),
    description: t('compare.meta.detailDescription', { name: vendor.name }),
    alternates: { canonical: `/compare/${vendor.slug}` },
    openGraph: {
      title: t('compare.meta.detailOgTitle', { name: vendor.name }),
      description: t('compare.meta.detailOgDescription', { name: vendor.name }),
    },
  };
}

const CompareDetailClient = nextDynamic(() => import('@/components/compare/CompareDetailClient'), {
  loading: () => <Skeleton className="h-screen w-full" />,
});

export default async function CompareDetailPage({
  params,
}: {
  params: Promise<{ competitor: string }>;
}) {
  const { competitor } = await params;
  if (!isCompetitorSlug(competitor)) notFound();

  const initialLanguage = await resolveLocale();

  return <CompareDetailClient slug={competitor} initialLanguage={initialLanguage} />;
}
