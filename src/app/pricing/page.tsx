import type { Metadata } from 'next';
import nextDynamic from 'next/dynamic';
import { cookies } from 'next/headers';
import { getServerTranslation } from '@/lib/i18n/server-translation';
import { Skeleton } from '@/components/ui/skeleton';

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const locale = cookieStore.get('i18nextLng')?.value || 'en';
  const { t } = await getServerTranslation('landing', locale);

  return {
    title: t('meta.pricing.title'),
    description: t('meta.pricing.description'),
    openGraph: {
      title: t('meta.pricing.ogTitle'),
      description: t('meta.pricing.ogDescription'),
    },
  };
}

const PricingClient = nextDynamic(() => import('@/components/pricing/PricingClient'), {
  loading: () => <Skeleton className="h-screen w-full" />,
});

export default async function PricingPage() {
  // Same server-detected locale the metadata uses, handed to the client tree so
  // the SSR'd page (CTA, FAQ, navbar) is in the visitor's language instead of
  // English-until-hydration.
  const locale = (await cookies()).get('i18nextLng')?.value || 'en';
  return <PricingClient initialLanguage={locale} />;
}
