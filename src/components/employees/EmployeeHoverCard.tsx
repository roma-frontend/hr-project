'use client';
import Image from 'next/image';

import { useTranslation } from 'react-i18next';
import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from '@/lib/cssMotion';
import React from 'react';
import { useUpdatePresence } from '@/hooks/useProductivity';

type PresenceStatus = 'available' | 'in_meeting' | 'in_call' | 'out_of_office' | 'busy';

const PRESENCE_CONFIG: Record<
  PresenceStatus,
  { labelKey: string; color: string; bg: string; dot: string; icon: string }
> = {
  available: {
    labelKey: 'presence.available',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    dot: 'bg-emerald-500',
    icon: '🟢',
  },
  in_meeting: {
    labelKey: 'presence.inMeeting',
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    dot: 'bg-amber-500',
    icon: '📅',
  },
  in_call: {
    labelKey: 'presence.inCall',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    dot: 'bg-blue-500',
    icon: '📞',
  },
  out_of_office: {
    labelKey: 'presence.outOfOffice',
    color: 'text-slate-600',
    bg: 'bg-slate-50',
    dot: 'bg-slate-500',
    icon: '🏠',
  },
  busy: {
    labelKey: 'presence.busy',
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    dot: 'bg-orange-500',
    icon: '⛔',
  },
};

interface Props {
  employee: any;
  children: React.ReactNode;
  canEditStatus?: boolean;
  currentUserId?: string;
  userRole?: string;
  allUsers?: any[];
}

