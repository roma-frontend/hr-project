'use client';

import { useParams, useRouter } from 'next/navigation';
import { ShieldLoader } from '@/components/ui/ShieldLoader';
import { useAuthStore } from '@/store/useAuthStore';
import { useUserById, useSuspendUser, useUnsuspendUser } from '@/hooks/useUsers';
import { useLoginAttemptsByUser } from '@/hooks/useSecurity';
import {
  Shield,
  ArrowLeft,
  Ban,
  CheckCircle,
  AlertTriangle,
  Clock,
  MapPin,
  Monitor,
} from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Image from 'next/image';

export default function SecurityAlertDetailPage() {
  const { t, i18n } = useTranslation();
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const userId = params.userId as string;

  const [suspendDuration, setSuspendDuration] = useState(24);
  const [suspendReason, setSuspendReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: suspiciousUser, isLoading: isLoadingUser } = useUserById(userId);
  const { data: recentAttempts, isLoading: isLoadingAttempts } = useLoginAttemptsByUser(userId, 10);
  const suspendUserMutation = useSuspendUser();
  const unsuspendUserMutation = useUnsuspendUser();

  if (!user) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'var(--background)' }}
      >
        <ShieldLoader size="lg" message={t('common.loadingUserData')} />
      </div>
    );
  }

  const isSuperadmin =
    user.email?.toLowerCase() === 'romangulanyan@gmail.com' || user.role === 'superadmin';

  if (!isSuperadmin) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'var(--background)' }}
      >
        <div className="text-center">
          <Shield className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--destructive)' }} />
          <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            {t('common.accessDenied')}
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>{t('common.onlySuperadminAccess')}</p>
        </div>
      </div>
    );
  }

  if (isLoadingUser || !suspiciousUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <ShieldLoader size="lg" message={t('common.loadingUserData')} />
      </div>
    );
  }

  const handleSuspend = async () => {
    if (!suspendReason.trim()) {
      toast.error(t('toasts.provideReasonForSuspension'));
      return;
    }

    setIsProcessing(true);
    try {
      await suspendUserMutation.mutateAsync({
        adminId: user!.id,
        userId: userId,
        reason: suspendReason,
        duration: suspendDuration,
      });

      toast.success(t('toasts.userSuspendedFor', { hours: suspendDuration }));
      setSuspendReason('');
    } catch (error: unknown) {
      const message = error instanceof Error ? t('security.error', { defaultValue: error.message }) : t('toasts.userSuspendFailed');
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUnsuspend = async () => {
    setIsProcessing(true);
    try {
      await unsuspendUserMutation.mutateAsync({
        adminId: user!.id,
        userId: userId,
      });

      toast.success(t('toasts.userUnsuspended'));
    } catch (error: unknown) {
      const message = error instanceof Error ? t('security.error', { defaultValue: error.message }) : t('toasts.userUnsuspendFailed');
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  };

  const getRiskLabel = (score?: number) => {
    if (!score) return t('security.riskUnknown');
    if (score >= 80) return t('security.riskLabelHigh');
    if (score >= 50) return t('security.riskLabelModerate');
    return t('security.riskLabelLow');
  };

  const getRiskStyle = (score?: number) => {
    if (!score) return { color: 'var(--text-muted)' };
    if (score >= 80) return { color: 'var(--destructive)' };
    if (score >= 50) return { color: 'var(--warning)' };
    return { color: 'var(--success)' };
  };

  return (
    <div className="min-h-screen p-6" style={{ background: 'var(--background)' }}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/superadmin/security')}
            className="flex items-center gap-2 text-sm mb-4 transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <ArrowLeft className="w-4 h-4" />
            {t('common.backToSecurityCenter')}
          </button>

          <div className="flex  items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {t('security.securityAlertDetails')}
              </h1>
              <p className="mt-1" style={{ color: 'var(--text-muted)' }}>
                {t('security.reviewAndManageSuspicious')}
              </p>
            </div>

                        {suspiciousUser.is_suspended && (
                          <div
                            className="flex items-center gap-2 px-4 py-2 rounded-lg"
                            style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--destructive)' }}
                          >
                            <Ban className="w-5 h-5" />
                            <span className="font-semibold">{t('security.accountSuspended')}</span>
                          </div>
                        )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* User Info Card */}
          <div className="lg:col-span-2 space-y-6">
            {/* User Details */}
            <div
              className="rounded-xl shadow-sm border p-6"
              style={{ background: 'var(--card-background)', borderColor: 'var(--border)' }}
            >
              <h2
                className="text-xl font-semibold mb-4 flex items-center gap-2"
                style={{ color: 'var(--text-primary)' }}
              >
                <Shield className="w-5 h-5" style={{ color: 'var(--primary)' }} />
                {t('superadmin.user360.tabs.activity')}
              </h2>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  {suspiciousUser.avatar_url ? (
                    <Image
                      src={suspiciousUser.avatar_url}
                      alt={suspiciousUser.name}
                      width={64}
                      height={64}
                      className="w-16 h-16 rounded-full"
                    />
                  ) : (
                    <div
                      className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold"
                      style={{
                        background:
                          'linear-gradient(to bottom right, var(--primary), var(--accent))',
                      }}
                    >
                      {suspiciousUser.name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {suspiciousUser.name}
                    </h3>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      {suspiciousUser.email}
                    </p>
                  </div>
                </div>

                <div
                  className="grid grid-cols-2 gap-4 pt-4 border-t"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <div>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      {t('superadmin.security.reason')}
                    </p>
                    <p
                      className="font-semibold capitalize"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {suspiciousUser.role}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      {t('common.department')}
                    </p>
                    <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {suspiciousUser.department || '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      {t('common.position')}
                    </p>
                    <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {suspiciousUser.position || '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      {t('common.status')}
                    </p>
                    <p
                      className="font-semibold"
                      style={{
                        color: suspiciousUser.is_active ? 'var(--success)' : 'var(--destructive)',
                      }}
                    >
                      {suspiciousUser.is_active ? t('common.active') : t('common.inactive')}
                    </p>
                  </div>
                </div>

                {suspiciousUser.is_suspended && (
                  <div
                    className="mt-4 p-4 border rounded-lg"
                    style={{
                      background: 'rgba(239,68,68,0.1)',
                      borderColor: 'rgba(239,68,68,0.3)',
                    }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-sm font-semibold" style={{ color: 'var(--destructive)' }}>
                        {t('common.suspensionDetails')}
                      </p>
                      {suspiciousUser.suspended_reason?.includes('AUTO-BLOCKED') && (
                        <span
                          className="text-xs font-bold text-white px-2 py-1 rounded"
                          style={{ background: 'var(--destructive)' }}
                        >
                          {t('security.autoBlocked')}
                        </span>
                      )}
                    </div>
                    <div className="space-y-1 text-sm" style={{ color: 'var(--text-primary)' }}>
                      <p>
                        <span className="font-medium">{t('common.reason')}:</span>{' '}
                        {suspiciousUser.suspended_reason}
                      </p>
                      <p>
                        <span className="font-medium">{t('superadmin.security.until')}:</span>{' '}
                        {new Date(suspiciousUser.suspended_until!).toLocaleString(i18n.language)}
                      </p>
                      <p>
                        <span className="font-medium">{t('superadmin.impersonate.sessionInfo.expiresAt')}:</span>{' '}
                        {new Date(suspiciousUser.suspended_at!).toLocaleString(i18n.language)}
                      </p>
                      {suspiciousUser.suspended_reason?.includes('AUTO-BLOCKED') && (
                        <p
                          className="text-xs font-medium mt-2 pt-2 border-t"
                          style={{
                            color: 'var(--destructive)',
                            borderColor: 'rgba(239,68,68,0.3)',
                          }}
                        >
                          ⚡ {t('superadmin.security.autoLockoutDesc')}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Login Attempts */}
            <div
              className="rounded-xl shadow-sm border p-6"
              style={{ background: 'var(--card-background)', borderColor: 'var(--border)' }}
            >
              <h2
                className="text-xl font-semibold mb-4 flex items-center gap-2"
                style={{ color: 'var(--text-primary)' }}
              >
                <Clock className="w-5 h-5" style={{ color: 'var(--primary)' }} />
                {t('superadmin.user360.security.title')}
              </h2>

              {isLoadingAttempts || !recentAttempts || recentAttempts.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  {isLoadingAttempts ? t('common.loading') : t('superadmin.user360.security.subtitle')}
                </p>
              ) : (
                <div className="space-y-3">
                  {recentAttempts.map((attempt: any) => (
                    <div
                      key={attempt.id}
                      className="p-4 rounded-lg border"
                      style={{
                        background: attempt.success
                          ? 'rgba(16,185,129,0.1)'
                          : 'rgba(239,68,68,0.1)',
                        borderColor: attempt.success
                          ? 'rgba(16,185,129,0.3)'
                          : 'rgba(239,68,68,0.3)',
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {attempt.success ? (
                              <CheckCircle
                                className="w-4 h-4"
                                style={{ color: 'var(--success)' }}
                              />
                            ) : (
                              <AlertTriangle
                                className="w-4 h-4"
                                style={{ color: 'var(--destructive)' }}
                              />
                            )}
                              <span
                                className="font-semibold text-sm"
                                style={{
                                  color: attempt.success ? 'var(--success)' : 'var(--destructive)',
                                }}
                              >
                                {attempt.success ? t('superadmin.user360.security.successful') : t('superadmin.user360.security.failed')}
                              </span>
                            {attempt.risk_score && (
                              <span
                                className="text-xs font-bold"
                                style={getRiskStyle(attempt.risk_score)}
                              >
                                {getRiskLabel(attempt.risk_score)}
                              </span>
                            )}
                          </div>

                          <div
                            className="text-sm space-y-1"
                            style={{ color: 'var(--text-primary)' }}
                          >
                            <p className="flex items-center gap-2">
                              <Monitor className="w-3 h-3" />
                              {t('toasts.method')}:{' '}
                              <span className="font-medium capitalize">{attempt.method}</span>
                            </p>
                            {attempt.ip && (
                              <p className="flex items-center gap-2">
                                <MapPin className="w-3 h-3" />
                                {t('toasts.ip')}: <span className="font-medium">{attempt.ip}</span>
                                {attempt.city && ` (${attempt.city}, ${attempt.country})`}
                              </p>
                            )}
                            {attempt.risk_factors && attempt.risk_factors.length > 0 && (
                              <p
                                className="font-medium mt-2"
                                style={{ color: 'var(--destructive)' }}
                              >
                                {t('toasts.riskFactors')}: {attempt.risk_factors.join(', ')}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {new Date(attempt.created_at).toLocaleString(i18n.language)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Actions Panel */}
          <div className="space-y-6">
            {suspiciousUser.is_suspended ? (
              /* Unsuspend Card */
              <div
                className="rounded-xl shadow-sm border p-6"
                style={{ background: 'var(--card-background)', borderColor: 'var(--border)' }}
              >
                <h2
                  className="text-xl font-semibold mb-4 flex items-center gap-2"
                  style={{ color: 'var(--success)' }}
                >
                <CheckCircle className="w-5 h-5" />
                {t('toasts.userUnsuspended')}
              </h2>

              <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
                {t('superadmin.bulkActions.close')}
              </p>

              <button
                onClick={handleUnsuspend}
                disabled={isProcessing}
                className="w-full text-white px-4 py-3 rounded-lg font-semibold transition-colors disabled:opacity-50"
                style={{ background: isProcessing ? 'var(--border)' : 'var(--success)' }}
                onMouseEnter={(e) => !isProcessing && (e.currentTarget.style.opacity = '0.9')}
                onMouseLeave={(e) => !isProcessing && (e.currentTarget.style.opacity = '1')}
              >
                {isProcessing ? t('common.loading') : t('superadmin.security.reviewAndUnsuspend')}
              </button>
              </div>
            ) : (
              /* Suspend Card */
              <div
                className="rounded-xl shadow-sm border p-6"
                style={{ background: 'var(--card-background)', borderColor: 'var(--border)' }}
              >
                <h2
                  className="text-xl font-semibold mb-4 flex items-center gap-2"
                  style={{ color: 'var(--destructive)' }}
                >
                <Ban className="w-5 h-5" />
                {t('superadmin.users.blockUser')}
              </h2>

              <div className="space-y-4">
                <div>
                  <label
                    className="block text-sm font-medium mb-2"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {t('superadmin.security.until')}
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    step="1"
                    value={suspendDuration}
                    onChange={(e) => setSuspendDuration(parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent"
                    style={{
                      background: 'var(--input-background)',
                      borderColor: 'var(--border)',
                      color: 'var(--text-primary)',
                    }}
                  />
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    {t('superadmin.security.autoLockoutDesc')}
                  </p>
                </div>

                <div>
                  <label
                    className="block text-sm font-medium mb-2"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {t('superadmin.security.reason')} *
                  </label>
                  <textarea
                    value={suspendReason}
                    onChange={(e) => setSuspendReason(e.target.value)}
                    placeholder={t('superadmin.impersonate.reasonPlaceholder')}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent resize-none"
                    style={{
                      background: 'var(--input-background)',
                      borderColor: 'var(--border)',
                      color: 'var(--text-primary)',
                    }}
                    rows={4}
                  />
                </div>

                <button
                  onClick={handleSuspend}
                  disabled={isProcessing || !suspendReason.trim()}
                  className="w-full text-white px-4 py-3 rounded-lg font-semibold transition-colors disabled:opacity-50"
                  style={{
                    background:
                      isProcessing || !suspendReason.trim()
                        ? 'var(--border)'
                        : 'var(--destructive)',
                  }}
                  onMouseEnter={(e) =>
                    !(isProcessing || !suspendReason.trim()) &&
                    (e.currentTarget.style.opacity = '0.9')
                  }
                  onMouseLeave={(e) =>
                    !(isProcessing || !suspendReason.trim()) &&
                    (e.currentTarget.style.opacity = '1')
                  }
                >
                  {isProcessing ? t('common.loading') : t('superadmin.users.blockUser')}
                </button>
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div
              className="rounded-xl border p-6"
              style={{ background: 'rgba(37,99,235,0.1)', borderColor: 'rgba(37,99,235,0.3)' }}
            >
              <h3 className="font-semibold mb-3" style={{ color: 'var(--primary)' }}>
                {t('superadmin.quickActions.actions')}
              </h3>
              <div className="space-y-2">
                <button
                  onClick={() => {
                    setSuspendDuration(1);
                    setSuspendReason(t('superadmin.quickActions.placeholder'));
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors"
                  style={{ background: 'var(--card-background)', color: 'var(--text-primary)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(37,99,235,0.2)')}
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = 'var(--card-background)')
                  }
                >
                  {t('security.hoursOne')} {t('common.hoursShort')} ({t('security.investigation')})
                </button>
                <button
                  onClick={() => {
                    setSuspendDuration(24);
                    setSuspendReason(t('superadmin.security.recentSuspiciousLogins'));
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors"
                  style={{ background: 'var(--card-background)', color: 'var(--text-primary)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(37,99,235,0.2)')}
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = 'var(--card-background)')
                  }
                >
                  {t('security.hoursTwentyFour')} {t('common.hoursShort')} ({t('security.suspicious')})
                </button>
                <button
                  onClick={() => {
                    setSuspendDuration(168);
                    setSuspendReason(t('superadmin.security.accessDenied'));
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors"
                  style={{ background: 'var(--card-background)', color: 'var(--text-primary)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(37,99,235,0.2)')}
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = 'var(--card-background)')
                  }
                >
                  1 {t('common.weeksShort')} ({t('security.breach')})
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
