'use client';

import { useAuthStore } from '@/store/useAuthStore';
import { useRouter, useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Save, ArrowLeft } from 'lucide-react';
import { ShieldLoader } from '@/components/ui/ShieldLoader';
import { toast } from 'sonner';
import {
  useOrganizationById,
  useUpdateOrganization,
} from '@/hooks/useOrganizations';

export default function EditOrganizationPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams();
  const { user } = useAuthStore();
  const orgId = params.id as string;
  const isSuperadmin =
    user?.role === 'superadmin' || user?.email?.toLowerCase() === 'romangulanyan@gmail.com';

  const isOwnOrganization = user?.organizationId === orgId;
  const canAccess = isSuperadmin || (user?.role === 'admin' && isOwnOrganization);

  const { data: organization, isLoading: loadingOrg } = useOrganizationById(
    orgId,
    user?.id || ''
  );

  const updateOrgMutation = useUpdateOrganization();

  const [formData, setFormData] = useState({
    name: '',
    plan: 'starter' as 'starter' | 'professional' | 'enterprise',
    isActive: true,
    timezone: 'UTC',
    country: '',
    industry: '',
  });

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (organization) {
      setFormData({
        name: organization.name,
        plan: organization.plan,
        isActive: organization.is_active,
        timezone: organization.timezone || 'UTC',
        country: organization.country || '',
        industry: organization.industry || '',
      });
    }
  }, [organization]);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    if (!isSuperadmin && !canAccess) {
      router.push('/dashboard');
    }
  }, [user, isSuperadmin, canAccess, router]);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <ShieldLoader size="lg" />
      </div>
    );
  }

  if (!isSuperadmin && !canAccess) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">{t('ui.accessDenied')}</h1>
          <p className="text-muted-foreground">{t('editOrg.onlyOwnOrganization', 'You can only manage your own organization')}</p>
          <p className="text-xs text-muted-foreground mt-2">
            {t('common.superadmin')}: {user.role} | {t('common.organization')}: {user.organizationId} | {t('common.requestedBy')}: {orgId}
          </p>
        </div>
      </div>
    );
  }

  if (loadingOrg) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <ShieldLoader size="lg" />
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">{t('superadmin.organizations.notFound', 'Organization')} {t('common.notFound', 'Not Found')}</h1>
          <p className="text-muted-foreground">{t('common.noOrgFound')}</p>
          <button
            onClick={() => router.push('/superadmin/organizations')}
            className="mt-4 px-4 py-2 rounded-lg bg-primary text-white"
          >
            {t('ui.backToOrganizations')}
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await updateOrgMutation.mutateAsync({
        organizationId: orgId,
        name: formData.name,
        plan: formData.plan,
        isActive: formData.isActive,
        timezone: formData.timezone,
        country: formData.country || undefined,
        industry: formData.industry || undefined,
      });

      toast.success(t('toasts.orgUpdated'));
      router.push('/superadmin/organizations');
    } catch (error) {
      console.error('Failed to update organization:', error);
      toast.error(error instanceof Error ? t('orgEdit.error', { defaultValue: error.message }) : t('toasts.orgUpdateFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-6" style={{ background: 'var(--background)' }}>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-4 mb-6 bg-(--background)/95 backdrop-blur supports-[backdrop-filter]:bg-(--background)/60 border-b border-(--border)">
          <div className="mb-8">
            <button
              onClick={() => router.push('/superadmin/organizations')}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-4 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              {t('ui.backToOrganizations')}
            </button>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-linear-to-r from-(--primary) to-(--primary-dark,var(--primary)) hover:opacity-90 transition-opacity text-white">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
                  {t('organization.editPageTitle')}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {t('organization.slugLabel')}:{' '}
                  <span className="font-mono">{organization.slug}</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="p-6 rounded-xl border space-y-6 animate-fade-in"
          style={{ background: 'var(--card)' }}
        >
          {/* Organization Name */}
          <div>
            <label
              className="block text-sm font-medium mb-2"
              style={{ color: 'var(--text-primary)' }}
            >
              {t('organization.nameLabel')} *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2.5 rounded-lg border outline-none transition-all"
              style={{
                background: 'var(--input)',
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
              }}
              placeholder={t('placeholders.auraMedicalCenter')}
            />
          </div>

          {/* Plan */}
          <div>
            <label
              className="block text-sm font-medium mb-2"
              style={{ color: 'var(--text-primary)' }}
            >
              {t('organization.planLabel')} *
            </label>
            <select
              required
              value={formData.plan}
              onChange={(e) => setFormData({ ...formData, plan: e.target.value as any })}
              className="w-full px-4 py-2.5 rounded-lg border outline-none transition-all"
              style={{
                background: 'var(--input)',
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="starter">{t('organization.planStarter')}</option>
              <option value="professional">{t('organization.planProfessional')}</option>
              <option value="enterprise">{t('organization.planEnterprise')}</option>
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <div>
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {t('organization.statusLabel')}
                </span>
                <p className="text-xs text-muted-foreground">
                  {t('organization.statusActiveDesc')}
                </p>
              </div>
            </label>
          </div>

          {/* Timezone */}
          <div>
            <label
              className="block text-sm font-medium mb-2"
              style={{ color: 'var(--text-primary)' }}
            >
              {t('organization.timezoneLabel')}
            </label>
            <select
              value={formData.timezone}
              onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
              className="w-full px-4 py-2.5 rounded-lg border outline-none transition-all"
              style={{
                background: 'var(--input)',
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="UTC">{t('organization.timezoneUTC')}</option>
              <option value="America/New_York">{t('organization.timezoneET')}</option>
              <option value="America/Chicago">{t('organization.timezoneCT')}</option>
              <option value="America/Denver">{t('organization.timezoneMT')}</option>
              <option value="America/Los_Angeles">{t('organization.timezonePT')}</option>
              <option value="Europe/London">{t('organization.timezoneGMT')}</option>
              <option value="Europe/Paris">{t('organization.timezoneCET')}</option>
              <option value="Asia/Dubai">{t('organization.timezoneGST')}</option>
              <option value="Asia/Tokyo">{t('organization.timezoneJST')}</option>
              <option value="Australia/Sydney">{t('organization.timezoneAEST')}</option>
            </select>
          </div>

          {/* Country */}
          <div>
            <label
              className="block text-sm font-medium mb-2"
              style={{ color: 'var(--text-primary)' }}
            >
              {t('organization.countryLabel')}
            </label>
            <input
              type="text"
              value={formData.country}
              onChange={(e) => setFormData({ ...formData, country: e.target.value })}
              className="w-full px-4 py-2.5 rounded-lg border outline-none transition-all"
              style={{
                background: 'var(--input)',
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
              }}
              placeholder={t('placeholders.unitedStates')}
            />
          </div>

          {/* Industry */}
          <div>
            <label
              className="block text-sm font-medium mb-2"
              style={{ color: 'var(--text-primary)' }}
            >
              {t('organization.industryLabel')}
            </label>
            <input
              type="text"
              value={formData.industry}
              onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
              className="w-full px-4 py-2.5 rounded-lg border outline-none transition-all"
              style={{
                background: 'var(--input)',
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
              }}
              placeholder={t('placeholders.healthcareTechnology')}
            />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-muted/30">
            <div>
              <p className="text-xs text-muted-foreground">{t('organization.totalEmployees')}</p>
              <p className="text-lg font-semibold">
                {(organization as any).totalEmployees || organization.employeeCount || 0}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('organization.activeEmployees')}</p>
              <p className="text-lg font-semibold text-green-600">
                {(organization as any).activeEmployees || organization.employeeCount || 0}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => router.push('/superadmin/organizations')}
              className="flex-1 px-6 py-2.5 rounded-lg border font-semibold transition-all hover:bg-muted"
              style={{ borderColor: 'var(--border)' }}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-6 py-2.5 rounded-lg font-semibold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-50 bg-linear-to-r from-(--primary) to-(--primary-dark,var(--primary)) hover:opacity-90 transition-opacity text-white"
            >
              {isLoading ? (
                <>
                  <ShieldLoader size="xs" variant="inline" />
                  {t('buttons.saving')}
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {t('buttons.saveChanges')}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
