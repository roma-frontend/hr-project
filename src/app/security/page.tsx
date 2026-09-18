import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { getServerTranslation } from '@/lib/i18n/server-translation';
import PublicPageShell from '@/components/landing/PublicPageShell';

/**
 * Public trust & security page.
 *
 * Copy discipline: every claim on this page maps to a capability that actually
 * ships (RBAC hierarchy, audit logs with IP, GDPR toolkit, SSO/SCIM, AI
 * guardrails + request logs, backups, WebAuthn/passkeys, e-signatures).
 * Certifications are listed as "in progress" — never claimed as held — until
 * a real audit certificate exists to link.
 */
export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const locale = cookieStore.get('i18nextLng')?.value || 'en';
  const { t } = await getServerTranslation('landing', locale);

  return {
    title: t('security.metaTitle'),
    description: t('security.metaDescription'),
  };
}

export default async function SecurityPage() {
  const cookieStore = await cookies();
  const locale = cookieStore.get('i18nextLng')?.value || 'en';
  const { t } = await getServerTranslation('landing', locale);

  const practices = [
    {
      title: t('security.encryptionTitle'),
      body: t('security.encryptionBody'),
    },
    {
      title: t('security.rbacTitle'),
      body: t('security.rbacBody'),
    },
    {
      title: t('security.auditTitle'),
      body: t('security.auditBody'),
    },
    {
      title: t('security.ssoTitle'),
      body: t('security.ssoBody'),
    },
    {
      title: t('security.aiTitle'),
      body: t('security.aiBody'),
    },
    {
      title: t('security.backupsTitle'),
      body: t('security.backupsBody'),
    },
    {
      title: t('security.dataRightsTitle'),
      body: t('security.dataRightsBody'),
    },
    {
      title: t('security.esignTitle'),
      body: t('security.esignBody'),
    },
  ];

  const certifications = [
    {
      name: t('security.soc2Name'),
      status: t('security.statusPlanned'),
      note: t('security.soc2Note'),
    },
    {
      name: t('security.isoName'),
      status: t('security.statusPlanned'),
      note: t('security.isoNote'),
    },
    {
      name: t('security.gdprName'),
      status: t('security.statusCompliant'),
      note: t('security.gdprNote'),
    },
  ];

  return (
    <PublicPageShell language={locale}>
      <div className="max-w-4xl mx-auto px-6 pb-16">
        {/* Hero */}
        <div className="mb-14">
          <span
            className="text-xs font-semibold uppercase tracking-widest"
            style={{ color: 'var(--primary)' }}
          >
            {t('security.eyebrow')}
          </span>
          <h1
            className="text-4xl font-black mt-2 mb-4"
            style={{ color: 'var(--landing-text-primary)' }}
          >
            {t('security.title')}
          </h1>
          <p
            className="text-lg leading-relaxed"
            style={{ color: 'var(--landing-text-secondary)', opacity: 0.85 }}
          >
            {t('security.subtitle')}
          </p>
        </div>

        {/* Practices grid */}
        <div className="grid md:grid-cols-2 gap-6 mb-16">
          {practices.map((p) => (
            <div
              key={p.title}
              className="rounded-2xl border p-6"
              style={{
                borderColor: 'var(--landing-card-border)',
                background: 'var(--landing-card-bg)',
              }}
            >
              <h2
                className="text-base font-bold mb-2"
                style={{ color: 'var(--landing-text-primary)' }}
              >
                {p.title}
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--landing-text-muted)' }}>
                {p.body}
              </p>
            </div>
          ))}
        </div>

        {/* Certifications roadmap */}
        <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--landing-text-primary)' }}>
          {t('security.certificationsTitle')}
        </h2>
        <div className="space-y-4 mb-16">
          {certifications.map((c) => (
            <div
              key={c.name}
              className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 rounded-xl border p-4"
              style={{ borderColor: 'var(--landing-card-border)' }}
            >
              <div className="flex-1">
                <p className="font-semibold" style={{ color: 'var(--landing-text-primary)' }}>
                  {c.name}
                </p>
                <p className="text-sm" style={{ color: 'var(--landing-text-muted)' }}>
                  {c.note}
                </p>
              </div>
              <span
                className="text-xs px-2.5 py-1 rounded-full whitespace-nowrap font-medium"
                style={{
                  background:
                    c.status === t('security.statusCompliant')
                      ? 'var(--success-bg, #dcfce7)'
                      : 'var(--surface-2)',
                  color:
                    c.status === t('security.statusCompliant')
                      ? 'var(--success, #16a34a)'
                      : 'var(--text-muted)',
                }}
              >
                {c.status}
              </span>
            </div>
          ))}
        </div>

        {/* Sub-processors / data hosting */}
        <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--landing-text-primary)' }}>
          {t('security.infrastructureTitle')}
        </h2>
        <p
          className="text-sm leading-relaxed mb-3"
          style={{ color: 'var(--landing-text-secondary)', opacity: 0.85 }}
        >
          {t('security.infrastructureBody')}
        </p>
        <ul
          className="text-sm leading-relaxed space-y-1.5 mb-16 list-disc pl-5"
          style={{ color: 'var(--landing-text-muted)' }}
        >
          <li>{t('security.infraConvex')}</li>
          <li>{t('security.infraVercel')}</li>
          <li>{t('security.infraCloudinary')}</li>
          <li>{t('security.infraLivekit')}</li>
        </ul>

        {/* Responsible disclosure */}
        <div
          className="rounded-2xl border p-6"
          style={{
            borderColor: 'var(--landing-card-border)',
            background: 'var(--landing-card-bg)',
          }}
        >
          <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--landing-text-primary)' }}>
            {t('security.disclosureTitle')}
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--landing-text-muted)' }}>
            {t('security.disclosureBody')}{' '}
            <Link href="/contact" className="underline" style={{ color: 'var(--primary)' }}>
              {t('security.disclosureLink')}
            </Link>
          </p>
        </div>

        {/*
          Trust Center. The subprocessor register, the DPA and the SLA live on
          their own pages so procurement can link to them directly instead of
          citing this summary — and so a change to the register does not mean
          editing the security page too.
        */}
        <div className="mt-16">
          <h2
            className="text-lg font-semibold mb-3"
            style={{ color: 'var(--landing-text-primary)' }}
          >
            {t('security.trustCenterTitle')}
          </h2>
          <p className="text-sm mb-6" style={{ color: 'var(--landing-text-muted)' }}>
            {t('security.trustCenterBody')}
          </p>
          <div className="flex flex-wrap gap-3">
            {[
              { href: '/subprocessors', label: t('security.trustSubprocessors') },
              { href: '/dpa', label: t('security.trustDpa') },
              { href: '/sla', label: t('security.trustSla') },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg border px-4 py-2 text-sm font-medium"
                style={{
                  borderColor: 'var(--landing-card-border)',
                  color: 'var(--landing-text-primary)',
                }}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </PublicPageShell>
  );
}
