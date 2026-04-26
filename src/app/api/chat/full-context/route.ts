import { NextRequest, NextResponse } from 'next/server';
import { fetchQuery } from 'convex/nextjs';
import { api } from '../../../../../convex/_generated/api';

// Opt out of static generation — uses request.url
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const requesterId = req.nextUrl.searchParams.get('requesterId');
    if (!requesterId) return NextResponse.json({ error: 'requesterId required' }, { status: 400 });

    // Fetch core system data in parallel first
    const [users, leaves, todayAttendance, allTasks, allTickets, automationWorkflows] =
      await Promise.all([
        fetchQuery(api.users.queries.getAllUsers, { requesterId: requesterId as any }),
        fetchQuery(api.leaves.getAllLeaves, { requesterId: requesterId as any }),
        fetchQuery(api.timeTracking.getTodayAllAttendance, { adminId: requesterId as any }),
        fetchQuery(api.tasks.getAllTasks, { requesterId: requesterId as any }),
        fetchQuery(api.tickets.getAllTickets, {
          status: undefined,
          priority: undefined,
          organizationId: undefined,
          assignedTo: undefined,
          limit: undefined,
          cursor: undefined,
        }),
        fetchQuery(api.automation.getActiveWorkflows, {}),
      ]);

    // Get organizationId from first user for dependent queries
    const orgId = (users as any[])?.[0]?.organizationId;

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
      // Tickets
      tickets: (allTickets as any[]).map((t: any) => ({
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
      })),
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
    });
  }
}
