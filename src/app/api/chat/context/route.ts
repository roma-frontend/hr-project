import { NextRequest, NextResponse } from 'next/server';
import { fetchQuery } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';
import { signConvexJWT, type JWTPayload } from '@/lib/jwt';
import { logger } from '@/lib/logger';

const _CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL!;

// Opt out of static generation — uses cookies
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const sessionToken = req.cookies.get('hr-session-token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get user session using Convex
    const session = await fetchQuery(api.auth.getSession, { sessionToken });

    if (!session) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Get user data
    const userId = session.userId;
    if (!userId || userId === '') {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 401 });
    }

    // Fetch user's leave data
    const convexToken = await signConvexJWT({
      userId: String(userId),
      name: session.name,
      email: session.email,
      role: session.role as JWTPayload['role'],
      organizationId: session.organizationId,
    });
    const analytics = await fetchQuery(
      api.analytics.getUserAnalytics,
      { userId },
      { token: convexToken },
    );
    if (!analytics) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
    const teamCalendar = await fetchQuery(
      api.analytics.getTeamCalendar,
      {},
      { token: convexToken },
    );

    // Build context for AI
    const context = {
      user: {
        id: userId,
        name: session.name,
        email: session.email,
        role: session.role,
        department: session.department,
        organizationId: session.organizationId,
      },
      leaveBalances: {
        paid: analytics.balances.paid,
        sick: analytics.balances.sick,
        family: analytics.balances.family,
      },
      stats: {
        totalDaysTaken: analytics.totalDaysTaken,
        pendingDays: analytics.pendingDays,
      },
      recentLeaves: ((analytics as { userLeaves?: unknown[] }).userLeaves ?? [])
        .slice(0, 5)
        .map((l: unknown) => {
          const x = l as {
            type: string;
            startDate: string;
            endDate: string;
            status: string;
            days: number;
          };
          return {
            type: x.type,
            startDate: x.startDate,
            endDate: x.endDate,
            status: x.status,
            days: x.days,
          };
        }),
      teamAvailability: (() => {
        const cal: unknown = teamCalendar;
        const arr = Array.isArray(cal) ? cal : ((cal as { data?: unknown[] })?.data ?? []);
        return arr.slice(0, 10).map((l: unknown) => {
          const x = l as {
            userName?: string;
            userDepartment?: string;
            startDate: string;
            endDate: string;
          };
          return {
            userName: x.userName,
            department: x.userDepartment,
            startDate: x.startDate,
            endDate: x.endDate,
          };
        });
      })(),
    };

    return NextResponse.json(context);
  } catch (error) {
    logger.error('Context error:', error);
    return NextResponse.json({ error: 'Failed to get context' }, { status: 500 });
  }
}
