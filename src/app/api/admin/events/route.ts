import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import type { TablesUpdate } from '@/lib/supabase/database.types';

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const supabaseService = createServiceClient();
  const { data: profile } = await supabaseService
    .from('users')
    .select('role, organization_id')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || !['admin', 'superadmin'].includes(profile.role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { user, profile, supabase: supabaseService };
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const { user, profile, supabase: supabaseService } = auth;

    const searchParams = req.nextUrl.searchParams;
    const organizationId = searchParams.get('organizationId');
    const type = searchParams.get('type');

    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId required' }, { status: 400 });
    }

    if (profile.role !== 'superadmin' && profile.organization_id !== organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (type === 'pending-leaves') {
      const { data: leaves, error } = await supabaseService
        .from('leave_requests')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const mapped = (leaves || []).map((l: any) => ({
        id: l.id,
        userId: l.userid,
        organization_id: l.organization_id,
        startDate: l.start_date,
        endDate: l.end_date,
        status: l.status,
        type: l.type,
        reason: l.reason,
      }));

      return NextResponse.json(mapped);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const events: any[] = [];
    const { data: eventsData, error } = await supabaseService
      .from('company_events')
      .select('*')
      .eq('organization_id', organizationId)
      .order('start_date', { ascending: true });

    if (error) {
      console.error('[Events API Error]', error);
    } else {
      events.push(...(eventsData || []));
    }

    const mapped = events.map((e: any) => ({
      id: e.id,
      organizationId: e.organization_id,
      name: e.name,
      description: e.description,
      startDate: e.start_date,
      endDate: e.end_date,
      priority: e.priority,
      eventType: e.event_type,
      requiredDepartments: e.required_departments,
      createdAt: e.created_at,
      isAllDay: e.is_all_day,
    }));

    return NextResponse.json(mapped);
  } catch (error) {
    console.error('[Events API Error]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const { user: authUser, profile, supabase: supabaseService } = auth;

    const body = await req.json();
    const { action, ...data } = body;

    switch (action) {
      case 'create': {
        const { name, description, startDate, endDate, priority, eventType, requiredDepartments, organizationId, isAllDay } = data;

        if (!organizationId) {
          return NextResponse.json({ error: 'organizationId required' }, { status: 400 });
        }

        if (profile.role !== 'superadmin' && profile.organization_id !== organizationId) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const now = Date.now();
        const { data: event, error } = await supabaseService
          .from('company_events')
          .insert({
            organization_id: organizationId,
            name,
            description,
            start_date: startDate,
            end_date: endDate,
            priority,
            event_type: eventType,
            required_departments: requiredDepartments,
            is_all_day: isAllDay ?? false,
            created_by: authUser.id,
            created_at: now,
            updated_at: now,
          })
          .select()
          .maybeSingle();

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ data: event });
      }

      case 'update': {
        const { eventId, ...updateData } = data;

        if (!eventId) {
          return NextResponse.json({ error: 'eventId required' }, { status: 400 });
        }

        const { data: existingEvent } = await supabaseService
          .from('company_events')
          .select('organization_id')
          .eq('id', eventId)
          .maybeSingle();

        if (!existingEvent) {
          return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }

        if (profile.role !== 'superadmin' && profile.organization_id !== existingEvent.organization_id) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const updatePayload: Record<string, unknown> = {};
        if (updateData.name !== undefined) updatePayload.name = updateData.name;
        if (updateData.description !== undefined) updatePayload.description = updateData.description;
        if (updateData.start_date !== undefined) updatePayload.start_date = updateData.start_date;
        if (updateData.end_date !== undefined) updatePayload.end_date = updateData.end_date;
        if (updateData.priority !== undefined) updatePayload.priority = updateData.priority;
        if (updateData.event_type !== undefined) updatePayload.event_type = updateData.event_type;
        if (updateData.required_departments !== undefined) updatePayload.required_departments = updateData.required_departments;
        if (updateData.is_all_day !== undefined) updatePayload.is_all_day = updateData.is_all_day;
        updatePayload.updated_at = Date.now();

        const { data: event, error } = await supabaseService
          .from('company_events')
          .update(updatePayload as any)
          .eq('id', eventId)
          .select()
          .maybeSingle();

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ data: event });
      }

      case 'delete': {
        const { eventId } = data;

        if (!eventId) {
          return NextResponse.json({ error: 'eventId required' }, { status: 400 });
        }

        const { data: existingEvent } = await supabaseService
          .from('company_events')
          .select('organization_id')
          .eq('id', eventId)
          .maybeSingle();

        if (!existingEvent) {
          return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }

        if (profile.role !== 'superadmin' && profile.organization_id !== existingEvent.organization_id) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { error } = await supabaseService
          .from('company_events')
          .delete()
          .eq('id', eventId);

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ data: { success: true } });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[Events API Error]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
