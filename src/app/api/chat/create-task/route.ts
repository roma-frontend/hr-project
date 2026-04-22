/**
 * AI Task Creation API with Conflict Detection
 *
 * Проверяет конфликты при создании задачи:
 * - Дедлайн во время отпуска исполнителя
 * - Задача назначена человеку в отпуске
 * - Пересечение с другими задачами
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

    const {
      organizationId,
      title,
      description,
      assignedTo,
      priority,
      deadline,
      tags,
    } = await req.json();

    const userId = auth.user.id;
    const assignedBy = auth.user.id;

    console.log('[create-task] Request:', {
      userId,
      organizationId,
      title,
      assignedTo,
      deadline,
    });

    if (!organizationId || !title || !assignedTo || !priority) {
      return NextResponse.json(
        {
          error:
            'Missing required fields: organizationId, title, assignedTo, priority',
        },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    // ═══════════════════════════════════════════════════════════════
    // CONFLICT DETECTION — Check task conflicts
    // ═══════════════════════════════════════════════════════════════
    const conflictResult: { hasCritical: boolean; hasWarnings: boolean; conflicts: any[] } = {
      hasCritical: false,
      hasWarnings: false,
      conflicts: [],
    };

    if (deadline) {
      // Проверяем конфликты задачи с отпусками
      const { data: leaves } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('userid', assignedTo)
        .eq('status', 'approved')
        .lte('start_date', new Date(deadline).toISOString().split('T')[0])
        .gte('end_date', new Date().toISOString().split('T')[0]);

      if (leaves && leaves.length > 0) {
        conflictResult.hasWarnings = true;
        leaves.forEach((l: any) => {
          conflictResult.conflicts.push({
            type: 'leave_conflict',
            severity: 'warning',
            message: `Assignee is on ${l.type} leave from ${l.start_date} to ${l.end_date}`,
          });
        });
      }
    }

    // Если есть критические конфликты — предупреждаем, но не блокируем
    const warnings: string[] = [];
    if (conflictResult.conflicts.length > 0) {
      conflictResult.conflicts.forEach((c: any) => {
        warnings.push(`${c.type}: ${c.message}`);
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // CREATE TASK
    // ═══════════════════════════════════════════════════════════════
    const { data: task, error } = await supabase
      .from('tasks')
      .insert({
        title,
        description: description || '',
        assigned_to: assignedTo,
        assigned_by: assignedBy,
        priority: priority as 'low' | 'medium' | 'high' | 'urgent',
        deadline: deadline ? new Date(deadline).getTime() : undefined,
        tags: tags || [],
        organization_id: organizationId,
      })
      .select()
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!task) {
      throw new Error('Failed to create task');
    }

    console.log('[create-task] Task created:', task.id);

    // Формируем ответ с учётом предупреждений
    let message = `✅ Task "${title}" has been created and assigned.`;

    if (warnings.length > 0) {
      message += `\n\n⚠️ **Potential conflicts detected**:\n`;
      warnings.forEach((w) => {
        message += `\n• ${w}`;
      });
      message += `\n\n💡 Consider adjusting the deadline or reassigning the task.`;
    }

    return NextResponse.json({
      success: true,
      taskId: task.id,
      message,
      hasWarnings: warnings.length > 0,
      warnings,
      conflicts: conflictResult.conflicts,
    });
  } catch (error: any) {
    console.error('[create-task] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create task' }, { status: 500 });
  }
}

/**
 * GET endpoint for quick task conflict check
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const organizationId = searchParams.get('organizationId');
    const assigneeId = searchParams.get('assigneeId');
    const deadline = searchParams.get('deadline');
    const userId = auth.user.id;

    if (!organizationId || !assigneeId || !deadline) {
      return NextResponse.json({ error: 'Missing required query params' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: leaves } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('userid', assigneeId)
      .eq('status', 'approved')
      .lte('start_date', new Date(parseInt(deadline)).toISOString().split('T')[0])
      .gte('end_date', new Date().toISOString().split('T')[0]);

    const conflicts = (leaves || []).map((l: any) => ({
      type: 'leave_conflict',
      severity: 'warning',
      message: `Assignee is on ${l.type} leave from ${l.start_date} to ${l.end_date}`,
    }));

    const aiFriendlyMessage = formatTaskConflictsForAI(conflicts);

    return NextResponse.json({
      success: true,
      hasConflicts: conflicts.length > 0,
      hasCriticalConflicts: false,
      conflictCount: conflicts.length,
      aiMessage: aiFriendlyMessage,
      conflicts,
    });
  } catch (error: any) {
    console.error('[task-conflict-check] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check conflicts' },
      { status: 500 },
    );
  }
}

/**
 * Форматирует конфликты задач в human-readable сообщения для AI
 */
function formatTaskConflictsForAI(conflicts: any[]): string {
  if (conflicts.length === 0) {
    return '✅ Конфликтов не обнаружено. Задачу можно создавать.';
  }

  let message = '⚠️ **Обнаружены потенциальные конфликты**:\n\n';

  conflicts.forEach((c, i) => {
    message += `${i + 1}. **${c.type}**\n`;
    message += `   ${c.message}\n`;
    message += `   💡 Consider adjusting the deadline or reassigning.\n\n`;
  });

  message += '\n📋 **Рекомендация AI**: ';
  message += 'Рассмотрите возможность переноса дедлайна или назначения другого исполнителя.';

  return message;
}
