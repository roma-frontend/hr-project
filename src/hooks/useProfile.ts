import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/useAuthStore';
import { useTranslation } from 'react-i18next';

const PROFILE_QUERY_KEYS = {
  user: (userId: string) => ['profile', 'user', userId],
  stats: (userId: string) => ['profile', 'stats', userId],
};

async function fetchUser(userId: string) {
  try {
    const params = new URLSearchParams({
      action: 'get-user-by-id',
      userId,
    });
    const res = await fetch(`/api/users?${params}`);
    if (!res.ok) throw new Error('Failed to fetch user');
    const json = await res.json();
    return json.data;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Failed to fetch user');
  }
}

async function fetchUserStats(userId: string) {
  try {
    const params = new URLSearchParams({
      action: 'get-user-stats',
      userId,
    });
    const res = await fetch(`/api/users?${params}`);
    if (!res.ok) throw new Error('Failed to fetch user stats');
    const json = await res.json();
    return json.data;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Failed to fetch user stats');
  }
}

export function useUserProfile(userId?: string) {
  return useQuery({
    queryKey: PROFILE_QUERY_KEYS.user(userId || ''),
    queryFn: () => fetchUser(userId!),
    enabled: !!userId,
  });
}

export function useUserStats(userId?: string) {
  return useQuery({
    queryKey: PROFILE_QUERY_KEYS.stats(userId || ''),
    queryFn: () => fetchUserStats(userId!),
    enabled: !!userId,
  });
}

export function useUpdateOwnProfile() {
  const queryClient = useQueryClient();
  const { user, login } = useAuthStore();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      email: string;
      phone?: string;
      location?: string;
    }) => {
      const res = await fetch(`/api/users?action=update-own-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update profile');
      }
      return res.json();
    },
    onSuccess: (response, variables) => {
      if (user) {
        login({ ...user, name: variables.name, email: variables.email });
      }
      queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEYS.user(user?.id || '') });
      queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEYS.stats(user?.id || '') });
      toast.success(t('profile.updated', 'Profile updated successfully'));
    },
    onError: (error: Error) => {
      toast.error(error.message || t('profile.updateFailed', 'Failed to update profile'));
    },
  });
}
