/**
 * AI Conflict Check API
 *
 * Проверяет конфликты для запросов AI Ассистента:
 * - Отпуска: проверяет мероприятия и department overlap
 * - Водители: проверяет доступность водителя
 * - Задачи: проверяет дедлайны и отпуска исполнителей
 *
 * Возвращает human-readable сообщения для AI
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/api-utils';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { organizationId, requestType, startDate, endDate, metadata } = await req.json();
    const userId = auth.user.id;

    console.log('[conflict-check] Request:', {
      userId,
      organizationId,
      requestType,
      startDate,
      endDate,
    });

    if (!organizationId || !requestType || !startDate || !endDate) {
      return NextResponse.json(
        {
          error: 'Missing required fields: organizationId, requestType, startDate, endDate',
        },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    let conflicts: any[] = [];

    if (requestType === 'leave') {
      // Check for overlapping leaves
      const { data: existingLeaves } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('userid', userId)
        .in('status', ['pending', 'approved'])
        .lte('start_date', new Date(endDate).toISOString().split('T')[0])
        .gte('end_date', new Date(startDate).toISOString().split('T')[0]);

      if (existingLeaves && existingLeaves.length > 0) {
        conflicts = existingLeaves.map((l: any) => ({
          type: 'leave_conflict',
          severity: 'critical',
          message: `You already have a ${l.type} leave from ${l.start_date} to ${l.end_date}`,
          suggestion: 'Choose different dates or cancel the existing leave',
        }));
      }

      // Check for company events
      const { data: events } = await supabase
        .from('company_events')
        .select('*')
        .eq('organization_id', organizationId)
        .lte('start_date', new Date(endDate).getTime())
        .gte('end_date', new Date(startDate).getTime());

      if (events && events.length > 0) {
        conflicts.push(...events.map((e: any) => ({
          type: 'event_conflict',
          severity: 'warning',
          message: `Company event "${e.name}" overlaps with your requested dates`,
          suggestion: 'Consider rescheduling around the event',
        })));
      }
    } else if (requestType === 'driver') {
      // Check driver availability
      const driverId = metadata?.driverId;
      if (driverId) {
        const { data: existingSchedules } = await supabase
          .from('driver_schedules')
          .select('*')
          .eq('driverid', driverId)
          .eq('status', 'scheduled')
          .or(`start_time.lte.${new Date(endDate).getTime()},end_time.gte.${new Date(startDate).getTime()}`);

        if (existingSchedules && existingSchedules.length > 0) {
          conflicts = existingSchedules.map((s: any) => ({
            type: 'driver_conflict',
            severity: 'critical',
            message: `Driver is already scheduled from ${new Date(s.start_time).toLocaleString()} to ${new Date(s.end_time).toLocaleString()}`,
            suggestion: 'Choose a different time or select another driver',
          }));
        }
      }
    } else if (requestType === 'task') {
      // Check if assignee is on leave
      const assigneeId = metadata?.assigneeId;
      if (assigneeId && endDate) {
        const { data: leaves } = await supabase
          .from('leave_requests')
          .select('*')
          .eq('userid', assigneeId)
          .eq('status', 'approved')
          .lte('start_date', new Date(endDate).toISOString().split('T')[0])
          .gte('end_date', new Date().toISOString().split('T')[0]);

        if (leaves && leaves.length > 0) {
          conflicts = leaves.map((l: any) => ({
            type: 'leave_conflict',
            severity: 'warning',
            message: `Assignee is on ${l.type} leave from ${l.start_date} to ${l.end_date}`,
            suggestion: 'Consider a different deadline or assignee',
          }));
        }
      }
    }

    console.log('[conflict-check] Result:', { conflicts });

    const hasCritical = conflicts.some((c: any) => c.severity === 'critical');
    const aiFriendlyMessage = formatConflictsForAI(conflicts, requestType);
    const alternativeDates = extractAlternativeDates(conflicts, requestType);

    return NextResponse.json({
      success: true,
      hasConflicts: conflicts.length > 0,
      hasCriticalConflicts: hasCritical,
      conflictCount: conflicts.length,
      conflicts,
      aiMessage: aiFriendlyMessage,
      alternativeDates,
      canProceed: !hasCritical,
    });
  } catch (error: any) {
    console.error('[conflict-check] Error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to check conflicts',
        success: false,
      },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  // GET для быстрой проверки через query params
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const organizationId = searchParams.get('organizationId');
    const requestType = searchParams.get('requestType');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const userId = auth.user.id;

    if (!organizationId || !requestType || !startDate || !endDate) {
      return NextResponse.json({ error: 'Missing required query params' }, { status: 400 });
    }

    const supabase = await createClient();

    let conflicts: any[] = [];

    if (requestType === 'leave') {
      const { data: existingLeaves } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('userid', userId)
        .in('status', ['pending', 'approved'])
        .lte('start_date', new Date(parseInt(endDate)).toISOString().split('T')[0])
        .gte('end_date', new Date(parseInt(startDate)).toISOString().split('T')[0]);

      if (existingLeaves && existingLeaves.length > 0) {
        conflicts = existingLeaves.map((l: any) => ({
          type: 'leave_conflict',
          severity: 'critical',
          message: `You already have a ${l.type} leave from ${l.start_date} to ${l.end_date}`,
        }));
      }
    }

    const aiFriendlyMessage = formatConflictsForAI(conflicts, requestType);

    return NextResponse.json({
      success: true,
      hasConflicts: conflicts.length > 0,
      hasCriticalConflicts: conflicts.some((c: any) => c.severity === 'critical'),
      conflictCount: conflicts.length,
      aiMessage: aiFriendlyMessage,
      canProceed: !conflicts.some((c: any) => c.severity === 'critical'),
    });
  } catch (error: any) {
    console.error('[conflict-check] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check conflicts' },
      { status: 500 },
    );
  }
}

/**
 * Форматирует конфликты в human-readable сообщения для AI
 */
