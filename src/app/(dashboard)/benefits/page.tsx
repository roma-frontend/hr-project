import nextDynamic from 'next/dynamic';
import { WidgetErrorBoundary } from '@/components/error/WidgetErrorBoundary';

function BenefitsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-(--card) rounded" />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 my-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-(--card) rounded-lg" />
        ))}
      </div>
    </div>
  );
}

const BenefitsClient = nextDynamic(
  () =>
    import('@/components/benefits/BenefitsClient').then((m) => ({
      default: () => (
        <WidgetErrorBoundary name="BenefitsClient">
          <m.default />
        </WidgetErrorBoundary>
      ),
    })),
  { loading: () => <BenefitsSkeleton /> },
);

export default function BenefitsPage() {
  return <BenefitsClient />;
}
