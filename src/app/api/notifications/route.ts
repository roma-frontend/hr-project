import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireAuth } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { user: authUser } = auth;

    const supabaseService = createServiceClient();
    const { searchParams } = new URL(request.url);

    const { data: notifications, error } = await supabaseService
      .from('notifications')
      .select('*')
      .eq('userid', authUser.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const mapped = (notifications || []).map((n: any) => ({
      id: n.id,
      userId: n.userid,
      title: n.title,
      message: n.message,
      type: n.type || 'info',
      relatedId: n.relatedid,
      metadata: n.metadata,
      isRead: n.is_read,
      createdAt: n.created_at,
    }));

    return NextResponse.json({ notifications: mapped });
  } catch (error) {
    console.error('[notifications GET] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { user: authUser } = auth;

    const supabaseService = createServiceClient();
    const body = await request.json();
    const { notificationId, isRead } = body;

    if (!notificationId) {
      return NextResponse.json({ error: 'Missing notificationId' }, { status: 400 });
    }

    const updateData: any = {};
    if (typeof isRead === 'boolean') {
      updateData.is_read = isRead;
    }

    const { data: notification, error } = await supabaseService
      .from('notifications')
      .update(updateData)
      .eq('id', notificationId)
      .eq('userid', authUser.id)
      .select()
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ notification, success: true });
  } catch (error) {
    console.error('[notifications PATCH] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { user: authUser } = auth;

    const supabaseService = createServiceClient();
    const body = await request.json();
    const { action } = body;

    if (action === 'mark-all-as-read') {
      const { error } = await supabaseService
        .from('notifications')
        .update({ is_read: true })
        .eq('userid', authUser.id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('[notifications POST] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { user: authUser } = auth;

    const supabaseService = createServiceClient();
    const { searchParams } = new URL(request.url);
    const notificationId = searchParams.get('notificationId');

    if (!notificationId) {
      return NextResponse.json({ error: 'Missing notificationId' }, { status: 400 });
    }

    const { error } = await supabaseService
      .from('notifications')
      .delete()
      .eq('id', notificationId)
      .eq('userid', authUser.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[notifications DELETE] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
