'use client';

import { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../../../../convex/_generated/api';
// cspell:disable
import { useAuthStore } from '@/store/useAuthStore';
// cspell:enable
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { CustomSelect } from '@/components/ui/CustomSelect';

export default function SuperadminCreateOrgPage() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const createOrg = useMutation(api.organizations.createOrganization);

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

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading user data...</p>
      </div>
    );
  }

  const isSuperadmin =
    user?.role === 'superadmin' || user?.email?.toLowerCase() === 'romangulanyan@gmail.com';

  if (!isSuperadmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">{t('ui.accessDenied')}</h1>
          <p>{t('ui.onlySuperadminCanAccess')}</p>
          <p className="text-sm mt-2">
            {t('ui.yourEmail')} {user.email} | {t('ui.role')} {user.role}
          </p>
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
      toast.info(`Creating ${formData.name} organization...`);

      await createOrg({
        superadminUserId: user.id as never,
        name: formData.name,
        slug: formData.slug,
        plan: formData.plan,
        timezone: formData.timezone,
        country: formData.country,
        industry: formData.industry,
      });

      toast.success(`Organization "${formData.name}" created successfully!`);
      toast.info(`Admin invitation will be sent to ${formData.adminEmail}`);

      // Reset form
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
      const message = error instanceof Error ? error.message : 'Failed to create organization';
      console.error('Full error:', error);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'var(--background)' }}
    >
      <div className="w-full max-w-2xl">
        <div
          className="rounded-2xl shadow-xl p-4 sm:p-8"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <h1
            className="text-3xl font-bold text-left sm:text-center mb-2"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('superadmin.organizations.createTitle')}
          </h1>
          <p className="text-left sm:text-center mb-8" style={{ color: 'var(--text-secondary)' }}>
            {t('superadmin.organizations.createSubtitle')}
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Organization Name */}
              <div>
                <label
                  className="block text-sm font-semibold mb-2"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {t('superadmin.organizations.nameLabel')}
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-400"
                  style={{
                    background: 'var(--background-subtle)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                  }}
                  placeholder={t('placeholders.acmeCorp')}
                  required
                />
              </div>

              {/* Slug */}
              <div>
                <label
                  className="block text-sm font-semibold mb-2"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {t('superadmin.organizations.slugLabel')}
                </label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
                    })
                  }
                  className="w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-400"
                  style={{
                    background: 'var(--background-subtle)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                  }}
                  placeholder={t('placeholders.acmeInc')}
                  required
                />
              </div>

              {/* Admin Email */}
              <div>
                <label
                  className="block text-sm font-semibold mb-2"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {t('superadmin.organizations.adminEmailLabel')}
                </label>
                <input
                  type="email"
                  value={formData.adminEmail}
                  onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-400"
                  style={{
                    background: 'var(--background-subtle)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                  }}
                  placeholder={t('placeholders.enterYourEmail')}
                  required
                />
              </div>

              {/* Plan */}
              <div>
                <label
                  className="block text-sm font-semibold mb-2"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {t('superadmin.organizations.planLabel')}
                </label>
                <CustomSelect
                  value={formData.plan}
                  onChange={(v) =>
                    setFormData({
                      ...formData,
                      plan: v as 'starter' | 'professional' | 'enterprise',
                    })
                  }
                  fullWidth
                  options={[
                    { value: 'starter', label: t('superadmin.organizations.planStarterFree') },
                    {
                      value: 'professional',
                      label: t('superadmin.organizations.planProfessionalPaid'),
                    },
                    {
                      value: 'enterprise',
                      label: t('superadmin.organizations.planEnterpriseCustom'),
                    },
                  ]}
                  triggerClassName="w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-400"
                  dropdownClassName="bg-[var(--background-subtle)] border-[var(--border)] text-[var(--text-primary)]"
                />
              </div>

              {/* Country */}
              <div>
                <label
                  className="block text-sm font-semibold mb-2"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {t('superadmin.organizations.countryLabel')}
                </label>
                <input
                  type="text"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-400"
                  style={{
                    background: 'var(--background-subtle)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                  }}
                  placeholder={t('placeholders.unitedStates')}
                />
              </div>

              {/* Timezone */}
              <div>
                <label
                  className="block text-sm font-semibold mb-2"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {t('superadmin.organizations.timezoneLabel')}
                </label>
                <CustomSelect
                  value={formData.timezone}
                  onChange={(v) => setFormData({ ...formData, timezone: v })}
                  fullWidth
                  options={[
                    { value: 'UTC', label: 'UTC' },
                    { value: 'America/New_York', label: 'Eastern Time' },
                    { value: 'America/Chicago', label: 'Central Time' },
                    { value: 'America/Los_Angeles', label: 'Pacific Time' },
                    { value: 'Europe/London', label: 'London' },
                    { value: 'Europe/Paris', label: 'Paris' },
                    { value: 'Asia/Tokyo', label: 'Tokyo' },
                    { value: 'Asia/Yerevan', label: 'Yerevan' },
                  ]}
                  triggerClassName="w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-400"
                  dropdownClassName="bg-[var(--background-subtle)] border-[var(--border)] text-[var(--text-primary)]"
                />
              </div>
            </div>

            {/* Industry */}
            <div>
              <label
                className="block text-sm font-semibold mb-2"
                style={{ color: 'var(--text-primary)' }}
              >
                {t('superadmin.organizations.industryLabel')}
              </label>
              <input
                type="text"
                value={formData.industry}
                onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-400"
                style={{
                  background: 'var(--background-subtle)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                }}
                placeholder={t('placeholders.technologyHealthcare')}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-linear-to-r from-(--primary) to-(--primary-dark,var(--primary)) hover:opacity-90 transition-all py-3 px-4 text-white font-semibold rounded-xl disabled:opacity-50"
            >
              {loading
                ? t('superadmin.organizations.creating')
                : t('superadmin.organizations.createOrganization')}
            </button>

            <p className="text-xs text-center" style={{ color: 'var(--text-secondary)' }}>
              {t('superadmin.organizations.requiredNotice')}
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
