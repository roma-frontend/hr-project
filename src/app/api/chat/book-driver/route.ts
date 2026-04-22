import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/api-utils';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { organizationId, driverId, startTime, endTime, tripInfo } = await req.json();
    const userId = auth.user.id;

    console.log('[book-driver] Received request:', {
      userId,
      organizationId,
      driverId,
      startTime,
      endTime,
      tripInfo,
    });

    if (!organizationId || !driverId || !startTime || !endTime || !tripInfo) {
      console.error('[book-driver] Missing required fields');
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = await createClient();

    // ═══════════════════════════════════════════════════════════════
    // CONFLICT DETECTION — Check driver availability
    // ═══════════════════════════════════════════════════════════════
    const { data: existingSchedules } = await supabase
      .from('driver_schedules')
      .select('*')
      .eq('driverid', driverId)
      .eq('status', 'scheduled')
      .or(`start_time.lte.${new Date(endTime).getTime()},end_time.gte.${new Date(startTime).getTime()}`);

    const hasConflict = existingSchedules && existingSchedules.length > 0;

    if (hasConflict) {
      const conflictMessages = existingSchedules.map((s: any) => ({
        type: 'driver_schedule_conflict',
        severity: 'critical',
        message: `Driver is already scheduled from ${new Date(s.start_time).toLocaleString()} to ${new Date(s.end_time).toLocaleString()}`,
      }));

      return NextResponse.json({
        success: false,
        conflict: true,
        hasCriticalConflicts: true,
        conflictCount: conflictMessages.length,
        message: buildDriverConflictMessage(conflictMessages, startTime, endTime),
        conflicts: conflictMessages,
        suggestion: 'Please choose a different time or select another driver.',
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // CREATE DRIVER REQUEST
    // ═══════════════════════════════════════════════════════════════
    const { data: request, error } = await supabase
      .from('driver_requests')
      .insert({
        organization_id: organizationId,
        requesterid: userId,
        driverid: driverId,
        start_time: new Date(startTime).getTime(),
        end_time: new Date(endTime).getTime(),
        trip_from: tripInfo.from || 'Not specified',
        trip_to: tripInfo.to || 'Not specified',
        trip_purpose: tripInfo.purpose || 'AI Booking',
        passenger_count: tripInfo.passengerCount || 1,
        trip_notes: tripInfo.notes || 'Booked via AI Assistant',
        status: 'pending',
      })
      .select()
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!request) {
      throw new Error('Failed to create driver request');
    }

    console.log('[book-driver] Request created:', request.id);

    return NextResponse.json({
      message: '✅ Driver request submitted successfully!',
      success: true,
      requestId: request.id,
      hasWarnings: false,
    });
  } catch (error: any) {
    console.error('[book-driver] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to book driver' }, { status: 500 });
  }
}

/**
 * Build human-readable conflict message for driver booking
 */
function buildDriverConflictMessage(conflicts: any[], startTime: string, endTime: string): string {
  if (conflicts.length === 0) return '';

  const startDate = new Date(startTime).toLocaleString();
  const endDate = new Date(endTime).toLocaleString();

  let message = `🚨 **Driver unavailable for requested time** (${startDate} → ${endDate}):\n\n`;

  conflicts.forEach((conflict, i) => {
    message += `${i + 1}. **${conflict.type}**\n`;
    message += `   ${conflict.message}\n`;
    message += `   💡 Choose a different time or select another driver.\n\n`;
  });

  return message;
}
