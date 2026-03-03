"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuthStore } from "@/store/useAuthStore";
import type { Id } from "../../convex/_generated/dataModel";

export type PlanType = "starter" | "professional" | "enterprise";
export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete";

export interface SubscriptionData {
  plan: PlanType;
  status: SubscriptionStatus;
  currentPeriodEnd?: number;
  cancelAtPeriodEnd: boolean;
  trialEnd?: number;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
}

export function useSubscription() {
  const { user } = useAuthStore();

  // Get organization to determine plan
  const organization = useQuery(
    api.organizations.getMyOrganization,
    user?.id ? { userId: user.id as Id<"users"> } : "skip"
  );

  // NOTE: subscriptions functionality is not implemented yet
  // Using organization plan instead
  const subscription = null as SubscriptionData | null; // useQuery disabled temporarily

  const isLoading = organization === undefined;

  // All users with organization are considered active
  const isActive = !!organization;

  // Get plan from organization, default to starter
  const plan: PlanType = organization?.plan ?? "starter";

  const isTrialing = subscription?.status === "trialing";
  const isCanceled = subscription?.status === "canceled";
  const isPastDue = subscription?.status === "past_due";

  // Дней до конца пробного периода
  const trialDaysLeft =
    isTrialing && subscription?.trialEnd
      ? Math.max(
        0,
        Math.ceil((subscription.trialEnd - Date.now()) / (1000 * 60 * 60 * 24))
      )
      : null;

  // Дней до конца периода
  const periodDaysLeft =
    subscription?.currentPeriodEnd
      ? Math.max(
        0,
        Math.ceil(
          (subscription.currentPeriodEnd - Date.now()) / (1000 * 60 * 60 * 24)
        )
      )
      : null;

  return {
    subscription,
    isLoading,
    isActive,
    plan,
    isTrialing,
    isCanceled,
    isPastDue,
    trialDaysLeft,
    periodDaysLeft,
  };
}
