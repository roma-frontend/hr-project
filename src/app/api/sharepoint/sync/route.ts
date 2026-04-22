import { NextRequest, NextResponse } from 'next/server';
import { fetchSharePointListItems, refreshSharePointToken } from '@/lib/sharepoint-sync';
import type { SharePointSyncResult } from '@/lib/sharepoint-sync';
import { validateRestrictedOrgFromRequest } from '@/lib/restricted-org';
import { createServiceClient } from '@/lib/supabase/service';
import { requireAuth } from '@/lib/api-utils';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const validation = await validateRestrictedOrgFromRequest(request);

    if (!validation.allowed) {
      return NextResponse.json(validation.body, { status: validation.status });
    }

    // Use authenticated user's ID and organization from session, not request body
    const adminId = auth.user.id;
    const organizationId = validation.payload.organizationId;

    // Get access token from cookies (try refresh if expired)
    let accessToken = request.cookies.get('sharepoint_access_token')?.value;
    const refreshToken = request.cookies.get('sharepoint_refresh_token')?.value;

    if (!accessToken && !refreshToken) {
      return NextResponse.json({ error: 'Not connected to SharePoint' }, { status: 401 });
    }

    // Try to refresh token if access token is missing
    let newTokens: {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    } | null = null;
    if (!accessToken && refreshToken) {
      try {
        newTokens = await refreshSharePointToken(refreshToken);
        accessToken = newTokens.access_token;
      } catch {
        return NextResponse.json(
          { error: 'SharePoint token expired, please reconnect' },
          { status: 401 },
        );
      }
    }

    // Fetch employees from SharePoint
    const employees = await fetchSharePointListItems(accessToken!);

    const result: SharePointSyncResult = {
      created: 0,
      updated: 0,
      deactivated: 0,
      errors: [],
    };

    const supabase = createServiceClient();

    // Upsert each employee
    for (const emp of employees) {
      try {
        // Check if user exists
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('email', emp.email)
          .maybeSingle();

        if (existingUser) {
          // Update existing user
          await supabase
            .from('users')
            .update({
              name: emp.name,
              department: emp.department,
              position: emp.position,
              phone: emp.phone,
              location: emp.location,
              employee_type: emp.employeeType,
              organization_id: organizationId,
            })
            .eq('id', existingUser.id);

          result.updated++;
        } else {
          // Create new user
          const { data: newUser, error } = await supabase
            .from('users')
            .insert({
              name: emp.name,
              email: emp.email,
              department: emp.department,
              position: emp.position,
              phone: emp.phone,
              location: emp.location,
              employee_type: emp.employeeType,
              organization_id: organizationId,
              password_hash: crypto.randomUUID(), // Temporary password
              role: 'employee',
            })
            .select('id')
            .maybeSingle();

          if (error) {
            throw new Error(error.message);
          }

          result.created++;
        }
      } catch (err) {
        result.errors.push(
          `Failed to sync ${emp.email}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    // Deactivate users no longer in SharePoint
    try {
      const activeEmails = employees.map((e) => e.email);
      
      // First, count users that will be deactivated
      const { data: usersToDeactivate, error: countError } = await supabase
        .from('users')
        .select('id')
        .eq('organization_id', organizationId)
        .not('email', 'in', `(${activeEmails.map(e => `'${e}'`).join(',')})`);

      if (countError) {
        throw new Error(countError.message);
      }

      // Then deactivate them
      if (usersToDeactivate && usersToDeactivate.length > 0) {
        const { error: updateError } = await supabase
          .from('users')
          .update({ is_active: false })
          .in('id', usersToDeactivate.map(u => u.id));

        if (updateError) {
          throw new Error(updateError.message);
        }

        result.deactivated = usersToDeactivate.length;
      } else {
        result.deactivated = 0;
      }
    } catch (err) {
      result.errors.push(
        `Failed to deactivate: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // Log the sync
    try {
      await supabase.from('sync_logs').insert({
        organization_id: organizationId,
        triggered_by: adminId,
        created_count: result.created,
        updated_count: result.updated,
        deactivated_count: result.deactivated,
        error_count: result.errors.length,
        created_at: Date.now(),
      });
    } catch {
      // Non-critical — don't fail the sync if logging fails
    }

    // Build response (optionally set refreshed cookies)
    const response = NextResponse.json(result);

    if (newTokens) {
      response.cookies.set('sharepoint_access_token', newTokens.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: newTokens.expires_in || 3600,
      });
      if (newTokens.refresh_token) {
        response.cookies.set('sharepoint_refresh_token', newTokens.refresh_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 365,
        });
      }
    }

    return response;
  } catch (error) {
    console.error('SharePoint sync error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 },
    );
  }
}
