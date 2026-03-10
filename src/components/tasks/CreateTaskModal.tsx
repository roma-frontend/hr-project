"use client";

import { useState, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { uploadTaskAttachment } from "@/actions/cloudinary";
import { toast } from "sonner";

interface Props {
  currentUserId: Id<"users">;
  userRole: "admin" | "supervisor" | "employee";
  onClose: () => void;
}

export function CreateTaskModal({ currentUserId, userRole, onClose }: Props) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [deadline, setDeadline] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const employees = useQuery(api.tasks.getUsersForAssignment, { requesterId: currentUserId });
  const myEmployees = useQuery(
    api.tasks.getMyEmployees,
    userRole === "supervisor" ? { supervisorId: currentUserId } : "skip"
  );

  const createTask = useMutation(api.tasks.createTask);
  const addAttachment = useMutation(api.tasks.addAttachment);

  const handleFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files ?? []).filter(f => {
      if (f.size > 10 * 1024 * 1024) {
        toast.error(`${f.name} too large (max 10MB)`);
        return false;
      }
      return true;
    });
    setFiles(prev => [...prev, ...newFiles].slice(0, 10));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const availableEmployees = userRole === "admin" ? employees : myEmployees;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError(t('task.titleRequired')); return; }
    if (!assignedTo) { setError(t('task.selectAssignee')); return; }

    setLoading(true);
    setError("");
    try {
      const tags = tagsInput.split(",").map(t => t.trim()).filter(Boolean);
      const taskId = await createTask({
        title: title.trim(),
        description: description.trim() || undefined,
        assignedTo: assignedTo as Id<"users">,
        assignedBy: currentUserId,
        priority,
        deadline: deadline ? new Date(deadline).getTime() : undefined,
        tags: tags.length > 0 ? tags : undefined,
      });

      // Upload attachments if any
      if (files.length > 0 && taskId) {
        await Promise.all(files.map(async (file) => {
          try {
            const base64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });
            const url = await uploadTaskAttachment(base64, file.name);
            await addAttachment({
              taskId: taskId as Id<"tasks">,
              url,
              name: file.name,
              type: file.type,
              size: file.size,
              uploadedBy: currentUserId,
            });
          } catch {
            toast.error(`Failed to upload ${file.name}`);
          }
        }));
      }

      onClose();
    } catch (err: any) {
      setError(err.message ?? t('task.failedToCreate'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[var(--card)] rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-[var(--border)]">
        {/* Header */}
        <div className="px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold ">{t('task.createTask')}</h2>
              <p className="text-black-200 text-sm mt-0.5">{t('task.assignTask')}</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors">✕</button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm rounded-xl px-4 py-3">{error}</div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-1.5">{t('task.taskTitleRequired')}</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={t('task.titlePlaceholder')}
              className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--background-subtle)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent placeholder:text-[var(--text-muted)]"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-1.5">{t('task.description')}</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={t('task.descriptionPlaceholder')}
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--background-subtle)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent resize-none placeholder:text-[var(--text-muted)]"
            />
          </div>

          {/* Assignee */}
          <div>
            <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-1.5">{t('task.assignToRequired')}</label>
            <select
              value={assignedTo}
              onChange={e => setAssignedTo(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--background-subtle)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            >
              <option value="">{t('task.selectEmployee')}</option>
              {availableEmployees?.map(emp => (
                <option key={emp._id} value={emp._id}>
                  {emp.name}
                  {emp.role ? ` [${emp.role === 'admin' ? 'Admin' : emp.role === 'supervisor' ? 'Supervisor' : emp.role === 'driver' ? 'Driver' : 'Employee'}]` : ''}
                  {emp.position ? ` — ${emp.position}` : ""}
                  {emp.department ? ` (${emp.department})` : ""}
                </option>
              ))}
            </select>
            {availableEmployees?.length === 0 && (
              <p className="text-xs text-amber-400 mt-1">
                {userRole === "supervisor" ? t('task.noEmployeesAssigned') : t('task.noEmployeesFound')}
              </p>
            )}
          </div>

          {/* Priority + Deadline row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-1.5">{t('task.priority')}</label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as any)}
                className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--background-subtle)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              >
                <option value="low">{t('task.low')}</option>
                <option value="medium">{t('task.medium')}</option>
                <option value="high">{t('task.high')}</option>
                <option value="urgent">{t('task.urgent')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-1.5">{t('task.deadline')}</label>
              <input
                type="date"
                value={deadline}
                onChange={e => setDeadline(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--background-subtle)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-1.5">{t('task.tags')} <span className="font-normal text-[var(--text-muted)]">{t('task.tagsHint')}</span></label>
            <input
              value={tagsInput}
              onChange={e => setTagsInput(e.target.value)}
              placeholder={t('task.tagsPlaceholder')}
              className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--background-subtle)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent placeholder:text-[var(--text-muted)]"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] text-sm font-medium hover:bg-[var(--background-subtle)] transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-700 hover:to-sky-700 text-white text-sm font-semibold shadow-md shadow-blue-500/20 transition-all disabled:opacity-60"
            >
              {loading ? t('task.creating') : t('task.createTaskButton')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
