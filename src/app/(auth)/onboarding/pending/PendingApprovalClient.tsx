'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/useAuthStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, Mail, Building2, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { logoutAction } from '@/actions/auth';

async function fetchCurrentUser(email: string) {
  const params = new URLSearchParams({ action: 'get-current-user' });
  const res = await fetch(`/api/users?${params}`);
  if (!res.ok) throw new Error('Failed to fetch user');
  const json = await res.json();
  return json.data;
}

async function fetchJoinRequests(userId: string) {
  const params = new URLSearchParams({ action: 'get-join-requests', userId });
  const res = await fetch(`/api/users?${params}`);
  if (!res.ok) throw new Error('Failed to fetch join requests');
  const json = await res.json();
  return json.data;
}

export default function PendingApprovalClient() {
  const { t } = useTranslation();
  const { user, setUser } = useAuthStore();

  const { data: freshUserData } = useQuery({
    queryKey: ['current-user', user?.email],
    queryFn: () => fetchCurrentUser(user!.email),
    enabled: !!user?.email,
    refetchInterval: 10000,
  });

  const { data: myRequests } = useQuery({
    queryKey: ['join-requests', user?.id],
    queryFn: () => fetchJoinRequests(user!.id),
    enabled: !!user?.id,
    refetchInterval: 10000,
  });

  const pendingRequest = myRequests?.find((req: { status: string }) => req.status === 'pending');
  const rejectedRequest = myRequests?.find((req: { status: string }) => req.status === 'rejected');

  React.useEffect(() => {
    if (freshUserData?.organizationId && freshUserData?.isApproved) {
      console.error('[PendingPage] ✅ User was approved! Redirecting to dashboard...');
      setUser({
        id: freshUserData.id,
        name: freshUserData.name,
        email: freshUserData.email,
        role: freshUserData.role,
        organizationId: freshUserData.organization_id,
        isApproved: freshUserData.isApproved,
      });

      const params = new URLSearchParams(window.location.search);
      const nextUrl = params.get('next');
      const redirectUrl = nextUrl || '/dashboard';
      window.location.href = redirectUrl;
    }
  }, [freshUserData, setUser]);

  const handleSignOut = async () => {
    await logoutAction();
    document.cookie = 'hr-auth-token=; path=/; max-age=0';
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-amber-50 to-orange-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white dark:bg-gray-800 shadow-lg mb-4">
            <Clock className="w-10 h-10 text-amber-600" />
          </div>
          <h1 className="text-3xl font-bold mb-2">
            {t('onboarding.pendingApproval', 'Pending Approval')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {t('onboarding.pendingDesc', 'Your request is being reviewed by administrators')}
          </p>
        </div>

        {rejectedRequest && (
          <Card className="mb-4 border-red-200 dark:border-red-800">
            <CardHeader>
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-600" />
                <CardTitle className="text-red-800 dark:text-red-200">
                  {t('onboarding.requestRejected', 'Request Rejected')}
                </CardTitle>
              </div>
              <CardDescription className="text-red-600 dark:text-red-300">
                {rejectedRequest.rejectionReason || t('onboarding.noReason', 'No reason provided')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleSignOut} className="flex-1">
                  {t('onboarding.tryAnotherEmail', 'Try Another Email')}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {pendingRequest && (
          <Card className="mb-4">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                <CardTitle>{t('onboarding.requestSent', 'Request Sent')}</CardTitle>
              </div>
              <CardDescription>
                {t('onboarding.waitingForApproval', 'Waiting for administrator approval')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <Mail className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium">{user?.email}</p>
                  <p className="text-xs text-blue-600">
                    {t('onboarding.requestSentTo', 'Request sent to administrators')}
                  </p>
                </div>
              </div>

              <div className="p-4 bg-amber-50 dark:bg-amber-950 rounded-lg">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  {t(
                    'onboarding.approvalTime',
                    'Administrators typically respond within 24-48 hours',
                  )}
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium text-sm">{t('onboarding.nextSteps', 'Next Steps')}:</h4>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <li>1. {t('onboarding.step1', 'Request submitted')}</li>
                  <li>2. {t('onboarding.step2', 'Wait for admin approval')}</li>
                  <li>3. {t('onboarding.step3', "You'll receive an email notification")}</li>
                  <li>4. {t('onboarding.step4', 'Access the dashboard')}</li>
                </ul>
              </div>

              <Button variant="outline" onClick={handleSignOut} className="w-full">
                {t('onboarding.checkLater', "I'll Check Later")}
              </Button>
            </CardContent>
          </Card>
        )}

        {!pendingRequest && !rejectedRequest && (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-gray-500">
                {t('onboarding.noRequest', 'No pending requests found')}
              </p>
              <Button onClick={handleSignOut} className="mt-4">
                {t('onboarding.backToLogin', 'Back to Login')}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
