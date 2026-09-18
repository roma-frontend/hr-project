import { Metadata } from 'next';
import { cookies } from 'next/headers';
import CareersPageWrapper from './CareersPageWrapper';

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const title = `Careers at ${slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, ' ')}`;
  return {
    title,
    description: `Explore open positions and join our team. View all available jobs at ${slug}.`,
    openGraph: {
      title,
      description: `Explore open positions and join our team.`,
      type: 'website',
    },
  };
}

export default async function CareersSlugPage({ params }: Props) {
  const { slug } = await params;
  // The wrapper renders the navbar, so it needs the locale too (see /careers).
  const locale = (await cookies()).get('i18nextLng')?.value || 'en';
  return <CareersPageWrapper slug={slug} initialLanguage={locale} />;
}
