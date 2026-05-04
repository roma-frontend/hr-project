import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/Skeleton';

const AIChatClient = dynamic(() => import('@/components/ai-chat/AIChatClient'), {
  loading: () => <Skeleton className="h-screen w-full" />,
});

export default function AIChatPage() {
  return <AIChatClient />;
}
