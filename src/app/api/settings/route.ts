import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseService = createServiceClient();

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'update-localization': {
        const { language, timezone, dateFormat, timeFormat, firstDayOfWeek } = body;

        const { error } = await supabaseService
          .from('users')
          .update({
            language,
            timezone,
            date_format: dateFormat,
            time_format: timeFormat,
            first_day_of_week: firstDayOfWeek,
            updated_at: Date.now(),
          })
          .eq('id', user.id);

        if (error) {
          throw error;
        }

        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Settings POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
