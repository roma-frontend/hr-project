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
    title: t('meta.attendance.title'),
    description: t('meta.attendance.description'),
    openGraph: {
      title: t('meta.attendance.ogTitle'),
      description: t('meta.attendance.ogDescription'),
    },
  };
}

const AttendancePageClient = nextDynamic(
  () => import('@/components/features/attendance/AttendancePageClient'),
  { loading: () => <Skeleton className="h-screen w-full" /> },
);

export default async function AttendancePage() {
  // SSR in the visitor's language like /pricing — see PricingPage.
  const locale = (await cookies()).get('i18nextLng')?.value || 'en';
  return <AttendancePageClient initialLanguage={locale} />;
}
