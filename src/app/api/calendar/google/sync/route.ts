import { NextRequest, NextResponse } from 'next/server';
import { createGoogleCalendarEvent } from '@/lib/calendar-sync';
import { requireAuth } from '@/lib/api-utils';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const accessToken = request.cookies.get('google_access_token')?.value;

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Not authenticated with Google Calendar' },
        { status: 401 },
      );
    }

    const { events } = await request.json();

    if (!Array.isArray(events)) {
      return NextResponse.json({ error: 'Invalid events data' }, { status: 400 });
    }

    // Create events in Google Calendar
    const results = [];
    for (const event of events) {
      try {
        const result = await createGoogleCalendarEvent(accessToken, event);
        results.push({ success: true, eventId: event.id, googleEventId: result.id });
      } catch (error) {
        results.push({ success: false, eventId: event.id, error: String(error) });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    return NextResponse.json({
      message: `Synced ${successCount} events, ${failureCount} failed`,
      results,
    });
  } catch (error) {
    console.error('Google Calendar sync error:', error);
    return NextResponse.json({ error: 'Failed to sync with Google Calendar' }, { status: 500 });
  }
}
