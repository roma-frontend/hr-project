'use client';

import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { EmployeeCard } from './EmployeeCard';
import { Users } from 'lucide-react';

interface Employee {
  _id: string;
  name: string;
  email: string;
  position?: string;
  department?: string;
  role: string;
  employeeType: 'staff' | 'contractor';
  avatarUrl?: string;
  phone?: string;
  supervisorId?: string;
  isActive: boolean;
  presenceStatus?: string;
  travelAllowance?: number;
}

interface RoleConfig {
  labelKey: string;
  icon: any;
  color: string;
  bg: string;
}

interface TypeConfig {
  labelKey: string;
  color: string;
  bg: string;
}

interface VirtualizedEmployeeListProps {
  employees: Employee[];
  viewMode: 'grid' | 'list';
  roleConfig: Record<string, RoleConfig>;
  typeConfig: Record<string, TypeConfig>;
  getPresenceBadge: (status: string | undefined) => { labelKey: string; cls: string };
  supervisors?: Array<{ _id: string; name: string }>;
  canManage: boolean;
  isAdmin: boolean;
  openMenuId: string | null;
  setOpenMenuId: (id: string | null) => void;
  setEditEmployee: (emp: Employee) => void;
  setDeleteConfirm: (id: string) => void;
  t: (key: string) => string;
  onEmployeeClick: (id: string) => void;
}

/**
 * Виртуализированный список сотрудников
 * Использует @tanstack/react-virtual для рендеринга только видимых элементов
 * Обеспечивает плавную работу даже с 1000+ сотрудниками
 */
export function VirtualizedEmployeeList({
  employees,
  viewMode,
  roleConfig,
  typeConfig,
  getPresenceBadge,
  supervisors,
  canManage,
  isAdmin,
  openMenuId,
  setOpenMenuId,
  setEditEmployee,
  setDeleteConfirm,
  t,
  onEmployeeClick,
}: VirtualizedEmployeeListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  // Размеры элементов
  const GRID_ITEM_HEIGHT = 280;
  const LIST_ITEM_HEIGHT = 80;
  const GRID_COLUMNS = viewMode === 'grid' ? 3 : 1;
  const GAP = 16;

  const virtualizer = useVirtualizer({
    count: employees.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => (viewMode === 'grid' ? GRID_ITEM_HEIGHT : LIST_ITEM_HEIGHT),
    overscan: 5, // Рендерить 5 элементов запасом
  });

  const totalHeight = virtualizer.getTotalSize();
  const virtualItems = virtualizer.getVirtualItems();

  if (employees.length === 0) {
    return (
      <div className="col-span-full flex flex-col items-center justify-center py-20 gap-3">
        <Users className="w-12 h-12 opacity-20" style={{ color: 'var(--text-muted)' }} />
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {t('employees.noFound')}
        </p>
      </div>
    );
  }

  // Grid view
  if (viewMode === 'grid') {
    return (
      <div
        ref={parentRef}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 h-[400px] sm:h-[500px] lg:h-[600px] overflow-auto"
      >
        <div
          style={{
            height: `${totalHeight}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualItems.map((virtualRow) => {
            const emp = employees[virtualRow.index];
            if (!emp) return null;
            const roleConf = (roleConfig[emp.role] || roleConfig.employee) as RoleConfig;
            const typeConf = (typeConfig[(emp as any).employeeType as keyof typeof typeConfig] || typeConfig.staff) as TypeConfig;
            const presence = getPresenceBadge((emp as any).presenceStatus);

            return (
              <div
                key={emp._id}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: `${(virtualRow.index % GRID_COLUMNS) * (100 / GRID_COLUMNS)}%`,
                  width: `${100 / GRID_COLUMNS}%`,
                  transform: `translateY(${virtualRow.start}px)`,
                  padding: '0 8px',
                  boxSizing: 'border-box',
                }}
              >
                <EmployeeCard
                  emp={emp}
                  roleConf={roleConf}
                  typeConf={typeConf}
                  presence={presence}
                  supervisors={supervisors}
                  canManage={canManage}
                  isAdmin={isAdmin}
                  openMenuId={openMenuId}
                  setOpenMenuId={setOpenMenuId}
                  setEditEmployee={setEditEmployee}
                  setDeleteConfirm={setDeleteConfirm}
                  t={t}
                  viewMode="grid"
                  index={virtualRow.index}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // List view
  return (
    <div
      ref={parentRef}
      className="rounded-2xl border overflow-hidden h-[400px] sm:h-[500px] lg:h-[600px] overflow-auto"
      style={{ borderColor: 'var(--border)' }}
    >
      <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
        {virtualItems.map((virtualRow) => {
          const emp = employees[virtualRow.index];
          if (!emp) return null;
          const roleConf = (roleConfig[emp.role] || roleConfig.employee) as RoleConfig;
          const typeConf = (typeConfig[(emp as any).employeeType as keyof typeof typeConfig] || typeConfig.staff) as TypeConfig;
          const presence = getPresenceBadge((emp as any).presenceStatus);

          return (
            <div
              key={emp._id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <EmployeeCard
                emp={emp}
                roleConf={roleConf}
                typeConf={typeConf}
                presence={presence}
                supervisors={supervisors}
                canManage={canManage}
                isAdmin={isAdmin}
                openMenuId={openMenuId}
                setOpenMenuId={setOpenMenuId}
                setEditEmployee={setEditEmployee}
                setDeleteConfirm={setDeleteConfirm}
                t={t}
                viewMode="list"
                index={virtualRow.index}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
