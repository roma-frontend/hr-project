'use client';
import Image from 'next/image';

import React, { useState, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from 'convex/react';
import { useDebouncedCallback } from 'use-debounce';
import { useVirtualizer } from '@tanstack/react-virtual';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { motion, AnimatePresence } from '@/lib/cssMotion';
import {
  Plus,
  Search,
  Shield,
  Users,
  Briefcase,
  User,
  AlertTriangle,
  LayoutGrid,
  List,
  Car,
  Crown,
  UserCheck,
  UserCog,
  Mail,
  Phone,
  Building2,
  Eye,
  ChevronRight,
  Edit2,
  Trash2,
  MoreVertical,
} from 'lucide-react';
import { useShallow } from 'zustand/shallow';
import { useAuthStore } from '@/store/useAuthStore';
import type { User as UserType } from '@/store/useAuthStore';
import { useSelectedOrganization } from '@/hooks/useSelectedOrganization';
import { AddEmployeeModal } from './AddEmployeeModal';
import { EditEmployeeModal } from './EditEmployeeModal';
import { AvatarUpload } from '@/components/ui/avatar-upload';
import { EmployeeCard, EmployeeMenu } from './EmployeeCard';
import { VirtualizedEmployeeList } from './VirtualizedEmployeeList';
import { TeamSidebar } from './TeamSidebar';
import { toast } from 'sonner';
import { ShieldLoader } from '@/components/ui/ShieldLoader';
import { useRouter } from 'next/navigation';

import { useMediaQuery } from '@/hooks/useMediaQuery';

const ROLE_CONFIG = {
  superadmin: {
    labelKey: 'roles.superAdmin',
    icon: Shield,
    color: '#9333ea',
    bg: 'rgba(147,51,234,0.1)',
  },
  admin: { labelKey: 'roles.admin', icon: Crown, color: '#2563eb', bg: 'rgba(99,102,241,0.1)' },
  supervisor: {
    labelKey: 'roles.supervisor',
    icon: UserCheck,
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.1)',
  },
  employee: {
    labelKey: 'roles.employee',
    icon: User,
    color: '#10b981',
    bg: 'rgba(16,185,129,0.1)',
  },
  driver: { labelKey: 'roles.driver', icon: Car, color: '#06b6d4', bg: 'rgba(6,182,212,0.1)' },
};

const TYPE_CONFIG = {
  staff: { labelKey: 'employeeTypes.staff', color: '#2563eb', bg: 'rgba(99,102,241,0.1)' },
  contractor: {
    labelKey: 'employeeTypes.contractor',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.1)',
  },
};

