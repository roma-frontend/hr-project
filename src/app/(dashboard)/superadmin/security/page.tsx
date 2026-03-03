"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/useAuth";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Eye,
  EyeOff,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Monitor,
  Fingerprint,
  Brain,
  Camera,
  Lock,
  Bell,
  RefreshCw,
  ChevronRight,
  Activity,
} from "lucide-react";

// ── Feature metadata ──────────────────────────────────────────────────────────
const FEATURES = [
  {
    key: "audit_logging",
    title: "Audit Logging",
    description: "Log all login attempts with IP, device info, and risk score. Essential baseline.",
    icon: Eye,
    color: "blue",
    critical: true,
  },
  {
    key: "adaptive_auth",
    title: "Adaptive Authentication",
    description: "Auto-block or challenge logins with high risk score (new device, many failed attempts, unusual hour).",
    icon: ShieldAlert,
    color: "orange",
    critical: false,
  },
  {
    key: "device_fingerprinting",
    title: "Device Fingerprinting",
    description: "Recognize known devices per employee. New device login triggers a higher risk score.",
    icon: Monitor,
    color: "purple",
    critical: false,
  },
  {
    key: "keystroke_dynamics",
    title: "Keystroke Dynamics",
    description: "Analyze typing rhythm to verify identity. Each person types like a fingerprint.",
    icon: Brain,
    color: "indigo",
    critical: false,
  },
  {
    key: "continuous_face",
    title: "Continuous Face Verification",
    description: "Periodically verify employee identity via camera during active session.",
    icon: Camera,
    color: "teal",
    critical: false,
  },
  {
    key: "failed_login_lockout",
    title: "Auto Account Lockout",
    description: "Automatically lock account after 5 failed login attempts in 15 minutes.",
    icon: Lock,
    color: "red",
    critical: false,
  },
  {
    key: "new_device_alert",
    title: "New Device Alert",
    description: "Notify admin when an employee logs in from an unrecognized device.",
    icon: Bell,
    color: "yellow",
    critical: false,
  },
] as const;

const COLOR_MAP: Record<string, { bg: string; border: string; badge: string; icon: string; toggle: string }> = {
  blue:   { bg: "bg-blue-950/40",   border: "border-blue-800/50",   badge: "bg-blue-900/60 text-blue-300",   icon: "text-blue-400",   toggle: "bg-blue-500" },
  orange: { bg: "bg-orange-950/40", border: "border-orange-800/50", badge: "bg-orange-900/60 text-orange-300", icon: "text-orange-400", toggle: "bg-orange-500" },
  purple: { bg: "bg-purple-950/40", border: "border-purple-800/50", badge: "bg-purple-900/60 text-purple-300", icon: "text-purple-400", toggle: "bg-purple-500" },
  indigo: { bg: "bg-indigo-950/40", border: "border-indigo-800/50", badge: "bg-indigo-900/60 text-indigo-300", icon: "text-indigo-400", toggle: "bg-indigo-500" },
  teal:   { bg: "bg-teal-950/40",   border: "border-teal-800/50",   badge: "bg-teal-900/60 text-teal-300",   icon: "text-teal-400",   toggle: "bg-teal-500" },
  red:    { bg: "bg-red-950/40",    border: "border-red-800/50",    badge: "bg-red-900/60 text-red-300",    icon: "text-red-400",    toggle: "bg-red-500" },
  yellow: { bg: "bg-yellow-950/40", border: "border-yellow-800/50", badge: "bg-yellow-900/60 text-yellow-300", icon: "text-yellow-400", toggle: "bg-yellow-500" },
};

