import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import { requireAuth } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');
    const userId = auth.user.id;

    switch (action) {
      case 'has-seen-tour': {
        const tourId = searchParams.get('tourId');

        if (!tourId) {
          return NextResponse.json({ data: { hasSeenTour: false } });
        }

        // Check if tour has been seen
        const { data: preference } = await supabase
          .from('userPreferences')
          .select('value')
          .eq('userId', userId)
          .eq('key', `tour_seen_${tourId}`)
          .maybeSingle();

        return NextResponse.json({
          data: { hasSeenTour: preference?.value === true },
        });
      }

      default:
        return NextResponse.json({ data: null });
    }
  } catch (error) {
    console.error('User preferences API error:', error);
    return NextResponse.json({ data: null }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { action, tourId } = body;
    const userId = auth.user.id;

    switch (action) {
      case 'mark-tour-as-seen': {
        if (!tourId) {
          return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Check if preference already exists
        const { data: existing } = await supabase
          .from('userPreferences')
          .select('id')
          .eq('userId', userId)
          .eq('key', `tour_seen_${tourId}`)
          .maybeSingle();

        if (existing) {
          await supabase
            .from('userPreferences')
            .update({ value: true, updatedAt: Date.now() })
            .eq('id', existing.id);
        } else {
          await supabase.from('userPreferences').insert({
            userId: userId,
            key: `tour_seen_${tourId}`,
            value: true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
        }

        return NextResponse.json({ success: true, storage: 'database' });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('User preferences POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
