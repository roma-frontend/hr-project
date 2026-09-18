import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { getServerTranslation } from '@/lib/i18n/server-translation';
import LeaveTypesClient from '@/components/features/leave-types/LeaveTypesClient';

/**
 * `/features/leave-types` — vacation, sick leave and the other leave kinds.
 *
 * Server component so the visitor's locale can be read from the cookie and
 * handed to the client shell: the page (and the navbar inside it) then renders
 * in that language on the first paint instead of English-then-hydration.
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = (await cookies()).get('i18nextLng')?.value || 'en';
  const { t } = await getServerTranslation('landing', locale);

  return {
    title: t('meta.features.title'),
    description: t('meta.features.description'),
    alternates: { canonical: '/features/leave-types' },
  };
}

export default async function LeaveTypesPage() {
  const locale = (await cookies()).get('i18nextLng')?.value || 'en';
  return <LeaveTypesClient initialLanguage={locale} />;
}
