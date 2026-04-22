'use client';

import { useTranslation } from 'react-i18next';
import React, { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from '@/lib/cssMotion';
import { ShieldLoader } from '@/components/ui/ShieldLoader';
import {
  User,
  Phone,
  AlertCircle,
  Building2,
  CheckCircle2,
  Search,
  ChevronRight,
  ArrowLeft,
  X,
  Sparkles,
  Users,
} from 'lucide-react';
import { registerAction } from '@/actions/auth';
import { useAuthStore } from '@/store/useAuthStore';
import { toast } from 'sonner';
import { I18nProvider } from '@/components/I18nProvider';
import { SmartEmailInput } from '@/components/auth/SmartEmailInput';
import { SmartPasswordInput } from '@/components/auth/SmartPasswordInput';
import { SmartErrorMessage, parseAuthError } from '@/components/auth/SmartErrorMessage';
import { useSearchOrganizations } from '@/hooks/useOrganizations';

interface OrgResult {
  id: string;
  name: string;
  slug: string;
  industry?: string;
  plan: string;
}

interface RegisterActionResult {
  success: boolean;
  role: 'superadmin' | 'admin' | 'supervisor' | 'employee' | 'driver';
  needsApproval: boolean;
  message?: string;
  userId?: string;
  name?: string;
  email?: string;
  department?: string;
  position?: string;
  employeeType?: string;
  avatar?: string;
}

type Step = 'org' | 'details';

function OrgSearch({ onSelect }: { onSelect: (org: OrgResult) => void }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selected, setSelected] = useState<OrgResult | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 350);
    return () => clearTimeout(t);
  }, [query]);

  const { data: results } = useSearchOrganizations(debouncedQuery, debouncedQuery.length >= 2);

  const handleSelect = (org: OrgResult) => {
    setSelected(org);
    setQuery(org.name);
    onSelect(org);
  };

  const handleClear = () => {
    setSelected(null);
    setQuery('');
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-(--text-muted)" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (selected) setSelected(null);
          }}
          placeholder={t('placeholders.searchYourOrganization')}
          className="w-full pl-10 pr-10 py-2.5 rounded-xl border text-sm outline-none transition-all"
          style={{
            background: 'var(--input)',
            borderColor: selected ? '#10b981' : 'var(--border)',
            color: 'var(--text-primary)',
          }}
          onFocus={(e) => {
            if (!selected) e.target.style.borderColor = '#2563eb';
          }}
          onBlur={(e) => {
            if (!selected) e.target.style.borderColor = 'var(--border)';
          }}
          autoComplete="off"
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-(--text-muted) hover:text-(--text-primary)"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 p-3 rounded-xl border"
            style={{ background: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.3)' }}
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-(--text-primary) truncate">
                {selected.name}
              </p>
              {selected.industry && (
                <p className="text-xs text-(--text-muted)">{selected.industry}</p>
              )}
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 uppercase">
              {t('auth.found', 'Found')}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!selected && debouncedQuery.length >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-xl border overflow-hidden shadow-lg"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
          >
            {results === undefined ? (
              <div className="flex items-center gap-2 p-3 text-sm text-(--text-muted)">
                <ShieldLoader size="xs" variant="inline" />
                {t('auth.searching', 'Searching…')}
              </div>
            ) : results.length === 0 ? (
              <div className="p-3 text-sm text-(--text-muted) text-center">
                {t('auth.noOrgFound', 'No organization found for')} &ldquo;{debouncedQuery}&rdquo;
                <p className="text-xs mt-1">{t('auth.askAdmin')}</p>
              </div>
            ) : (
              results.map((org: OrgResult) => (
                <button
                  key={org.id}
                  type="button"
                  onClick={() => handleSelect(org)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-(--background-subtle) transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-(--primary)/10 border border-(--primary)/20 flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4 text-(--primary)" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-(--text-primary) truncate">
                      {org.name}
                    </p>
                    {org.industry && <p className="text-xs text-(--text-muted)">{org.industry}</p>}
                  </div>
                  <ChevronRight className="w-4 h-4 text-(--text-muted) shrink-0" />
                </button>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {!selected && query.length < 2 && (
        <p className="text-xs text-(--text-muted) flex items-center gap-1.5 px-1">
          <Users className="w-3 h-3" />
          {t('auth.typeToSearchOrg', 'Type at least 2 characters to search for your organization')}
        </p>
      )}
    </div>
  );
}

function RegisterPageContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const { login } = useAuthStore();
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>('org');
  const [_showPassword, _setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrg, setSelectedOrg] = useState<OrgResult | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('invite');
    if (token) {
      setTimeout(() => setInviteToken(token), 0);
    }
  }, []);

  const handleOrgNext = () => {
    if (!selectedOrg && !inviteToken) {
      setError(t('auth.selectOrg', 'Please select your organization'));
      return;
    }
    setError(null);
    setStep('details');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (formData.password.length < 8) {
      setError(t('auth.passwordMustBe', 'Password must be at least 8 characters'));
      return;
    }

    const fd = new FormData();
    fd.append('name', formData.name);
    fd.append('email', formData.email);
    fd.append('password', formData.password);
    if (formData.phone) fd.append('phone', formData.phone);
    if (selectedOrg) fd.append('organizationId', selectedOrg.id);
    if (inviteToken) fd.append('inviteToken', inviteToken);

    startTransition(async () => {
      try {
        const result = (await registerAction(fd)) as RegisterActionResult;

        if (result.needsApproval) {
          toast.success(t('auth.requestSent', 'Request sent!'), {
            description: t(
              'auth.requestSentDesc',
              "You'll be notified when your account is approved.",
            ),
            duration: 6000,
          });
          setTimeout(() => router.push('/login'), 3000);
        } else {
          if (result.userId) {
            login({
              id: result.userId,
              name: result.name!,
              email: result.email!,
              role: result.role as 'superadmin' | 'admin' | 'supervisor' | 'employee' | 'driver',
              department: result.department,
              position: result.position,
              employeeType: result.employeeType as 'staff' | 'contractor' | undefined,
              avatar: result.avatar,
            });
          }
          toast.success(t('toasts.welcomeAccountReady'));

          const params = new URLSearchParams(window.location.search);
          const nextUrl = params.get('next');
          const redirectUrl = nextUrl || '/dashboard';
          router.push(redirectUrl);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : t('auth.registrationFailed', 'Registration failed'),
        );
      }
    });
  };

  const isSuperadmin = formData.email.toLowerCase() === 'romangulanyan@gmail.com';

  return (
    <I18nProvider>
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'var(--background)' }}
      >
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div
            className="absolute -top-40 -right-40 w-96 h-96 rounded-full blur-3xl opacity-20"
            style={{ background: 'radial-gradient(circle, #2563eb, transparent)' }}
          />
          <div
            className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full blur-3xl opacity-20"
            style={{ background: 'radial-gradient(circle, #0ea5e9, transparent)' }}
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="w-full max-w-md relative"
        >
          <div
            className="rounded-2xl p-8 shadow-2xl border"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <div className="flex flex-col items-center mb-6">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-lg bg-linear-to-r from-(--primary) to-(--primary-dark,var(--primary)) hover:opacity-90 transition-opacity">
                <Building2 className="w-7 h-7 text-white" />
              </div>
              <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {step === 'org'
                  ? t('auth.findYourOrg', 'Find your organization')
                  : t('auth.createAccount', 'Create account')}
              </h1>
              <p className="text-sm mt-1 text-center" style={{ color: 'var(--text-muted)' }}>
                {step === 'org'
                  ? t('auth.searchCompany', 'Search for your company to get started')
                  : `${t('auth.joining', 'Joining')} ${selectedOrg?.name ?? t('auth.yourOrganization', 'your organization')}`}
              </p>
            </div>

            <div className="flex items-center gap-2 mb-6">
              {(['org', 'details'] as Step[]).map((s, i) => (
                <React.Fragment key={s}>
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                      style={{
                        background:
                          step === s
                            ? '#2563eb'
                            : i < ['org', 'details'].indexOf(step)
                              ? '#10b981'
                              : 'var(--border)',
                        color:
                          step === s || i < ['org', 'details'].indexOf(step)
                            ? '#fff'
                            : 'var(--text-muted)',
                      }}
                    >
                      {i < ['org', 'details'].indexOf(step) ? '✓' : i + 1}
                    </div>
                    <span
                      className="text-xs font-medium"
                      style={{ color: step === s ? 'var(--text-primary)' : 'var(--text-muted)' }}
                    >
                      {s === 'org'
                        ? t('auth.organizationStep', 'Organization')
                        : t('auth.yourDetails', 'Your details')}
                    </span>
                  </div>
                  {i < 1 && <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />}
                </React.Fragment>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {step === 'org' && (
                <motion.div
                  key="org"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  {inviteToken ? (
                    <div
                      className="flex items-center gap-3 p-3 rounded-xl border"
                      style={{
                        background: 'rgba(37,99,235,0.08)',
                        borderColor: 'rgba(37,99,235,0.3)',
                      }}
                    >
                      <Sparkles className="w-4 h-4 text-blue-500 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-(--text-primary)">
                          {t('auth.inviteLinkDetected')}
                        </p>
                        <p className="text-xs text-(--text-muted)">{t('auth.invitedToJoin')}</p>
                      </div>
                    </div>
                  ) : (
                    <OrgSearch onSelect={(org) => setSelectedOrg(org)} />
                  )}

                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-2 p-3 rounded-xl text-sm"
                        style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}
                      >
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        {error}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <motion.button
                    type="button"
                    onClick={handleOrgNext}
                    disabled={!selectedOrg && !inviteToken}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    className="bg-linear-to-r from-(--primary) to-(--primary-dark,var(--primary)) hover:opacity-90 transition-opacity w-full py-2.5 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t('auth.continue', 'Continue')}
                    <ChevronRight className="w-4 h-4" />
                  </motion.button>
                </motion.div>
              )}

              {step === 'details' && (
                <motion.form
                  id="personal-details-form"
                  key="details"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  onSubmit={handleSubmit}
                  className="space-y-4"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setStep('org');
                      setError(null);
                    }}
                    className="flex items-center gap-1 text-xs text-(--text-muted) hover:text-(--text-primary) transition-colors -mt-1 mb-1"
                  >
                    <ArrowLeft className="w-3 h-3" /> {t('auth.backToOrg', 'Back to organization')}
                  </button>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {t('auth.fullName')}
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-(--text-muted)" />
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                        placeholder={t('placeholders.johnDoe')}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm outline-none transition-all"
                        style={{
                          background: 'var(--input)',
                          borderColor: 'var(--border)',
                          color: 'var(--text-primary)',
                        }}
                        onFocus={(e) => (e.target.style.borderColor = '#2563eb')}
                        onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
                      />
                    </div>
                  </div>

                  <div id="email-field">
                    <SmartEmailInput
                      value={formData.email}
                      onChange={(val) => setFormData((p) => ({ ...p, email: val }))}
                      label={t('auth.emailAddress')}
                      placeholder={t('auth.emailPlaceholder', 'you@company.com')}
                    />
                    {isSuperadmin && (
                      <p className="text-xs text-blue-500 flex items-center gap-1 px-1 mt-2">
                        <CheckCircle2 className="w-3 h-3" />{' '}
                        {t('auth.superadminAccount', 'Superadmin account')}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {t('auth.phoneOptional')}
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-(--text-muted)" />
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                        placeholder={t('auth.phonePlaceholder', '+374 XX XXX XXX')}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm outline-none transition-all"
                        style={{
                          background: 'var(--input)',
                          borderColor: 'var(--border)',
                          color: 'var(--text-primary)',
                        }}
                        onFocus={(e) => (e.target.style.borderColor = '#2563eb')}
                        onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
                      />
                    </div>
                  </div>

                  <div id="password-field">
                    <SmartPasswordInput
                      value={formData.password}
                      onChange={(val) => setFormData((p) => ({ ...p, password: val }))}
                      label={t('auth.password', 'Password')}
                      placeholder={t('placeholders.minCharacters')}
                      showStrength={true}
                      showGenerator={true}
                    />
                  </div>

                  <AnimatePresence>
                    {error && <SmartErrorMessage error={parseAuthError(error)} />}
                  </AnimatePresence>

                  <motion.button
                    type="submit"
                    disabled={isPending}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    className="w-full py-2.5 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-70 bg-linear-to-r from-(--primary) to-(--primary-dark,var(--primary)) hover:opacity-90 transition-opacity"
                  >
                    {isPending ? (
                      <>
                        <ShieldLoader size="xs" variant="inline" className="mr-2" />{' '}
                        {t('auth.creatingAccount', 'Creating account…')}
                      </>
                    ) : (
                      t('auth.requestToJoin', 'Request to Join')
                    )}
                  </motion.button>
                </motion.form>
              )}
            </AnimatePresence>

            <div className="text-center mt-6 space-y-3">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {t('auth.alreadyHaveAccount', 'Already have an account?')}{' '}
                <Link
                  href="/login"
                  className="font-semibold hover:underline"
                  style={{ color: '#2563eb' }}
                >
                  {t('auth.signIn', 'Sign in')}
                </Link>
              </p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {t('common.or', 'or')}
                </span>
                <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
              </div>
              <Link href="/register-org">
                <button
                  className="text-sm font-semibold hover:underline"
                  style={{ color: '#10b981' }}
                >
                  🏢 {t('register.createOrgWithPlan')}
                </button>
              </Link>
            </div>
          </div>

          <div className="text-center mt-4">
            <Link
              href="/"
              className="text-sm hover:underline"
              style={{ color: 'var(--text-muted)' }}
            >
              ← {t('auth.backToHome', 'Back to home')}
            </Link>
          </div>
        </motion.div>
      </div>
    </I18nProvider>
  );
}

export default function RegisterClient() {
  return (
    <I18nProvider>
      <RegisterPageContent />
    </I18nProvider>
  );
}
