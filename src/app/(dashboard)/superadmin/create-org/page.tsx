"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { useAuthStore } from "@/store/useAuthStore";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

export default function SuperadminCreateOrgPage() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const createOrg = useMutation(api.organizations.createOrganization);

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    plan: "starter" as "starter" | "professional" | "enterprise",
    timezone: "UTC",
    country: "",
    industry: "",
    adminEmail: "",
  });

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading user data...</p>
      </div>
    );
  }

  const isSuperadmin = user?.role === "superadmin" || user?.email?.toLowerCase() === "romangulanyan@gmail.com";
  
  console.log("🔍 [Create Org] User check:", { email: user.email, role: user.role, isSuperadmin });
  
  if (!isSuperadmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">{t('ui.accessDenied')}</h1>
          <p>{t('ui.onlySuperadminCanAccess')}</p>
          <p className="text-sm mt-2">{t('ui.yourEmail')} {user.email} | {t('ui.role')} {user.role}</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.id) {
      toast.error(t("toasts.userIdNotFound"));
      return;
    }

    if (!formData.name || !formData.slug || !formData.adminEmail) {
      toast.error(t("toasts.pleaseFillAllFields"));
      return;
    }

    setLoading(true);
    
    try {
      toast.info(`Creating ${formData.name} organization...`);
      
      const result = await createOrg({
        superadminUserId: user.id as any,
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
        name: "",
        slug: "",
        plan: "starter",
        timezone: "UTC",
        country: "",
        industry: "",
        adminEmail: "",
      });

    } catch (error: any) {
      console.error("Full error:", error);
      toast.error(error.message || "Failed to create organization");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--background)" }}>
      <div className="w-full max-w-2xl">
        <div className="rounded-2xl shadow-xl p-8" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <h1 className="text-3xl font-bold text-center mb-2" style={{ color: "var(--text-primary)" }}>
            🏢 {t('superadmin.organizations.createTitle')}
          </h1>
          <p className="text-center mb-8" style={{ color: "var(--text-secondary)" }}>
            {t('superadmin.organizations.createSubtitle')}
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Organization Name */}
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
                  {t('superadmin.organizations.nameLabel')}
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-400"
                  style={{
                    background: "var(--background-subtle)",
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)"
                  }}
                  placeholder={t('placeholders.acmeCorp')}
                  required
                />
              </div>

              {/* Slug */}
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
                  {t('superadmin.organizations.slugLabel')}
                </label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                  className="w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-400"
                  style={{
                    background: "var(--background-subtle)",
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)"
                  }}
                  placeholder={t('placeholders.acmeInc')}
                  required
                />
              </div>

              {/* Admin Email */}
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
                  {t('superadmin.organizations.adminEmailLabel')}
                </label>
                <input
                  type="email"
                  value={formData.adminEmail}
                  onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-400"
                  style={{
                    background: "var(--background-subtle)",
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)"
                  }}
                  placeholder={t('placeholders.enterYourEmail')}
                  required
                />
              </div>

              {/* Plan */}
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
                  {t('superadmin.organizations.planLabel')}
                </label>
                <select
                  value={formData.plan}
                  onChange={(e) => setFormData({ ...formData, plan: e.target.value as any })}
                  className="w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-400"
                  style={{
                    background: "var(--background-subtle)",
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)"
                  }}
                >
                  <option value="starter">{t('superadmin.organizations.planStarterFree')}</option>
                  <option value="professional">{t('superadmin.organizations.planProfessionalPaid')}</option>
                  <option value="enterprise">{t('superadmin.organizations.planEnterpriseCustom')}</option>
                </select>
              </div>

              {/* Country */}
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
                  {t('superadmin.organizations.countryLabel')}
                </label>
                <input
                  type="text"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-400"
                  style={{
                    background: "var(--background-subtle)",
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)"
                  }}
                  placeholder={t('placeholders.unitedStates')}
                />
              </div>

              {/* Timezone */}
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
                  {t('superadmin.organizations.timezoneLabel')}
                </label>
                <select
                  value={formData.timezone}
                  onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-400"
                  style={{
                    background: "var(--background-subtle)",
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)"
                  }}
                >
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">Eastern Time</option>
                  <option value="America/Chicago">Central Time</option>
                  <option value="America/Los_Angeles">Pacific Time</option>
                  <option value="Europe/London">London</option>
                  <option value="Europe/Paris">Paris</option>
                  <option value="Asia/Tokyo">Tokyo</option>
                  <option value="Asia/Yerevan">Yerevan</option>
                </select>
              </div>
            </div>

            {/* Industry */}
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
                {t('superadmin.organizations.industryLabel')}
              </label>
              <input
                type="text"
                value={formData.industry}
                onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-400"
                style={{
                  background: "var(--background-subtle)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)"
                }}
                placeholder={t('placeholders.technologyHealthcare')}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 text-white font-semibold rounded-xl transition-all disabled:opacity-50 hover:opacity-90"
              style={{ background: "var(--accent-gradient)" }}
            >
              {loading ? t('superadmin.organizations.creating') : t('superadmin.organizations.createOrganization')}
            </button>

            <p className="text-xs text-center" style={{ color: "var(--text-secondary)" }}>
              {t('superadmin.organizations.requiredNotice')}
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
