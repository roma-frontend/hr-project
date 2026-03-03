"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useParams, useRouter } from "next/navigation";
import { ShieldLoader } from "@/components/ui/ShieldLoader";
import { useAuthStore } from "@/store/useAuthStore";
import { Shield, ArrowLeft, Ban, CheckCircle, AlertTriangle, Clock, MapPin, Monitor } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export default function SecurityAlertDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const userId = params.userId as string;
  
  const [suspendDuration, setSuspendDuration] = useState(24);
  const [suspendReason, setSuspendReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Check if current user is superadmin
  const isSuperadmin = user?.email?.toLowerCase() === "romangulanyan@gmail.com";

  // Get user details
  const suspiciousUser = useQuery(
    api.users.getUserById,
    user?.id ? { userId: userId as Id<"users">, requesterId: user.id as Id<"users"> } : "skip"
  );

  // Get recent login attempts for this user
  const recentAttempts = useQuery(
    api.security.getLoginAttemptsByUser,
    userId ? { userId: userId as Id<"users">, limit: 10 } : "skip"
  );

  // Mutations
  const suspendUserMutation = useMutation(api.users.suspendUser);
  const unsuspendUserMutation = useMutation(api.users.unsuspendUser);

  if (!isSuperadmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 mx-auto mb-4 text-red-500" />
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-muted-foreground">Only superadmin can access this page</p>
        </div>
      </div>
    );
  }

  if (!suspiciousUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <ShieldLoader size="lg" message="Loading security details..." />
      </div>
    );
  }

  const handleSuspend = async () => {
    if (!suspendReason.trim()) {
      toast.error("Please provide a reason for suspension");
      return;
    }

    setIsProcessing(true);
    try {
      await suspendUserMutation({
        adminId: user!.id as Id<"users">,
        userId: userId as Id<"users">,
        reason: suspendReason,
        duration: suspendDuration,
      });

      toast.success(`User suspended for ${suspendDuration} hours`);
      setSuspendReason("");
    } catch (error: any) {
      toast.error(error.message || "Failed to suspend user");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUnsuspend = async () => {
    setIsProcessing(true);
    try {
      await unsuspendUserMutation({
        adminId: user!.id as Id<"users">,
        userId: userId as Id<"users">,
      });

      toast.success("User unsuspended successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to unsuspend user");
    } finally {
      setIsProcessing(false);
    }
  };

  const getRiskColor = (score?: number) => {
    if (!score) return "text-gray-500";
    if (score >= 80) return "text-red-500";
    if (score >= 50) return "text-orange-500";
    return "text-yellow-500";
  };

  const getRiskLabel = (score?: number) => {
    if (!score) return "Unknown";
    if (score >= 80) return "HIGH RISK";
    if (score >= 50) return "MODERATE";
    return "LOW";
  };

  return (
    <div className="min-h-screen p-6 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.push("/superadmin/security")}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Security Center
          </button>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Security Alert Details</h1>
              <p className="text-gray-600 mt-1">Review and manage suspicious activity</p>
            </div>
            
            {suspiciousUser.isSuspended && (
              <div className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg">
                <Ban className="w-5 h-5" />
                <span className="font-semibold">Account Suspended</span>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* User Info Card */}
          <div className="lg:col-span-2 space-y-6">
            {/* User Details */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5" />
                User Information
              </h2>
              
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  {suspiciousUser.avatarUrl ? (
                    <img src={suspiciousUser.avatarUrl} alt={suspiciousUser.name} className="w-16 h-16 rounded-full" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold">
                      {suspiciousUser.name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <h3 className="text-lg font-semibold">{suspiciousUser.name}</h3>
                    <p className="text-sm text-gray-600">{suspiciousUser.email}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div>
                    <p className="text-sm text-gray-600">Role</p>
                    <p className="font-semibold capitalize">{suspiciousUser.role}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Department</p>
                    <p className="font-semibold">{suspiciousUser.department || "—"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Position</p>
                    <p className="font-semibold">{suspiciousUser.position || "—"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Status</p>
                    <p className={`font-semibold ${suspiciousUser.isActive ? "text-green-600" : "text-red-600"}`}>
                      {suspiciousUser.isActive ? "Active" : "Inactive"}
                    </p>
                  </div>
                </div>

                {suspiciousUser.isSuspended && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-sm font-semibold text-red-700">Suspension Details</p>
                      {suspiciousUser.suspendedReason?.includes("AUTO-BLOCKED") && (
                        <span className="text-xs font-bold bg-red-600 text-white px-2 py-1 rounded">
                          AUTO-BLOCKED
                        </span>
                      )}
                    </div>
                    <div className="space-y-1 text-sm">
                      <p><span className="font-medium">Reason:</span> {suspiciousUser.suspendedReason}</p>
                      <p><span className="font-medium">Until:</span> {new Date(suspiciousUser.suspendedUntil!).toLocaleString()}</p>
                      <p><span className="font-medium">Suspended at:</span> {new Date(suspiciousUser.suspendedAt!).toLocaleString()}</p>
                      {suspiciousUser.suspendedReason?.includes("AUTO-BLOCKED") && (
                        <p className="text-xs text-red-600 font-medium mt-2 pt-2 border-t border-red-200">
                          ⚡ This user was automatically blocked by the security system due to high-risk activity.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Login Attempts */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Recent Login Attempts
              </h2>
              
              {!recentAttempts || recentAttempts.length === 0 ? (
                <p className="text-gray-500 text-sm">No recent login attempts</p>
              ) : (
                <div className="space-y-3">
                  {recentAttempts.map((attempt) => (
                    <div
                      key={attempt._id}
                      className={`p-4 rounded-lg border ${
                        attempt.success
                          ? "bg-green-50 border-green-200"
                          : "bg-red-50 border-red-200"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {attempt.success ? (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            ) : (
                              <AlertTriangle className="w-4 h-4 text-red-600" />
                            )}
                            <span className={`font-semibold text-sm ${
                              attempt.success ? "text-green-700" : "text-red-700"
                            }`}>
                              {attempt.success ? "Successful Login" : "Failed Login"}
                            </span>
                            {attempt.riskScore && (
                              <span className={`text-xs font-bold ${getRiskColor(attempt.riskScore)}`}>
                                {getRiskLabel(attempt.riskScore)}
                              </span>
                            )}
                          </div>
                          
                          <div className="text-sm space-y-1">
                            <p className="flex items-center gap-2">
                              <Monitor className="w-3 h-3" />
                              Method: <span className="font-medium capitalize">{attempt.method}</span>
                            </p>
                            {attempt.ip && (
                              <p className="flex items-center gap-2">
                                <MapPin className="w-3 h-3" />
                                IP: <span className="font-medium">{attempt.ip}</span>
                                {attempt.city && ` (${attempt.city}, ${attempt.country})`}
                              </p>
                            )}
                            {attempt.riskFactors && attempt.riskFactors.length > 0 && (
                              <p className="text-red-600 font-medium mt-2">
                                Risk Factors: {attempt.riskFactors.join(", ")}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        <div className="text-xs text-gray-500">
                          {new Date(attempt.createdAt).toLocaleString()}
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
            {suspiciousUser.isSuspended ? (
              /* Unsuspend Card */
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-green-600">
                  <CheckCircle className="w-5 h-5" />
                  Unsuspend Account
                </h2>
                
                <p className="text-sm text-gray-600 mb-4">
                  This will immediately restore the user's access to the system.
                </p>
                
                <button
                  onClick={handleUnsuspend}
                  disabled={isProcessing}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-3 rounded-lg font-semibold transition-colors"
                >
                  {isProcessing ? "Processing..." : "Unsuspend User"}
                </button>
              </div>
            ) : (
              /* Suspend Card */
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-red-600">
                  <Ban className="w-5 h-5" />
                  Suspend Account
                </h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Suspension Duration (hours)
                    </label>
                    <input
                      type="number"
                      min="0.1"
                      step="1"
                      value={suspendDuration}
                      onChange={(e) => setSuspendDuration(parseFloat(e.target.value))}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      User will be auto-unsuspended after this time
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Reason for Suspension *
                    </label>
                    <textarea
                      value={suspendReason}
                      onChange={(e) => setSuspendReason(e.target.value)}
                      placeholder="e.g., Suspicious login activity from unknown location"
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                      rows={4}
                    />
                  </div>
                  
                  <button
                    onClick={handleSuspend}
                    disabled={isProcessing || !suspendReason.trim()}
                    className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white px-4 py-3 rounded-lg font-semibold transition-colors"
                  >
                    {isProcessing ? "Processing..." : "Suspend User"}
                  </button>
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="bg-blue-50 rounded-xl border border-blue-200 p-6">
              <h3 className="font-semibold mb-3 text-blue-900">Quick Presets</h3>
              <div className="space-y-2">
                <button
                  onClick={() => {
                    setSuspendDuration(1);
                    setSuspendReason("Temporary suspension for investigation (1 hour)");
                  }}
                  className="w-full text-left px-3 py-2 bg-white hover:bg-blue-100 rounded-lg text-sm transition-colors"
                >
                  1 hour (investigation)
                </button>
                <button
                  onClick={() => {
                    setSuspendDuration(24);
                    setSuspendReason("Suspicious activity detected - 24 hour suspension");
                  }}
                  className="w-full text-left px-3 py-2 bg-white hover:bg-blue-100 rounded-lg text-sm transition-colors"
                >
                  24 hours (suspicious)
                </button>
                <button
                  onClick={() => {
                    setSuspendDuration(168);
                    setSuspendReason("Security breach - 1 week suspension pending review");
                  }}
                  className="w-full text-left px-3 py-2 bg-white hover:bg-blue-100 rounded-lg text-sm transition-colors"
                >
                  1 week (security breach)
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
