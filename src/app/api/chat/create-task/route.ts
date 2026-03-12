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
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(req: NextRequest) {
  try {
    const { 
      userId, 
      organizationId,
      title, 
      description, 
      assignedTo, 
      assignedBy, 
      priority, 
      deadline,
      tags 
    } = await req.json();

    console.log('[create-task] Request:', { 
      userId, 
      organizationId, 
      title, 
      assignedTo, 
      deadline 
    });

    if (!userId || !organizationId || !title || !assignedTo || !assignedBy || !priority) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, organizationId, title, assignedTo, assignedBy, priority' },
        { status: 400 }
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // CONFLICT DETECTION — Check task conflicts
    // ═══════════════════════════════════════════════════════════════
    let conflictResult = { hasCritical: false, hasWarnings: false, conflicts: [] };
    
    if (deadline) {
      // Проверяем конфликты задачи с отпусками
      conflictResult = await convex.query(api.conflicts.checkConflictsForRequest, {
        organizationId: organizationId as Id<"organizations">,
        requestType: "task" as const,
        userId: assignedTo as Id<"users">,
        startDate: Date.now(),
        endDate: new Date(deadline).getTime(),
        metadata: { 
          assigneeId: assignedTo as Id<"users">,
          taskId: undefined,
        },
      });
    }

    // Если есть критические конфликты — предупреждаем, но не блокируем
    const warnings: string[] = [];
    if (conflictResult.conflicts.length > 0) {
      conflictResult.conflicts.forEach((c: any) => {
        warnings.push(`${c.title}: ${c.message}`);
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // CREATE TASK
    // ═══════════════════════════════════════════════════════════════
    const taskId = await convex.mutation(api.tasks.createTask, {
      title,
      description: description || '',
      assignedTo: assignedTo as Id<"users">,
      assignedBy: assignedBy as Id<"users">,
      priority: priority as "low" | "medium" | "high" | "urgent",
      deadline: deadline ? new Date(deadline).getTime() : undefined,
      tags: tags || [],
    });

    console.log('[create-task] Task created:', taskId);

    // Формируем ответ с учётом предупреждений
    let message = `✅ Task "${title}" has been created and assigned.`;
    
    if (warnings.length > 0) {
      message += `\n\n⚠️ **Potential conflicts detected**:\n`;
      warnings.forEach(w => {
        message += `\n• ${w}`;
      });
      message += `\n\n💡 Consider adjusting the deadline or reassigning the task.`;
    }

    return NextResponse.json({
      success: true,
      taskId,
      message,
      hasWarnings: warnings.length > 0,
      warnings,
      conflicts: conflictResult.conflicts,
    });
  } catch (error: any) {
    console.error('[create-task] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create task' },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for quick task conflict check
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const organizationId = searchParams.get('organizationId');
    const assigneeId = searchParams.get('assigneeId');
    const deadline = searchParams.get('deadline');

    if (!userId || !organizationId || !assigneeId || !deadline) {
      return NextResponse.json(
        { error: 'Missing required query params' },
        { status: 400 }
      );
    }

    const conflictResult = await convex.query(api.conflicts.checkConflictsForRequest, {
      organizationId: organizationId as Id<"organizations">,
      requestType: "task" as const,
      userId: userId as Id<"users">,
      startDate: Date.now(),
      endDate: parseInt(deadline),
      metadata: { 
        assigneeId: assigneeId as Id<"users">,
      },
    });

    const aiFriendlyMessage = formatTaskConflictsForAI(conflictResult.conflicts);

    return NextResponse.json({
      success: true,
      hasConflicts: conflictResult.conflicts.length > 0,
      hasCriticalConflicts: conflictResult.hasCritical,
      conflictCount: conflictResult.conflicts.length,
      aiMessage: aiFriendlyMessage,
      conflicts: conflictResult.conflicts,
    });

  } catch (error: any) {
    console.error('[task-conflict-check] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check conflicts' },
      { status: 500 }
    );
  }
}

/**
 * Форматирует конфликты задач в human-readable сообщения для AI
 */
function formatTaskConflictsForAI(conflicts: any[]): string {
  if (conflicts.length === 0) {
    return "✅ Конфликтов не обнаружено. Задачу можно создавать.";
  }

  let message = "⚠️ **Обнаружены потенциальные конфликты**:\n\n";

  conflicts.forEach((c, i) => {
    message += `${i + 1}. **${c.title}**\n`;
    message += `   ${c.message}\n`;
    message += `   💡 ${c.suggestion}\n\n`;
  });

  message += "\n📋 **Рекомендация AI**: ";
  message += "Рассмотрите возможность переноса дедлайна или назначения другого исполнителя.";

  return message;
}
