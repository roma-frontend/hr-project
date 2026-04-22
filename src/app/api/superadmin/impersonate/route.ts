import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { serverT } from '@/lib/i18n/server-actions-i18n';
import type { Database } from '@/lib/supabase/database.types';

type ImpersonationSession = Database['public']['Tables']['impersonation_sessions']['Row'];

async function requireSuperadmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: serverT('superadmin.api.unauthorized', 'Unauthorized') }, { status: 401 }) };

  const supabaseService = createServiceClient();
  const { data: profile } = await supabaseService
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || profile.role !== 'superadmin') {
    return { error: NextResponse.json({ error: serverT('superadmin.api.forbidden', 'Forbidden') }, { status: 403 }) };
  }
  return { user, profile, supabase: supabaseService };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperadmin();
    if (auth.error) return auth.error;
    const { user: authUser, supabase: supabaseService } = auth;

    const { searchParams } = new URL(request.url);
    const prefix = searchParams.get('prefix');
    const userId = searchParams.get('userId');
    const superadminId = searchParams.get('superadminId');
    const limit = searchParams.get('limit') || '20';

    if (prefix) {
      const { data: users, error } = await supabaseService
        .from('users')
        .select('id, name, email, role, avatar_url, organization_id')
        .or(`name.ilike.%${prefix}%,email.ilike.%${prefix}%`)
        .limit(20);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        users: (users || []).map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          avatarUrl: u.avatar_url,
          organization_id: u.organization_id,
        })),
      });
    }

    if (userId) {
      const { data: session, error } = await supabaseService
        .from('impersonation_sessions')
        .select(
          `
          id,
          is_active,
          reason,
          started_at,
          ended_at,
          expires_at,
          superadminid,
          target_userid,
          organization_id,
          users!impersonation_sessions_superadminid_fkey (name, email),
          users!impersonation_sessions_target_userid_fkey (name, email),
          organizations!impersonation_sessions_organization_id_fkey (name)
        `,
        )
        .eq('superadminid', userId)
        .eq('is_active', true)
        .gt('expires_at', Date.now())
        .maybeSingle();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (!session) {
        return NextResponse.json({ session: null });
      }

      const usersArray = session.users as unknown as { name: string; email: string }[] | null;
      const superadmin = usersArray?.[0] || null;
      const targetUser = usersArray?.[1] || null;
      const org = session.organizations;

      return NextResponse.json({
        session: {
          id: session.id,
          sessionId: session.id,
          isActive: session.is_active,
          superadminName: superadmin?.name,
          targetUserName: targetUser?.name,
          targetUserEmail: targetUser?.email,
          organizationName: org?.name,
          reason: session.reason,
          startedAt: session.started_at,
          endedAt: session.ended_at,
          duration: session.ended_at ? session.ended_at - session.started_at : 0,
          expiresAt: session.expires_at,
          targetUser: {
            name: targetUser?.name,
            email: targetUser?.email,
          },
        },
      });
    }

    if (superadminId) {
      const { data: sessions, error } = await supabaseService
        .from('impersonation_sessions')
        .select(
          `
          id,
          is_active,
          reason,
          started_at,
          ended_at,
          superadminid,
          target_userid,
          organization_id,
          users!impersonation_sessions_superadminid_fkey (name),
          users!impersonation_sessions_target_userid_fkey (name, email),
          organizations!impersonation_sessions_organization_id_fkey (name)
        `,
        )
        .eq('superadminid', superadminId)
        .order('started_at', { ascending: false })
        .limit(parseInt(limit));

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const formattedSessions = (sessions || []).map((s) => {
        const usersArray = s.users as unknown as { name: string; email: string }[] | null;
        const superadmin = usersArray?.[0] || null;
        const targetUser = usersArray?.[1] || null;
        const org = s.organizations;

        return {
          id: s.id,
          isActive: s.is_active,
          superadminName: superadmin?.name,
          targetUserName: targetUser?.name,
          targetUserEmail: targetUser?.email,
          organizationName: org?.name,
          reason: s.reason,
          startedAt: s.started_at,
          endedAt: s.ended_at,
          duration: s.ended_at ? s.ended_at - s.started_at : 0,
        };
      });

      return NextResponse.json({ sessions: formattedSessions });
    }

    return NextResponse.json({ error: serverT('superadmin.api.invalidRequest', 'Invalid request') }, { status: 400 });
  } catch (error) {
    console.error('[Impersonation API] Error:', error);
    return NextResponse.json({ error: serverT('superadmin.api.internalServerError', 'Internal server error') }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSuperadmin();
    if (auth.error) return auth.error;
    const { user: authUser, supabase: supabaseService } = auth;

    const { targetUserId, reason } = await request.json();

    if (!targetUserId || !reason) {
      return NextResponse.json(
        { error: serverT('superadmin.api.missingRequiredFields', 'Missing required fields') },
        { status: 400 },
      );
    }

    const { data: targetUser } = await supabaseService
      .from('users')
      .select('organization_id')
      .eq('id', targetUserId)
      .maybeSingle();

    if (!targetUser?.organization_id) {
      return NextResponse.json(
        { error: serverT('superadmin.api.targetUserNoOrg', 'Target user has no organization') },
        { status: 400 },
      );
    }

    const token = crypto.randomUUID();
    const expiresAt = Date.now() + 60 * 60 * 1000;

    const { data: session, error } = await supabaseService
      .from('impersonation_sessions')
      .insert({
        superadminid: authUser.id,
        target_userid: targetUserId,
        organization_id: targetUser.organization_id,
        reason,
        token,
        expires_at: expiresAt,
        started_at: Date.now(),
        is_active: true,
      })
      .select()
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, session });
  } catch (error) {
    console.error('[Start Impersonation API] Error:', error);
    return NextResponse.json({ error: serverT('superadmin.api.internalServerError', 'Internal server error') }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireSuperadmin();
    if (auth.error) return auth.error;
    const { user: authUser, supabase: supabaseService } = auth;

    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: serverT('superadmin.api.missingRequiredFields', 'Missing required fields') },
        { status: 400 },
      );
    }

    const { error } = await supabaseService
      .from('impersonation_sessions')
      .update({ is_active: false, ended_at: Date.now() })
      .eq('id', sessionId)
      .eq('superadminid', authUser.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[End Impersonation API] Error:', error);
    return NextResponse.json({ error: serverT('superadmin.api.internalServerError', 'Internal server error') }, { status: 500 });
  }
}
