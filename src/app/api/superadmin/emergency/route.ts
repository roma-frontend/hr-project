import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { serverT } from '@/lib/i18n/server-actions-i18n';
import type { Database } from '@/lib/supabase/database.types';
import { requireSuperadmin } from '@/lib/api-utils';

type TicketRow = Database['public']['Tables']['tickets']['Row'];
type UserRow = Database['public']['Tables']['users']['Row'];
type LoginAttemptRow = Database['public']['Tables']['login_attempts']['Row'];
type OrganizationRow = Database['public']['Tables']['organizations']['Row'];

interface TicketWithCreator {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  createdBy: string;
  organization_id: string | null;
  createdAt: number;
  updatedAt: number | null;
  creatorName: string;
  organizationName: string | null;
  minutesOpen: number;
}

interface IncidentWithCreator {
  id: string;
  organization_id: string | null;
  title: string;
  description: string;
  priority: string;
  status: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number | null;
  creatorName: string;
  minutesActive: number;
}

export async function GET(request?: NextRequest) {
  try {
    const auth = await requireSuperadmin();
    if (auth instanceof NextResponse) return auth;

    const supabase = createServiceClient();

    // Critical tickets
    const { data: criticalTicketsData } = await supabase
      .from('tickets')
      .select(
        `
        id,
        title,
        description,
        status,
        priority,
        createdBy,
        organization_id,
        createdAt,
        updatedAt,
        users!tickets_createdBy_fkey (name),
        organizations!tickets_organization_id_fkey (name)
      `,
      )
      .eq('priority', 'critical')
      .in('status', ['open', 'in_progress'])
      .order('createdAt', { ascending: false })
      .limit(10);

    // Active incidents (using tickets as fallback since emergency_incidents table doesn't exist)
    const { data: activeIncidentsData } = await supabase
      .from('tickets')
      .select(
        `
        id,
        title,
        description,
        status,
        priority,
        createdBy,
        organization_id,
        createdAt,
        updatedAt,
        users!tickets_createdBy_fkey (name)
      `,
      )
      .eq('priority', 'critical')
      .order('createdAt', { ascending: false });

    // SLA breaches (tickets older than 24h still open)
    const { count: slaBreaches } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .in('status', ['open', 'in_progress'])
      .lt('createdAt', Date.now() - 24 * 60 * 60 * 1000);

    // Suspicious IPs
    const { data: suspiciousIPsData } = await supabase
      .from('login_attempts')
      .select('ip, userid')
      .eq('success', false)
      .gte('created_at', Date.now() - 24 * 60 * 60 * 1000);

    // Maintenance mode orgs
    const { count: maintenanceModeOrgs } = await supabase
      .from('organizations')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', false);

    // Pending org requests
    const { count: pendingOrgRequests } = await supabase
      .from('organization_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    // Format critical tickets
    const criticalTickets = (criticalTicketsData || []).map((t): TicketWithCreator => {
      const usersData = t.users as unknown as { name: string }[] | null;
      const creator = Array.isArray(usersData) ? usersData[0] : usersData;
      const org = t.organizations as unknown as { name: string } | null;
      return {
        id: t.id,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        createdBy: t.createdBy,
        organization_id: t.organization_id,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt ?? null,
        creatorName: creator?.name || 'Unknown',
        organizationName: org?.name || null,
        minutesOpen: Math.round((Date.now() - t.createdAt) / 60000),
      };
    });

    // Format active incidents
    const activeIncidents = (activeIncidentsData || []).map((i): IncidentWithCreator => {
      const usersData = i.users as unknown as { name: string }[] | null;
      const creator = Array.isArray(usersData) ? usersData[0] : usersData;
      return {
        id: i.id,
        organization_id: i.organization_id,
        title: i.title,
        description: i.description,
        priority: i.priority,
        status: i.status,
        createdBy: i.createdBy,
        createdAt: i.createdAt,
        updatedAt: i.updatedAt ?? null,
        creatorName: creator?.name || 'Unknown',
        minutesActive: Math.round((Date.now() - i.createdAt) / 60000),
      };
    });

    // Format suspicious IPs
    const ipMap = new Map<string, { attempts: number; userIds: Set<string> }>();
    for (const attempt of suspiciousIPsData || []) {
      const ip = attempt.ip || 'unknown';
      if (!ipMap.has(ip)) {
        ipMap.set(ip, { attempts: 0, userIds: new Set() });
      }
      const entry = ipMap.get(ip)!;
      entry.attempts++;
      if (attempt.userid) {
        entry.userIds.add(attempt.userid);
      }
    }
    const suspiciousIPs = Array.from(ipMap.entries()).map(([ip, data]) => ({
      ip,
      attempts: data.attempts,
      userIds: Array.from(data.userIds),
    }));

    // Calculate priority score
    const priorityScore =
      criticalTickets.length * 10 +
      activeIncidents.length * 5 +
      (slaBreaches || 0) * 3 +
      suspiciousIPs.length * 8;

    const priorityLevel =
      priorityScore >= 50
        ? 'critical'
        : priorityScore >= 30
          ? 'high'
          : priorityScore >= 10
            ? 'medium'
            : 'low';

    const issues: string[] = [];
    if (criticalTickets.length > 0) issues.push('critical-tickets');
    if (activeIncidents.length > 0) issues.push('active-incidents');
    if ((slaBreaches || 0) > 0) issues.push('sla-breaches');
    if (suspiciousIPs.length > 0) issues.push('suspicious-ips');

    return NextResponse.json({
      criticalTickets,
      activeIncidents,
      slaBreaches: slaBreaches || 0,
      suspiciousIPs,
      maintenanceModeOrgs: maintenanceModeOrgs || 0,
      pendingOrgRequests: pendingOrgRequests || 0,
      priorityLevel,
      priorityScore,
      issues,
      requiresAttention: priorityScore >= 10,
    });
  } catch (error) {
    console.error('[Emergency Dashboard API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSuperadmin();
    if (auth instanceof NextResponse) return auth;

    const supabase = createServiceClient();
    const {
      action,
      createdBy,
      title,
      description,
      severity,
      affectedUsers,
      affectedOrgs,
    } = await request.json();

    if (action !== 'createIncident') {
      return NextResponse.json({ error: serverT('superadmin.api.invalidAction', 'Invalid action') }, { status: 400 });
    }

    if (!createdBy || !title || !description || !severity) {
      return NextResponse.json(
        { error: serverT('superadmin.api.missingRequiredFields', 'Missing required fields') },
        { status: 400 },
      );
    }

    const { data: incident, error } = await supabase
      .from('tickets')
      .insert({
        createdBy,
        title,
        description,
        priority: severity === 'critical' ? 'critical' : severity === 'high' ? 'high' : 'medium',
        status: 'open',
        organization_id: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      .select()
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, incident });
  } catch (error) {
    console.error('[Create Incident API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireSuperadmin();
    if (auth instanceof NextResponse) return auth;

    const supabase = createServiceClient();
    const {
      action,
      incidentId,
      status,
      userId,
      rootCause,
      resolution,
    } = await request.json();

    if (action !== 'updateIncidentStatus') {
      return NextResponse.json({ error: serverT('superadmin.api.invalidAction', 'Invalid action') }, { status: 400 });
    }

    if (!incidentId || !status || !userId) {
      return NextResponse.json(
        { error: serverT('superadmin.api.missingRequiredFields', 'Missing required fields') },
        { status: 400 },
      );
    }

    const updateData: {
      status: 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed';
      updatedAt: number;
      description?: string;
      resolvedAt?: number;
    } = {
      status: status as 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed',
      updatedAt: Date.now(),
    };

    if (resolution) {
      updateData.description = resolution;
    }

    if (status === 'resolved') {
      updateData.resolvedAt = Date.now();
    }

    const { error } = await supabase
      .from('tickets')
      .update(updateData)
      .eq('id', incidentId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Update Incident API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
