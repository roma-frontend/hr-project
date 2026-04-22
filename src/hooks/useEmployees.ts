import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export interface EmployeeProfile {
  id: string;
  userId: string;
  biography: any;
  emergencyContact: any;
  education: any;
  certifications: any;
}

export interface EmployeeDocument {
  id: string;
  userId: string;
  fileName: string;
  category: string;
  uploadedAt: number;
  url: string;
}

export interface EmployeeProfileData {
  profile: EmployeeProfile | null;
  documents: EmployeeDocument[];
}

export function useEmployeeProfile(employeeId: string, enabled = true) {
  const { t } = useTranslation();
  return useQuery({
    queryKey: ['employee-profile', employeeId],
    queryFn: async () => {
      const params = new URLSearchParams({
        action: 'get-employee-profile',
        employeeId,
      });
      const res = await fetch(`/api/employees?${params}`);
      if (!res.ok) throw new Error(t('hooks.employees.failedToFetchProfile', 'Failed to fetch employee profile'));
      const json = await res.json();
      return json.data as EmployeeProfileData;
    },
    enabled: enabled && !!employeeId,
  });
}

export interface AIEvaluation {
  id: string;
  userId: string;
  overallScore: number;
  breakdown: {
    performance: number;
    attendance: number;
    behavior: number;
    leaveHistory: number;
  };
  createdAt: number;
}

export function useEmployeeAIEvaluation(employeeId: string, enabled = true) {
  const { t } = useTranslation();
  return useQuery({
    queryKey: ['employee-ai-evaluation', employeeId],
    queryFn: async () => {
      const params = new URLSearchParams({
        action: 'get-ai-evaluation',
        employeeId,
      });
      const res = await fetch(`/api/employees?${params}`);
      if (!res.ok) throw new Error(t('hooks.employees.failedToFetchAIEvaluation', 'Failed to fetch AI evaluation'));
      const json = await res.json();
      return json.data as AIEvaluation | null;
    },
    enabled: enabled && !!employeeId,
  });
}

export interface SupervisorRating {
  id: string;
  employeeId: string;
  supervisorId: string;
  supervisor: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  } | null;
  overallRating: number;
  qualityOfWork: number;
  efficiency: number;
  teamwork: number;
  initiative: number;
  communication: number;
  reliability: number;
  strengths: string | null;
  areasForImprovement: string | null;
  generalComments: string | null;
  ratingPeriod: string | null;
  createdAt: number;
}

export function useLatestSupervisorRating(employeeId: string, enabled = true) {
  const { t } = useTranslation();
  return useQuery({
    queryKey: ['supervisor-rating-latest', employeeId],
    queryFn: async () => {
      const params = new URLSearchParams({
        action: 'get-latest-rating',
        employeeId,
      });
      const res = await fetch(`/api/employees?${params}`);
      if (!res.ok) throw new Error(t('hooks.employees.failedToFetchRating', 'Failed to fetch latest rating'));
      const json = await res.json();
      return json.data as SupervisorRating | null;
    },
    enabled: enabled && !!employeeId,
  });
}

export function useSupervisorRatings(employeeId: string, limit = 10, enabled = true) {
  const { t } = useTranslation();
  return useQuery({
    queryKey: ['supervisor-ratings', employeeId, limit],
    queryFn: async () => {
      const params = new URLSearchParams({
        action: 'get-employee-ratings',
        employeeId,
        limit: String(limit),
      });
      const res = await fetch(`/api/employees?${params}`);
      if (!res.ok) throw new Error(t('hooks.employees.failedToFetchRatings', 'Failed to fetch ratings'));
      const json = await res.json();
      return json.data as SupervisorRating[];
    },
    enabled: enabled && !!employeeId,
  });
}

export interface MonthlyTimeStats {
  totalDays: number;
  totalWorkedHours: number;
  punctualityRate: number;
  lateDays: number;
  earlyLeaveDays: number;
}

export function useMonthlyTimeStats(employeeId: string, month: string, enabled = true) {
  const { t } = useTranslation();
  return useQuery({
    queryKey: ['time-tracking-monthly', employeeId, month],
    queryFn: async () => {
      const params = new URLSearchParams({
        action: 'get-monthly-stats',
        employeeId,
        month,
      });
      const res = await fetch(`/api/employees?${params}`);
      if (!res.ok) throw new Error(t('hooks.employees.failedToFetchMonthlyStats', 'Failed to fetch monthly stats'));
      const json = await res.json();
      return json.data as MonthlyTimeStats;
    },
    enabled: enabled && !!employeeId && !!month,
  });
}

export function useSubmitSupervisorRating() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: {
      employeeId: string;
      supervisorId: string;
      overallRating: number;
      qualityOfWork?: number;
      efficiency?: number;
      teamwork?: number;
      initiative?: number;
      communication?: number;
      reliability?: number;
      strengths?: string;
      areasForImprovement?: string;
      generalComments?: string;
      ratingPeriod?: string;
    }) => {
      const res = await fetch('/api/employees?action=submit-rating', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to submit rating');
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['supervisor-ratings', variables.employeeId] });
      queryClient.invalidateQueries({ queryKey: ['supervisor-rating-latest', variables.employeeId] });
      toast.success(t('toasts.ratingSubmitted'));
    },
    onError: (error) => {
      toast.error(t('toasts.ratingSubmitFailed'));
      console.error('Submit rating error:', error);
    },
  });
}

export function useSubmitAIEvaluation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: {
      employeeId: string;
      overallScore: number;
      breakdown?: Record<string, number>;
    }) => {
      const res = await fetch('/api/employees?action=submit-evaluation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to submit evaluation');
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['employee-ai-evaluation', variables.employeeId] });
    },
    onError: (error) => {
      toast.error(t('toasts.aiEvalSubmitFailed'));
      console.error('Submit evaluation error:', error);
    },
  });
}

export interface UpdateEmployeeData {
  name?: string;
  role?: string;
  employeeType?: string;
  department?: string;
  position?: string;
  phone?: string;
  supervisorId?: string;
  isActive?: boolean;
  travelAllowance?: number;
  paidLeaveBalance?: number;
  sickLeaveBalance?: number;
  familyLeaveBalance?: number;
  presenceStatus?: string;
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: { employeeId: string } & UpdateEmployeeData) => {
      const { employeeId, ...updateData } = data;
      const res = await fetch(`/api/employees/${employeeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update employee');
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user-by-id', variables.employeeId] });
      queryClient.invalidateQueries({ queryKey: ['employee-profile', variables.employeeId] });
      queryClient.invalidateQueries({ queryKey: ['org-users'] });
      toast.success(t('toasts.employeeUpdated'));
    },
    onError: (error) => {
      toast.error(t('toasts.employeeUpdateFailed'));
      console.error('Update employee error:', error);
    },
  });
}

export function useDeleteEmployee() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: { employeeId: string; adminId: string }) => {
      const res = await fetch('/api/users?action=delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminId: data.adminId,
          userId: data.employeeId,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to delete employee');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-users'] });
      toast.success(t('toasts.employeeDeleted'));
    },
    onError: (error) => {
      toast.error(t('toasts.employeeDeleteFailed'));
      console.error('Delete employee error:', error);
    },
  });
}
