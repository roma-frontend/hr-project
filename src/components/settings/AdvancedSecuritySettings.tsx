"use client";
import Image from 'next/image';

import { useTranslation } from "react-i18next";
import React, { useState, useEffect, useRef } from "react";
import { Shield, Smartphone, History, Key, AlertTriangle, ShieldCheck, Copy, Check, Loader2, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuthStore } from "@/store/useAuthStore";

type SetupStep = "idle" | "loading" | "qr" | "verify" | "backup" | "done";

export function AdvancedSecuritySettings() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [loginAlerts, setLoginAlerts] = useState(true);
  const [loading, setLoading] = useState(true);

  // 2FA setup state
  const [setupStep, setSetupStep] = useState<SetupStep>("idle");
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [totpSecret, setTotpSecret] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verifyCode, setVerifyCode] = useState("");
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);
  const verifyInputRef = useRef<HTMLInputElement>(null);

  // Disable 2FA state
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [disableError, setDisableError] = useState<string | null>(null);
  const [disableLoading, setDisableLoading] = useState(false);

  // Fetch 2FA status on mount
  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await fetch('/api/auth/totp/setup', { method: 'GET' }).catch(() => null);
        // We don't have a GET endpoint, so use a different approach
        // Just check via the user's session — the status is fetched from Convex
        // For now, we'll use a dedicated status check
      } catch {}
      setLoading(false);
    }

    // Check status via Convex query through an API call
    async function checkTotpStatus() {
      try {
        if (!user?.id) return;
        const res = await fetch(`/api/auth/totp/status?userId=${user.id}`);
        if (res.ok) {
          const data = await res.json();
          setTwoFactorEnabled(data.totpEnabled);
        }
      } catch {} finally {
        setLoading(false);
      }
    }
    checkTotpStatus();
  }, [user?.id]);

  // Start 2FA setup
  const handleStartSetup = async () => {
    setSetupStep("loading");
    try {
      const res = await fetch('/api/auth/totp/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id, email: user?.email }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Setup failed');
      }
      const data = await res.json();
      setQrCodeUrl(data.qrCodeUrl);
      setTotpSecret(data.secret);
      setBackupCodes(data.backupCodes);
      setSetupStep("qr");
    } catch (err: any) {
      toast.error(err.message || 'Failed to start 2FA setup');
      setSetupStep("idle");
    }
  };

  // Verify setup code
  const handleVerifySetup = async () => {
    if (verifyCode.length !== 6) return;
    setVerifyError(null);
    try {
      const res = await fetch('/api/auth/totp/verify-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: verifyCode, userId: user?.id }),
      });
      if (!res.ok) {
        const err = await res.json();
        setVerifyError(err.error || 'Invalid code');
        setVerifyCode("");
        return;
      }
      setSetupStep("backup");
      setTwoFactorEnabled(true);
      toast.success(t('toasts.twoFactorEnabled'));
    } catch (err: any) {
      setVerifyError(err.message || 'Verification failed');
      setVerifyCode("");
    }
  };

  // Auto-submit on 6 digits
  useEffect(() => {
    if (verifyCode.length === 6 && setupStep === "verify") {
      handleVerifySetup();
    }
  }, [verifyCode, setupStep]);

  // Disable 2FA
  const handleDisable = async () => {
    if (!disablePassword) return;
    setDisableLoading(true);
    setDisableError(null);
    try {
      const res = await fetch('/api/auth/totp/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: disablePassword, userId: user?.id }),
      });
      if (!res.ok) {
        const err = await res.json();
        setDisableError(err.error || 'Failed to disable 2FA');
        return;
      }
      setTwoFactorEnabled(false);
      setShowDisableConfirm(false);
      setDisablePassword("");
      toast.success(t('toasts.twoFactorDisabled'));
    } catch (err: any) {
      setDisableError(err.message || 'Failed to disable 2FA');
    } finally {
      setDisableLoading(false);
    }
  };

  const copyToClipboard = (text: string, type: "secret" | "codes") => {
    navigator.clipboard.writeText(text);
    if (type === "secret") {
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    } else {
      setCopiedCodes(true);
      setTimeout(() => setCopiedCodes(false), 2000);
    }
  };

  // Mock data for sessions and login history
  const activeSessions = [
    { id: 1, device: "Chrome on Windows", location: "Moscow, Russia", ip: "192.168.1.1", lastActive: "Just now", current: true },
    { id: 2, device: "Safari on iPhone", location: "Moscow, Russia", ip: "192.168.1.25", lastActive: "2 hours ago", current: false },
  ];

  const loginHistory = [
    { id: 1, date: "2024-02-28 09:15", device: "Chrome on Windows", location: "Moscow, Russia", ip: "192.168.1.1", status: "success" },
    { id: 2, date: "2024-02-27 18:30", device: "Safari on iPhone", location: "Moscow, Russia", ip: "192.168.1.25", status: "success" },
    { id: 3, date: "2024-02-27 09:00", device: "Chrome on Windows", location: "Moscow, Russia", ip: "192.168.1.1", status: "success" },
    { id: 4, date: "2024-02-26 17:45", device: "Firefox on MacOS", location: "Unknown", ip: "203.0.113.0", status: "failed" },
  ];

  return (
    <div className="space-y-6">
      {/* Two-Factor Authentication */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Key className="w-5 h-5 text-[var(--primary)]" />
              <CardTitle>{t('settingsAdvancedSecurity.twoFactor')}</CardTitle>
            </div>
            {twoFactorEnabled && (
              <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-500/20">
                <ShieldCheck className="w-3 h-3 mr-1" />
                Enabled
              </Badge>
            )}
          </div>
          <CardDescription>{t('settingsAdvancedSecurity.twoFactorDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status / Toggle */}
          {setupStep === "idle" && !showDisableConfirm && (
            <div className="flex items-center justify-between p-4 rounded-lg bg-[var(--surface-hover)] border border-[var(--border)]">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🔐</span>
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    {twoFactorEnabled ? "Two-factor authentication is active" : t('settingsAdvancedSecurity.enable2fa')}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    {twoFactorEnabled
                      ? "Your account is protected with an authenticator app"
                      : t('settingsAdvancedSecurity.enable2faDesc')}
                  </p>
                </div>
              </div>
              {twoFactorEnabled ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-500 hover:text-red-600 border-red-200"
                  onClick={() => setShowDisableConfirm(true)}
                >
                  Disable
                </Button>
              ) : (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleStartSetup}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enable"}
                </Button>
              )}
            </div>
          )}

          {/* Loading */}
          {setupStep === "loading" && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-[var(--primary)]" />
              <span className="ml-2 text-sm text-[var(--text-muted)]">Setting up 2FA...</span>
            </div>
          )}

          {/* QR Code Step */}
          {setupStep === "qr" && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg border border-[var(--primary)]/20 bg-[var(--primary)]/5">
                <p className="text-sm font-medium text-[var(--text-primary)] mb-3">
                  Step 1: Scan QR Code
                </p>
                <p className="text-xs text-[var(--text-muted)] mb-4">
                  Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
                </p>
                <div className="flex justify-center mb-4">
                  <div className="bg-white p-3 rounded-lg">
                    <img src={qrCodeUrl} alt="TOTP QR Code" width={200} height={200} />
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-xs text-[var(--text-muted)] mb-1">Or enter this code manually:</p>
                  <div className="flex items-center justify-center gap-2">
                    <code className="text-sm font-mono bg-[var(--surface-hover)] px-3 py-1.5 rounded border border-[var(--border)]">
                      {totpSecret}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(totpSecret, "secret")}
                    >
                      {copiedSecret ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setSetupStep("idle");
                    setQrCodeUrl("");
                    setTotpSecret("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => {
                    setSetupStep("verify");
                    setTimeout(() => verifyInputRef.current?.focus(), 100);
                  }}
                >
                  Next: Verify Code
                </Button>
              </div>
            </div>
          )}

          {/* Verify Code Step */}
          {setupStep === "verify" && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg border border-[var(--primary)]/20 bg-[var(--primary)]/5">
                <p className="text-sm font-medium text-[var(--text-primary)] mb-2">
                  Step 2: Verify Code
                </p>
                <p className="text-xs text-[var(--text-muted)] mb-4">
                  Enter the 6-digit code from your authenticator app to verify setup
                </p>
                <input
                  ref={verifyInputRef}
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={verifyCode}
                  onChange={(e) => {
                    setVerifyCode(e.target.value.replace(/\D/g, ""));
                    setVerifyError(null);
                  }}
                  placeholder="000000"
                  className="w-full text-center text-2xl tracking-[0.5em] font-mono py-3 px-4 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{
                    background: "var(--surface-hover)",
                    borderColor: verifyError ? "#ef4444" : "var(--border)",
                    color: "var(--text-primary)",
                  }}
                  autoFocus
                />
                {verifyError && (
                  <p className="text-sm text-red-500 mt-2 flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" />
                    {verifyError}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setSetupStep("qr")}
                >
                  Back
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleVerifySetup}
                  disabled={verifyCode.length !== 6}
                >
                  Verify & Enable
                </Button>
              </div>
            </div>
          )}

          {/* Backup Codes Step */}
          {setupStep === "backup" && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg border border-green-500/20 bg-green-500/5">
                <div className="flex items-center gap-2 mb-3">
                  <ShieldCheck className="w-5 h-5 text-green-600" />
                  <p className="text-sm font-medium text-green-600">
                    2FA Enabled Successfully!
                  </p>
                </div>
                <p className="text-xs text-[var(--text-muted)] mb-4">
                  Save these backup codes in a safe place. Each code can only be used once. If you lose access to your authenticator app, you can use these codes to sign in.
                </p>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {backupCodes.map((code, i) => (
                    <div
                      key={i}
                      className="font-mono text-sm text-center py-2 px-3 rounded bg-[var(--surface-hover)] border border-[var(--border)]"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {code}
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => copyToClipboard(backupCodes.join("\n"), "codes")}
                >
                  {copiedCodes ? (
                    <><Check className="w-4 h-4 mr-2 text-green-500" /> Copied!</>
                  ) : (
                    <><Copy className="w-4 h-4 mr-2" /> Copy All Codes</>
                  )}
                </Button>
              </div>
              <Button
                className="w-full"
                onClick={() => {
                  setSetupStep("idle");
                  setQrCodeUrl("");
                  setTotpSecret("");
                  setBackupCodes([]);
                  setVerifyCode("");
                }}
              >
                Done
              </Button>
            </div>
          )}

          {/* Disable Confirmation */}
          {showDisableConfirm && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg border border-red-500/20 bg-red-500/5">
                <p className="text-sm font-medium text-red-600 mb-2">
                  Disable Two-Factor Authentication
                </p>
                <p className="text-xs text-[var(--text-muted)] mb-4">
                  Enter your password to confirm. This will remove 2FA protection from your account.
                </p>
                <input
                  type="password"
                  value={disablePassword}
                  onChange={(e) => {
                    setDisablePassword(e.target.value);
                    setDisableError(null);
                  }}
                  placeholder="Enter your password"
                  className="w-full py-2 px-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
                  style={{
                    background: "var(--surface-hover)",
                    borderColor: disableError ? "#ef4444" : "var(--border)",
                    color: "var(--text-primary)",
                  }}
                />
                {disableError && (
                  <p className="text-sm text-red-500 mt-2">{disableError}</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowDisableConfirm(false);
                    setDisablePassword("");
                    setDisableError(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={handleDisable}
                  disabled={!disablePassword || disableLoading}
                >
                  {disableLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Disable 2FA
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Sessions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-[var(--primary)]" />
                <CardTitle>{t('settingsAdvancedSecurity.activeSessions')}</CardTitle>
              </div>
              <CardDescription>{t('settingsAdvancedSecurity.activeSessionsDesc')}</CardDescription>
            </div>
            <Badge variant="secondary">{activeSessions.length} active</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {activeSessions.map((session) => (
            <div
              key={session.id}
              className="flex items-start justify-between p-4 rounded-lg bg-[var(--surface-hover)] border border-[var(--border)]"
            >
              <div className="flex items-start gap-3 flex-1">
                <div className="w-10 h-10 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center">
                  <Smartphone className="w-5 h-5 text-[var(--primary)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-[var(--text-primary)]">{session.device}</p>
                    {session.current && (
                      <Badge variant="default" className="text-xs">{t('common.current') || 'Current'}</Badge>
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    {session.location} • {session.ip}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {t('settingsAdvancedSecurity.lastActive')} {session.lastActive}
                  </p>
                </div>
              </div>
              {!session.current && (
                <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600">
                  Sign Out
                </Button>
              )}
            </div>
          ))}

          <Button variant="outline" className="w-full" size="sm">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Sign Out All Other Sessions
          </Button>
        </CardContent>
      </Card>

      {/* Login History */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-[var(--primary)]" />
            <CardTitle>Login History</CardTitle>
          </div>
          <CardDescription>Recent login attempts and activity</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {loginHistory.map((login, idx) => (
              <div key={login.id}>
                <div className="flex items-start justify-between py-3">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={`w-2 h-2 rounded-full mt-2 ${
                      login.status === "success" ? "bg-green-500" : "bg-red-500"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--text-primary)]">
                        {login.device}
                      </p>
                      <p className="text-xs text-[var(--text-muted)] mt-1">
                        {login.location} • {login.ip}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {login.date}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={login.status === "success" ? "default" : "destructive"}
                    className="text-xs"
                  >
                    {login.status === "success" ? "✓ Success" : "✗ Failed"}
                  </Badge>
                </div>
                {idx < loginHistory.length - 1 && (
                  <div className="border-b border-[var(--border)]" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Security Alerts */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[var(--warning)]" />
            <CardTitle>Security Alerts</CardTitle>
          </div>
          <CardDescription>Get notified of suspicious activity</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-[var(--surface-hover)] border border-[var(--border)]">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🔔</span>
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">Login Alerts</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Get notified when someone logs into your account
                </p>
              </div>
            </div>
            <Switch checked={loginAlerts} onCheckedChange={setLoginAlerts} />
          </div>

          <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <div className="flex items-start gap-3">
              <span className="text-xl">💡</span>
              <div>
                <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Security Tip</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Use a strong, unique password and enable 2FA for maximum security.
                  Regularly review your login history for any suspicious activity.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
