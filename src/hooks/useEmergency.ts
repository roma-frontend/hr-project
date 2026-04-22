import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

interface EmergencyDashboardData {
  criticalTickets: {
    id: string;
    ticketNumber: string;
    title: string;
    status: string;
    creatorName: string;
    organizationName: string | null;
    minutesOpen: number;
  }[];
  activeIncidents: {
    id: string;
    organizationId?: string;
    title: string;
    description: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
    affectedUsers: number;
    affectedOrgs: number;
    rootCause?: string;
    resolution?: string;
    startedAt: number;
    resolvedAt?: number;
    createdBy: string;
    createdAt: number;
    updatedAt: number;
    creatorName: string;
    minutesActive: number;
  }[];
  slaBreaches: number;
  suspiciousIPs: {
    ip: string;
    attempts: number;
    userIds: string[];
  }[];
  maintenanceModeOrgs: number;
  pendingOrgRequests: number;
  priorityLevel: 'critical' | 'high' | 'medium' | 'low';
  priorityScore: number;
  issues: string[];
  requiresAttention: boolean;
}

export function useEmergencyDashboard() {
  const { t } = useTranslation();
  return useQuery({
    queryKey: ['superadmin', 'emergencyDashboard'],
    queryFn: async () => {
      const res = await fetch('/api/superadmin/emergency');
      if (!res.ok) throw new Error(t('hooks.emergency.failedToFetchDashboard', 'Failed to fetch emergency dashboard'));
      const data = await res.json();
      return data as EmergencyDashboardData;
    },
  });
}

export function useCreateIncident() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async ({
      createdBy,
      title,
      description,
      severity,
      affectedUsers,
      affectedOrgs,
    }: {
      createdBy: string;
      title: string;
      description: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      affectedUsers: number;
      affectedOrgs: number;
    }) => {
      const res = await fetch('/api/superadmin/emergency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createIncident',
          createdBy,
          title,
          description,
          severity,
          affectedUsers,
          affectedOrgs,
        }),
      });
      if (!res.ok) throw new Error(t('hooks.emergency.failedToCreateIncident', 'Failed to create incident'));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin', 'emergencyDashboard'] });
    },
  });
}

export function useUpdateIncidentStatus() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async ({
      incidentId,
      status,
      userId,
      rootCause,
      resolution,
    }: {
      incidentId: string;
      status: string;
      userId: string;
      rootCause?: string;
      resolution?: string;
    }) => {
      const res = await fetch('/api/superadmin/emergency', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateIncidentStatus',
          incidentId,
          status,
          userId,
          rootCause,
          resolution,
        }),
      });
      if (!res.ok) throw new Error(t('hooks.emergency.failedToUpdateIncidentStatus', 'Failed to update incident status'));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin', 'emergencyDashboard'] });
    },
  });
}
