'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
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
  Send,
} from 'lucide-react';
import { ShieldLoader } from '@/components/ui/ShieldLoader';
import Navbar from '@/components/layout/Navbar';

export default function ContactClient() {
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

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) {
      setError(t('contactPage.fillAllFields') || t('errors.required'));
      return;
    }
    if (!validateEmail(form.email)) {
      setError(t('errors.invalidEmail'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          company: form.company || undefined,
          teamSize: form.teamSize || undefined,
          message: form.message,
          plan: 'enterprise',
        }),
      });

      if (!res.ok) throw new Error(t('contact.failedToSubmit', 'Failed to submit inquiry'));
      setSent(true);
    } catch (_e) {
      setError(t('errors.somethingWentWrong'));
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (error) setError('');
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--landing-bg)' }}>
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes gentleGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(56, 189, 248, 0); }
          50% { box-shadow: 0 0 20px 2px rgba(56, 189, 248, 0.08); }
        }
        .badge-shimmer {
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
          animation: shimmer 4s ease-in-out infinite;
        }
        .pulse-dot {
          animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        .contact-fade-in {
          animation: fadeIn 0.9s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          opacity: 0;
        }
        .delay-100 { animation-delay: 0.1s; }
        .delay-200 { animation-delay: 0.2s; }
        .delay-300 { animation-delay: 0.3s; }
        .delay-400 { animation-delay: 0.4s; }
        .delay-500 { animation-delay: 0.5s; }
        .delay-600 { animation-delay: 0.6s; }
        
        .feature-item {
          transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .feature-item:hover {
          transform: translateX(4px);
        }
        .feature-item:hover .feature-icon {
          background: linear-gradient(135deg, rgba(56,189,248,0.15), rgba(99,102,241,0.1));
          border-color: rgba(56,189,248,0.3);
          box-shadow: 0 0 16px rgba(56,189,248,0.12);
        }
        .feature-item:hover .feature-text {
          color: var(--landing-text-primary);
        }
        .feature-icon {
          transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .feature-text {
          transition: color 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        }
        
        .contact-link {
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .contact-link:hover {
          opacity: 1 !important;
          transform: translateX(2px);
        }
        .contact-link:hover .contact-link-icon {
          color: var(--primary);
        }
        .contact-link-icon {
          transition: color 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        
        .back-link {
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .back-link:hover {
          color: var(--landing-text-secondary) !important;
        }
        .back-link:hover .back-link-icon {
          transform: translateX(-3px);
        }
        .back-link:hover .back-link-text {
          opacity: 1 !important;
        }
        .back-link-icon {
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .back-link-text {
          transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        
        .form-card {
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        html:not(.dark) .form-card {
          background: rgba(255, 255, 255, 0.9) !important;
          border: 1px solid rgba(37, 99, 235, 0.2) !important;
          box-shadow: 0 4px 24px rgba(37, 99, 235, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04);
        }
        html.dark .form-card {
          background: rgba(13, 30, 56, 0.7) !important;
          border: 1px solid rgba(56, 189, 248, 0.2) !important;
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(56, 189, 248, 0.05);
        }
        .form-card:hover {
          transform: translateY(-1px);
        }
        html:not(.dark) .form-card:hover {
          border-color: rgba(37, 99, 235, 0.35) !important;
          box-shadow: 0 8px 32px rgba(37, 99, 235, 0.12), 0 2px 4px rgba(0, 0, 0, 0.06);
        }
        html.dark .form-card:hover {
          border-color: rgba(56, 189, 248, 0.35) !important;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(56, 189, 248, 0.1);
        }
        
        .field-wrapper {
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        html:not(.dark) .field-wrapper {
          background: #ffffff !important;
          border: 1.5px solid rgba(37, 99, 235, 0.2) !important;
        }
        html.dark .field-wrapper {
          background: rgba(17, 35, 68, 0.8) !important;
          border: 1.5px solid rgba(56, 189, 248, 0.2) !important;
        }
        html:not(.dark) .field-wrapper:hover {
          border-color: rgba(37, 99, 235, 0.45) !important;
          background: #f0f6ff !important;
        }
        html.dark .field-wrapper:hover {
          border-color: rgba(56, 189, 248, 0.4) !important;
          background: rgba(17, 35, 68, 0.95) !important;
        }
        html:not(.dark) .field-wrapper:focus-within {
          border-color: rgba(37, 99, 235, 0.7) !important;
          background: #ffffff !important;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }
        html.dark .field-wrapper:focus-within {
          border-color: rgba(56, 189, 248, 0.6) !important;
          background: rgba(17, 35, 68, 1) !important;
          box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.15);
        }
        
        .submit-btn {
          transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .submit-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(56,189,248,0.25);
        }
        .submit-btn:active:not(:disabled) {
          transform: translateY(0);
        }
        
        .home-btn {
          transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .home-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(56,189,248,0.25);
        }
      `}</style>

      <Navbar />

      <div className="relative flex flex-col items-center text-center px-6 min-h-screen justify-start">
        {/* Back link */}
        <div className="w-full max-w-5xl pt-16 pb-10 contact-fade-in">
          <Link
            href="/#pricing"
            className="back-link inline-flex items-center gap-2 text-sm"
            style={{ color: 'var(--landing-text-muted)' }}
          >
            <ChevronLeft size={16} className="back-link-icon" />
            <span className="back-link-text" style={{ opacity: 0.7 }}>
              {t('contactPage.backToPricing')}
            </span>
          </Link>
        </div>

        {/* Badge */}
        <div className="contact-fade-in delay-100 relative inline-flex items-center gap-2 px-5 py-2.5 rounded-full backdrop-blur-sm mb-8 overflow-hidden"
          style={{
            border: '1px solid var(--landing-card-border)',
            background: 'var(--landing-card-bg)',
          }}
        >
          <div className="badge-shimmer absolute inset-0" />
          <div
            className="w-1.5 h-1.5 rounded-full pulse-dot"
            style={{ backgroundColor: 'var(--primary)' }}
          />
          <span
            className="relative text-xs font-bold tracking-[0.2em] uppercase"
            style={{ color: 'var(--landing-text-muted)' }}
          >
            {t('contact.enterpriseSupport')}
          </span>
        </div>

        {/* Title */}
        <h1 className="contact-fade-in delay-200 relative mb-6">
          <span
            className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-none"
            style={{ color: 'var(--landing-text-primary)' }}
          >
            {t('contactPage.contactHeader')}
          </span>
          <div
            className="absolute -bottom-4 left-1/2 -translate-x-1/2 h-[2px] w-24"
            style={{
              background: 'linear-gradient(to right, transparent, var(--primary), transparent)',
            }}
          />
        </h1>

        {/* Subtitle */}
        <p className="contact-fade-in delay-300 max-w-xl text-base md:text-lg leading-relaxed font-light mb-16"
          style={{ color: 'var(--landing-text-secondary)' }}
        >
          {t('contactPage.enterpriseSubtitle')}
        </p>

        {/* Main content grid */}
        <div className="contact-fade-in delay-400 w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          {/* Left column - features */}
          <div className="space-y-10">
            {/* Enterprise features */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {ENTERPRISE_FEATURES.map(({ icon, text }) => (
                <div
                  key={text}
                  className="feature-item flex items-start gap-3"
                >
                  <div
                    className="feature-icon w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                    style={{
                      background: 'linear-gradient(135deg, rgba(56,189,248,0.1), rgba(99,102,241,0.05))',
                      border: '1px solid rgba(56,189,248,0.15)',
                      color: 'var(--primary)',
                    }}
                  >
                    {icon}
                  </div>
                  <span className="feature-text text-sm leading-relaxed pt-1.5" style={{ color: 'var(--landing-text-secondary)' }}>
                    {text}
                  </span>
                </div>
              ))}
            </div>

            {/* Direct contact */}
            <div className="space-y-4 pt-8" style={{ borderTop: '1px solid var(--landing-card-border)' }}>
              <p className="text-xs uppercase tracking-[0.2em] font-semibold"
                style={{ color: 'var(--landing-text-muted)' }}
              >
                {t('contactPage.directContact')}
              </p>
              <div className="space-y-3">
                <a
                  href="mailto:sales@hroffice.io"
                  className="contact-link flex items-center gap-3 text-sm"
                  style={{ color: 'var(--landing-text-secondary)', opacity: 0.8 }}
                >
                  <Mail size={15} className="contact-link-icon" />
                  <span>sales@hroffice.io</span>
                </a>
                <a
                  href="tel:+18005550199"
                  className="contact-link flex items-center gap-3 text-sm"
                  style={{ color: 'var(--landing-text-secondary)', opacity: 0.8 }}
                >
                  <Phone size={15} className="contact-link-icon" />
                  <span>+1 (800) 555-0199</span>
                </a>
              </div>
            </div>
          </div>

          {/* Right column - form */}
          <div>
            <div
              className="form-card rounded-2xl overflow-hidden"
            >
              <div
                className="h-px"
                style={{
                  background: 'linear-gradient(90deg, transparent, var(--primary), transparent)',
                  opacity: 0.3,
                }}
              />

              <div className="p-8 md:p-10">
                {sent ? (
                  <div className="flex flex-col items-center text-center py-10 gap-6 contact-fade-in">
                    <div className="relative">
                      <div
                        className="absolute inset-0 rounded-full blur-xl scale-150"
                        style={{ backgroundColor: 'var(--primary)', opacity: 0.1 }}
                      />
                      <div
                        className="relative w-16 h-16 rounded-full flex items-center justify-center"
                        style={{
                          background: 'var(--primary)',
                          boxShadow: '0 16px 48px rgba(0,0,0,0.1)',
                        }}
                      >
                        <CheckCircle size={32} className="text-white" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-xl font-bold" style={{ color: 'var(--landing-text-primary)' }}>
                        {t('contactPage.messageSentTitle')}
                      </h2>
                      <p className="text-sm leading-relaxed" style={{ color: 'var(--landing-text-secondary)' }}>
                        {t('contactPage.messageSentDesc')}
                      </p>
                    </div>
                    <Link
                      href="/"
                      className="home-btn flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white text-white"
                      style={{
                        background: 'var(--primary)',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                      }}
                    >
                      {t('ui.backToHome')} <ArrowRight size={15} />
                    </Link>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-5 contact-fade-in delay-200">
                    <div className="mb-6">
                      <h2 className="text-xl font-bold" style={{ color: 'var(--landing-text-primary)' }}>
                        {t('contact.title')}
                      </h2>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <Field label={t('contact.name') + ' *'} icon={<Users size={14} />}>
                        <input
                          type="text"
                          placeholder={t('placeholders.johnSmith')}
                          required
                          value={form.name}
                          onChange={(e) => handleInputChange('name', e.target.value)}
                          className="w-full bg-transparent text-sm outline-none placeholder:opacity-50 py-1 text-(--landing-text-primary)"
                        />
                      </Field>
                      <Field label={t('contact.email') + ' *'} icon={<Mail size={14} />}>
                        <input
                          type="email"
                          placeholder={t('placeholders.emailExample')}
                          required
                          value={form.email}
                          onChange={(e) => handleInputChange('email', e.target.value)}
                          className="w-full bg-transparent text-sm outline-none laceholder:opacity-50p py-1 text-(--landing-text-primary)"
                        />
                      </Field>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <Field label={t('contact.company')} icon={<Building2 size={14} />}>
                        <input
                          type="text"
                          placeholder={t('placeholders.acmeCorp')}
                          value={form.company}
                          onChange={(e) => handleInputChange('company', e.target.value)}
                          className="w-full bg-transparent text-sm outline-none placeholder:opacity-50 py-1 text-(--landing-text-primary)"
                        />
                      </Field>
                      <Field label={t('contact.teamSize')} icon={<Users size={14} />}>
                        <select
                          value={form.teamSize}
                          onChange={(e) => handleInputChange('teamSize', e.target.value)}
                          className="w-full bg-transparent text-sm outline-none appearance-none cursor-pointer py-1 text-(--landing-text-primary)"
                        >
                          <option value="" disabled style={{ background: 'var(--landing-card-bg)' }}>
                            {t('contactPage.selectTeamSize')}
                          </option>
                          {TEAM_SIZES.map((s) => (
                            <option key={s} value={s} style={{ background: 'var(--landing-card-bg)' }}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>

                    <Field label={t('contact.message') + ' *'} icon={<MessageSquare size={14} />}>
                      <textarea
                        placeholder={t('contactPage.requirementsPlaceholder')}
                        required
                        rows={4}
                        value={form.message}
                        onChange={(e) => handleInputChange('message', e.target.value)}
                        className="w-full bg-transparent text-sm outline-none resize-none placeholder:opacity-50 py-1"
                        style={{
                          color: 'var(--landing-text-primary)',
                        }}
                      />
                    </Field>

                    {error && (
                      <p className="text-sm flex items-center gap-2" style={{ color: '#ef4444' }}>
                        <span className="w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: '#ef4444' }} />
                        {error}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className="submit-btn w-full py-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-white"
                      style={{
                        background: 'var(--primary)',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                      }}
                    >
                      {loading ? (
                        <ShieldLoader size="xs" variant="inline" />
                      ) : (
                        <>
                          <Send size={16} />
                          {t('contact.sendMessage')}
                        </>
                      )}
                    </button>

                    <p className="text-center text-xs flex items-center justify-center gap-1.5 pt-3"
                      style={{ color: 'var(--landing-text-muted)', opacity: 0.6 }}
                    >
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
      <label className="flex items-center gap-2 text-xs font-medium mb-3"
        style={{ color: 'var(--landing-text-secondary)' }}
      >
        <span style={{ opacity: 0.7 }}>{icon}</span>
        {label}
      </label>
      <div
        className="field-wrapper px-5 py-4 rounded-xl"
      >
        {children}
      </div>
    </div>
  );
}
