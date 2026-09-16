import type { Metadata } from 'next';
import nextDynamic from 'next/dynamic';
import { cookies } from 'next/headers';
import { getServerTranslation } from '@/lib/i18n/server-translation';
import { Skeleton } from '@/components/ui/skeleton';

const SUPPORTED = ['en', 'hy', 'ru', 'de'] as const;
type Lang = (typeof SUPPORTED)[number];

async function resolveLocale(): Promise<Lang> {
  const raw = (await cookies()).get('i18nextLng')?.value;
  return (SUPPORTED as readonly string[]).includes(raw ?? '') ? (raw as Lang) : 'en';
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveLocale();
  const { t } = await getServerTranslation('landing', locale);

  return {
    title: t('compare.meta.indexTitle'),
    description: t('compare.meta.indexDescription'),
    alternates: { canonical: '/compare' },
    openGraph: {
      title: t('compare.meta.indexOgTitle'),
      description: t('compare.meta.indexOgDescription'),
    },
  };
}

const CompareIndexClient = nextDynamic(() => import('@/components/compare/CompareIndexClient'), {
  loading: () => <Skeleton className="h-screen w-full" />,
});

export default async function ComparePage() {
  const initialLanguage = await resolveLocale();

  return <CompareIndexClient initialLanguage={initialLanguage} />;
}