export function EmployeesClient() {
  const { t } = useTranslation();
  const user = useAuthStore(useShallow((state: { user: UserType | null }) => state.user));
  const selectedOrgId = useSelectedOrganization();
  const router = useRouter();
  const isMobile = useMediaQuery('(max-width: 640px)');
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>(
    user?.role === 'employee' ? 'active' : 'active',
  );
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editEmployee, setEditEmployee] = useState<any | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false); // Закрыт по умолчанию

  // Pagination state
  const [cursor, setCursor] = useState<Id<'users'> | undefined>(undefined);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [pageCount, setPageCount] = useState(0);
  const PAGE_SIZE = 50;

  // Debounced search - prevents excessive re-renders while typing
  const handleSearchChange = useDebouncedCallback((value: string) => {
    setDebouncedSearch(value);
  }, 300);

  // For superadmin with selected org, ALWAYS use getOrgMembers
  // For others, use getAllUsers which returns their org's members
  const isSuperadmin = user?.role === 'superadmin';
  const useOrgFilter = mounted && isSuperadmin && selectedOrgId;

  // TEMP: Load all users without pagination for testing
  const allUsersDirect = useQuery(
    useOrgFilter ? api.organizations.getOrgMembers : api.users.getAllUsers,
    mounted && user?.id
      ? useOrgFilter
        ? {
            organizationId: selectedOrgId as Id<'organizations'>,
            superadminUserId: user.id as Id<'users'>,
          }
        : { requesterId: user.id as Id<'users'> }
      : 'skip',
  );

  console.log('[EmployeesClient] allUsersDirect:', {
    length: allUsersDirect?.length,
    value: allUsersDirect,
    mounted,
    hasUserId: !!user?.id,
    useOrgFilter,
    selectedOrgId,
  });

  // Use direct load for now
  React.useEffect(() => {
    console.log('[EmployeesClient] useEffect allUsersDirect:', allUsersDirect?.length);
    if (allUsersDirect && allUsersDirect.length > 0) {
      console.log('[EmployeesClient] Setting allUsers:', allUsersDirect.length);
      setAllUsers(allUsersDirect);
      setHasMore(false);
    }
  }, [allUsersDirect]);

  const usersPage = allUsersDirect; // For compatibility

  // Build supervisor lookup map from allUsers (more reliable than separate query)
  const supervisorMap = useMemo(() => {
    const map = new Map<string, string>();
    (allUsers || [])
      .filter((u) => u.role === 'supervisor' || u.role === 'admin')
      .forEach((u) => map.set(u._id, u.name));
    return map;
  }, [allUsers]);
  const deleteUser = useMutation(api.users.deleteUser);

  // Load more function
  const loadMore = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!hasMore || isLoadingMore) return;
    const lastUser = allUsers[allUsers.length - 1];
    if (lastUser) {
      setCursor(lastUser._id);
      setIsLoadingMore(true);
    }
  };

  const isAdmin = user?.role === 'admin';
  const isSupervisor = user?.role === 'supervisor';
  const canManage = isAdmin || isSupervisor || isSuperadmin;

  // Check if current user can delete a specific employee
  const canDeleteEmployee = (emp: any) => {
    if (!canManage) {
      console.log(`[canDelete] ${emp.name}: false - not a manager`);
      return false;
    }

    // Cannot delete yourself
    if (emp._id === user?.id) {
      console.log(`[canDelete] ${emp.name}: false - cannot delete self`);
      return false;
    }

    // Superadmin (by role OR email) can delete anyone (except themselves)
    const isSuperadminUser =
      isSuperadmin || user?.email?.toLowerCase() === 'romangulanyan@gmail.com';
    const isSuperadminEmployee =
      emp.role === 'superadmin' || emp.email?.toLowerCase() === 'romangulanyan@gmail.com';

    console.log(`[canDelete] ${emp.name}:`, {
      userIsSuperadmin: isSuperadminUser,
      empIsSuperadmin: isSuperadminEmployee,
      empRole: emp.role,
      empEmail: emp.email,
    });

    if (isSuperadminUser) {
      console.log(`[canDelete] ${emp.name}: true - you are superadmin`);
      return true;
    }

    // Non-superadmin cannot delete superadmin (by role OR email)
    if (isSuperadminEmployee) {
      console.log(`[canDelete] ${emp.name}: false - target is superadmin`);
      return false;
    }

    // Non-superadmin cannot delete other admins
    if (emp.role === 'admin') {
      console.log(`[canDelete] ${emp.name}: false - target is admin`);
      return false;
    }

    // Admin/supervisor can delete employees and supervisors
    console.log(`[canDelete] ${emp.name}: true - can delete employee/supervisor`);
    return true;
  };

  // Check if current user can edit a specific employee
  const canEditEmployee = (emp: any) => {
    if (!canManage) return false;

    // Superadmin (by role OR email) can edit anyone
    const isSuperadminUser =
      isSuperadmin || user?.email?.toLowerCase() === 'romangulanyan@gmail.com';
    if (isSuperadminUser) return true;

    // Non-superadmin cannot edit superadmin (by role OR email)
    const isSuperadminEmployee =
      emp.role === 'superadmin' || emp.email?.toLowerCase() === 'romangulanyan@gmail.com';
    if (isSuperadminEmployee) return false;

    // Admin cannot edit OTHER admins (but can edit themselves)
    if (emp.role === 'admin' && isAdmin && emp._id !== user?.id) return false;

    return true;
  };

  const filtered = useMemo(() => {
    const usersToFilter = allUsers || [];
    if (usersToFilter.length === 0) return [];

    return usersToFilter.filter((u) => {
      // Filter out superadmins
      if (u.role === 'superadmin' || u.email?.toLowerCase() === 'romangulanyan@gmail.com') {
        return false;
      }
      const matchSearch =
        !debouncedSearch ||
        u.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        u.email.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        (u.department ?? '').toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        (u.position ?? '').toLowerCase().includes(debouncedSearch.toLowerCase());
      const matchRole = filterRole === 'all' || u.role === filterRole;
      const matchType = filterType === 'all' || (u as any).employeeType === filterType;
      const matchStatus =
        filterStatus === 'all' ||
        (filterStatus === 'active' && u.isActive) ||
        (filterStatus === 'inactive' && !u.isActive);
      return matchSearch && matchRole && matchType && matchStatus;
    });
  }, [allUsers, debouncedSearch, filterRole, filterType, filterStatus]);

  const stats = useMemo(() => {
    if (!allUsers || allUsers.length === 0)
      return { total: 0, staff: 0, contractors: 0, admins: 0, supervisors: 0 };
    const active = allUsers.filter((u) => u.isActive);
    return {
      total: active.length,
      staff: active.filter((u: any) => (u as any).employeeType === 'staff').length,
      contractors: active.filter((u: any) => (u as any).employeeType === 'contractor').length,
      admins: active.filter((u) => u.role === 'admin').length,
      supervisors: active.filter((u) => u.role === 'supervisor').length,
    };
  }, [allUsers]);

  const handleDelete = async (userId: string) => {
    if (!user?.id) {
      toast.error(t('toasts.userIdNotFound'));
      return;
    }
    try {
      await deleteUser({ adminId: user.id as Id<'users'>, userId: userId as Id<'users'> });
      toast.success(t('employees.deactivated'));
      setDeleteConfirm(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('employees.deactivateFailed'));
    }
  };

  if (!mounted) return null;
  if (allUsers === undefined)
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <ShieldLoader size="lg" />
      </div>
    );

  return (
    <div
      className="space-y-6"
      style={{
        transition: isMobile ? 'none' : 'padding-right 600ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        willChange: isMobile ? 'auto' : 'padding-right',
        paddingRight: isMobile ? '0' : isPanelOpen ? '19rem' : '5rem',
      }}
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-4"
      >
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {t('nav.employees')}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {stats.total} {t('employees.total')} · {stats.staff} {t('employeeTypes.staff')} ·{' '}
            {stats.contractors} {t('employeeTypes.contractors')}
          </p>
        </div>
        {canManage && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white shadow-lg hover:shadow-xl transition-all"
            style={{ background: 'linear-gradient(135deg, #2563eb, #0ea5e9)' }}
          >
            <Plus className="w-5 h-5" /> {t('employees.addEmployee')}
          </motion.button>
        )}
      </motion.div>

      {/* Info Banner for Admins */}
      {canManage && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="p-4 rounded-xl border flex items-start gap-3"
          style={{ background: 'rgba(37,99,235,0.08)', borderColor: 'rgba(37,99,235,0.2)' }}
        >
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-blue-500 bg-blue-500/10">
            <Plus className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm" style={{ color: '#2563eb' }}>
              {t('employees.infoBannerTitle')}
            </h3>
            <p
              className="text-xs mt-1"
              style={{ color: 'var(--text-muted)' }}
              dangerouslySetInnerHTML={{ __html: t('employees.infoBannerDesc') }}
            />
          </div>
        </motion.div>
      )}

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid gap-3"
      >
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: 'var(--text-muted)' }}
          />
          <input
            value={search}
            onChange={(e) => {
              const value = e.target.value;
              setSearch(value); // Мгновенное обновление для input
              handleSearchChange(value); // Debounced для фильтрации
            }}
            placeholder={t('placeholders.searchByName')}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm outline-none"
            style={{
              background: 'var(--card)',
              borderColor: 'var(--border)',
              color: 'var(--text-primary)',
            }}
          />
          {search && (
            <button
              onClick={() => {
                setSearch('');
                setDebouncedSearch('');
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          )}
        </div>
        <div className="flex gap-2 items-center overflow-x-auto sm:overflow-x-visible pb-2 sm:pb-0 scrollbar-hide flex-nowrap sm:flex-wrap">
          {[
            {
              value: filterRole,
              setter: setFilterRole,
              options: ['all', 'admin', 'supervisor', 'employee'],
              label: 'Role',
            },
            {
              value: filterType,
              setter: setFilterType,
              options: ['all', 'staff', 'contractor'],
              label: 'Type',
            },
            ...(canManage
              ? [
                  {
                    value: filterStatus,
                    setter: setFilterStatus,
                    options: ['all', 'active', 'inactive'],
                    label: 'Status',
                  },
                ]
              : []),
          ].map(({ value, setter, options, label }: any) => {
            const getTranslation = (o: string) => {
              if (o === 'all') {
                if (label === 'Role') return t('employees.allRoles', { defaultValue: 'All Roles' });
                if (label === 'Type') return t('employees.allTypes', { defaultValue: 'All Types' });
                if (label === 'Status')
                  return t('employees.allStatuses', { defaultValue: 'All Statuses' });
              }
              return t(`employees.filter_${o}`, { defaultValue: o });
            };
            return (
              <select
                key={label}
                value={value}
                onChange={(e) => setter(e.target.value)}
                className="px-3 py-2 rounded-xl border text-sm outline-none capitalize flex-shrink-0"
                style={{
                  background: 'var(--card)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-primary)',
                }}
              >
                {options.map((o: any) => (
                  <option key={o} value={o} className="capitalize">
                    {getTranslation(o)}
                  </option>
                ))}
              </select>
            );
          })}
          {/* View toggle */}
          <div className="flex rounded-xl flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2.5 transition-colors ${viewMode === 'grid' ? 'text-white rounded-lg' : ''} rounded-lg`}
              style={{
                background:
                  viewMode === 'grid' ? 'linear-gradient(135deg,#2563eb,#0ea5e9)' : 'var(--card)',
                color: viewMode === 'grid' ? 'white' : 'var(--text-muted)',
              }}
              title={t('ariaLabels.gridView')}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className="p-2.5 transition-colors rounded-lg"
              style={{
                background:
                  viewMode === 'list' ? 'linear-gradient(135deg,#2563eb,#0ea5e9)' : 'var(--card)',
                color: viewMode === 'list' ? 'white' : 'var(--text-muted)',
              }}
              title={t('ariaLabels.listView')}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Presence badge helper */}
      {(() => {
        const getPresenceBadge = (status: string | undefined) => {
          const cfg: Record<string, { labelKey: string; cls: string }> = {
            available: { labelKey: 'presence.available', cls: 'bg-emerald-100 text-emerald-700' },
            in_meeting: { labelKey: 'presence.inMeeting', cls: 'bg-amber-100 text-amber-700' },
            in_call: { labelKey: 'presence.inCall', cls: 'bg-blue-100 text-blue-700' },
            out_of_office: { labelKey: 'presence.outOfOffice', cls: 'bg-rose-100 text-rose-700' },
            busy: { labelKey: 'presence.busy', cls: 'bg-orange-100 text-orange-700' },
          };
          return cfg[status ?? 'available'] ?? cfg['available'];
        };

        const renderMenu = (emp: any) =>
          canManage ? (
            <div className="relative flex-shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenMenuId(openMenuId === emp._id ? null : emp._id);
                }}
                className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                style={{ color: 'var(--text-muted)', background: 'var(--background-subtle)' }}
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              <AnimatePresence>
                {openMenuId === emp._id && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="absolute right-0 top-8 w-40 rounded-xl border shadow-xl z-20 overflow-hidden"
                    style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/employees/${emp._id}`);
                        setOpenMenuId(null);
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:opacity-80"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      <Eye className="w-3.5 h-3.5" /> {t('common.viewProfile')}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditEmployee(emp as any);
                        setOpenMenuId(null);
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:opacity-80"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      <Edit2 className="w-3.5 h-3.5" /> {t('common.edit')}
                    </button>
                    {isAdmin && emp.role !== 'admin' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirm(emp._id);
                          setOpenMenuId(null);
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:opacity-80"
                        style={{ color: '#ef4444' }}
                      >
                        <Trash2 className="w-3.5 h-3.5" /> {t('employees.deactivate')}
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : null;

        return (
          <>
            {/* GRID VIEW */}
            {viewMode === 'grid' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                <AnimatePresence>
                  {filtered.map((emp: any, i: any) => {
                    const roleConf = ROLE_CONFIG[emp.role as keyof typeof ROLE_CONFIG];
                    const typeConf =
                      TYPE_CONFIG[(emp as any).employeeType as keyof typeof TYPE_CONFIG] ||
                      TYPE_CONFIG.staff;
                    const RoleIcon = roleConf.icon;
                    const presenceStatus = (emp as any).presenceStatus;
                    const presence = presenceStatus ? getPresenceBadge(presenceStatus) : null;
                    return (
                      <motion.div
                        key={emp._id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ delay: i * 0.03 }}
                        onClick={() => router.push(`/employees/${emp._id}`)}
                        className="relative p-5 rounded-2xl border group cursor-pointer hover:shadow-lg transition-shadow"
                        style={{
                          background: 'var(--card)',
                          borderColor: emp.isActive ? 'var(--border)' : 'rgba(239,68,68,0.2)',
                          opacity: emp.isActive ? 1 : 0.6,
                        }}
                      >
                        <div className="flex items-start gap-3 mb-4">
                          <AvatarUpload
                            userId={emp._id}
                            currentUrl={emp.avatarUrl}
                            name={emp.name}
                            size="md"
                            readonly={!canManage && emp._id !== user?.id}
                          />
                          <div className="min-w-0 flex-1">
                            <h3
                              className="font-semibold truncate cursor-pointer hover:text-blue-500 transition-colors"
                              style={{ color: 'var(--text-primary)' }}
                            >
                              {emp.name}
                            </h3>
                            <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                              {emp.position ?? t('employees.noPosition')}
                            </p>
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium mt-1"
                              style={{ background: roleConf.bg, color: roleConf.color }}
                            >
                              <RoleIcon className="w-2.5 h-2.5" />
                              {t(roleConf.labelKey)}
                            </span>
                          </div>
                        </div>
                        <div className="space-y-1.5 text-xs">
                          <div
                            className="flex items-center gap-2"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            <Mail className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{emp.email}</span>
                          </div>
                          {(emp as any).phone && (
                            <div
                              className="flex items-center gap-2"
                              style={{ color: 'var(--text-muted)' }}
                            >
                              <Phone className="w-3 h-3" />
                              {(emp as any).phone}
                            </div>
                          )}
                          {emp.department && (
                            <div
                              className="flex items-center gap-2"
                              style={{ color: 'var(--text-muted)' }}
                            >
                              <Building2 className="w-3 h-3" />
                              {emp.department}
                            </div>
                          )}
                          {(emp as any).supervisorId && (
                            <div className="flex items-center gap-2">
                              <UserCog className="w-3 h-3 flex-shrink-0 text-blue-400" />
                              <span className="truncate text-blue-500 font-medium">
                                {supervisorMap.get((emp as any).supervisorId) ??
                                  t('employees.noSupervisor')}
                              </span>
                            </div>
                          )}
                        </div>
                        <div
                          className="flex items-center justify-between mt-4 pt-3 border-t"
                          style={{ borderColor: 'var(--border)' }}
                        >
                          <div className="flex gap-2">
                            <span
                              className="text-xs px-2 py-0.5 rounded-full font-medium"
                              style={{ background: typeConf.bg, color: typeConf.color }}
                            >
                              {t(typeConf.labelKey)}
                            </span>
                            {(emp as any).supervisorId && (
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-500/10 text-blue-500">
                                {supervisorMap.get((emp as any).supervisorId) ??
                                  t('employees.noSupervisor')}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            {isAdmin ? (
                              <span
                                className="text-xs font-semibold"
                                style={{ color: 'var(--text-muted)' }}
                              >
                                {(emp as any).travelAllowance?.toLocaleString() ?? '0'}{' '}
                                {t('currency.amd')}
                              </span>
                            ) : (
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                  emp.isActive
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-red-100 text-red-700'
                                }`}
                              >
                                {emp.isActive
                                  ? t('common.active', { defaultValue: 'Активен' })
                                  : t('common.inactive', { defaultValue: 'Неактивен' })}
                              </span>
                            )}
                          </div>
                        </div>
                        {!emp.isActive && (
                          <div
                            className="absolute inset-0 rounded-2xl flex items-center justify-center"
                            style={{ background: 'rgba(0,0,0,0.05)' }}
                          >
                            <span
                              className="text-xs font-bold px-3 py-1 rounded-full"
                              style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}
                            >
                              {t('employees.deactivatedBadge')}
                            </span>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
                {filtered.length === 0 && (
                  <div className="col-span-full flex flex-col items-center justify-center py-20 gap-3">
                    <Users
                      className="w-12 h-12 opacity-20"
                      style={{ color: 'var(--text-muted)' }}
                    />
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      {t('employees.noFound')}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Load More Button */}
            {hasMore && filtered.length > 0 && (
              <div className="flex justify-center mt-6">
                <button
                  onClick={loadMore}
                  disabled={isLoadingMore}
                  className="px-6 py-3 rounded-xl border text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: 'var(--card)',
                    borderColor: 'var(--border)',
                    color: 'var(--text-primary)',
                  }}
                >
                  {isLoadingMore ? <ShieldLoader /> : t('common.loadMore')}
                </button>
              </div>
            )}

            {/* LIST VIEW */}
            {viewMode === 'list' && (
              <div
                className="rounded-2xl border overflow-hidden"
                style={{ borderColor: 'var(--border)' }}
              >
                {/* Table header */}
                <div
                  className="hidden sm:grid grid-cols-12 gap-4 px-5 py-3 text-xs font-semibold uppercase tracking-wide"
                  style={{ background: 'var(--background-subtle)', color: 'var(--text-muted)' }}
                >
                  <div className="col-span-4">{t('dashboard.employee')}</div>
                  <div className="col-span-2">{t('employeeInfo.department')}</div>
                  <div className="col-span-2">{t('roles.supervisor')}</div>
                  <div className="col-span-2">{t('dashboard.status')}</div>
                  <div className="col-span-2" style={{ textAlign: 'center' }}>
                    {t('dashboard.type')}
                  </div>
                </div>
                <AnimatePresence>
                  {filtered.map((emp: any, i: any) => {
                    const roleConf = ROLE_CONFIG[emp.role as keyof typeof ROLE_CONFIG];
                    const typeConf =
                      TYPE_CONFIG[(emp as any).employeeType as keyof typeof TYPE_CONFIG] ||
                      TYPE_CONFIG.staff;
                    const RoleIcon = roleConf.icon;
                    const presenceStatus = (emp as any).presenceStatus;
                    const presence = presenceStatus ? getPresenceBadge(presenceStatus) : null;
                    return (
                      <motion.div
                        key={emp._id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ delay: i * 0.02 }}
                        onClick={() => router.push(`/employees/${emp._id}`)}
                        className="flex flex-col gap-3 p-4 sm:grid sm:grid-cols-12 sm:gap-4 sm:px-5 sm:py-3.5 sm:items-center group cursor-pointer border-t transition-colors hover:bg-[var(--background-subtle)] relative"
                        style={{ borderColor: 'var(--border)', opacity: emp.isActive ? 1 : 0.5 }}
                      >
                        {/* Employee name + avatar */}
                        <div className="sm:col-span-4 flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-gradient-to-br from-blue-500 to-sky-500 flex items-center justify-center text-white text-xs font-bold">
                            {emp.avatarUrl ? (
                              <img
                                src={emp.avatarUrl}
                                alt={emp.name}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              emp.name
                                .split(' ')
                                .map((n: any) => n[0])
                                .join('')
                                .toUpperCase()
                                .slice(0, 2)
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p
                              className="font-semibold text-sm truncate"
                              style={{ color: 'var(--text-primary)' }}
                            >
                              {emp.name}
                            </p>
                            <div className="flex items-center gap-1.5">
                              <span
                                className="inline-flex items-center gap-0.5 text-xs font-medium"
                                style={{ color: roleConf.color }}
                              >
                                <RoleIcon className="w-2.5 h-2.5" />
                                {emp.position ?? t(roleConf.labelKey)}
                              </span>
                            </div>
                          </div>
                          {/* Mobile-only action chevron */}
                          <ChevronRight
                            className="w-4 h-4 sm:hidden flex-shrink-0"
                            style={{ color: 'var(--text-muted)' }}
                          />
                        </div>

                        {/* Mobile info row */}
                        <div className="flex flex-wrap items-center gap-2 sm:hidden">
                          {emp.department && (
                            <span
                              className="text-xs px-2 py-0.5 rounded-full"
                              style={{
                                background: 'var(--background-subtle)',
                                color: 'var(--text-muted)',
                              }}
                            >
                              <Building2 className="w-3 h-3 inline mr-1" />
                              {emp.department}
                            </span>
                          )}
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              emp.isActive
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {emp.isActive
                              ? t('common.active', { defaultValue: 'Активен' })
                              : t('common.inactive', { defaultValue: 'Неактивен' })}
                          </span>
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ background: typeConf.bg, color: typeConf.color }}
                          >
                            {t(typeConf.labelKey)}
                          </span>
                        </div>

                        {/* Department - desktop only */}
                        <div
                          className="hidden sm:block sm:col-span-2 text-sm truncate"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {emp.department ?? t('common.none')}
                        </div>

                        {/* Supervisor - desktop only */}
                        <div className="hidden sm:block sm:col-span-2 text-sm truncate text-blue-500 font-medium">
                          {(emp as any).supervisorId
                            ? (supervisorMap.get((emp as any).supervisorId) ?? t('common.none'))
                            : t('common.none')}
                        </div>

                        {/* Account status - desktop only */}
                        <div className="hidden sm:block sm:col-span-2">
                          <span
                            className={`text-xs px-2 py-1 rounded-full font-medium ${
                              emp.isActive
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {emp.isActive
                              ? t('common.active', { defaultValue: 'Активен' })
                              : t('common.inactive', { defaultValue: 'Неактивен' })}
                          </span>
                        </div>

                        {/* Type - desktop only */}
                        <div
                          className="hidden sm:block sm:col-span-2"
                          style={{ textAlign: 'center' }}
                        >
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ background: typeConf.bg, color: typeConf.color }}
                          >
                            {t(typeConf.labelKey)}
                          </span>
                        </div>

                        {/* Actions — view only on hover */}
                        <div
                          className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 items-center gap-1 px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-md border"
                          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/employees/${emp._id}`);
                            }}
                            className="p-1.5 rounded-md text-blue-500 hover:bg-blue-500/20 transition-colors"
                            title={t('common.view')}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
                {filtered.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <Users
                      className="w-12 h-12 opacity-20"
                      style={{ color: 'var(--text-muted)' }}
                    />
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      {t('employees.noFound')}
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        );
      })()}

      {/* Modals */}
      <AddEmployeeModal open={showAddModal} onClose={() => setShowAddModal(false)} />

      {editEmployee && (
        <EditEmployeeModal
          employee={editEmployee as any}
          open={!!editEmployee}
          onClose={() => setEditEmployee(null)}
        />
      )}

      {/* Delete confirm */}
      <AnimatePresence>
        {deleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirm(null)}
              className="absolute inset-0"
              style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative p-6 rounded-2xl border shadow-2xl max-w-sm w-full text-center"
              style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: 'rgba(239,68,68,0.1)' }}
              >
                <AlertTriangle className="w-7 h-7" style={{ color: '#ef4444' }} />
              </div>
              <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                {t('employees.deactivateTitle')}
              </h3>
              <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
                {t('employees.deactivateDesc')}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-2 rounded-xl text-sm font-medium border"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  className="flex-1 py-2 rounded-xl text-sm font-semibold text-white"
                  style={{ background: '#ef4444' }}
                >
                  {t('employees.deactivate')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Close menu on outside click */}
      {openMenuId && <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />}

      {/* Team Sidebar - Compact collapsible panel */}
      <TeamSidebar userId={user?.id as Id<'users'>} onToggle={setIsPanelOpen} />
    </div>
  );
}

export default EmployeesClient;
