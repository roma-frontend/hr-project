/**
import Image from 'next/image';
 * Organization Selection Page
 * 
 * For new Google OAuth users to select which organization they want to join.
 */

'use client';

import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useAuthStore } from '@/store/useAuthStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Building2, Search, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { ShieldLoader } from '@/components/ui/ShieldLoader';

export default function SelectOrganizationPage() {
  const { t } = useTranslation();
  const { user, setUser } = useAuthStore();

  // Get fresh user data from Convex (not just from auth store)
  const freshUserData = useQuery(
    api.users.queries.getCurrentUser,
    user?.email ? { email: user.email } : 'skip',
  );

  // Debug logging
  React.useEffect(() => {
    console.log('[SelectOrganization] user:', {
      id: user?.id,
      email: user?.email,
      organizationId: user?.organizationId,
      isApproved: user?.isApproved,
    });
    console.log('[SelectOrganization] freshUserData from Convex:', freshUserData);
  }, [user, freshUserData]);

  // Redirect if user already has organization and is approved (check BOTH store and fresh Convex data)
  React.useEffect(() => {
    // Check fresh data from Convex first (more reliable than store)
    if (freshUserData?.organizationId && freshUserData?.isApproved) {
      console.log(
        '[SelectOrganization] ✅ Fresh Convex data shows user is approved - redirecting to dashboard',
      );
      // Update auth store with fresh data
      setUser({
        id: freshUserData._id,
        name: freshUserData.name,
        email: freshUserData.email,
        role: freshUserData.role,
        organizationId: freshUserData.organizationId,
        isApproved: freshUserData.isApproved,
      });

      // Check for callback URL
      const params = new URLSearchParams(window.location.search);
      const nextUrl = params.get('next');
      const redirectUrl = nextUrl || '/dashboard';
      window.location.href = redirectUrl;
      return;
    }

    // Fallback to store data
    if (user?.organizationId && user?.isApproved) {
      console.log(
        '[SelectOrganization] ✅ Store data shows user is approved - redirecting to dashboard',
      );

      // Check for callback URL
      const params = new URLSearchParams(window.location.search);
      const nextUrl = params.get('next');
      const redirectUrl = nextUrl || '/dashboard';
      window.location.href = redirectUrl;
    }
  }, [user, freshUserData, setUser]);

  const organizations = useQuery(api.organizationJoinRequests.getActiveOrganizations);
  const requestJoin = useMutation(api.organizationJoinRequests.requestJoinOrganization);
  // Skip getMyRequests query to avoid rendering issues - user can see pending status after redirect

  const [searchQuery, setSearchQuery] = useState('');
  const [isRequesting, setIsRequesting] = useState<Id<'organizations'> | null>(null);

  const filteredOrgs = organizations?.filter(
    (org: any) =>
      org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      org.slug.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Debug logging
  console.log('[SelectOrganizationPage] Render:', {
    user,
    organizations,
    filteredOrgs,
    hasUser: !!user,
    hasOrgs: !!organizations,
    orgsCount: organizations?.length,
    filteredCount: filteredOrgs?.length,
    userId: user?.id,
    user_id: user?.id,
    buttonShouldBeDisabled: !user?.id,
  });

  const handleRequestJoin = async (organizationId: Id<'organizations'>) => {
    console.log('[handleRequestJoin] Called with organizationId:', organizationId);
    console.log('[handleRequestJoin] user:', { id: user?.id, email: user?.email });

    if (!user?.id) {
      console.error('[handleRequestJoin] No user ID!');
      toast.error('User not loaded. Please try again.');
      return;
    }

    setIsRequesting(organizationId);
    try {
      console.log(
        '[handleRequestJoin] Sending request with userId:',
        user.id,
        'organizationId:',
        organizationId,
      );

      await requestJoin({
        userId: user.id as Id<'users'>,
        organizationId,
      });

      console.log('[handleRequestJoin] Request successful!');
      toast.success(t('onboarding.requestSent', 'Request sent!'));
      window.location.href = '/onboarding/pending';
    } catch (error: any) {
      console.error('[handleRequestJoin] Error:', error);
      toast.error(error.message || t('onboarding.requestFailed', 'Failed to send request'));
    } finally {
      setIsRequesting(null);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white dark:bg-gray-800 shadow-lg mb-4">
            <Building2 className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold mb-2">
            {t('onboarding.selectOrganization', 'Select Your Organization')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {t(
              'onboarding.selectOrgDesc',
              'Choose the organization you want to join. Your request will be sent to administrators for approval.',
            )}
          </p>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            type="text"
            placeholder={t('onboarding.searchOrg', 'Search organizations...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Organizations List */}
        <div className="space-y-3">
          {!organizations ? (
            <div className="flex items-center justify-center py-12">
              <ShieldLoader size="md" variant="inline" />
            </div>
          ) : filteredOrgs?.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                {searchQuery
                  ? t('onboarding.noOrgFound', 'No organizations found matching your search')
                  : t('onboarding.noOrgs', 'No organizations available')}
              </CardContent>
            </Card>
          ) : (
            filteredOrgs?.map((org) => (
              <Card
                key={org._id}
                className="hover:shadow-md transition-shadow cursor-pointer group"
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* Logo */}
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-lg">
                        {org.logoUrl ? (
                          <img
                            src={org.logoUrl}
                            alt={org.name}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        ) : (
                          org.name.charAt(0).toUpperCase()
                        )}
                      </div>

                      {/* Info */}
                      <div>
                        <h3 className="font-semibold text-lg group-hover:text-blue-600 transition-colors">
                          {org.name}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <span>@{org.slug}</span>
                          {org.industry && (
                            <>
                              <span>•</span>
                              <span>{org.industry}</span>
                            </>
                          )}
                          {org.country && (
                            <>
                              <span>•</span>
                              <span>{org.country}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Button */}
                    <Button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('[Button onClick] Clicked!', { orgId: org._id, user });
                        handleRequestJoin(org._id);
                      }}
                      disabled={isRequesting === org._id || !user?.id}
                      className="min-w-[120px]"
                    >
                      {isRequesting === org._id ? (
                        <>
                          <ShieldLoader size="xs" variant="inline" />
                          {t('onboarding.sending', 'Sending...')}
                        </>
                      ) : !user?.id ? (
                        <ShieldLoader size="xs" variant="inline" />
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          {t('onboarding.join', 'Join')}
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Help Text */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            {t(
              'onboarding.afterJoin',
              "After joining, you'll need to wait for administrator approval before accessing the dashboard.",
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
