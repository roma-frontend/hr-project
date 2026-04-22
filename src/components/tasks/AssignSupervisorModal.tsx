'use client';
import Image from 'next/image';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/useAuthStore';
import { useOrgUsers } from '@/hooks/useUsers';

interface Props {
  onClose: () => void;
}

function Avatar({ name, url }: { name: string; url?: string | null }) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  return (
    <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 flex items-center justify-center font-bold text-white text-xs bg-linear-to-br from-blue-500 to-sky-500">
      {url ? (
        <img
          src={url}
          alt={name}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        initials
      )}
    </div>
  );
}

export function AssignSupervisorModal({ onClose }: Props) {
  const { t } = useTranslation();
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [selectedSupervisor, setSelectedSupervisor] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const { user } = useAuthStore();
  const { data: employees } = useOrgUsers(user?.organizationId || '');
  const { data: supervisors } = useOrgUsers(user?.organizationId || '');

  const selectedEmp = employees?.find((e) => e.id === selectedEmployee);
  const currentSupervisor = supervisors?.find((s) => s.id === selectedEmp?.supervisorid);

  const handleAssign = async () => {
    if (!selectedEmployee || !user?.organizationId) return;
    setLoading(true);
    try {
      const res = await fetch('/api/tasks?action=assign-supervisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: selectedEmployee,
          supervisorId: selectedSupervisor || null,
          organizationId: user.organizationId,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || t('tasks.failedToAssignSupervisor', 'Failed to assign supervisor'));
      }

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setSelectedEmployee('');
        setSelectedSupervisor('');
      }, 1500);
    } catch (error) {
      console.error('Failed to assign supervisor:', error);
      setSuccess(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 backdrop-blur-sm"
        style={{ backgroundColor: 'var(--overlay-bg, rgba(0, 0, 0, 0.6))' }}
        onClick={onClose}
      />
      <div className="relative bg-(--card) rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-(--border)">
        {/* Header */}
        <div className="px-6 py-5 bg-transparent">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">{t('modals.assignSupervisor.title')}</h2>
              <p className="text-sm mt-0.5">{t('modals.assignSupervisor.description')}</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-white/30 flex items-center justify-center transition-colors"
              style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'var(--text-on-accent)' }}
            >
              ✕
            </button>
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
            <label className="block text-sm font-semibold text-(--text-secondary) mb-1.5">
              {t('modals.assignSupervisor.selectEmployee')}
            </label>
            <select
              value={selectedEmployee}
              onChange={(e) => {
                setSelectedEmployee(e.target.value);
                setSelectedSupervisor('');
              }}
              className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--background-subtle) text-(--text-primary) text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="">{t('modals.assignSupervisor.chooseEmployee')}</option>
              {employees?.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                  {emp.position ? ` — ${emp.position}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Current supervisor info */}
          {selectedEmp && (
            <div className="bg-(--background-subtle) rounded-2xl p-4 space-y-2 border border-(--border)">
              <div className="flex items-center gap-3">
                <Avatar name={selectedEmp.name} url={selectedEmp.avatar_url} />
                <div>
                  <p className="text-sm font-semibold text-(--text-primary)">
                    {selectedEmp.name}
                  </p>
                  <p className="text-xs text-(--text-muted)">
                    {selectedEmp.position}{' '}
                    {selectedEmp.department ? `· ${selectedEmp.department}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-(--text-muted) mt-2">
                <span>{t('modals.assignSupervisor.currentSupervisor')}</span>
                <span className="font-semibold text-(--text-secondary)">
                  {currentSupervisor?.name ?? t('common.none')}
                </span>
              </div>
            </div>
          )}

          {/* Supervisor select */}
          <div>
            <label className="block text-sm font-semibold text-(--text-secondary) mb-1.5">
              {t('modals.assignSupervisor.assignSupervisor')}
            </label>
            <select
              value={selectedSupervisor}
              onChange={(e) => setSelectedSupervisor(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--background-subtle) text-(--text-primary) text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50"
              disabled={!selectedEmployee}
            >
              <option value="">— {t('modals.assignSupervisor.removeSupervisor')}</option>
              {supervisors?.map((sup) => (
                <option key={sup.id} value={sup.id}>
                  {sup.name} ({t(`roles.${sup.role}`)}
                  {sup.department ? ` · ${sup.department}` : ''})
                </option>
              ))}
            </select>
          </div>

          {/* All employees overview */}
          <div>
            <h3 className="text-xs font-semibold text-(--text-muted) uppercase tracking-wide mb-2">
              {t('modals.assignSupervisor.currentAssignments')}
            </h3>
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {employees?.map((emp) => {
                const sup = supervisors?.find((s) => s.id === emp.supervisorid);
                return (
                  <div
                    key={emp.id}
                    className="flex items-center justify-between bg-(--background-subtle) rounded-xl px-3 py-2 border border-(--border)"
                  >
                    <div className="flex items-center gap-2">
                      <Avatar name={emp.name} url={emp.avatar_url} />
                      <span className="text-xs font-medium text-(--text-primary)">
                        {emp.name}
                      </span>
                    </div>
                    <span className="text-xs text-(--text-muted)">
                      {sup ? (
                        `→ ${sup.name}`
                      ) : (
                        <span className="text-amber-400">
                          {t('modals.assignSupervisor.noSupervisor')}
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-(--border) text-(--text-secondary) text-sm font-medium hover:bg-(--background-subtle) transition-colors"
            >
              {t('common.close')}
            </button>
            <button
              onClick={handleAssign}
              disabled={!selectedEmployee || loading}
              style={{
                background: 'var(--accent-gradient)',
                color: 'var(--text-on-accent)',
              }}
              className="flex-1 px-4 py-2.5 rounded-xl hover:opacity-90 text-sm font-semibold shadow-md transition-all disabled:opacity-50"
            >
              {loading ? t('common.saving') : t('modals.assignSupervisor.saveAssignment')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
