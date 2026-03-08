"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useSession } from "next-auth/react";
import { useAuthStore } from "@/store/useAuthStore";
import { useSidebarStore } from "@/store/useSidebarStore";
import { usePathname } from "next/navigation";
import { ShieldLoader } from "@/components/ui/ShieldLoader";

function SidebarSkeleton() {
  return (
    <aside className="hidden lg:flex flex-col w-60 h-screen shrink-0 border-r bg-[var(--sidebar-bg)] border-[var(--sidebar-border)] animate-pulse">
      <div className="h-16 border-b border-[var(--sidebar-border)]" />
      <div className="flex-1 py-4 space-y-1">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-9 mx-2 rounded-lg bg-[var(--background-subtle)]/50" />
        ))}
      </div>
    </aside>
  );
}

const Sidebar = dynamic(
  () => import("@/components/layout/Sidebar").then((m) => m.Sidebar),
  { ssr: false, loading: () => <SidebarSkeleton /> }
);

const MobileSidebar = dynamic(
  () => import("@/components/layout/Sidebar").then((m) => m.MobileSidebar),
  { ssr: false, loading: () => null }
);

const Navbar = dynamic(
  () => import("@/components/layout/Navbar").then((m) => m.Navbar),
  { ssr: false, loading: () => <div className="h-16 border-b border-[var(--border)] bg-[var(--navbar-bg)] fixed top-0 left-0 right-0 z-[60]" /> }
);

const ChatWidget = dynamic(
  () => import("@/components/ai/ChatWidget").then((m) => m.ChatWidget),
  { ssr: false, loading: () => null }
);

const BreakReminderService = dynamic(
  () => import("@/components/productivity/BreakReminderService"),
  { ssr: false, loading: () => null }
);

const FocusModeIndicator = dynamic(
  () => import("@/components/productivity/FocusModeIndicator"),
  { ssr: false, loading: () => null }
);

const NotificationBanner = dynamic(
  () => import("@/components/notifications/NotificationBanner").then((m) => m.NotificationBanner),
  { ssr: false, loading: () => null }
);

const MaintenanceBanner = dynamic(
  () => import("@/components/MaintenanceBanner").then((m) => m.MaintenanceBanner),
  { ssr: false, loading: () => null }
);

export function Providers({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  const { status } = useSession();
  const [hydrated, setHydrated] = useState(false);
  const pathname = usePathname();
  const isChatPage = pathname?.startsWith("/chat");

  useEffect(() => {
    // Rehydrate persisted stores from localStorage on client only
    // This prevents SSR/client mismatch (hydration errors) from localStorage state
    useSidebarStore.persist.rehydrate();

    // Rehydrate auth store from localStorage for email/password login sessions.
    // Email/password login saves user data to localStorage but after page reload
    // the store is empty (skipHydration: true). We need to restore it here.
    // For OAuth sessions, useAuthSync will overwrite with fresh data anyway,
    // so rehydrating stale data first is harmless.
    useAuthStore.persist.rehydrate();

    setHydrated(true);
  }, []);

  // Show Shield HR loader while:
  // 1. Stores haven't hydrated from localStorage yet
  // 2. OAuth session is active (Google login) but user data hasn't been synced from Convex yet
  const isOAuthSyncing = status === "authenticated" && !user;
  if (!hydrated || isOAuthSyncing) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--background)]">
        <ShieldLoader size="lg" />
      </div>
    );
  }

  // transition-colors removed from wrapper div — causes full-tree repaint on theme change
  return (
    <div className="flex h-screen bg-[var(--background)] overflow-hidden">
      {/* Desktop Sidebar — ssr:false prevents localStorage persist mismatch */}
      <Sidebar />

      {/* Mobile Sidebar */}
      <MobileSidebar />

      {/* Main content — contain:layout reduces CLS from child layout changes */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden" style={{ contain: "layout" }}>
        {/* Navbar — ssr:false prevents theme/user/notification mismatch */}
        <Navbar />
        {/* Maintenance warning banner — below navbar, above content */}
        {user && <MaintenanceBanner />}
        {/* Main content area — chat page gets no padding and no scroll (manages its own) */}
        <main className={isChatPage ? "flex-1 overflow-hidden flex flex-col min-h-0" : "flex-1 overflow-y-auto overflow-x-hidden"}>
          {isChatPage ? (
            <div className="flex flex-col flex-1 min-h-0 h-full p-0 sm:p-3 md:p-4">
              {children}
            </div>
          ) : (
            <div className="p-2 sm:p-4 md:p-6 max-w-[1600px] mx-auto">
              {children}
            </div>
          )}
        </main>
      </div>
      {/* AI Chat Widget - hidden on /chat page so it doesn't cover the send button */}
      {!isChatPage && <ChatWidget />}

      {/* Real-time notification banners */}
      {hydrated && user && <NotificationBanner />}

      {/* Productivity Services - only render when mounted to avoid SSR mismatch */}
      {hydrated && user && (
        <>
          <BreakReminderService
            enabled={false}
            intervalMinutes={120}
            workHoursStart={undefined}
            workHoursEnd={undefined}
          />
          <FocusModeIndicator
            enabled={false}
            workHoursStart={undefined}
            workHoursEnd={undefined}
          />
        </>
      )}
    </div>
  );
}