export function EmployeeHoverCard({
  employee,
  children,
  canEditStatus = false,
  currentUserId,
  userRole,
  allUsers,
}: Props) {
  const { t } = useTranslation();
  const isAdmin = userRole === 'admin';
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<'right' | 'left'>('right');
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const updatePresenceMutation = useUpdatePresence();

  const supervisor = allUsers?.find((u: any) => u.id === employee.supervisorId);

  const { data: taskCount = [] } = useQuery({
    queryKey: ['tasks-for-employee', employee.id],
    queryFn: async () => {
      const params = new URLSearchParams({
        action: 'get-tasks-for-employee',
        userId: employee.id,
      });
      const res = await fetch(`/api/tasks?${params}`);
      if (!res.ok) throw new Error(t('hooks.employees.failedToFetchTasks', 'Failed to fetch tasks'));
      const json = await res.json();
      return json.data as any[];
    },
    enabled: open && !!employee.id,
  });

  const activeTasks = (taskCount ?? []).filter(
    (t: any) => t.status === 'in_progress' || t.status === 'pending',
  ).length;

  const presence = (employee.presenceStatus ?? 'available') as PresenceStatus;
  const presenceCfg = PRESENCE_CONFIG[presence];

  const handleMouseEnter = () => {
    clearTimeout(timerRef.current);
    // Detect position
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setPos(rect.right + 320 > window.innerWidth ? 'left' : 'right');
    }
    timerRef.current = setTimeout(() => setOpen(true), 1000);
  };

  const handleMouseLeave = () => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setOpen(false), 200);
  };

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const handlePresenceChange = async (status: PresenceStatus) => {
    await updatePresenceMutation.mutateAsync({ userId: employee.id, presenceStatus: status });
  };

  const initials = (employee.name ?? '?')
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      ref={containerRef}
      className="relative inline-block w-full"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 6 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            onMouseEnter={() => clearTimeout(timerRef.current)}
            onMouseLeave={handleMouseLeave}
            className="fixed z-[9999] w-[300px]"
            style={(() => {
              if (!containerRef.current) return {};
              const rect = containerRef.current.getBoundingClientRect();
              const cardW = 300;
              const cardH = 500;
              const margin = 10;

              // Vertical: center on element, clamp to screen
              const idealTop = rect.top + rect.height / 2 - cardH / 2;
              const top = Math.max(margin, Math.min(idealTop, window.innerHeight - cardH - margin));

              // Horizontal: prefer right side, fallback to left, clamp to screen
              let left = rect.right + margin;
              if (left + cardW > window.innerWidth - margin) {
                left = rect.left - cardW - margin;
              }
              // Final clamp — never go off left edge
              left = Math.max(margin, left);

              return {
                top,
                left,
                filter: 'drop-shadow(0 12px 40px rgba(99,102,241,0.22))',
              };
            })()}
          >
            <div
              className="rounded-2xl overflow-hidden border"
              style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            >
              {/* Header with avatar + name inside */}
              <div className="bg-linear-to-br from-blue-600 to-sky-700 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span
                    className="text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.15)',
                      color: 'var(--text-on-primary)',
                    }}
                  >
                    <span className="mr-1">{presenceCfg.icon}</span>
                    {t(presenceCfg.labelKey)}
                  </span>
                  {activeTasks > 0 && (
                    <span
                      className="text-xs font-semibold px-2.5 py-1 rounded-full"
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.15)',
                        color: 'var(--text-on-primary)',
                      }}
                    >
                      📋 {activeTasks} task{activeTasks > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div
                    className="w-14 h-14 rounded-full overflow-hidden shadow-lg shrink-0 flex items-center justify-center text-xl font-bold"
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.15)',
                      border: '2px solid rgba(255,255,255,0.4)',
                      color: 'var(--text-on-primary)',
                    }}
                  >
                    {employee.avatarUrl ? (
                      <img
                        src={employee.avatarUrl}
                        alt={employee.name}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      initials
                    )}
                  </div>
                  <div>
                    <h3
                      className="font-bold text-base leading-tight"
                      style={{ color: 'var(--text-on-primary)' }}
                    >
                      {employee.name}
                    </h3>
                    <p className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
                      {employee.position ?? employee.role}
                    </p>
                  </div>
                </div>
              </div>

              {/* Info */}
              <div className="px-4 pb-4 pt-3">
                {/* Info rows */}
                <div className="space-y-2.5">
                  {employee.email && (
                    <a
                      href={`mailto:${employee.email}`}
                      className="flex items-center gap-2.5 group hover:opacity-80 transition-opacity"
                    >
                      <span
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors shrink-0"
                        style={{ backgroundColor: 'var(--background-subtle)' }}
                      >
                        ✉️
                      </span>
                      <span
                        className="text-sm transition-colors truncate"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {employee.email}
                      </span>
                    </a>
                  )}

                  {employee.phone && (
                    <a
                      href={`tel:${employee.phone}`}
                      className="flex items-center gap-2.5 group hover:opacity-80 transition-opacity"
                    >
                      <span
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors shrink-0"
                        style={{ backgroundColor: 'var(--background-subtle)' }}
                      >
                        📞
                      </span>
                      <span
                        className="text-sm transition-colors"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {employee.phone}
                      </span>
                    </a>
                  )}

                  {employee.department && (
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: 'var(--background-subtle)' }}
                      >
                        🏢
                      </span>
                      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {employee.department}
                      </span>
                    </div>
                  )}

                  {supervisor && (
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: 'var(--background-subtle)' }}
                      >
                        👤
                      </span>
                      <div>
                        <span className="text-xs block" style={{ color: 'var(--text-muted)' }}>
                          {t('roles.supervisor')}
                        </span>
                        <span
                          className="text-sm font-medium"
                          style={{ color: 'var(--accent-primary)' }}
                        >
                          {supervisor.name && supervisor.name !== 'admin'
                            ? supervisor.name
                            : (supervisor.email?.split('@')[0] ?? t('roles.admin'))}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Financial info — admin only */}
                  {isAdmin && employee.travelAllowance != null && (
                    <div className="mt-1 pt-2.5 border-t" style={{ borderColor: 'var(--border)' }}>
                      <p
                        className="text-xs mb-2 font-medium uppercase tracking-wide"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {t('employeeInfo.finance')}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {employee.travelAllowance != null && (
                          <div
                            className="rounded-xl p-2.5"
                            style={{ backgroundColor: 'var(--background-subtle)' }}
                          >
                            <p className="text-xs text-amber-500 font-medium">
                              ✈️ {t('employeeInfo.travel')}
                            </p>
                            <p
                              className="text-sm font-bold"
                              style={{ color: 'var(--text-primary)' }}
                            >
                              {employee.travelAllowance.toLocaleString()} {t('currency.amd')}
                            </p>
                          </div>
                        )}
                        {employee.sickLeaveBudget != null && (
                          <div
                            className="rounded-xl p-2.5"
                            style={{ backgroundColor: 'var(--background-subtle)' }}
                          >
                            <p className="text-xs text-rose-500 font-medium">
                              🏥 {t('employeeInfo.sickLeave')}
                            </p>
                            <p
                              className="text-sm font-bold"
                              style={{ color: 'var(--text-primary)' }}
                            >
                              {employee.sickLeaveBudget.toLocaleString()} {t('currency.amd')}
                            </p>
                          </div>
                        )}
                        {employee.vacationBudget != null && (
                          <div
                            className="rounded-xl p-2.5"
                            style={{ backgroundColor: 'var(--background-subtle)' }}
                          >
                            <p className="text-xs text-blue-500 font-medium">
                              🏖️ {t('employeeInfo.vacation')}
                            </p>
                            <p
                              className="text-sm font-bold"
                              style={{ color: 'var(--text-primary)' }}
                            >
                              {employee.vacationBudget.toLocaleString()} {t('currency.amd')}
                            </p>
                          </div>
                        )}
                        {employee.salary != null && (
                          <div
                            className="rounded-xl p-2.5"
                            style={{ backgroundColor: 'var(--background-subtle)' }}
                          >
                            <p className="text-xs text-emerald-500 font-medium">
                              💰 {t('employeeInfo.salary')}
                            </p>
                            <p
                              className="text-sm font-bold"
                              style={{ color: 'var(--text-primary)' }}
                            >
                              {employee.salary.toLocaleString()} {t('currency.amd')}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Presence selector — only for self or admin */}
                {canEditStatus && (
                  <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                    <p className="text-xs mb-2 font-medium" style={{ color: 'var(--text-muted)' }}>
                      {t('employeeInfo.setStatus', 'Set Status')}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {(
                        Object.entries(PRESENCE_CONFIG) as [
                          PresenceStatus,
                          (typeof PRESENCE_CONFIG)[PresenceStatus],
                        ][]
                      ).map(([key, cfg]) => (
                        <button
                          key={key}
                          onClick={() => handlePresenceChange(key)}
                          className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all ${
                            presence === key
                              ? `${cfg.bg} ${cfg.color} ring-2 ring-offset-1 ring-current`
                              : ''
                          }`}
                          style={
                            presence === key
                              ? {}
                              : {
                                  backgroundColor: 'var(--background-subtle)',
                                  color: 'var(--text-muted)',
                                }
                          }
                          onMouseEnter={(e) => {
                            if (presence !== key) {
                              e.currentTarget.style.backgroundColor = 'var(--background)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (presence !== key) {
                              e.currentTarget.style.backgroundColor = 'var(--background-subtle)';
                            }
                          }}
                        >
                          {cfg.icon} {t(cfg.labelKey)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