function Toggle({ enabled, onToggle, loading }: { enabled: boolean; onToggle: () => void; loading?: boolean }) {
  return (
    <button
      onClick={onToggle}
      disabled={loading}
      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-300 focus:outline-none ${
        enabled ? "bg-green-500" : "bg-gray-600"
      } ${loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-300 ${
          enabled ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function RiskBadge({ score }: { score: number }) {
  if (score >= 60) return <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-900/70 text-red-300">HIGH {score}</span>;
  if (score >= 30) return <span className="px-2 py-0.5 rounded text-xs font-bold bg-yellow-900/70 text-yellow-300">MED {score}</span>;
  return <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-900/70 text-green-300">LOW {score}</span>;
}

export default function SecurityDashboard() {
  const { user } = useAuth();
  const [toggling, setToggling] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<"settings" | "logs" | "attempts">("settings");

  const settings = useQuery(api.security.getAllSettings);
  const loginStats = useQuery(api.security.getLoginStats, { hours: 24 });
  const auditLogs = useQuery(api.security.getRecentAuditLogs, { limit: 50 });
  const toggleSetting = useMutation(api.security.toggleSetting);

  if (!user || user.role !== "superadmin") {
    return (
      <div className="flex items-center justify-center h-96 text-gray-400">
        <ShieldAlert className="w-8 h-8 mr-3 text-red-400" />
        Access denied — superadmin only
      </div>
    );
  }

  const handleToggle = async (key: string, currentEnabled: boolean) => {
    setToggling((prev) => ({ ...prev, [key]: true }));
    try {
      await toggleSetting({ key, enabled: !currentEnabled, updatedBy: user.userId as any });
    } catch (err) {
      console.error("Toggle failed:", err);
    } finally {
      setToggling((prev) => ({ ...prev, [key]: false }));
    }
  };

  const getSettingEnabled = (key: string) => {
    const s = settings?.find((s) => s.key === key);
    return s ? s.enabled : true;
  };

  const enabledCount = FEATURES.filter((f) => getSettingEnabled(f.key)).length;
  const threatLevel =
    (loginStats?.highRisk ?? 0) >= 10 ? "Critical" :
    (loginStats?.highRisk ?? 0) >= 3  ? "Elevated" :
    (loginStats?.failed ?? 0) >= 20   ? "Moderate" : "Normal";
  const threatColor =
    threatLevel === "Critical" ? "text-red-400" :
    threatLevel === "Elevated" ? "text-orange-400" :
    threatLevel === "Moderate" ? "text-yellow-400" : "text-green-400";

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-900/50 rounded-xl border border-blue-700/50">
            <Shield className="w-7 h-7 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Security Control Center</h1>
            <p className="text-gray-400 text-sm">Manage identity verification systems across all organizations</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Activity className="w-4 h-4" />
          Live monitoring
        </div>
      </div>

      {/* ── Stats bar ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <div className={`text-2xl font-bold ${threatColor}`}>{threatLevel}</div>
          <div className="text-xs text-gray-400 mt-1">Threat Level</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-white">{loginStats?.total ?? 0}</div>
          <div className="text-xs text-gray-400 mt-1">Logins (24h)</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-red-400">{loginStats?.failed ?? 0}</div>
          <div className="text-xs text-gray-400 mt-1">Failed</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-orange-400">{loginStats?.highRisk ?? 0}</div>
          <div className="text-xs text-gray-400 mt-1">High Risk</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-green-400">{enabledCount}/{FEATURES.length}</div>
          <div className="text-xs text-gray-400 mt-1">Features ON</div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-2 mb-6 border-b border-gray-800">
        {(["settings", "attempts", "logs"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 text-sm font-medium capitalize rounded-t-lg transition-colors ${
              activeTab === tab
                ? "bg-gray-900 text-white border border-b-0 border-gray-700"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            {tab === "settings" ? "🛡️ Security Features" : tab === "attempts" ? "🔐 Login Attempts" : "📋 Audit Logs"}
          </button>
        ))}
      </div>

      {/* ── TAB: Security Features ── */}
      {activeTab === "settings" && (
        <div className="space-y-4">
          <p className="text-gray-400 text-sm mb-4">
            Toggle security systems on/off. Changes take effect immediately for all organizations.
            If employees report issues — simply disable the feature.
          </p>
          {FEATURES.map((feature) => {
            const enabled = getSettingEnabled(feature.key);
            const colors = COLOR_MAP[feature.color];
            const Icon = feature.icon;
            const isLoading = toggling[feature.key];
            const savedAt = settings?.find((s) => s.key === feature.key)?.updatedAt;

            return (
              <div
                key={feature.key}
                className={`${colors.bg} ${colors.border} border rounded-xl p-5 flex items-center gap-4 transition-all`}
              >
                <div className={`p-2.5 rounded-lg bg-gray-900/60 ${colors.icon}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-white">{feature.title}</span>
                    {feature.critical && (
                      <span className="text-xs px-2 py-0.5 rounded bg-blue-900/60 text-blue-300">Essential</span>
                    )}
                    {!enabled && (
                      <span className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-400">Disabled</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400">{feature.description}</p>
                  {savedAt && (
                    <p className="text-xs text-gray-600 mt-1">
                      Last changed: {new Date(savedAt).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-medium ${enabled ? "text-green-400" : "text-gray-500"}`}>
                    {enabled ? "ON" : "OFF"}
                  </span>
                  <Toggle
                    enabled={enabled}
                    onToggle={() => handleToggle(feature.key, enabled)}
                    loading={isLoading}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── TAB: Login Attempts ── */}
      {activeTab === "attempts" && (
        <div>
          <p className="text-gray-400 text-sm mb-4">Recent suspicious and failed login attempts (last 24h)</p>
          {!loginStats?.suspicious?.length ? (
            <div className="text-center py-16 text-gray-500">
              <ShieldCheck className="w-12 h-12 mx-auto mb-3 text-green-600" />
              No suspicious activity in last 24 hours
            </div>
          ) : (
            <div className="space-y-2">
              {loginStats.suspicious.map((attempt: any, i: number) => (
                <div
                  key={i}
                  className="bg-gray-900 border border-gray-800 rounded-lg p-4 flex items-center gap-4"
                >
                  <div className="flex-shrink-0">
                    {attempt.success ? (
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-white truncate">{attempt.email}</span>
                      <span className="text-xs text-gray-500 capitalize bg-gray-800 px-2 py-0.5 rounded">
                        {attempt.method}
                      </span>
                      {attempt.riskScore !== undefined && (
                        <RiskBadge score={attempt.riskScore} />
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>IP: {attempt.ip ?? "—"}</span>
                      {attempt.riskFactors?.length > 0 && (
                        <span className="text-orange-400">⚠ {attempt.riskFactors.join(", ")}</span>
                      )}
                      {attempt.blockedReason && (
                        <span className="text-red-400">🔒 {attempt.blockedReason}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 flex-shrink-0">
                    {new Date(attempt.createdAt).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Audit Logs ── */}
      {activeTab === "logs" && (
        <div>
          <p className="text-gray-400 text-sm mb-4">All security-related actions across the platform</p>
          {!auditLogs?.length ? (
            <div className="text-center py-16 text-gray-500">
              <Eye className="w-12 h-12 mx-auto mb-3 text-gray-700" />
              No audit logs yet
            </div>
          ) : (
            <div className="space-y-2">
              {auditLogs.map((log: any) => (
                <div
                  key={log._id}
                  className="bg-gray-900 border border-gray-800 rounded-lg p-4 flex items-center gap-4"
                >
                  <div className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-medium text-white text-sm">{log.userName}</span>
                      <span className="text-xs text-gray-500">{log.userEmail}</span>
                    </div>
                    <div className="text-sm text-gray-400">
                      <span className="text-blue-400 font-mono text-xs bg-blue-950/50 px-1.5 py-0.5 rounded mr-2">
                        {log.action}
                      </span>
                      {log.details}
                    </div>
                    {log.ip && (
                      <div className="text-xs text-gray-600 mt-0.5">IP: {log.ip}</div>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 flex-shrink-0">
                    {new Date(log.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
