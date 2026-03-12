/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CONFLICT SERVICE — Единая система обнаружения конфликтов
 * ─────────────────────────────────────────────────────────────────────────────
 * 
 * Централизованный сервис для обнаружения всех типов конфликтов:
 * - Отпуска ↔ Мероприятия
 * - Отпуска ↔ Отпуска (department overlap)
 * - Водители ↔ Поездки
 * - Задачи ↔ Дедлайны/Отпуска
 * - Мероприятия ↔ Праздники
 * 
 * Используется AI Ассистентом для умных предупреждений
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type ConflictType =
  | "leave_event"           // Отпуск пересекается с мероприятием
  | "leave_department"      // Слишком много людей из отдела в отпуске
  | "driver_schedule"       // Водитель уже забронирован
  | "task_deadline"         // Дедлайн задачи во время отпуска
  | "task_assignment"       // Задача назначена человеку в отпуске
  | "holiday_conflict"      // Мероприятие в праздник
  | "blackout_period";      // Запрос в запретный период

export type ConflictSeverity = "critical" | "warning" | "info";

export interface Conflict {
  id: string;
  type: ConflictType;
  severity: ConflictSeverity;
  title: string;
  message: string;
  suggestion: string;
  date: string;
  affectedUsers: Id<"users">[];
  affectedDepartments?: string[];
  relatedEventId?: Id<"companyEvents">;
  relatedTaskId?: Id<"tasks">;
  relatedRequestId?: Id<"driverRequests">;
  metadata?: Record<string, any>;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

const THRESHOLDS = {
  DEPARTMENT_CRITICAL: 0.5,  // 50% отдела — критический уровень
  DEPARTMENT_WARNING: 0.3,   // 30% отдела — предупреждение
  CHECK_DAYS_BEFORE: 14,     // Проверять конфликты за 2 недели
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN CONFLICT DETECTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Обнаружить ВСЕ типы конфликтов для организации
 * Используется AI Ассистентом для комплексной проверки
 */
export const detectAllConflicts = query({
  args: {
    organizationId: v.id("organizations"),
    startDate: v.number(),
    endDate: v.number(),
    userId: v.optional(v.id("users")),
    conflictTypes: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const conflicts: Conflict[] = [];

    // Определяем, какие типы конфликтов проверять
    const typesToCheck = args.conflictTypes || [
      "leave_event",
      "leave_department",
      "driver_schedule",
      "task_deadline",
      "task_assignment",
    ];

    // 1. Leave-Event конфликты
    if (typesToCheck.includes("leave_event")) {
      const leaveEventConflicts = await detectLeaveEventConflicts(ctx, args);
      conflicts.push(...leaveEventConflicts);
    }

    // 2. Department overlap конфликты
    if (typesToCheck.includes("leave_department")) {
      const deptConflicts = await detectDepartmentConflicts(ctx, args);
      conflicts.push(...deptConflicts);
    }

    // 3. Driver schedule конфликты
    if (typesToCheck.includes("driver_schedule")) {
      const driverConflicts = await detectDriverConflicts(ctx, args);
      conflicts.push(...driverConflicts);
    }

    // 4. Task conflicts
    if (typesToCheck.includes("task_deadline") || typesToCheck.includes("task_assignment")) {
      const taskConflicts = await detectTaskConflicts(ctx, args);
      conflicts.push(...taskConflicts);
    }

    // Сортируем: критические сначала, затем по дате
    return conflicts.sort((a, b) => {
      if (a.severity === "critical" && b.severity !== "critical") return -1;
      if (b.severity === "critical" && a.severity !== "critical") return 1;
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
  },
});

/**
 * Быстрая проверка для конкретного запроса
 * Используется при создании/редактировании сущности
 */
export const checkConflictsForRequest = query({
  args: {
    organizationId: v.id("organizations"),
    requestType: v.union(
      v.literal("leave"),
      v.literal("driver"),
      v.literal("task"),
      v.literal("event")
    ),
    userId: v.id("users"),
    startDate: v.number(),
    endDate: v.number(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const conflicts: Conflict[] = [];

    if (args.requestType === "leave") {
      // Проверка конфликтов отпуска
      const user = await ctx.db.get(args.userId);
      if (!user) return { conflicts: [], hasCritical: false };

      const userDepartment = user.department || "";

      // 1. Проверка мероприятий
      const events = await ctx.db
        .query("companyEvents")
        .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
        .collect();

      for (const event of events) {
        const overlaps = (
          args.startDate <= event.endDate && 
          args.endDate >= event.startDate
        );

        if (!overlaps) continue;

        const isRequiredDept = event.requiredDepartments.some(
          dept => dept.toLowerCase() === userDepartment.toLowerCase()
        );
        const isRequiredEmployee = event.requiredEmployeeIds?.includes(args.userId);

        if (isRequiredDept || isRequiredEmployee) {
          conflicts.push({
            id: `leave-event-${event._id}`,
            type: "leave_event",
            severity: event.priority === "high" ? "critical" : "warning",
            title: isRequiredEmployee 
              ? "Вы лично требуется на мероприятии" 
              : `Ваш отдел "${userDepartment}" требуется на мероприятии`,
            message: `Мероприятие "${event.name}" (${new Date(event.startDate).toLocaleDateString()}) требует вашего присутствия или присутствия сотрудников вашего отдела.`,
            suggestion: isRequiredEmployee
              ? "Рекомендуем перенести отпуск или обсудить с руководителем возможность отсутствия."
              : "Обсудите с командой, кто может представлять отдел на мероприятии.",
            date: new Date(event.startDate).toISOString(),
            affectedUsers: [args.userId],
            affectedDepartments: [userDepartment],
            relatedEventId: event._id,
            metadata: {
              eventName: event.name,
              eventStartDate: event.startDate,
              eventEndDate: event.endDate,
              eventType: event.eventType,
            },
          });
        }
      }

      // 2. Проверка department overlap
      const deptConflicts = await detectDepartmentConflicts(ctx, {
        ...args,
        userId: args.userId,
      });
      conflicts.push(...deptConflicts);
    }

    if (args.requestType === "driver") {
      // Проверка конфликтов водителя
      const driverId = args.metadata?.driverId as Id<"drivers"> | undefined;
      
      if (driverId) {
        const existingTrips = await ctx.db
          .query("driverSchedules")
          .withIndex("by_driver", (q) => q.eq("driverId", driverId))
          .collect();

        for (const trip of existingTrips) {
          const overlaps = (
            args.startDate <= trip.endTime && 
            args.endDate >= trip.startTime
          );

          if (overlaps && trip.status !== "cancelled") {
            conflicts.push({
              id: `driver-schedule-${trip._id}`,
              type: "driver_schedule",
              severity: "critical",
              title: "Водитель уже забронирован",
              message: `Водитель уже забронирован на это время: ${trip.tripInfo.purpose}`,
              suggestion: "Выберите другого водителя или измените время поездки.",
              date: new Date(trip.startTime).toISOString(),
              affectedUsers: [],
              relatedRequestId: trip.requestId,
              metadata: {
                tripId: trip._id,
                tripPurpose: trip.tripInfo.purpose,
              },
            });
          }
        }
      }
    }

    if (args.requestType === "task") {
      // Проверка конфликтов задач
      const assigneeId = args.metadata?.assigneeId as Id<"users"> | undefined;
      
      if (assigneeId) {
        // Проверяем, не в отпуске ли исполнитель
        const leaveRequests = await ctx.db
          .query("leaveRequests")
          .withIndex("by_user", (q) => q.eq("userId", assigneeId))
          .collect();

        for (const leave of leaveRequests) {
          const overlaps = (
            args.startDate <= new Date(leave.endDate).getTime() && 
            args.endDate >= new Date(leave.startDate).getTime()
          );

          if (overlaps && leave.status === "approved") {
            conflicts.push({
              id: `task-leave-${leave._id}`,
              type: "task_assignment",
              severity: "warning",
              title: "Исполнитель в отпуске",
              message: `Назначенный исполнитель будет в отпуске (${leave.type}) в период выполнения задачи.`,
              suggestion: "Переназначьте задачу на другого сотрудника или измените срок выполнения.",
              date: leave.startDate,
              affectedUsers: [assigneeId],
              relatedTaskId: args.metadata?.taskId,
              metadata: {
                leaveId: leave._id,
                leaveType: leave.type,
                leaveStartDate: leave.startDate,
                leaveEndDate: leave.endDate,
              },
            });
          }
        }
      }
    }

    return { 
      conflicts, 
      hasCritical: conflicts.some(c => c.severity === "critical"),
    };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// LEAVE EVENT CONFLICTS
// ─────────────────────────────────────────────────────────────────────────────

async function detectLeaveEventConflicts(
  ctx: any,
  args: { organizationId: Id<"organizations">; startDate: number; endDate: number }
): Promise<Conflict[]> {
  const conflicts: Conflict[] = [];

  // Получаем все мероприятия в периоде
  const events = await ctx.db
    .query("companyEvents")
    .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
    .collect();

  // Получаем все одобренные отпуска в периоде
  const leaves = await ctx.db
    .query("leaveRequests")
    .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
    .collect();

  const approvedLeaves = leaves.filter(l => l.status === "approved");

  for (const event of events) {
    for (const leave of approvedLeaves) {
      const overlaps = (
        new Date(leave.startDate).getTime() <= event.endDate && 
        new Date(leave.endDate).getTime() >= event.startDate
      );

      if (!overlaps) continue;

      const user = await ctx.db.get(leave.userId);
      if (!user) continue;

      const userDepartment = user.department || "";
      const isRequiredDept = event.requiredDepartments.some(
        dept => dept.toLowerCase() === userDepartment.toLowerCase()
      );
      const isRequiredEmployee = event.requiredEmployeeIds?.includes(leave.userId);

      if (isRequiredDept || isRequiredEmployee) {
        conflicts.push({
          id: `leave-event-${event._id}-${leave._id}`,
          type: "leave_event",
          severity: event.priority === "high" ? "critical" : "warning",
          title: isRequiredEmployee 
            ? `${user.name} лично требуется на мероприятии` 
            : `Сотрудник из "${userDepartment}" требуется на мероприятии`,
          message: `${user.name} в отпуске (${leave.type}) во время мероприятия "${event.name}".`,
          suggestion: "Рассмотрите возможность переноса отпуска или найдите замену сотруднику.",
          date: new Date(event.startDate).toISOString(),
          affectedUsers: [leave.userId],
          affectedDepartments: [userDepartment],
          relatedEventId: event._id,
          metadata: {
            leaveId: leave._id,
            eventName: event.name,
            eventType: event.eventType,
          },
        });
      }
    }
  }

  return conflicts;
}

// ─────────────────────────────────────────────────────────────────────────────
// DEPARTMENT OVERLAP CONFLICTS
// ─────────────────────────────────────────────────────────────────────────────

async function detectDepartmentConflicts(
  ctx: any,
  args: { 
    organizationId: Id<"organizations">; 
    startDate: number; 
    endDate: number;
    userId?: Id<"users">;
  }
): Promise<Conflict[]> {
  const conflicts: Conflict[] = [];

  // Получаем всех пользователей
  const users = await ctx.db
    .query("users")
    .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
    .collect();

  // Получаем все одобренные отпуска
  const leaves = await ctx.db
    .query("leaveRequests")
    .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
    .collect();

  const approvedLeaves = leaves.filter(l => l.status === "approved");

  // Группируем по отделам
  const deptUsers = new Map<string, typeof users>();
  const deptLeaves = new Map<string, typeof approvedLeaves>();

  for (const user of users) {
    const dept = user.department || "Unknown";
    if (!deptUsers.has(dept)) deptUsers.set(dept, []);
    deptUsers.get(dept)!.push(user);
  }

  for (const leave of approvedLeaves) {
    const user = users.find(u => u._id === leave.userId);
    if (!user) continue;
    
    const dept = user.department || "Unknown";
    if (!deptLeaves.has(dept)) deptLeaves.set(dept, []);
    deptLeaves.get(dept)!.push(leave);
  }

  // Проверяем каждый день в периоде
  const startDate = new Date(args.startDate);
  const endDate = new Date(args.endDate);

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    const timestamp = d.getTime();

    for (const [dept, deptUserList] of deptUsers.entries()) {
      const deptSize = deptUserList.length;
      if (deptSize === 0) continue;

      // Считаем, кто в отпуске в этот день
      const leavesOnThisDay = deptLeaves.get(dept)?.filter(leave => {
        const leaveStart = new Date(leave.startDate).getTime();
        const leaveEnd = new Date(leave.endDate).getTime();
        return timestamp >= leaveStart && timestamp <= leaveEnd;
      }) || [];

      const outCount = leavesOnThisDay.length;
      const percentage = outCount / deptSize;

      // Если конкретный userId указан, проверяем только его отдел
      if (args.userId) {
        const currentUser = await ctx.db.get(args.userId);
        if (currentUser?.department !== dept) continue;
      }

      if (percentage >= THRESHOLDS.DEPARTMENT_CRITICAL) {
        conflicts.push({
          id: `dept-critical-${dept}-${dateStr}`,
          type: "leave_department",
          severity: "critical",
          title: `Критическая нехватка сотрудников в "${dept}"`,
          message: `${outCount}/${deptSize} сотрудников (${(percentage * 100).toFixed(0)}%) в отпуске. Работа отдела может быть парализована.`,
          suggestion: "Рекомендуем отозвать кого-то из отпуска или перераспределить задачи.",
          date: dateStr,
          affectedUsers: leavesOnThisDay.map(l => l.userId),
          affectedDepartments: [dept],
          metadata: {
            percentage: Math.round(percentage * 100),
            departmentSize: deptSize,
          },
        });
      } else if (percentage >= THRESHOLDS.DEPARTMENT_WARNING) {
        conflicts.push({
          id: `dept-warning-${dept}-${dateStr}`,
          type: "leave_department",
          severity: "warning",
          title: `Внимание: ${outCount} сотрудников из "${dept}" в отпуске`,
          message: `${outCount}/${deptSize} сотрудников (${(percentage * 100).toFixed(0)}%) отсутствуют. Возможны задержки.`,
          suggestion: "Планируйте нагрузку с учётом отсутствия сотрудников.",
          date: dateStr,
          affectedUsers: leavesOnThisDay.map(l => l.userId),
          affectedDepartments: [dept],
          metadata: {
            percentage: Math.round(percentage * 100),
            departmentSize: deptSize,
          },
        });
      }
    }
  }

  return conflicts;
}

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER CONFLICTS
// ─────────────────────────────────────────────────────────────────────────────

async function detectDriverConflicts(
  ctx: any,
  args: { organizationId: Id<"organizations">; startDate: number; endDate: number }
): Promise<Conflict[]> {
  const conflicts: Conflict[] = [];

  // Получаем все поездки в периоде
  const schedules = await ctx.db
    .query("driverSchedules")
    .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
    .collect();

  const activeSchedules = schedules.filter(s => 
    s.status === "approved" || s.status === "pending"
  );

  // Группируем по водителям и проверяем пересечения
  const driverTrips = new Map<Id<"drivers">, typeof activeSchedules>();

  for (const schedule of activeSchedules) {
    if (!driverTrips.has(schedule.driverId)) {
      driverTrips.set(schedule.driverId, []);
    }
    driverTrips.get(schedule.driverId)!.push(schedule);
  }

  for (const [driverId, trips] of driverTrips.entries()) {
    // Проверяем на пересечения по времени
    for (let i = 0; i < trips.length; i++) {
      for (let j = i + 1; j < trips.length; j++) {
        const trip1 = trips[i];
        const trip2 = trips[j];

        const overlaps = (
          trip1.startTime <= trip2.endTime && 
          trip1.endTime >= trip2.startTime
        );

        if (overlaps) {
          conflicts.push({
            id: `driver-overlap-${trip1._id}-${trip2._id}`,
            type: "driver_schedule",
            severity: "critical",
            title: "Двойная бронь водителя",
            message: `Водитель забронирован одновременно на две поездки: "${trip1.tripInfo.purpose}" и "${trip2.tripInfo.purpose}".`,
            suggestion: "Переназначьте одну из поездок на другого водителя.",
            date: new Date(trip1.startTime).toISOString(),
            affectedUsers: [trip1.requestedBy, trip2.requestedBy],
            metadata: {
              driverId,
              trip1Id: trip1._id,
              trip2Id: trip2._id,
            },
          });
        }
      }
    }
  }

  return conflicts;
}

// ─────────────────────────────────────────────────────────────────────────────
// TASK CONFLICTS
// ─────────────────────────────────────────────────────────────────────────────

async function detectTaskConflicts(
  ctx: any,
  args: { organizationId: Id<"organizations">; startDate: number; endDate: number }
): Promise<Conflict[]> {
  const conflicts: Conflict[] = [];

  // Получаем все задачи
  const tasks = await ctx.db
    .query("tasks")
    .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
    .collect();

  const activeTasks = tasks.filter(t => 
    t.status !== "completed" && t.status !== "cancelled"
  );

  // Получаем все отпуска
  const leaves = await ctx.db
    .query("leaveRequests")
    .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
    .collect();

  const approvedLeaves = leaves.filter(l => l.status === "approved");

  // Проверяем каждую задачу
  for (const task of activeTasks) {
    const assignee = await ctx.db.get(task.assigneeId);
    if (!assignee) continue;

    const taskDeadline = task.dueDate ? new Date(task.dueDate).getTime() : null;
    
    // Проверяем, не попадает ли дедлайн в период отпусков
    if (taskDeadline) {
      for (const leave of approvedLeaves) {
        if (leave.userId !== task.assigneeId) continue;

        const leaveStart = new Date(leave.startDate).getTime();
        const leaveEnd = new Date(leave.endDate).getTime();

        if (taskDeadline >= leaveStart && taskDeadline <= leaveEnd) {
          conflicts.push({
            id: `task-deadline-${task._id}-${leave._id}`,
            type: "task_deadline",
            severity: "warning",
            title: "Дедлайн задачи во время отпуска",
            message: `Дедлайн задачи "${task.title}" попадает на период отпуска исполнителя.`,
            suggestion: "Перенесите дедлайн или переназначьте задачу.",
            date: new Date(taskDeadline).toISOString(),
            affectedUsers: [task.assigneeId],
            relatedTaskId: task._id,
            metadata: {
              taskId: task._id,
              taskTitle: task.title,
              leaveId: leave._id,
            },
          });
        }
      }
    }
  }

  return conflicts;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFLICT SUMMARY FOR AI
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Краткая сводка конфликтов для AI Ассистента
 * Возвращает human-readable сообщения
 */
export const getConflictSummaryForAI = query({
  args: {
    organizationId: v.id("organizations"),
    userId: v.optional(v.id("users")),
    startDate: v.number(),
    endDate: v.number(),
  },
  handler: async (ctx, args) => {
    const conflicts = await detectAllConflicts(ctx, {
      organizationId: args.organizationId,
      startDate: args.startDate,
      endDate: args.endDate,
      userId: args.userId,
    });

    const critical = conflicts.filter(c => c.severity === "critical");
    const warnings = conflicts.filter(c => c.severity === "warning");

    return {
      total: conflicts.length,
      critical: critical.length,
      warnings: warnings.length,
      messages: conflicts.map(c => ({
        type: c.type,
        severity: c.severity,
        title: c.title,
        message: c.message,
        suggestion: c.suggestion,
      })),
      hasBlockingConflicts: critical.length > 0,
    };
  },
});
