"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthStore } from "@/store/useAuthStore";

interface Props {
  onClose: () => void;
}

function Avatar({ name, url }: { name: string; url?: string | null }) {
  const initials = name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  return (
    <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center font-bold text-white text-xs bg-gradient-to-br from-blue-500 to-sky-500">
      {url ? <img src={url} alt={name} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : initials}
    </div>
  );
}

export function AssignSupervisorModal({ onClose }: Props) {
  const { t } = useTranslation();
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [selectedSupervisor, setSelectedSupervisor] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const { user } = useAuthStore();
  const employees = useQuery(
    api.tasks.getUsersForAssignment,
    user?.id ? { requesterId: user.id as Id<"users"> } : "skip"
  );
  const supervisors = useQuery(
    api.tasks.getSupervisors,
    user?.id ? { requesterId: user.id as Id<"users"> } : "skip"
  );

  // Debug: log to check if data is loading
  console.log("AssignSupervisorModal - user:", user);
  console.log("AssignSupervisorModal - user.id:", user?.id);
  console.log("AssignSupervisorModal - employees:", employees);
  console.log("AssignSupervisorModal - supervisors:", supervisors);
  const assignSupervisor = useMutation(api.tasks.assignSupervisor);

  const selectedEmp = employees?.find(e => e._id === selectedEmployee);
  const currentSupervisor = supervisors?.find(s => s._id === selectedEmp?.supervisorId);

  const handleAssign = async () => {
    if (!selectedEmployee) return;
    setLoading(true);
    try {
      await assignSupervisor({
        employeeId: selectedEmployee as Id<"users">,
        supervisorId: selectedSupervisor ? selectedSupervisor as Id<"users"> : undefined,
      });
      setSuccess(true);
      setTimeout(() => { setSuccess(false); setSelectedEmployee(""); setSelectedSupervisor(""); }, 1500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 backdrop-blur-sm" style={{ backgroundColor: "var(--overlay-bg, rgba(0, 0, 0, 0.6))" }} onClick={onClose} />
      <div className="relative bg-[var(--card)] rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-[var(--border)]">
        {/* Header */}
        <div className="px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">{t('modals.assignSupervisor.title')}</h2>
              <p className="text-sm mt-0.5">{t('modals.assignSupervisor.description')}</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-white/30 flex items-center justify-center transition-colors" style={{ backgroundColor: "rgba(255,255,255,0.2)", color: "var(--text-on-accent)" }}>✕</button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {success && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm rounded-xl px-4 py-3 text-center font-medium">
              ✅ {t('modals.assignSupervisor.supervisorAssignedSuccess')}
            </div>
          )}

          {/* Employee select */}
          <div>
            <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-1.5">Select Employee</label>
            <select
              value={selectedEmployee}
              onChange={e => { setSelectedEmployee(e.target.value); setSelectedSupervisor(""); }}
              className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--background-subtle)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="">Choose employee...</option>
              {employees === undefined && <option disabled>{t('commonUI.loading')}...</option>}
              {employees?.length === 0 && <option disabled>No employees found</option>}
              {employees?.map(emp => (
                <option key={emp._id} value={emp._id}>
                  {emp.name}{emp.position ? ` — ${emp.position}` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Current supervisor info */}
          {selectedEmp && (
            <div className="bg-[var(--background-subtle)] rounded-2xl p-4 space-y-2 border border-[var(--border)]">
              <div className="flex items-center gap-3">
                <Avatar name={selectedEmp.name} url={selectedEmp.avatarUrl} />
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{selectedEmp.name}</p>
                  <p className="text-xs text-[var(--text-muted)]">{selectedEmp.position} {selectedEmp.department ? `· ${selectedEmp.department}` : ""}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mt-2">
                <span>Current supervisor:</span>
                <span className="font-semibold text-[var(--text-secondary)]">{currentSupervisor?.name ?? "None"}</span>
              </div>
            </div>
          )}

          {/* Supervisor select */}
          <div>
            <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-1.5">Assign Supervisor</label>
            <select
              value={selectedSupervisor}
              onChange={e => setSelectedSupervisor(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--background-subtle)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50"
              disabled={!selectedEmployee}
            >
              <option value="">— Remove supervisor</option>
              {supervisors?.map(sup => (
                <option key={sup._id} value={sup._id}>
                  {sup.name} ({sup.role}){sup.department ? ` · ${sup.department}` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* All employees overview */}
          <div>
            <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">Current Assignments</h3>
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {employees?.map(emp => {
                const sup = supervisors?.find(s => s._id === emp.supervisorId);
                return (
                  <div key={emp._id} className="flex items-center justify-between bg-[var(--background-subtle)] rounded-xl px-3 py-2 border border-[var(--border)]">
                    <div className="flex items-center gap-2">
                      <Avatar name={emp.name} url={emp.avatarUrl} />
                      <span className="text-xs font-medium text-[var(--text-primary)]">{emp.name}</span>
                    </div>
                    <span className="text-xs text-[var(--text-muted)]">
                      {sup ? `→ ${sup.name}` : <span className="text-amber-400">No supervisor</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] text-sm font-medium hover:bg-[var(--background-subtle)] transition-colors">
              Close
            </button>
            <button
              onClick={handleAssign}
              disabled={!selectedEmployee || loading}
              style={{ 
                background: "var(--accent-gradient)",
                color: "var(--text-on-accent)"
              }}
              className="flex-1 px-4 py-2.5 rounded-xl hover:opacity-90 text-sm font-semibold shadow-md transition-all disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save Assignment"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
