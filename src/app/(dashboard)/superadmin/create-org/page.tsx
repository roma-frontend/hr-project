'use client';

import { useState } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useCreateOrganization } from '@/hooks/useOrganizations';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ShieldLoader } from '@/components/ui/ShieldLoader';

export default function SuperadminCreateOrgPage() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const router = useRouter();
  const createOrgMutation = useCreateOrganization();

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    plan: 'starter' as 'starter' | 'professional' | 'enterprise',
    timezone: 'UTC',
    country: '',
    industry: '',
    adminEmail: '',
  });

  const isSuperadmin =
    user?.role === 'superadmin' || user?.email?.toLowerCase() === 'romangulanyan@gmail.com';

  if (!user || !isSuperadmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            {t('ui.accessDenied')}
          </h1>
          <p className="text-muted-foreground">{t('ui.onlySuperadminCanAccess')}</p>
          {user && (
            <p className="text-xs text-muted-foreground mt-2">
              {t('ui.yourEmail')} {user.email} | {t('ui.role')} {user.role}
            </p>
          )}
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.id) {
      toast.error(t('toasts.userIdNotFound'));
      return;
    }

    if (!formData.name || !formData.slug || !formData.adminEmail) {
      toast.error(t('toasts.pleaseFillAllFields'));
      return;
    }

    setLoading(true);

    try {
      toast.info(t('superadmin.creatingOrg', 'Creating {{name}} organization...', { name: formData.name }));

      await createOrgMutation.mutateAsync({
        name: formData.name,
        slug: formData.slug,
        plan: formData.plan,
        timezone: formData.timezone,
        country: formData.country,
        industry: formData.industry,
      });

      toast.success(t('superadmin.orgCreated', 'Organization "{{name}}" created successfully!', { name: formData.name }));
      toast.info(t('superadmin.adminInvitationSent', 'Admin invitation will be sent to {{email}}', { email: formData.adminEmail }));

      setFormData({
        name: '',
        slug: '',
        plan: 'starter',
        timezone: 'UTC',
        country: '',
        industry: '',
        adminEmail: '',
      });
    } catch (error) {
      const message = error instanceof Error ? t('orgCreate.error', { defaultValue: error.message }) : t('orgRequests.createFailed', 'Failed to create organization');
      console.error('Full error:', error);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1
            className="text-3xl font-bold md:text-4xl"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('superadmin.organizations.createTitle')}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {t('superadmin.organizations.createSubtitle')}
          </p>
        </div>

        {/* Form Card */}
        <div className="rounded-xl border" style={{ background: 'var(--card)' }}>
          <form onSubmit={handleSubmit} className="space-y-6 p-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* Organization Name */}
              <div className="space-y-2">
                <label
                  className="text-sm font-medium"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {t('superadmin.organizations.nameLabel')}
                  <span className="text-destructive">*</span>
                </label>
                <Input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t('placeholders.acmeCorp')}
                  required
                />
              </div>

              {/* Slug */}
              <div className="space-y-2">
                <label
                  className="text-sm font-medium"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {t('superadmin.organizations.slugLabel')}
                  <span className="text-destructive">*</span>
                </label>
                <Input
                  type="text"
                  value={formData.slug}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
                    })
                  }
                  placeholder={t('placeholders.acmeInc')}
                  required
                />
              </div>

              {/* Admin Email */}
              <div className="space-y-2">
                <label
                  className="text-sm font-medium"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {t('superadmin.organizations.adminEmailLabel')}
                  <span className="text-destructive">*</span>
                </label>
                <Input
                  type="email"
                  value={formData.adminEmail}
                  onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                  placeholder={t('placeholders.enterYourEmail')}
                  required
                />
              </div>

              {/* Plan */}
              <div className="space-y-2">
                <label
                  className="text-sm font-medium"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {t('superadmin.organizations.planLabel')}
                </label>
                <Select
                  value={formData.plan}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      plan: value as 'starter' | 'professional' | 'enterprise',
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('superadmin.organizations.planLabel')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="starter">
                      {t('superadmin.organizations.planStarterFree')}
                    </SelectItem>
                    <SelectItem value="professional">
                      {t('superadmin.organizations.planProfessionalPaid')}
                    </SelectItem>
                    <SelectItem value="enterprise">
                      {t('superadmin.organizations.planEnterpriseCustom')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Country */}
              <div className="space-y-2">
                <label
                  className="text-sm font-medium"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {t('superadmin.organizations.countryLabel')}
                </label>
                <Input
                  type="text"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  placeholder={t('placeholders.unitedStates')}
                />
              </div>

              {/* Timezone */}
              <div className="space-y-2">
                <label
                  className="text-sm font-medium"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {t('superadmin.organizations.timezoneLabel')}
                </label>
                <Select
                  value={formData.timezone}
                  onValueChange={(value) => setFormData({ ...formData, timezone: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('superadmin.organizations.timezoneLabel')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UTC">{t('superadmin.createOrg.timezoneUTC', 'UTC')}</SelectItem>
                    <SelectItem value="America/New_York">{t('superadmin.createOrg.timezoneET', 'Eastern Time')}</SelectItem>
                    <SelectItem value="America/Chicago">{t('superadmin.createOrg.timezoneCT', 'Central Time')}</SelectItem>
                    <SelectItem value="America/Los_Angeles">{t('superadmin.createOrg.timezonePT', 'Pacific Time')}</SelectItem>
                    <SelectItem value="Europe/London">{t('superadmin.createOrg.timezoneGMT', 'London')}</SelectItem>
                    <SelectItem value="Europe/Paris">{t('superadmin.createOrg.timezoneCET', 'Paris')}</SelectItem>
                    <SelectItem value="Asia/Tokyo">{t('superadmin.createOrg.timezoneJST', 'Tokyo')}</SelectItem>
                    <SelectItem value="Asia/Yerevan">{t('superadmin.createOrg.timezoneAMT', 'Yerevan')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Industry */}
            <div className="space-y-2">
              <label
                className="text-sm font-medium"
                style={{ color: 'var(--text-primary)' }}
              >
                {t('superadmin.organizations.industryLabel')}
              </label>
              <Input
                type="text"
                value={formData.industry}
                onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                placeholder={t('placeholders.technologyHealthcare')}
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                {t('actions.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="min-w-[160px]"
              >
                {loading ? (
                  <>
                    <ShieldLoader size="sm" className="mr-2" />
                    {t('superadmin.organizations.creating')}
                  </>
                ) : (
                  t('superadmin.organizations.createOrganization')
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
