"use client";

import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuthStore } from "@/store/useAuthStore";
import type { Id } from "../../../convex/_generated/dataModel";
import { CheckCircle2, Circle, Clock, AlertCircle } from "lucide-react";
import { ShieldLoader } from "@/components/ui/ShieldLoader";
import { toast } from "sonner";

export function TodayTasksPanel() {

  const { t } = useTranslation();
  const { user } = useAuthStore();
  const tasks = useQuery(
    api.productivity.getTodayTasks,
    user?.id ? { userId: user.id as Id<"users"> } : "skip"
  );
  const updateTaskStatus = useMutation(api.tasks.updateTaskStatus);

  const handleToggleTask = async (taskId: Id<"tasks">, currentStatus: string) => {
    try {
      const newStatus = currentStatus === "completed" ? "in_progress" : "completed";
      await updateTaskStatus({ taskId, status: newStatus, userId: user!.id as Id<"users"> });
      toast.success(newStatus === "completed" ? "Task completed! 🎉" : "Task reopened");
    } catch (error) {
      toast.error("Failed to update task");
    }
  };

  // Hide section when loading or no tasks
  if (!tasks || tasks.length === 0) {
    return null;
  }

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case "high":
        return "text-red-500 bg-red-500/10";
      case "medium":
        return "text-orange-500 bg-orange-500/10";
      case "low":
        return "text-blue-500 bg-blue-500/10";
      default:
        return "text-gray-500 bg-gray-500/10";
    }
  };

  const formatDueDate = (dueDate?: number) => {
    if (!dueDate) return null;
    const date = new Date(dueDate);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";

    const isOverdue = date < today;
    return isOverdue ? "Overdue" : date.toLocaleDateString();
  };

  return (
    <div className="px-2 py-3">
      <div className="mb-3 px-2">
        <h3 className="text-xs font-semibold text-[var(--text-muted)]">Top Priority Tasks</h3>
        <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Quick access to your important tasks</p>
      </div>

      <div className="space-y-2">
        {tasks.map((task) => {
          const isCompleted = task.status === "completed";
          const dueText = formatDueDate(task.deadline);
          const isOverdue = task.deadline && task.deadline < Date.now();

          return (
            <div
              key={task._id}
              className={`group rounded-lg border p-3 transition-all hover:border-[var(--primary)]/50 ${isCompleted
                ? "border-[var(--border)] bg-[var(--background-subtle)]/50 opacity-60"
                : "border-[var(--border)] bg-[var(--background-subtle)]"
                }`}
            >
              <div className="flex items-start gap-2">
                <button
                  onClick={() => handleToggleTask(task._id, task.status)}
                  className="mt-0.5 flex-shrink-0 transition-transform hover:scale-110"
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : (
                    <Circle className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--primary)]" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-medium leading-snug ${isCompleted
                      ? "line-through text-[var(--text-muted)]"
                      : "text-[var(--text-primary)]"
                      }`}
                  >
                    {task.title}
                  </p>

                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {/* Priority badge */}
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase ${getPriorityColor(
                        task.priority
                      )}`}
                    >
                      {task.priority || "medium"}
                    </span>

                    {/* Due date */}
                    {dueText && (
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] ${isOverdue ? "text-red-500 font-semibold" : "text-[var(--text-muted)]"
                          }`}
                      >
                        {isOverdue ? <AlertCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        {dueText}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 px-2">
        <a
          href="/tasks"
          className="block text-center text-xs text-[var(--primary)] hover:underline font-medium"
        >
          View all tasks →
        </a>
      </div>
    </div>
  );
}
