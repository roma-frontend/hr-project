'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';
import {
  Building2,
  Mail,
  MessageSquare,
  Users,
  ArrowRight,
  CheckCircle,
  ChevronLeft,
  Shield,
  Zap,
  Star,
  Phone,
  Globe,
  Clock,
} from 'lucide-react';
import { ShieldLoader } from '@/components/ui/ShieldLoader';
import Navbar from '@/components/layout/Navbar';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export default function ContactPage() {
  const { t } = useTranslation();

  const TEAM_SIZES = [
    t('contactPage.team1to10'),
    t('contactPage.team11to50'),
    t('contactPage.team51to200'),
    t('contactPage.team201to500'),
    t('contactPage.team500plus'),
  ];

  const ENTERPRISE_FEATURES = [
    { icon: <Users size={18} />, text: t('contactPage.employeesSupported') },
    { icon: <Shield size={18} />, text: t('contactPage.securityReview') },
    { icon: <Zap size={18} />, text: t('contactPage.customIntegrations') },
    { icon: <Star size={18} />, text: t('contactPage.prioritySupport') },
    { icon: <Globe size={18} />, text: t('contactPage.onPremise') },
    { icon: <Clock size={18} />, text: t('contactPage.uptime') },
  ];

  const [form, setForm] = useState({ name: '', email: '', company: '', teamSize: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) {
      setError(t('contactPage.fillAllFields') || t('errors.required'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      await convex.mutation(api.subscriptions.saveContactInquiry, {
        name: form.name,
        email: form.email,
        company: form.company || undefined,
        teamSize: form.teamSize || undefined,
        message: form.message,
        plan: 'enterprise',
      });
      setSent(true);
    } catch (e: any) {
      setError(t('errors.somethingWentWrong'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-background">
      {/* Navbar */}
      <Navbar />

      {/* Background glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-blue-600/8 rounded-full blur-[140px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-indigo-600/8 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-cyan-600/4 rounded-full blur-[160px]" />
      </div>

      {/* Grid pattern */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.05]"
        style={{
          backgroundImage:
            'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-6 mt-12">
        {/* Back link */}
        <Link
          href="/#pricing"
          className="inline-flex items-center gap-2 text-primary/70 hover:text-primary text-sm mb-12 transition-colors group"
        >
          <ChevronLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          {t('contactPage.backToPricing')}
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
          {/* ── Left — Info ─────────────────────────────────────────────────── */}
          <div>
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-cyan-500/20 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 text-xs font-semibold uppercase tracking-widest mb-6">
              <Building2 size={12} />
              {t('contact.enterpriseSupport')}
            </div>

            <h1 className="text-4xl md:text-5xl font-black text-primary leading-tight mb-6">
              {t('contactPage.contactHeader')}
            </h1>

            <p className="text-muted-foreground/80 text-lg leading-relaxed mb-10">
              {t('contactPage.enterpriseSubtitle')}
            </p>

            {/* Features */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-12">
              {ENTERPRISE_FEATURES.map(({ icon, text }) => (
                <div
                  key={text}
                  className="flex items-center gap-3 p-4 rounded-2xl border border-border bg-card/50 backdrop-blur-xl"
                >
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      background:
                        'linear-gradient(135deg, rgba(56,189,248,0.2), rgba(99,102,241,0.1))',
                      border: '1px solid rgba(56,189,248,0.2)',
                      color: '#38bdf8',
                    }}
                  >
                    {icon}
                  </div>
                  <span className="text-muted-foreground text-sm">{text}</span>
                </div>
              ))}
            </div>

            {/* Contact info */}
            <div className="space-y-4">
              <p className="text-muted-foreground/60 text-xs uppercase tracking-widest font-semibold mb-3">
                {t('contactPage.directContact')}
              </p>
              {[
                {
                  icon: <Mail size={15} />,
                  label: 'sales@hroffice.io',
                  href: 'mailto:sales@hroffice.io',
                },
                { icon: <Phone size={15} />, label: '+1 (800) 555-0199', href: 'tel:+18005550199' },
              ].map(({ icon, label, href }) => (
                <a
                  key={label}
                  href={href}
                  className="flex items-center gap-3 text-primary/70 hover:text-primary transition-colors text-sm"
                >
                  <span className="text-primary/50">{icon}</span>
                  {label}
                </a>
              ))}
            </div>
          </div>

          {/* ── Right — Form ─────────────────────────────────────────────────── */}
          <div className="relative">
            {/* Card glow */}
            <div
              className="absolute -inset-1 rounded-3xl blur-xl opacity-15 dark:opacity-20"
              style={{ background: 'linear-gradient(135deg, #38bdf8, #6366f1)' }}
            />

            <div className="relative rounded-3xl border border-border/80 overflow-hidden bg-card/90 dark:bg-card/70 backdrop-blur-xl shadow-xl">
              {/* Top accent */}
              <div
                className="h-[1px]"
                style={{
                  background:
                    'linear-gradient(90deg, transparent, rgba(56,189,248,0.4), rgba(99,102,241,0.4), transparent)',
                }}
              />

              <div className="p-8 md:p-10">
                {sent ? (
                  /* ── Success state ── */
                  <div className="flex flex-col items-center text-center py-8 gap-6">
                    <div className="relative">
                      <div className="absolute inset-0 bg-green-500/20 rounded-full blur-xl scale-150" />
                      <div
                        className="relative w-20 h-20 rounded-full flex items-center justify-center"
                        style={{
                          background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                          boxShadow: '0 16px 48px rgba(34,197,94,0.3)',
                        }}
                      >
                        <CheckCircle size={40} className="text-white" />
                      </div>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-primary mb-2">
                        {t('contactPage.messageSentTitle')}
                      </h2>
                      <p className="text-muted-foreground/80 text-sm leading-relaxed">
                        {t('contactPage.messageSentDesc')}
                      </p>
                    </div>
                    <Link
                      href="/"
                      className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-semibold text-white transition-all hover:scale-105"
                      style={{
                        background: 'linear-gradient(135deg, #38bdf8, #6366f1)',
                        boxShadow: '0 4px 16px rgba(56,189,248,0.15)',
                      }}
                    >
                      {t('ui.backToHome')} <ArrowRight size={15} />
                    </Link>
                  </div>
                ) : (
                  /* ── Form ── */
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                      <h2 className="text-2xl font-bold text-primary mb-1">{t('contact.title')}</h2>
                      <p className="text-muted-foreground/60 text-sm">
                        {t('contactPage.enterpriseSubtitle')}
                      </p>
                    </div>

                    {/* Name + Email */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Field label={t('contact.name') + ' *'} icon={<Users size={14} />}>
                        <input
                          type="text"
                          placeholder={t('placeholders.johnSmith')}
                          required
                          value={form.name}
                          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                          className="w-full bg-transparent text-foreground placeholder-muted-foreground/50 text-sm outline-none font-medium"
                        />
                      </Field>
                      <Field label={t('contact.email') + ' *'} icon={<Mail size={14} />}>
                        <input
                          type="email"
                          placeholder="john@company.com"
                          required
                          value={form.email}
                          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                          className="w-full bg-transparent text-foreground placeholder-muted-foreground/50 text-sm outline-none font-medium"
                        />
                      </Field>
                    </div>

                    {/* Company + Team size */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Field label={t('contact.company')} icon={<Building2 size={14} />}>
                        <input
                          type="text"
                          placeholder={t('placeholders.acmeCorp')}
                          value={form.company}
                          onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                          className="w-full bg-transparent text-foreground placeholder-muted-foreground/50 text-sm outline-none font-medium"
                        />
                      </Field>
                      <Field label={t('contact.teamSize')} icon={<Users size={14} />}>
                        <select
                          value={form.teamSize}
                          onChange={(e) => setForm((f) => ({ ...f, teamSize: e.target.value }))}
                          className="w-full bg-transparent text-foreground text-sm outline-none appearance-none cursor-pointer font-medium"
                        >
                          <option value="" disabled className="bg-background text-muted-foreground">
                            {t('contactPage.selectTeamSize')}
                          </option>
                          {TEAM_SIZES.map((s) => (
                            <option key={s} value={s} className="bg-background text-foreground">
                              {s}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>

                    {/* Message */}
                    <Field label={t('contact.message') + ' *'} icon={<MessageSquare size={14} />}>
                      <textarea
                        placeholder={t('contactPage.requirementsPlaceholder')}
                        required
                        rows={4}
                        value={form.message}
                        onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                        className="w-full bg-transparent text-foreground placeholder-muted-foreground/50 text-sm outline-none resize-none font-medium min-h-[100px]"
                      />
                    </Field>

                    {error && (
                      <p className="text-destructive text-sm flex items-center gap-2">
                        <span className="w-1 h-1 rounded-full bg-destructive flex-shrink-0" />
                        {error}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-4 rounded-2xl font-bold text-white text-sm flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                      style={{
                        background: 'linear-gradient(135deg, #38bdf8, #6366f1)',
                        boxShadow: '0 4px 16px rgba(56,189,248,0.15)',
                      }}
                    >
                      {loading ? (
                        <ShieldLoader size="xs" variant="inline" />
                      ) : (
                        <>
                          <MessageSquare size={16} />
                          {t('contact.sendMessage')}
                          <ArrowRight size={16} />
                        </>
                      )}
                    </button>

                    <p className="text-center text-muted-foreground/50 text-xs flex items-center justify-center gap-1.5">
                      <Shield size={11} />
                      {t('contact.securityNotice')}
                    </p>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Field wrapper ─────────────────────────────────────────────────────────────
function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-foreground text-xs font-medium mb-2">
        <span className="text-foreground/80">{icon}</span>
        {label}
      </label>
      <div className="px-4 py-3 rounded-xl border border-border/60 bg-background/50 focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/10 focus-within:bg-background transition-all shadow-sm">
        {children}
      </div>
    </div>
  );
}
