'use client';

import dynamic from 'next/dynamic';
import { useAuthStore } from '@/store/useAuthStore';
import { ShieldLoader } from '@/components/ui/ShieldLoader';

const TasksClient = dynamic(() => import('@/components/tasks/TasksClient'), {
  ssr: false,
  loading: () => (
    <div className="p-6 space-y-4 animate-pulse">
      <div className="h-8 w-48 rounded-lg bg-white/5" />
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-16 rounded-2xl bg-white/5" />
      ))}
    </div>
  ),
});

export default function TasksPage() {
  const { user, isAuthenticated } = useAuthStore();

  // Show loader while user is loading
  if (!isAuthenticated || !user?.id || !user?.role) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <ShieldLoader size="lg" />
      </div>
    );
  }

  return <TasksClient userId={user.id} userRole={user.role} />;
}
