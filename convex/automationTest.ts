/**
 * Automation - Test Data (for development only)
 */

import { mutation } from "./_generated/server";

export const createTestData = mutation({
  args: {},
  handler: async (ctx) => {
    // Create test automation tasks
    const tasks = [
      { name: "Daily backup", status: "completed" as const },
      { name: "Email notifications", status: "completed" as const },
      { name: "Data sync", status: "running" as const },
      { name: "Report generation", status: "pending" as const },
      { name: "User cleanup", status: "failed" as const },
    ];

    const createdTasks = [];
    for (const task of tasks) {
      const taskId = await ctx.db.insert("automationTasks", {
        name: task.name,
        status: task.status,
        createdAt: Date.now() - Math.floor(Math.random() * 86400000),
        updatedAt: Date.now(),
      });
      createdTasks.push({ taskId, name: task.name, status: task.status });
    }

    // Create test workflows
    const workflow1 = await ctx.db.insert("automationWorkflows", {
      name: "Employee Onboarding",
      description: "Автоматическая настройка нового сотрудника",
      config: {
        steps: [
          "Create email account",
          "Assign equipment",
          "Schedule orientation",
          "Add to team channels",
        ],
      },
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const workflow2 = await ctx.db.insert("automationWorkflows", {
      name: "Leave Approval Auto-Response",
      description: "Автоматический ответ на заявки отпусков",
      config: {
        trigger: "leave_request_submitted",
        action: "send_email_confirmation",
      },
      isActive: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return {
      success: true,
      tasks: createdTasks,
      workflows: [
        { workflowId: workflow1, name: "Employee Onboarding", isActive: true },
        { workflowId: workflow2, name: "Leave Approval Auto-Response", isActive: false },
      ],
      message: "✅ Тестовые данные созданы! Обновите страницу /superadmin/automation",
    };
  },
});
