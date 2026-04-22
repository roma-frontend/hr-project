import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

export interface GlobalSearchResults {
  users: Array<{
    id: string;
    name: string;
    email: string;
    organizationId?: string;
  }>;
  organizations: Array<{
    id: string;
    name: string;
    plan: string;
    slug: string;
  }>;
  leaveRequests: Array<{
    id: string;
    userName: string;
    type: string;
    startDate: string;
    endDate: string;
    status: string;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    description?: string;
    status: string;
    priority?: string;
  }>;
  driverRequests: Array<{
    id: string;
    requesterName?: string;
    status: string;
    tripInfo?: {
      from: string;
      to: string;
    };
  }>;
  supportTickets: Array<{
    id: string;
    ticketNumber: string;
    title: string;
    status: string;
    priority: string;
  }>;
  total: number;
}

export function useGlobalSearch(query: string, limit = 20) {
  const { t } = useTranslation();
  return useQuery({
    queryKey: ['superadmin', 'global-search', query, limit],
    queryFn: async () => {
      const params = new URLSearchParams({
        action: 'global-search',
        query,
        limit: String(limit),
      });
      const res = await fetch(`/api/superadmin?${params}`);
      if (!res.ok) throw new Error(t('hooks.globalsearch.failedToSearch', 'Failed to search'));
      const json = await res.json();
      return json.data as GlobalSearchResults;
    },
    enabled: query.length >= 2,
  });
}
