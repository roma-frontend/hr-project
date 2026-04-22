/**
 * Scan all pending leave requests for conflicts with company events
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/api-utils';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const organizationId = auth.profile.organization_id;

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Get all pending leave requests
    const { data: pendingLeaves } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('status', 'pending');

    // Get all company events
    const { data: events } = await supabase
      .from('company_events')
      .select('*')
      .eq('organization_id', organizationId);

    let conflictsFound = 0;

    if (pendingLeaves && events) {
      // Check for overlaps between pending leaves and events
      for (const leave of pendingLeaves) {
        const leaveStart = new Date(leave.start_date).getTime();
        const leaveEnd = new Date(leave.end_date).getTime();

        for (const event of events) {
          const eventStart = event.start_date;
          const eventEnd = event.end_date;

          // Check for overlap
          if (leaveStart <= eventEnd && leaveEnd >= eventStart) {
            conflictsFound++;
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Conflict scan completed',
      scanned: pendingLeaves?.length || 0,
      conflictsFound,
    });
  } catch (error) {
    console.error('Conflict scan failed:', error);
    return NextResponse.json({ error: 'Scan failed' }, { status: 500 });
  }
}
