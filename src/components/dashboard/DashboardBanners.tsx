"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { Shield, Timer } from "lucide-react";
import { SmartBanner } from "@/components/ui/SmartBanner";
import { useAuthStore } from "@/store/useAuthStore";

interface DashboardBannersProps {
  /** Leave balances from Convex user data */
  paidLeaveBalance?: number;
  sickLeaveBalance?: number;
  familyLeaveBalance?: number;
  /** User's createdAt timestamp — to detect first-time login */
  userCreatedAt?: number;
  /** Last login timestamp */
  lastLoginAt?: number;
}

export function DashboardBanners({
  paidLeaveBalance,
  sickLeaveBalance,
  familyLeaveBalance,
  userCreatedAt,
  lastLoginAt,
}: DashboardBannersProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuthStore();

  // ── 1. Success banner after login ─────────────────────────────────────────
  const [showLoginSuccess, setShowLoginSuccess] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const justLoggedIn = sessionStorage.getItem("just_logged_in");
      if (justLoggedIn === "true") {
        setShowLoginSuccess(true);
        sessionStorage.removeItem("just_logged_in");
      }
    }
  }, []);

  // ── 2. Suspicious login warning ───────────────────────────────────────────
  const [showSuspiciousLogin, setShowSuspiciousLogin] = useState(false);
  const [suspiciousDetails, setSuspiciousDetails] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const suspicious = sessionStorage.getItem("suspicious_login");
      if (suspicious) {
        setShowSuspiciousLogin(true);
        setSuspiciousDetails(suspicious);
        sessionStorage.removeItem("suspicious_login");
      }
    }
  }, []);

  // ── 3. Session expiry countdown ───────────────────────────────────────────
  const [showSessionExpiry, setShowSessionExpiry] = useState(false);
  const [sessionMinutes, setSessionMinutes] = useState(5);

  useEffect(() => {
    // Check session expiry every 60 seconds
    const checkSession = () => {
      if (typeof window === "undefined") return;
      const cookieStr = document.cookie;
      const sessionCookie = cookieStr
        .split("; ")
        .find((c) => c.startsWith("session_expiry="));

      if (sessionCookie) {
        const expiry = parseInt(sessionCookie.split("=")[1], 10);
        const remaining = expiry - Date.now();
        const minutesLeft = Math.ceil(remaining / 60000);

        if (minutesLeft <= 5 && minutesLeft > 0) {
          setSessionMinutes(minutesLeft);
          setShowSessionExpiry(true);
        } else {
          setShowSessionExpiry(false);
        }
      }
    };

    checkSession();
    const interval = setInterval(checkSession, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleExtendSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/refresh-session", { method: "POST" });
      if (res.ok) {
        setShowSessionExpiry(false);
      }
    } catch {
      // If refresh fails, session will expire naturally
    }
  }, []);

  // ── 4. Welcome banner for new employees ───────────────────────────────────
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !userCreatedAt) return;

    // Show welcome if account created within last 24 hours
    // AND user hasn't dismissed it before
    const ageMs = Date.now() - userCreatedAt;
    const isNewUser = ageMs < 24 * 60 * 60 * 1000;
    const dismissed = localStorage.getItem("welcome_banner_dismissed");

    if (isNewUser && !dismissed) {
      setShowWelcome(true);
    }
  }, [userCreatedAt]);

  const handleDismissWelcome = useCallback(() => {
    setShowWelcome(false);
    localStorage.setItem("welcome_banner_dismissed", "true");
  }, []);

  // ── 5. Leave balance warning ──────────────────────────────────────────────
  const lowBalances: string[] = [];
  if (paidLeaveBalance !== undefined && paidLeaveBalance <= 2) {
    lowBalances.push(`Paid leave: ${paidLeaveBalance} days`);
  }
  if (sickLeaveBalance !== undefined && sickLeaveBalance <= 2) {
    lowBalances.push(`Sick leave: ${sickLeaveBalance} days`);
  }
  if (familyLeaveBalance !== undefined && familyLeaveBalance <= 1) {
    lowBalances.push(`Family leave: ${familyLeaveBalance} days`);
  }
  const showLeaveWarning = lowBalances.length > 0;

  return (
    <div className="space-y-3">
      {/* 1. Login success — green */}
      {showLoginSuccess && (
        <SmartBanner
          type="success"
          message={`Welcome back, ${user?.name?.split(" ")[0] || ""}! You're logged in successfully.`}
          suggestion="Have a productive day ahead!"
          autoDismiss={5000}
          onDismiss={() => setShowLoginSuccess(false)}
        />
      )}

      {/* 2. Suspicious login — warning/orange */}
      {showSuspiciousLogin && (
        <SmartBanner
          type="warning"
          message="Unusual login activity detected"
          suggestion={
            suspiciousDetails ||
            "This login was from a new device or location. If this wasn't you, change your password immediately."
          }
          icon={<Shield className="w-5 h-5 text-amber-500" />}
          action={{
            label: "Review security settings",
            onClick: () => router.push("/settings"),
          }}
          onDismiss={() => setShowSuspiciousLogin(false)}
        />
      )}

      {/* 3. Session expiry countdown — orange */}
      {showSessionExpiry && (
        <SmartBanner
          type="warning"
          message={`Your session expires in ${sessionMinutes} minute${sessionMinutes > 1 ? "s" : ""}`}
          suggestion="Save your work and extend your session to avoid losing changes."
          icon={<Timer className="w-5 h-5 text-amber-500" />}
          dismissable={false}
          action={{
            label: "Extend session",
            onClick: handleExtendSession,
          }}
        />
      )}

      {/* 4. Welcome banner for new employees — purple */}
      {showWelcome && (
        <SmartBanner
          type="purple"
          message="Welcome to the team! We're excited to have you here."
          suggestion="Start by exploring the dashboard, setting up your profile, and checking your leave balances."
          action={{
            label: "Set up your profile",
            onClick: () => router.push("/settings"),
          }}
          onDismiss={handleDismissWelcome}
        />
      )}

      {/* 5. Leave balance warning — orange */}
      {showLeaveWarning && (
        <SmartBanner
          type="warning"
          message="Your leave balance is running low"
          suggestion={lowBalances.join(" / ")}
          action={{
            label: "View leave history",
            onClick: () => router.push("/leaves"),
          }}
          autoDismiss={15000}
        />
      )}
    </div>
  );
}
