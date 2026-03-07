"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuthStore } from "@/store/useAuthStore";
import { Id } from "../../../convex/_generated/dataModel";
import { SmartBanner } from "@/components/ui/SmartBanner";
import { useRouter } from "next/navigation";
import { MessageSquare } from "lucide-react";

/**
 * Real-time notification banner that slides in from top
 * when new unread notifications arrive (chat messages, leave requests, etc.)
 */
export function NotificationBanner() {
  const { user } = useAuthStore();
  const router = useRouter();

  const notifications = useQuery(
    api.notifications.getUserNotifications,
    user?.id ? { userId: user.id as Id<"users"> } : "skip"
  );

  const [lastSeenCount, setLastSeenCount] = useState<number | null>(null);
  const [newNotification, setNewNotification] = useState<{
    title: string;
    message: string;
    type: string;
  } | null>(null);

  useEffect(() => {
    if (!notifications) return;

    const unread = notifications.filter((n) => !n.isRead);
    const currentCount = unread.length;

    // On first load, just record the count
    if (lastSeenCount === null) {
      setLastSeenCount(currentCount);
      return;
    }

    // If new unread appeared, show the latest one
    if (currentCount > lastSeenCount && unread.length > 0) {
      const latest = unread[0]; // most recent
      setNewNotification({
        title: latest.title,
        message: latest.message,
        type: latest.type,
      });
    }

    setLastSeenCount(currentCount);
  }, [notifications, lastSeenCount]);

  const handleDismiss = useCallback(() => {
    setNewNotification(null);
  }, []);

  if (!newNotification) return null;

  // Map notification type to banner type
  const bannerType =
    newNotification.type === "leave_approved"
      ? ("success" as const)
      : newNotification.type === "leave_rejected"
        ? ("error" as const)
        : newNotification.type === "security_alert"
          ? ("warning" as const)
          : ("purple" as const);

  return (
    <div className="fixed top-20 right-4 z-[100] w-80 sm:w-96">
      <SmartBanner
        type={bannerType}
        message={newNotification.title}
        suggestion={newNotification.message}
        icon={<MessageSquare className="w-5 h-5" />}
        autoDismiss={8000}
        onDismiss={handleDismiss}
        action={{
          label: "View",
          onClick: () => {
            handleDismiss();
            if (
              newNotification.type === "leave_request" ||
              newNotification.type === "leave_approved" ||
              newNotification.type === "leave_rejected"
            ) {
              router.push("/leaves");
            } else {
              router.push("/dashboard");
            }
          },
        }}
      />
    </div>
  );
}
