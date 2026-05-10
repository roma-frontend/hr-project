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
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Building2, Search, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ShieldLoader } from '@/components/ui/ShieldLoader';
import { useRouter } from 'next/navigation';

interface Organization {
  _id: Id<'organizations'>;
  name: string;
  slug: string;
  industry?: string;
  logoUrl?: string;
  country?: string;
}

export default function SelectOrganizationPage() {
  const { t } = useTranslation();
  const { user, setUser } = useAuthStore();
  const router = useRouter();

  // Get fresh user data from Convex (not just from auth store)
  const freshUserData = useQuery(
    api.users.queries.getCurrentUser,
    user?.email ? { email: user.email } : 'skip',
  );

  // Redirect if user already has organization and is approved (check BOTH store and fresh Convex data)
  React.useEffect(() => {
    // Check fresh data from Convex first (more reliable than store)
    if (freshUserData?.organizationId && freshUserData?.isApproved) {
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
      router.push(redirectUrl);
      return;
    }

    // Sallback to store data
    if (user?.organizationId && user?.isApproved) {
      // Check for callback URL
      const params = new URLSearchParams(window.location.search);
      const nextUrl = params.get('next');
      const redirectUrl = nextUrl || '/dashboard';
      router.push(redirectUrl);
    }
  }, [user, freshUserData, setUser]);

  const organizations = useQuery(api.organizationJoinRequests.getActiveOrganizations) as
    | Organization[]
    | undefined;
  const requestJoin = useMutation(api.organizationJoinRequests.requestJoinOrganization);

  const [searchQuery, setSearchQuery] = useState('');
  const [isRequesting, setIsRequesting] = useState<Id<'organizations'> | null>(null);

  const filteredOrgs = organizations?.filter(
    (org) =>
      org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      org.slug.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleRequestJoin = async (organizationId: Id<'organizations'>) => {
    if (!user?.id) {
      return;
    }

    setIsRequesting(organizationId);
    try {
      await requestJoin({
        userId: user.id as Id<'users'>,
        organizationId,
      });

      router.push('/onboarding/pending');
    } catch (_error) {
    } finally {
      setIsRequesting(null);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
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
                      <div className="w-12 h-12 rounded-lg bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-lg">
                        {org.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
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
