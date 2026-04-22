import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const supabaseService = createServiceClient();
  const { data: profile } = await supabaseService
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || !['admin', 'superadmin'].includes(profile.role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { user, profile, supabase: supabaseService };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const { supabase: supabaseService } = auth;

    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');

    switch (action) {
      case 'get-stats': {
        const now = Date.now();
        const last24h = now - 24 * 60 * 60 * 1000;
        const last7d = now - 7 * 24 * 60 * 60 * 1000;

        const { data: tasks } = await supabaseService
          .from('automation_tasks')
          .select('*');

        const { data: workflows } = await supabaseService
          .from('automation_workflows')
          .select('*');

        const recentTasks = (tasks || []).filter((t: any) => t.created_at > last24h);
        const previousTasks = (tasks || []).filter((t: any) => t.created_at > last7d && t.created_at <= last24h);

        const completedTasks = (tasks || []).filter((t: any) => t.status === 'completed').length;
        const pendingTasks = (tasks || []).filter((t: any) => t.status === 'pending').length;
        const failedTasks = (tasks || []).filter((t: any) => t.status === 'failed').length;

        const calculateTrend = (current: number, previous: number) => {
          if (previous === 0) return current > 0 ? 100 : 0;
          return Math.round(((current - previous) / previous) * 100);
        };

        const completedTrend = calculateTrend(
          recentTasks.filter((t: any) => t.status === 'completed').length,
          previousTasks.filter((t: any) => t.status === 'completed').length
        );
        const pendingTrend = calculateTrend(
          recentTasks.filter((t: any) => t.status === 'pending').length,
          previousTasks.filter((t: any) => t.status === 'pending').length
        );
        const failedTrend = calculateTrend(
          recentTasks.filter((t: any) => t.status === 'failed').length,
          previousTasks.filter((t: any) => t.status === 'failed').length
        );
        const tasksTrend = calculateTrend(recentTasks.length, previousTasks.length);

        return NextResponse.json({
          data: {
            totalTasks: (tasks || []).length,
            completedTasks,
            pendingTasks,
            failedTasks,
            tasksTrend,
            completedTrend,
            pendingTrend,
            failedTrend,
            activeWorkflows: (workflows || []).filter((w: any) => w.is_active).length,
          },
        });
      }

      case 'get-recent-tasks': {
        const limit = parseInt(searchParams.get('limit') || '10');

        const { data: tasks } = await supabaseService
          .from('automation_tasks')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit);

        return NextResponse.json({ data: tasks || [] });
      }

      case 'get-active-workflows': {
        const { data: workflows } = await supabaseService
          .from('automation_workflows')
          .select('*');

        return NextResponse.json({ data: workflows || [] });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[Automation API Error]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const { user: authUser, supabase: supabaseService } = auth;

    const body = await request.json();
    const action = request.nextUrl.searchParams.get('action');

    switch (action) {
      case 'run-automation': {
        const { data: task, error } = await supabaseService
          .from('automation_tasks')
          .insert({
            name: 'Manual automation run',
            status: 'running',
            created_by: authUser.id,
            created_at: Date.now(),
          } as any)
          .select()
          .maybeSingle();

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        if (!task) {
          return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
        }

        // Simulate completion after delay
        await new Promise((resolve) => setTimeout(resolve, 2000));

        await supabaseService
          .from('automation_tasks')
          .update({ status: 'completed', updated_at: Date.now() })
          .eq('id', task.id);

        return NextResponse.json({ data: { success: true, taskId: task.id } });
      }

      case 'toggle-workflow': {
        const { workflowId } = body;

        if (!workflowId) {
          return NextResponse.json({ error: 'Missing workflowId' }, { status: 400 });
        }

        const { data: workflow } = await supabaseService
          .from('automation_workflows')
          .select('*')
          .eq('id', workflowId)
          .maybeSingle();

        if (!workflow) {
          return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
        }

        const { data: updatedWorkflow, error } = await supabaseService
          .from('automation_workflows')
          .update({
            is_active: !workflow.is_active,
            updated_at: Date.now(),
          })
          .eq('id', workflowId)
          .select()
          .maybeSingle();

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        if (!updatedWorkflow) {
          return NextResponse.json({ error: 'Failed to update workflow' }, { status: 500 });
        }

        return NextResponse.json({
          data: { success: true, isActive: updatedWorkflow.is_active },
        });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[Automation API Error]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
