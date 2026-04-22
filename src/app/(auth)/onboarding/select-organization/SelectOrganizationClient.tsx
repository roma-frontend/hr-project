'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRequestJoinOrganization } from '@/hooks/useOrganizations';
import { useAuthStore } from '@/store/useAuthStore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Building2, Search, ArrowRight, Shield, Users, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ShieldLoader } from '@/components/ui/ShieldLoader';

interface Organization {
  id: string;
  name: string;
  slug: string;
  industry?: string;
  logoUrl?: string;
  country?: string;
}

async function fetchCurrentUser(email: string) {
  const params = new URLSearchParams({ action: 'get-current-user' });
  const res = await fetch(`/api/users?${params}`);
  if (!res.ok) throw new Error('Failed to fetch user');
  const json = await res.json();
  return json.data;
}

async function fetchActiveOrganizations() {
  const params = new URLSearchParams({ action: 'get-for-picker' });
  const res = await fetch(`/api/org?${params}`);
  if (!res.ok) throw new Error('Failed to fetch organizations');
  const json = await res.json();
  return json.data as Organization[];
}

export default function SelectOrganizationClient() {
  const { t } = useTranslation();
  const { user, setUser } = useAuthStore();

  const { data: freshUserData } = useQuery({
    queryKey: ['current-user', user?.email],
    queryFn: () => fetchCurrentUser(user!.email),
    enabled: !!user?.email,
  });

  React.useEffect(() => {
    if (freshUserData?.organizationId && freshUserData?.isApproved) {
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
      return;
    }

    if (user?.organizationId && user?.isApproved) {
      const params = new URLSearchParams(window.location.search);
      const nextUrl = params.get('next');
      const redirectUrl = nextUrl || '/dashboard';
      window.location.href = redirectUrl;
    }
  }, [user, freshUserData, setUser]);

  const { data: organizations, error, isLoading } = useQuery({
    queryKey: ['organizations-for-picker'],
    queryFn: fetchActiveOrganizations,
  });

  React.useEffect(() => {
    if (organizations) {
      console.log('[SelectOrg] Organizations loaded:', organizations);
    }
    if (error) {
      console.error('[SelectOrg] Error loading organizations:', error);
    }
  }, [organizations, error]);
  const requestJoin = useRequestJoinOrganization();

  const [searchQuery, setSearchQuery] = useState('');
  const [isRequesting, setIsRequesting] = useState<string | null>(null);

  const filteredOrgs = organizations?.filter(
    (org) =>
      org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      org.slug.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleRequestJoin = async (organizationId: string) => {
    if (!user?.id) {
      return;
    }

    setIsRequesting(organizationId);
    try {
      await requestJoin.mutateAsync({
        userId: user.id,
        organizationId,
      });

      window.location.href = '/onboarding/pending';
    } catch (_error) {
    } finally {
      setIsRequesting(null);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--landing-bg)] p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-10 animate-fade-in">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-lg mb-6">
            <Shield className="w-10 h-10 text-[var(--primary)]" strokeWidth={1.5} />
          </div>
          <h1 className="text-3xl font-bold mb-3 heading-gradient">
            {t('onboarding.selectOrganization', 'Select Your Organization')}
          </h1>
          <p className="text-[var(--text-muted)] max-w-md mx-auto">
            {t(
              'onboarding.selectOrgDesc',
              'Choose the organization you want to join. Your request will be sent to administrators for approval.',
            )}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="flex flex-col items-center p-4 rounded-xl bg-[var(--card)] border border-[var(--border)]">
            <Building2 className="w-5 h-5 text-[var(--primary)] mb-2" />
            <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
              {t('onboarding.organizations', 'Organizations')}
            </span>
            <span className="text-xl font-bold text-[var(--text-primary)]">
              {organizations?.length ?? 0}
            </span>
          </div>
          <div className="flex flex-col items-center p-4 rounded-xl bg-[var(--card)] border border-[var(--border)]">
            <Users className="w-5 h-5 text-[var(--primary)] mb-2" />
            <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
              {t('onboarding.members', 'Members')}
            </span>
            <span className="text-xl font-bold text-[var(--text-primary)]">—</span>
          </div>
          <div className="flex flex-col items-center p-4 rounded-xl bg-[var(--card)] border border-[var(--border)]">
            <Globe className="w-5 h-5 text-[var(--primary)] mb-2" />
            <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
              {t('onboarding.countries', 'Countries')}
            </span>
            <span className="text-xl font-bold text-[var(--text-primary)]">—</span>
          </div>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)] pointer-events-none" />
          <Input
            type="text"
            placeholder={t('onboarding.searchOrg', 'Search organizations...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 h-12 text-base bg-[var(--card)] border-[var(--border)] focus:border-[var(--primary)] focus:ring-[var(--primary)]/20 transition-all"
          />
        </div>

        <div className="space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <ShieldLoader size="md" variant="inline" />
            </div>
          ) : error ? (
            <Card variant="subtle">
              <CardContent className="py-10 text-center">
                <p className="text-[var(--destructive)] mb-2">
                  {t('onboarding.loadError', 'Failed to load organizations')}
                </p>
                <p className="text-xs text-[var(--text-muted)]">{String(error)}</p>
              </CardContent>
            </Card>
          ) : filteredOrgs?.length === 0 ? (
            <Card variant="subtle">
              <CardContent className="py-10 text-center">
                <Search className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3 opacity-50" />
                <p className="text-[var(--text-muted)]">
                  {searchQuery
                    ? t('onboarding.noOrgFound', 'No organizations found matching your search')
                    : t('onboarding.noOrgs', 'No organizations available')}
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredOrgs?.map((org, index) => (
              <Card
                key={org.id}
                className="hover:shadow-md hover:border-[var(--primary)]/30 transition-all duration-200 cursor-pointer group animate-fade-in"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <CardContent className="p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-xl bg-(--button-primary-bg) flex items-center justify-center text-white font-bold text-lg shadow-md group-hover:shadow-lg transition-shadow">
                        {org.logoUrl ? (
                          <img
                            src={org.logoUrl}
                            alt={org.name}
                            className="w-full h-full object-cover rounded-xl"
                          />
                        ) : (
                          org.name.charAt(0).toUpperCase()
                        )}
                      </div>

                      <div>
                        <h3 className="font-semibold text-lg text-[var(--text-primary)] group-hover:text-[var(--primary)] transition-colors">
                          {org.name}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] mt-0.5">
                          <span className="font-medium">@{org.slug}</span>
                          {org.industry && (
                            <>
                              <span className="text-[var(--border)]">•</span>
                              <span>{org.industry}</span>
                            </>
                          )}
                          {org.country && (
                            <>
                              <span className="text-[var(--border)]">•</span>
                              <span>{org.country}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <Button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleRequestJoin(org.id);
                      }}
                      disabled={isRequesting === org.id || !user?.id}
                      className="min-w-[120px] h-10 rounded-lg font-medium"
                    >
                      {isRequesting === org.id ? (
                        <>
                          <ShieldLoader size="xs" variant="inline" />
                          {t('onboarding.sending', 'Sending...')}
                        </>
                      ) : !user?.id ? (
                        <ShieldLoader size="xs" variant="inline" />
                      ) : (
                        <>
                          {t('onboarding.join', 'Join')}
                          <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-[var(--text-muted)]">
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
