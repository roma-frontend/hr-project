import { NextRequest, NextResponse } from 'next/server';
import { fetchQuery } from 'convex/nextjs';
import { api } from '../../../../../convex/_generated/api';
import { jwtVerify } from 'jose';

// Opt out of static generation — uses request.url
export const revalidate = 0;

async function getUserRoleFromSession(req: NextRequest): Promise<string> {
  try {
    const token = req.cookies.get('hr-auth-token') || req.cookies.get('oauth-session');
    if (!token) return 'employee';

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) return 'employee';

    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jwtVerify(token.value, secret);
    return (payload.role as string) || 'employee';
  } catch {
    return 'employee';
  }
}

export async function GET(req: NextRequest) {
  try {
    const requesterId = req.nextUrl.searchParams.get('requesterId');
    if (!requesterId) return NextResponse.json({ error: 'requesterId required' }, { status: 400 });

    // Get user role and organization from session
    const userRole = await getUserRoleFromSession(req);
    const isAdmin = userRole === 'admin' || userRole === 'superadmin';
    const isSupervisor = userRole === 'supervisor';

    // Fetch core system data first (needed to get orgId)
    let users: any[] = [],
      leaves: any[] = [],
      todayAttendance: any[] = [],
      allTasks: any[] = [],
      allTickets: any[] = [],
      automationWorkflows: any[] = [];
    try {
      users =
        (await fetchQuery(api.users.queries.getAllUsers, { requesterId: requesterId as any })) ||
        [];
    } catch (e) {
      console.warn('getAllUsers failed:', e);
    }
    try {
      leaves =
        (await fetchQuery(api.leaves.getAllLeaves, { requesterId: requesterId as any })) || [];
    } catch (e) {
      console.warn('getAllLeaves failed:', e);
    }
    try {
      todayAttendance =
        (await fetchQuery(api.timeTracking.getTodayAllAttendance, {
          adminId: requesterId as any,
        })) || [];
    } catch (e) {
      console.warn('getTodayAllAttendance failed:', e);
    }
    try {
      allTasks =
        (await fetchQuery(api.tasks.getAllTasks, { requesterId: requesterId as any })) || [];
    } catch (e) {
      console.warn('getAllTasks failed:', e);
    }
    try {
      allTickets = (await fetchQuery(api.tickets.getAllTickets, {})) || [];
    } catch (e) {
      console.warn('getAllTickets failed:', e);
    }
    try {
      automationWorkflows = (await fetchQuery(api.automation.getActiveWorkflows, {})) || [];
    } catch (e) {
      console.warn('getActiveWorkflows failed:', e);
    }

    // Get organizationId from users list (first user with orgId)
    const firstUserWithOrg = (users as any[])?.find((u: any) => u.organizationId);
    const orgId = firstUserWithOrg?.organizationId;

    // Fetch all surveys (no status filter to see all)
    let allSurveys: any[] = [];
    if (orgId) {
      try {
        console.log('[Full Context] Fetching surveys for orgId:', orgId, typeof orgId);
        allSurveys = await fetchQuery(api.surveys.listSurveys, {
          organizationId: orgId as any, // Convex will validate
          limit: 20,
        });
        console.log(
          '[Full Context] Surveys fetched:',
          allSurveys?.length,
          allSurveys?.map((s: any) => s.title),
        );
      } catch (e) {
        console.warn('Failed to fetch surveys:', e);
      }
    } else {
      console.log('[Full Context] No orgId, skipping surveys fetch');
    }

    // Fetch events if we have an organization
    let allEvents: any[] = [];
    if (orgId) {
      try {
        allEvents = await fetchQuery(api.events.getCompanyEvents, {
          organizationId: orgId,
        });
      } catch (e) {
        console.warn('Failed to fetch events:', e);
      }
    }

    // Fetch driver data if we have organization
    let driverRequests: any[] = [];
    let availableDrivers: any[] = [];
    if (orgId) {
      try {
        // Get first driver for requests
        const drivers = await fetchQuery(api.drivers.queries.getFilteredDrivers, {
          organizationId: orgId,
        });
        if ((drivers as any[])?.length > 0) {
          driverRequests = await fetchQuery(api.drivers.requests_queries.getDriverRequests, {
            driverId: (drivers as any[])[0]._id,
          });
        }
        availableDrivers = await fetchQuery(api.drivers.queries.getAvailableDrivers, {
          organizationId: orgId,
        });
      } catch (e) {
        console.warn('Failed to fetch driver data:', e);
      }
    }

    // Fetch Goals/OKR
    let allGoals: any[] = [];
    let myGoals: any[] = [];
    try {
      allGoals = await fetchQuery(api.goals.listObjectives, { requesterId: requesterId as any });
      myGoals = await fetchQuery(api.goals.getMyObjectives, { requesterId: requesterId as any });
      console.log('[Full Context] Goals fetched:', allGoals?.length, 'My goals:', myGoals?.length);
    } catch (e) {
      console.warn('Failed to fetch goals:', e);
    }

    // Fetch Recognition/Kudos (if user role allows)
    let kudosFeed: any[] = [];
    let leaderboard: any[] = [];
    try {
      kudosFeed = await fetchQuery(api.recognition.getKudosFeed, { limit: 20 });
      leaderboard = await fetchQuery(api.recognition.getLeaderboard, { limit: 10 });
      console.log('[Full Context] Kudos fetched:', kudosFeed?.length);
    } catch (e) {
      console.warn('Failed to fetch recognition:', e);
    }

    // Fetch Corporate Policies
    let corporateDocs: any[] = [];
    if (orgId) {
      try {
        const allDocs = await fetchQuery(api.signatures.listDocuments, {});
        corporateDocs = (allDocs as any[])?.filter((d: any) => d.organizationId === orgId) || [];
        console.log('[Full Context] Corporate docs fetched:', corporateDocs?.length);
      } catch (e) {
        console.warn('Failed to fetch corporate docs:', e);
      }
    }

    // Fetch Performance Reviews (admin/supervisor only)
    let performanceData: any = null;
    if (isAdmin || isSupervisor) {
      try {
        performanceData = await fetchQuery(api.performance.getCycleSummary, {
          requesterId: requesterId as any,
        });
        console.log('[Full Context] Performance data fetched:', performanceData?.cycles?.length);
      } catch (e) {
        console.warn('Failed to fetch performance data:', e);
      }
    }

    // Fetch Unread Messages (chat module) - simplified
    let unreadMessages = 0;
    const unreadConversations: any[] = [];
    try {
      const unreadData = await fetchQuery((api.chat.queries as any).getTotalUnread, {
        userId: requesterId as any,
      });
      unreadMessages = (unreadData as any)?.total || 0;
      console.log('[Full Context] Unread messages:', unreadMessages);
    } catch (e) {
      console.warn('Failed to fetch unread messages:', e);
    }

    // Fetch Unread Notifications - simplified
    let unreadNotifications = 0;
    try {
      const notifData = await fetchQuery(api.notifications.getUnreadCount, {
        userId: requesterId as any,
      });
      unreadNotifications = (notifData as any)?.count || 0;
      console.log('[Full Context] Unread notifications:', unreadNotifications);
    } catch (e) {
      console.warn('Failed to fetch unread notifications:', e);
    }

    // Fetch Unread Leave Approvals (for supervisors/admins)
    let unreadLeaveApprovals = 0;
    try {
      const leaveData = await fetchQuery(api.leaves.getUnreadCount, {
        managerId: requesterId as any,
      });
      unreadLeaveApprovals = (leaveData as any)?.count || 0;
      console.log('[Full Context] Unread leave approvals:', unreadLeaveApprovals);
    } catch (e) {
      console.warn('Failed to fetch unread approvals:', e);
    }

    // Build rich employee map with leave info
    // Filter out superadmins from employee data
    const filteredUsers = (users as any[]).filter((u: any) => u.role !== 'superadmin');

    const employeeData = filteredUsers.map((u: any) => {
      const userLeaves = (leaves as any[]).filter((l: any) => l.userId === u._id);
      const todayRecord = (todayAttendance as any[]).find((t: any) => t.userId === u._id);

      const approvedLeaves = userLeaves.filter((l: any) => l.status === 'approved');
      const pendingLeaves = userLeaves.filter((l: any) => l.status === 'pending');

      // Current/upcoming leaves
      const now = new Date().toISOString().split('T')[0] || '';
      const activeLeave = approvedLeaves.find((l: any) => l.startDate <= now && l.endDate >= now);
      const upcomingLeaves = approvedLeaves
        .filter((l: any) => l.startDate > now)
        .sort((a: any, b: any) => a.startDate.localeCompare(b.startDate))
        .slice(0, 3);

      return {
        id: u._id,
        name: u.name,
        email: u.email,
        role: u.role,
        department: u.department,
        position: u.position,
        employeeType: u.employeeType,
        // Today's attendance
        todayStatus: todayRecord
          ? {
              status: todayRecord.status,
              checkIn: todayRecord.checkInTime
                ? new Date(todayRecord.checkInTime).toLocaleTimeString('en-GB', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : null,
              checkOut: todayRecord.checkOutTime
                ? new Date(todayRecord.checkOutTime).toLocaleTimeString('en-GB', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : null,
              isLate: todayRecord.isLate,
              lateMinutes: todayRecord.lateMinutes,
              workedHours: todayRecord.totalWorkedMinutes
                ? (todayRecord.totalWorkedMinutes / 60).toFixed(1)
                : null,
            }
          : null,
        // Leave balances
        leaveBalance: u.leaveBalance ?? { paid: 20, sick: 10, family: 5, unpaid: 30 },
        // Currently on leave — include real leaveId for edit/delete!
        currentLeave: activeLeave
          ? {
              leaveId: activeLeave._id,
              type: activeLeave.type,
              startDate: activeLeave.startDate,
              endDate: activeLeave.endDate,
              reason: activeLeave.reason,
              status: activeLeave.status,
            }
          : null,
        // Upcoming leaves — include real leaveId!
        upcomingLeaves: upcomingLeaves.map((l: any) => ({
          leaveId: l._id,
          type: l.type,
          startDate: l.startDate,
          endDate: l.endDate,
          days: l.days,
          status: l.status,
        })),
        // Pending requests — include real leaveId!
        pendingLeaves: pendingLeaves.map((l: any) => ({
          leaveId: l._id,
          type: l.type,
          startDate: l.startDate,
          endDate: l.endDate,
          days: l.days,
          status: l.status,
        })),
        // ALL leaves for this employee (for edit/delete)
        allLeaves: userLeaves.map((l: any) => ({
          leaveId: l._id,
          type: l.type,
          startDate: l.startDate,
          endDate: l.endDate,
          days: l.days,
          status: l.status,
          reason: l.reason,
        })),
        // Leave history summary
        totalLeavesTaken: approvedLeaves.reduce((sum: number, l: any) => sum + (l.days ?? 0), 0),
        // Supervisor
        supervisorName: u.supervisorId
          ? ((users as any[]).find((s: any) => s._id === u.supervisorId)?.name ?? null)
          : null,
        // Presence status
        presenceStatus: u.presenceStatus ?? 'available',
        // Tasks
        tasks: (allTasks as any[])
          .filter((t: any) => t.assignedTo === u._id)
          .map((t: any) => ({
            taskId: t._id,
            title: t.title,
            status: t.status,
            priority: t.priority,
            deadline: t.deadline ? new Date(t.deadline).toISOString().split('T')[0] : null,
            assignedBy:
              (users as any[]).find((s: any) => s._id === t.assignedBy)?.name ?? 'Unknown',
          })),
      };
    });

    // Calendar events — all approved leaves next 90 days
    const now = new Date().toISOString().split('T')[0] || '';
    const in90Days =
      new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] || '';
    const calendarEvents = (leaves as any[])
      .filter((l: any) => l.status === 'approved' && l.endDate >= now && l.startDate <= in90Days)
      .map((l: any) => {
        const user = (users as any[]).find((u: any) => u._id === l.userId);
        return {
          employee: user?.name ?? 'Unknown',
          department: user?.department ?? '',
          type: l.type,
          startDate: l.startDate,
          endDate: l.endDate,
          days: l.days,
        };
      })
      .sort((a: any, b: any) => a.startDate.localeCompare(b.startDate));

    // Today's attendance summary
    const presentToday = (todayAttendance as any[]).map((t: any) => {
      const user = (users as any[]).find((u: any) => u._id === t.userId);
      return {
        name: user?.name ?? 'Unknown',
        department: user?.department ?? '',
        status: t.status,
        checkIn: t.checkInTime
          ? new Date(t.checkInTime).toLocaleTimeString('en-GB', {
              hour: '2-digit',
              minute: '2-digit',
            })
          : null,
        checkOut: t.checkOutTime
          ? new Date(t.checkOutTime).toLocaleTimeString('en-GB', {
              hour: '2-digit',
              minute: '2-digit',
            })
          : null,
        isLate: t.isLate,
        lateMinutes: t.lateMinutes,
      };
    });

    return NextResponse.json({
      employees: employeeData,
      calendarEvents,
      todayAttendance: presentToday,
      totalEmployees: filteredUsers.length,
      currentlyAtWork: presentToday.filter((t: any) => t.status === 'checked_in').length,
      onLeaveToday: employeeData.filter((e: any) => e.currentLeave).length,
      // Tickets - filter based on role
      tickets: (() => {
        let filtered = allTickets as any[];
        if (!isAdmin && !isSupervisor) {
          filtered = (allTickets as any[]).filter(
            (t: any) => t.createdByUserId === requesterId || t.assignedTo === requesterId,
          );
        }
        return filtered.map((t: any) => ({
          ticketId: t._id,
          ticketNumber: t.ticketNumber,
          title: t.title,
          description: t.description,
          status: t.status,
          priority: t.priority,
          category: t.category,
          createdBy: t.creatorName ?? 'Unknown',
          assignedTo: t.assigneeName,
          createdAt: t.createdAt,
          isOverdue: t.isOverdue,
        }));
      })(),
      ticketStats: {
        total: (allTickets as any[]).length,
        open: (allTickets as any[]).filter((t: any) => t.status === 'open').length,
        inProgress: (allTickets as any[]).filter((t: any) => t.status === 'in_progress').length,
        resolved: (allTickets as any[]).filter((t: any) => t.status === 'resolved').length,
        closed: (allTickets as any[]).filter((t: any) => t.status === 'closed').length,
        critical: (allTickets as any[]).filter(
          (t: any) => t.priority === 'critical' && t.status !== 'closed',
        ).length,
      },
      // Events
      companyEvents: (allEvents as any[]).map((e: any) => ({
        eventId: e._id,
        name: e.name,
        description: e.description,
        startDate: new Date(e.startDate).toISOString().split('T')[0],
        endDate: new Date(e.endDate).toISOString().split('T')[0],
        eventType: e.eventType,
        priority: e.priority,
        createdBy: e.creatorName,
        requiredDepartments: e.requiredDepartments,
      })),
      // Automation
      automationWorkflows: (automationWorkflows as any[]).map((w: any) => ({
        workflowId: w._id,
        name: w.name,
        description: w.description,
        isActive: w.isActive,
        createdAt: w.createdAt,
      })),
      // Drivers
      driverRequests: (driverRequests as any[]).map((r: any) => ({
        requestId: r._id,
        status: r.status,
        pickupLocation: r.pickupLocation,
        dropoffLocation: r.dropoffLocation,
        requestedBy: r.requestedBy,
        scheduledFor: r.scheduledFor,
      })),
      availableDrivers: (availableDrivers as any[]).map((d: any) => ({
        driverId: d._id,
        name: d.name,
        vehicle: d.vehicle,
        status: d.status,
      })),
      // All Surveys
      surveys: (allSurveys as any[]).map((s: any) => ({
        surveyId: s._id,
        title: s.title,
        description: s.description,
        status: s.status,
        isAnonymous: s.isAnonymous,
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        createdBy: s.creator?.name || 'Unknown',
        responseCount: s.responseCount || 0,
      })),
      // Goals & OKR
      goals: (allGoals as any[]).map((g: any) => ({
        goalId: g._id,
        title: g.title,
        description: g.description,
        progress: g.progress,
        status: g.status,
        dueDate: g.dueDate,
        ownerId: g.ownerId,
        ownerName: g.owner?.name || g.ownerName,
        keyResults: (g.keyResults || []).map((kr: any) => ({
          title: kr.title,
          progress: kr.progress,
          currentValue: kr.currentValue,
          targetValue: kr.targetValue,
        })),
      })),
      myGoals: (myGoals as any[]).map((g: any) => ({
        goalId: g._id,
        title: g.title,
        progress: g.progress,
        status: g.status,
        dueDate: g.dueDate,
      })),
      // Recognition & Kudos
      kudosFeed: (kudosFeed as any[]).map((k: any) => ({
        kudosId: k._id,
        message: k.message,
        senderName: k.sender?.name || k.senderName,
        receiverName: k.receiver?.name || k.receiverName,
        badge: k.badge?.name || k.badgeName,
        createdAt: k._creationTime,
      })),
      leaderboard: (leaderboard as any[]).map((l: any) => ({
        userId: l.userId,
        userName: l.user?.name || l.userName,
        points: l.totalPoints,
        rank: l.rank,
      })),
      // Corporate Policies
      corporateDocs: (corporateDocs as any[]).map((d: any) => ({
        docId: d._id,
        title: d.title,
        category: d.category,
        createdAt: d._creationTime,
      })),
      // Performance Reviews (admin/supervisor only)
      performanceReviews: (performanceData?.cycles || []).map((c: any) => ({
        cycleId: c._id,
        name: c.name,
        status: c.status,
        startDate: c.startDate,
        endDate: c.endDate,
        totalParticipants: c.totalParticipants || 0,
        completedReviews: c.completedReviews || 0,
      })),
      // Unread counts
      unreadMessages,
      unreadConversations: (unreadConversations as any[]).slice(0, 5).map((c: any) => ({
        conversationId: c._id,
        name: c.name,
        lastMessage: c.lastMessage?.content || c.lastMessagePreview,
        unreadCount: c.unreadCount,
        fromUser: c.lastMessage?.sender?.name || c.lastSenderName,
      })),
      unreadNotifications,
      unreadLeaveApprovals,
    });
  } catch (error) {
    console.error('Full context error:', error);
    return NextResponse.json({
      employees: [],
      calendarEvents: [],
      todayAttendance: [],
      tickets: [],
      companyEvents: [],
      automationWorkflows: [],
      driverRequests: [],
      availableDrivers: [],
      surveys: [],
      goals: [],
      myGoals: [],
      kudosFeed: [],
      leaderboard: [],
      corporateDocs: [],
      performanceReviews: [],
      unreadMessages: 0,
      unreadConversations: [],
      unreadNotifications: 0,
      unreadLeaveApprovals: 0,
    });
  }
}
