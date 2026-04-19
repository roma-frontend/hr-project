#!/usr/bin/env node
/**
 * ⏰ Trial Period Reminder System
 * 
 * Checks for subscriptions with ending trial periods and sends reminders
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

// Load environment variables
// In production, use platform env vars (Vercel, etc)
// In development, fallback to .env.local
if (!process.env.CONVEX_URL) {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
}

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
};

interface Subscription {
  _id: string;
  _creationTime: number;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  status: string;
  plan: string;
  userEmail?: string;
  trialEnd?: number;
  currentPeriodStart?: number;
  stripeCurrentPeriodEnd: number;
}

function getDaysUntil(timestamp: number): number {
  const now = Date.now();
  const diff = timestamp - now;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function checkTrialReminders() {

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;

  if (!convexUrl) {
    console.error(`${colors.red}❌ CONVEX_URL not found in .env.local${colors.reset}`);
    process.exit(1);
  }

  const client = new ConvexHttpClient(convexUrl);

  const subscriptions = await client.query(api.subscriptions.listAll) as unknown as Subscription[];

  if (!subscriptions || subscriptions.length === 0) {
    console.log(`${colors.yellow}⚠️  No subscriptions found${colors.reset}`);
    return;
  }


  // Filter trialing subscriptions
  const trialingSubscriptions = subscriptions.filter(sub =>
    sub.status === 'trialing' && sub.trialEnd
  );

  if (trialingSubscriptions.length === 0) {
    return;
  }


  const reminders = {
    critical: [] as Subscription[], // < 3 days
    warning: [] as Subscription[],  // 3-7 days
    info: [] as Subscription[],     // > 7 days
  };

  trialingSubscriptions.forEach(sub => {
    const daysLeft = getDaysUntil(sub.trialEnd!);

    if (daysLeft < 0) {
    } else if (daysLeft <= 3) {
      reminders.critical.push(sub);
    } else if (daysLeft <= 7) {
      reminders.warning.push(sub);
    } else {
      reminders.info.push(sub);
    }
  });

  // Recommended actions
  if (reminders.critical.length > 0 || reminders.warning.length > 0) {

    if (reminders.critical.length > 0) {
      console.log(`${colors.red}1. Critical trials:${colors.reset}`);
      reminders.critical.forEach(sub => {
      });
    }

    if (reminders.warning.length > 0) {
      console.log(`${colors.yellow}2. Warning trials:${colors.reset}`);
      reminders.warning.forEach(sub => {
        console.log(`   ${colors.dim}• Email ${sub.userEmail}: "Make the most of your trial"${colors.reset}`);
      });
      console.log();
    }
  }
}

checkTrialReminders().catch(console.error);