function formatConflictsForAI(conflicts: any[], requestType: string): string {
  if (conflicts.length === 0) {
    return '✅ Конфликтов не обнаружено. Можно продолжать.';
  }

  const critical = conflicts.filter((c) => c.severity === 'critical');
  const warnings = conflicts.filter((c) => c.severity === 'warning');

  let message = '';

  if (critical.length > 0) {
    message += '🚨 **КРИТИЧЕСКИЕ КОНФЛИКТЫ** (требуют внимания):\n';
    critical.forEach((c) => {
      message += `• ${c.type}: ${c.message} 💡 ${c.suggestion}\n`;
    });
  }

  if (warnings.length > 0) {
    message += '\n⚠️ **ПРЕДУПРЕЖДЕНИЯ**:\n';
    warnings.forEach((c) => {
      message += `• ${c.type}: ${c.message} 💡 ${c.suggestion}\n`;
    });
  }

  if (requestType === 'leave') {
    message += '\n📅 **Рекомендация AI**: ';
    if (critical.length > 0) {
      message += 'Настоятельно рекомендую выбрать другие даты или обсудить с руководителем.';
    } else if (warnings.length > 0) {
      message += 'Можно продолжить, но будьте готовы к возможным сложностям.';
    }
  }

  return message;
}

/**
 * Извлекает альтернативные даты из конфликтов
 */
function extractAlternativeDates(conflicts: any[], requestType: string): string[] {
  const alternativeDates: string[] = [];

  if (requestType !== 'leave') return alternativeDates;

  // Если есть конфликты, предлагаем даты через 2 недели
  if (conflicts.length > 0) {
    const now = new Date();
    const alternativeStart = new Date(now);
    alternativeStart.setDate(alternativeStart.getDate() + 14);

    const alternativeEnd = new Date(alternativeStart);
    alternativeEnd.setDate(alternativeEnd.getDate() + 7);

    const options = [
      `${alternativeStart.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} - ${alternativeEnd.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}`,
    ];

    // Ещё одна опция через 3 недели
    const altStart2 = new Date(now);
    altStart2.setDate(altStart2.getDate() + 21);
    const altEnd2 = new Date(altStart2);
    altEnd2.setDate(altEnd2.getDate() + 7);

    options.push(
      `${altStart2.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} - ${altEnd2.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}`,
    );

    return options;
  }

  return alternativeDates;
}
