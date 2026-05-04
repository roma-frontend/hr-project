'use client';

import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuthStore } from '@/store/useAuthStore';
import type { Id } from '../../convex/_generated/dataModel';

export type PlanType = 'starter' | 'professional' | 'enterprise';

export function useSubscription() {
  const { user } = useAuthStore();

  // Get organization to determine plan
  const organization = useQuery(
    api.organizations.getMyOrganization,
    user?.id ? { userId: user.id as Id<'users'> } : 'skip',
  );

  const isLoading = organization === undefined;
  const isActive = !!organization;
  const plan: PlanType = organization?.plan ?? 'starter';

  return {
    isLoading,
    isActive,
    plan,
  };
}
