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

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const { user, supabase: supabaseService } = auth;

    const searchParams = req.nextUrl.searchParams;
    const action = searchParams.get('action');

    if (action === 'get-config') {
      const { data: config } = await supabaseService
        .from('sla_config')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (!config) {
        return NextResponse.json({
          data: {
            targetResponseTimeHours: 24,
            warningThresholdPercent: 75,
            criticalThresholdPercent: 90,
          },
        });
      }

      return NextResponse.json({
        data: {
          id: config.id,
          targetResponseTimeHours: config.target_response_time_hours,
          warningThresholdPercent: config.warning_threshold_percent,
          criticalThresholdPercent: config.critical_threshold_percent,
        },
      });
    }

    if (action === 'get-stats') {
      const startDate = searchParams.get('startDate');
      const endDate = searchParams.get('endDate');

      let query = supabaseService.from('sla_metrics').select('*');

      if (startDate) {
        query = query.gte('created_at', parseInt(startDate));
      }
      if (endDate) {
        query = query.lte('created_at', parseInt(endDate));
      }

      const { data: metrics } = await query;

      if (!metrics || metrics.length === 0) {
        return NextResponse.json({
          data: {
            complianceRate: 100,
            avgResponseTime: 0,
            targetResponseTime: 24,
            avgSLAScore: 100,
            onTime: 0,
            breached: 0,
            pending: 0,
            total: 0,
            criticalCount: 0,
            warningCount: 0,
          },
        });
      }

      const total = metrics.length;
      const onTime = metrics.filter((m: any) => m.status === 'within_sla').length;
      const breached = metrics.filter((m: any) => m.status === 'breached').length;
      const pending = metrics.filter((m: any) => m.status === 'warning').length;
      const complianceRate = total > 0 ? Math.round((onTime / total) * 100) : 100;

      const respondedMetrics = metrics.filter((m: any) => m.first_response_time_hours !== undefined && m.first_response_time_hours !== null);
      const avgResponseTime =
        respondedMetrics.length > 0
          ? Math.round(
              (respondedMetrics.reduce(
                (sum: number, m: any) => sum + (m.first_response_time_hours || 0),
                0,
              ) /
                respondedMetrics.length) *
                10,
            ) / 10
          : 0;

      const avgSLAScore =
        respondedMetrics.length > 0
          ? Math.round(
              respondedMetrics.reduce((sum: number, m: any) => sum + (m.sla_score || 0), 0) /
                respondedMetrics.length,
            )
          : 100;

      const criticalCount = metrics.filter((m: any) => m.is_critical).length;
      const warningCount = metrics.filter(
        (m: any) => m.is_warning && !m.is_critical,
      ).length;

      return NextResponse.json({
        data: {
          complianceRate,
          avgResponseTime,
          targetResponseTime: 24,
          avgSLAScore,
          onTime,
          breached,
          pending,
          total,
          criticalCount,
          warningCount,
        },
      });
    }

    if (action === 'get-trend') {
      const days = parseInt(searchParams.get('days') || '30');
      const now = Date.now();
      const startDate = now - days * 24 * 60 * 60 * 1000;

      const { data: metrics } = await supabaseService
        .from('sla_metrics')
        .select('*')
        .gte('created_at', startDate);

      if (!metrics) {
        return NextResponse.json({ data: [] });
      }

      const dailyData: Record<string, any> = {};

      for (let i = 0; i < days; i++) {
        const date = new Date(now - i * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().split('T')[0]!;
        dailyData[dateStr] = { date: dateStr, onTime: 0, breached: 0, totalResponseTime: 0, count: 0 };
      }

      metrics.forEach((m: any) => {
        const date = new Date(m.created_at);
        const dateStr = date.toISOString().split('T')[0]!;
        const dayData = dailyData[dateStr];
        if (dayData) {
          if (m.status === 'within_sla') dayData.onTime++;
          if (m.status === 'breached') dayData.breached++;
          if (m.first_response_time_hours !== undefined && m.first_response_time_hours !== null) {
            dayData.totalResponseTime += m.first_response_time_hours;
            dayData.count++;
          }
        }
      });

      const trend = Object.values(dailyData)
        .map((d: any) => ({
          date: d.date,
          onTime: d.onTime,
          breached: d.breached,
          avgResponseTime: d.count > 0 ? Math.round((d.totalResponseTime / d.count) * 10) / 10 : 0,
          complianceRate:
            d.onTime + d.breached > 0
              ? Math.round((d.onTime / (d.onTime + d.breached)) * 100)
              : 100,
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      return NextResponse.json({ data: trend });
    }

    if (action === 'get-pending-with-sla') {
      const { data: pending } = await supabaseService
        .from('sla_metrics')
        .select('*')
        .eq('status', 'warning');

      if (!pending) {
        return NextResponse.json({ data: [] });
      }

      const pendingWithDetails = await Promise.all(
        pending.map(async (m: any) => {
          const { data: leaveRequest } = await supabaseService
            .from('leave_requests')
            .select('*, users!leave_requests_userid_fkey(name)')
            .eq('id', m.ticketId)
            .maybeSingle();

          if (!leaveRequest) return null;

          const elapsedHours = (Date.now() - leaveRequest.created_at) / (1000 * 60 * 60);
          const targetHours = 24;
          const remainingHours = targetHours - elapsedHours;
          const progressPercent = Math.min(100, (elapsedHours / targetHours) * 100);

          let slaStatus: 'normal' | 'warning' | 'critical' | 'breached' = 'normal';
          if (progressPercent >= 100) {
            slaStatus = 'breached';
          } else if (progressPercent >= 90) {
            slaStatus = 'critical';
          } else if (progressPercent >= 75) {
            slaStatus = 'warning';
          }

          return {
            id: m.id,
            leaveRequestId: m.ticketId,
            userName: leaveRequest.users?.name || 'Unknown',
            type: leaveRequest.type,
            startDate: leaveRequest.start_date,
            endDate: leaveRequest.end_date,
            totalDays: leaveRequest.total_days,
            sla: {
              status: slaStatus,
              elapsedHours: Math.round(elapsedHours * 10) / 10,
              targetHours,
              remainingHours: Math.round(remainingHours * 10) / 10,
              progressPercent,
            },
          };
        }),
      );

      return NextResponse.json({ data: pendingWithDetails.filter(Boolean) });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('[SLA API Error]', error);
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
    const { user: authUser, supabase: supabaseService } = auth;

    const body = await req.json();
    const action = req.nextUrl.searchParams.get('action');

    if (action === 'update-config') {
      const {
        targetResponseTime,
        warningThreshold,
        criticalThreshold,
        businessHoursOnly,
        businessStartHour,
        businessEndHour,
        excludeWeekends,
        notifyOnWarning,
        notifyOnCritical,
        notifyOnBreach,
      } = body;

      const { data: existingConfig } = await supabaseService
        .from('sla_config')
        .select('id')
        .limit(1)
        .maybeSingle();

      let result;
      if (existingConfig) {
        result = await supabaseService
          .from('sla_config')
          .update({
            target_response_time_hours: targetResponseTime,
            warning_threshold_percent: warningThreshold,
            critical_threshold_percent: criticalThreshold,
            updatedAt: Date.now(),
          })
          .eq('id', existingConfig.id)
          .select()
          .maybeSingle();
      } else {
        result = await supabaseService
          .from('sla_config')
          .insert({
            target_response_time_hours: targetResponseTime,
            warning_threshold_percent: warningThreshold,
            critical_threshold_percent: criticalThreshold,
            createdAt: Date.now(),
          })
          .select()
          .maybeSingle();
      }

      if (result.error) {
        return NextResponse.json({ error: result.error.message }, { status: 500 });
      }

      if (!result.data) {
        return NextResponse.json({ error: 'Failed to save SLA config' }, { status: 500 });
      }

      return NextResponse.json({
        data: {
          id: result.data.id,
          targetResponseTimeHours: result.data.target_response_time_hours,
          warningThresholdPercent: result.data.warning_threshold_percent,
          criticalThresholdPercent: result.data.critical_threshold_percent,
        },
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('[SLA API Error]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
