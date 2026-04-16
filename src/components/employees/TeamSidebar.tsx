'use client';

import { useQuery } from 'convex/react';
import { useTranslation } from 'react-i18next';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { motion, AnimatePresence } from '@/lib/cssMotion';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import {
  Users,
  UserCheck,
  UserX,
  Briefcase,
  Calendar,
  Award,
  TrendingUp,
  Clock,
  Star,
  Zap,
  ChevronDown,
  ChevronUp,
  X,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useState, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

interface TeamSidebarProps {
  userId?: Id<'users'>;
  onToggle?: (isOpen: boolean) => void;
}

interface CollapsibleSectionProps {
  title: React.ReactNode;
  isCollapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  defaultIcon?: React.ReactNode;
}

function CollapsibleSection({
  title,
  isCollapsed,
  onToggle,
  children,
  defaultIcon,
}: CollapsibleSectionProps) {
  return (
    <Card className="border-0 shadow-lg bg-gradient-to-br from-[var(--card)] to-[var(--background-subtle)] overflow-hidden px-3 sm:px-0">
      <CardHeader className="pb-0 cursor-pointer" onClick={onToggle}>
        <CardTitle className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider flex items-center justify-between gap-2 py-3">
          <div className="flex items-center gap-2">{title}</div>
          <motion.div
            animate={{ rotate: isCollapsed ? 0 : 180 }}
            transition={{
              duration: 0.4,
              ease: [0.34, 1.56, 0.64, 1],
            }}
          >
            <ChevronUp className="w-4 h-4" />
          </motion.div>
        </CardTitle>
      </CardHeader>
      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              duration: 0.4,
              ease: [0.34, 1.56, 0.64, 1],
            }}
          >
            <CardContent className="space-y-3 pt-3">{children}</CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

/**
 * BizierEasingCard — карточка с анимацией
 * На десктопе: карточки с scale и bezier easing анимацией
 * На мобильных: только простая fade анимация без движения
 */
function BizierEasingCard({
  children,
  index = 0,
  isExpanded,
  className = '',
  isMobile = false,
}: {
  children: React.ReactNode;
  index?: number;
  isExpanded: boolean;
  className?: string;
  isMobile?: boolean;
}) {
  const bizier = [0.34, 1.56, 0.64, 1];

  // На мобильных только fade, без scale
  const initial = isMobile ? { opacity: 0 } : { opacity: 0, scale: 0.9 };
  const animate = isExpanded
    ? { opacity: 1, ...(isMobile ? {} : { scale: 1 }) }
    : { opacity: 0, ...(isMobile ? {} : { scale: 0.9 }) };
  const transition = {
    delay: index * 0.06,
    duration: isMobile ? 0.25 : 0.5,
    ease: isMobile ? 'easeInOut' : bizier,
  };

  return (
    <motion.div className={className} initial={initial} animate={animate} transition={transition}>
      {children}
    </motion.div>
  );
}

export function TeamSidebar({ userId, onToggle }: TeamSidebarProps) {
  const { t } = useTranslation();
  const isMobile = useMediaQuery('(max-width: 640px)');
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(true); // Закрыт по умолчанию
  const [collapsedSections, setCollapsedSections] = useState({
    overview: true, // Свернут по умолчанию
    recent: true,
    quickStats: true,
  });

  // Блокировка скролла страницы при открытии панели на мобильных
  useLayoutEffect(() => {
    if (isMobile && !isPanelCollapsed) {
      const scrollY = window.scrollY;
      document.documentElement.style.overflow = 'hidden';
      document.documentElement.style.height = '100vh';
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.height = '100vh';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      sessionStorage.setItem('scrollY', scrollY.toString());
    } else {
      const scrollY = sessionStorage.getItem('scrollY');
      document.documentElement.style.overflow = '';
      document.documentElement.style.height = '';
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY));
        sessionStorage.removeItem('scrollY');
      }
    }

    return () => {
      document.documentElement.style.overflow = '';
      document.documentElement.style.height = '';
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
    };
  }, [isMobile, isPanelCollapsed]);

  const toggleSection = (section: keyof typeof collapsedSections) => {
    setCollapsedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  // Get all users for stats
  const allUsers = useQuery(
    api.users.queries.getAllUsers,
    userId ? { requesterId: userId } : 'skip',
  );

  // Calculate stats
  const stats = allUsers?.reduce(
    (acc, user) => {
      // Skip superadmins from all counts
      if (user.role === 'superadmin') {
        return acc;
      }

      if (!user.isActive) {
        acc.inactive++;
        return acc;
      }

      acc.total++;
      if (user.role === 'admin') acc.admins++;
      else if (user.role === 'supervisor') acc.supervisors++;
      else if (user.role === 'employee') acc.employees++;
      else if (user.role === 'driver') acc.drivers++;

      if ((user as any).employeeType === 'contractor') acc.contractors++;
      else acc.staff++;

      return acc;
    },
    {
      total: 0,
      admins: 0,
      supervisors: 0,
      employees: 0,
      drivers: 0,
      contractors: 0,
      staff: 0,
      inactive: 0,
    },
  ) || {
    total: 0,
    admins: 0,
    supervisors: 0,
    employees: 0,
    drivers: 0,
    contractors: 0,
    staff: 0,
    inactive: 0,
  };

  // Recent employees (by createdAt)
  const recentEmployees =
    allUsers
      ?.filter((u: any) => u.isActive)
      .sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, 5) || [];

  const overviewTitle = (
    <span className="flex items-center gap-2">
      <Users className="w-4 h-4" />
      {t('employees.teamOverview')}
    </span>
  );

  const recentTitle = (
    <span className="flex items-center gap-2">
      <TrendingUp className="w-4 h-4" />
      {t('employees.newMembers')}
    </span>
  );

  const quickStatsTitle = (
    <span className="flex items-center gap-2">
      <Award className="w-4 h-4" />
      {t('dashboard.quickStats')}
    </span>
  );

  return createPortal(
    <>
      {/* Кнопка сворачивания/разворачивания панели */}
      <motion.button
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        transition={{ duration: 0.2 }}
        onClick={() => {
          const newCollapsedState = !isPanelCollapsed;
          setIsPanelCollapsed(newCollapsedState);
          onToggle?.(!newCollapsedState);
        }}
        className="fixed top-34 sm:top-25 right-3 sm:right-6 z-[100] w-10 h-10 sm:w-9 sm:h-9 rounded-full shadow-lg flex items-center justify-center transition-colors"
        style={{
          background: 'var(--primary)',
          color: 'var(--primary-foreground)',
          boxShadow: '0 4px 20px rgba(37, 99, 235, 0.5)',
        }}
      >
        {isPanelCollapsed ? (
          <PanelRightOpen className="w-4 h-4 sm:w-5 sm:h-5" />
        ) : (
          <PanelRightClose className="w-4 h-4 sm:w-5 sm:h-5" />
        )}
      </motion.button>

      {/* Backdrop для мобильных - закрывает по клику */}
      <AnimatePresence>
        {!isPanelCollapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => {
              setIsPanelCollapsed(true);
              onToggle?.(false);
            }}
            className="fixed inset-0 bg-black/60 z-[60] lg:hidden"
            style={{ backdropFilter: 'blur(8px)' }}
          />
        )}
      </AnimatePresence>

      {/* Боковая панель */}
      <AnimatePresence>
        {!isPanelCollapsed && (
          <motion.aside
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            transition={{
              duration: isMobile ? 0.3 : 0.4,
              ease: isMobile ? 'easeInOut' : [0.34, 1.56, 0.64, 1],
            }}
            className="fixed top-16 sm:top-24 right-0 sm:right-6 z-[70] w-full sm:w-64 max-h-[calc(100vh-80px)] sm:max-h-[calc(100vh-180px)] overflow-y-auto space-y-3 sm:space-y-4 scrollbar-thin scrollbar-thumb-[var(--muted-foreground)] scrollbar-track-transparent lg:shadow-lg rounded-xl"
            style={{
              background: 'var(--card)',
              boxShadow: isMobile
                ? '0 -10px 40px rgba(0, 0, 0, 0.3)'
                : '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            }}
          >
            {/* Кнопка закрытия для мобильных */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-3 py-3 sm:p-0 sm:hidden border-b border-[var(--border)] bg-[var(--card)]">
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {t('employees.teamOverview')}
              </span>
              <button
                onClick={() => {
                  setIsPanelCollapsed(true);
                  onToggle?.(false);
                }}
                className="p-2 rounded-lg hover:bg-[var(--background-subtle)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="sm:p-0">
              {/* Team Overview */}
              <CollapsibleSection
                title={overviewTitle}
                isCollapsed={collapsedSections.overview}
                onToggle={() => toggleSection('overview')}
                defaultIcon={<Users className="w-4 h-4" />}
              >
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <BizierEasingCard
                    index={0}
                    isExpanded={!collapsedSections.overview}
                    isMobile={isMobile}
                    className="p-2 sm:p-3 rounded-xl bg-blue-500/10 border border-blue-500/20"
                  >
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                      <UserCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-500" />
                      <span className="text-[10px] sm:text-xs text-blue-600 font-medium">
                        {t('employees.active')}
                      </span>
                    </div>
                    <p className="text-xl sm:text-2xl font-bold text-blue-600">{stats.total}</p>
                  </BizierEasingCard>
                  <BizierEasingCard
                    index={1}
                    isExpanded={!collapsedSections.overview}
                    isMobile={isMobile}
                    className="p-2 sm:p-3 rounded-xl bg-gray-500/10 border border-gray-500/20"
                  >
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                      <UserX className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-500" />
                      <span className="text-[10px] sm:text-xs text-gray-600 font-medium">
                        {t('employees.inactive')}
                      </span>
                    </div>
                    <p className="text-xl sm:text-2xl font-bold text-gray-600">{stats.inactive}</p>
                  </BizierEasingCard>
                </div>

                <div className="space-y-1.5 sm:space-y-2 pt-2 border-t border-[var(--border)]">
                  <BizierEasingCard
                    index={2}
                    isExpanded={!collapsedSections.overview}
                    isMobile={isMobile}
                    className="flex items-center justify-between text-[10px] sm:text-xs"
                  >
                    <span className="text-[var(--text-muted)] flex items-center gap-1 sm:gap-1.5">
                      <Award className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> {t('roles.admin')}
                    </span>
                    <Badge
                      variant="secondary"
                      className="bg-purple-500/20 text-purple-600 border-purple-500/30 text-[10px] sm:text-xs"
                    >
                      {stats.admins}
                    </Badge>
                  </BizierEasingCard>
                  <BizierEasingCard
                    index={3}
                    isExpanded={!collapsedSections.overview}
                    isMobile={isMobile}
                    className="flex items-center justify-between text-[10px] sm:text-xs"
                  >
                    <span className="text-[var(--text-muted)] flex items-center gap-1 sm:gap-1.5">
                      <Star className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> {t('roles.supervisor')}
                    </span>
                    <Badge
                      variant="secondary"
                      className="bg-amber-500/20 text-amber-600 border-amber-500/30 text-[10px] sm:text-xs"
                    >
                      {stats.supervisors}
                    </Badge>
                  </BizierEasingCard>
                  <BizierEasingCard
                    index={4}
                    isExpanded={!collapsedSections.overview}
                    isMobile={isMobile}
                    className="flex items-center justify-between text-[10px] sm:text-xs"
                  >
                    <span className="text-[var(--text-muted)] flex items-center gap-1 sm:gap-1.5">
                      <UserCheck className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> {t('roles.employee')}
                    </span>
                    <Badge
                      variant="secondary"
                      className="bg-green-500/20 text-green-600 border-green-500/30 text-[10px] sm:text-xs"
                    >
                      {stats.employees}
                    </Badge>
                  </BizierEasingCard>
                  {stats.drivers > 0 && (
                    <BizierEasingCard
                      index={5}
                      isExpanded={!collapsedSections.overview}
                      isMobile={isMobile}
                      className="flex items-center justify-between text-[10px] sm:text-xs"
                    >
                      <span className="text-[var(--text-muted)] flex items-center gap-1 sm:gap-1.5">
                        <Zap className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> {t('roles.driver')}
                      </span>
                      <Badge
                        variant="secondary"
                        className="bg-cyan-500/20 text-cyan-600 border-cyan-500/30 text-[10px] sm:text-xs"
                      >
                        {stats.drivers}
                      </Badge>
                    </BizierEasingCard>
                  )}
                </div>

                <div className="pt-2 border-t border-[var(--border)]">
                  <BizierEasingCard
                    index={6}
                    isExpanded={!collapsedSections.overview}
                    isMobile={isMobile}
                    className="flex items-center justify-between text-[10px] sm:text-xs"
                  >
                    <span className="text-[var(--text-muted)] flex items-center gap-1 sm:gap-1.5">
                      <Briefcase className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> {t('employeeTypes.staff')}
                    </span>
                    <span className="font-semibold text-[var(--text-primary)]">{stats.staff}</span>
                  </BizierEasingCard>
                  <BizierEasingCard
                    index={7}
                    isExpanded={!collapsedSections.overview}
                    isMobile={isMobile}
                    className="flex items-center justify-between text-[10px] sm:text-xs mt-1 sm:mt-1.5"
                  >
                    <span className="text-[var(--text-muted)] flex items-center gap-1 sm:gap-1.5">
                      <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />{' '}
                      {t('employeeTypes.contractor')}
                    </span>
                    <span className="font-semibold text-[var(--text-primary)]">
                      {stats.contractors}
                    </span>
                  </BizierEasingCard>
                </div>
              </CollapsibleSection>

              {/* Recent Members */}
              {recentEmployees.length > 0 && (
                <CollapsibleSection
                  title={recentTitle}
                  isCollapsed={collapsedSections.recent}
                  onToggle={() => toggleSection('recent')}
                  defaultIcon={<TrendingUp className="w-4 h-4" />}
                >
                  <div className="space-y-1.5 sm:space-y-2">
                    {recentEmployees.map((emp: any, index) => (
                      <motion.div
                        key={emp._id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                          delay: index * 0.05,
                          duration: 0.4,
                          ease: [0.34, 1.56, 0.64, 1],
                        }}
                        className="flex items-center gap-2 p-2 rounded-lg hover:bg-[var(--background-subtle)] transition-colors"
                      >
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center font-bold text-white text-[10px] sm:text-xs bg-gradient-to-br from-blue-500 to-sky-500">
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
                              .map((n: any[]) => n[0])
                              .join('')
                              .toUpperCase()
                              .slice(0, 2)
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] sm:text-xs font-medium text-[var(--text-primary)] truncate">
                            {emp.name}
                          </p>
                          <p className="text-[9px] sm:text-[10px] text-[var(--text-muted)]">
                            {emp.position || t('common.noPosition')}
                          </p>
                        </div>
                        <Badge
                          variant="secondary"
                          className="text-[9px] sm:text-[10px] bg-green-500/20 text-green-600 border-green-500/30"
                        >
                          New
                        </Badge>
                      </motion.div>
                    ))}
                  </div>
                </CollapsibleSection>
              )}

              {/* Quick Stats */}
              <CollapsibleSection
                title={quickStatsTitle}
                isCollapsed={collapsedSections.quickStats}
                onToggle={() => toggleSection('quickStats')}
                defaultIcon={<Award className="w-4 h-4" />}
              >
                <div className="space-y-2 sm:space-y-3">
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05, duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
                    className="flex items-center justify-between"
                  >
                    <span className="text-[10px] sm:text-xs text-[var(--success)]">
                      {t('employees.supervisors')}
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-[var(--success)]">
                      {stats.supervisors}
                    </span>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1, duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
                    className="flex items-center justify-between"
                  >
                    <span className="text-[10px] sm:text-xs text-[var(--success)]">
                      {t('employees.contractors')}
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-[var(--success)]">
                      {stats.contractors}
                    </span>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15, duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
                    className="pt-2 border-t border-[var(--border)]"
                  >
                    <p className="text-[9px] sm:text-[10px] text-[var(--text-muted)] text-center">
                      💡 {t('employees.teamHealthGood')}
                    </p>
                  </motion.div>
                </div>
              </CollapsibleSection>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>,
    document.body,
  );
}
