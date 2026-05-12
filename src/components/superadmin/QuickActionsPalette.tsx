'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { useTranslation } from 'react-i18next';
import {
  Search,
  Users,
  Ticket,
  CheckCircle,
  AlertTriangle,
  Wrench,
  MessageSquare,
  User,
  FileText,
  Shield,
  Zap,
  X,
  Command,
  ArrowRight,
  HelpCircleIcon,
  LayoutDashboard,
  CheckSquare,
  Calendar,
  BarChart3,
  Target,
  TrendingUp,
  DollarSign,
  Clock,
  Settings,
  ClipboardList,
  GraduationCap,
  Briefcase,
  Activity,
  Database,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  shortcut: string;
  category: 'action' | 'navigation' | 'user';
  action: () => void;
  requiresSelection?: boolean;
  superadminOnly?: boolean;
  adminOnly?: boolean;
  supervisorOnly?: boolean;
}

export function QuickActionsPalette() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Check if user is superadmin
  const isSuperadmin = user?.role === 'superadmin';

  // Check if user is admin or supervisor
  const isAdmin = user?.role === 'admin';
  const isSupervisor = user?.role === 'supervisor';

  // Quick actions list - filtered by role
  const allActions: QuickAction[] = [
    // Common navigation - available to all users
    {
      id: 'dashboard',
      label: t('nav.dashboard', 'Dashboard'),
      icon: <LayoutDashboard className="w-4 h-4" />,
      shortcut: '⌘D',
      category: 'navigation',
      action: () => {
        setIsOpen(false);
        router.push('/dashboard');
      },
    },
    {
      id: 'tasks',
      label: t('nav.tasks', 'Tasks'),
      icon: <CheckSquare className="w-4 h-4" />,
      shortcut: '⌘T',
      category: 'navigation',
      action: () => {
        setIsOpen(false);
        router.push('/tasks');
      },
    },
    {
      id: 'leaves',
      label: t('nav.leaves', 'Leave'),
      icon: <Clock className="w-4 h-4" />,
      shortcut: '⌘L',
      category: 'navigation',
      action: () => {
        setIsOpen(false);
        router.push('/leaves');
      },
    },
    {
      id: 'calendar',
      label: t('nav.calendar', 'Calendar'),
      icon: <Calendar className="w-4 h-4" />,
      shortcut: '⌘C',
      category: 'navigation',
      action: () => {
        setIsOpen(false);
        router.push('/calendar');
      },
    },
    {
      id: 'chat',
      label: t('nav.chat', 'Chat'),
      icon: <MessageSquare className="w-4 h-4" />,
      shortcut: '⌘⇧C',
      category: 'navigation',
      action: () => {
        setIsOpen(false);
        router.push('/chat');
      },
    },
    // Admin/Supervisor only navigation
    {
      id: 'employees',
      label: t('nav.employees', 'Employees'),
      icon: <Users className="w-4 h-4" />,
      shortcut: '⌘E',
      category: 'navigation',
      action: () => {
        setIsOpen(false);
        router.push('/employees');
      },
      supervisorOnly: true,
    },
    {
      id: 'attendance',
      label: t('nav.attendance', 'Attendance'),
      icon: <Activity className="w-4 h-4" />,
      shortcut: '⌘A',
      category: 'navigation',
      action: () => {
        setIsOpen(false);
        router.push('/attendance');
      },
      supervisorOnly: true,
    },
    {
      id: 'goals',
      label: t('nav.goals', 'Goals'),
      icon: <Target className="w-4 h-4" />,
      shortcut: '⌘G',
      category: 'navigation',
      action: () => {
        setIsOpen(false);
        router.push('/goals');
      },
      supervisorOnly: true,
    },
    {
      id: 'performance',
      label: t('nav.performance', 'Performance'),
      icon: <TrendingUp className="w-4 h-4" />,
      shortcut: '⌘P',
      category: 'navigation',
      action: () => {
        setIsOpen(false);
        router.push('/performance');
      },
      supervisorOnly: true,
    },
    {
      id: 'payroll',
      label: t('nav.payroll', 'Payroll'),
      icon: <DollarSign className="w-4 h-4" />,
      shortcut: '⌘⇧P',
      category: 'navigation',
      action: () => {
        setIsOpen(false);
        router.push('/payroll');
      },
      adminOnly: true,
    },
    {
      id: 'analytics',
      label: t('nav.analytics', 'Analytics'),
      icon: <BarChart3 className="w-4 h-4" />,
      shortcut: '⌘⇧A',
      category: 'navigation',
      action: () => {
        setIsOpen(false);
        router.push('/analytics');
      },
      adminOnly: true,
    },
    {
      id: 'recruitment',
      label: t('nav.recruitment', 'Recruitment'),
      icon: <Briefcase className="w-4 h-4" />,
      shortcut: '⌘R',
      category: 'navigation',
      action: () => {
        setIsOpen(false);
        router.push('/recruitment');
      },
      adminOnly: true,
    },
    {
      id: 'surveys',
      label: t('nav.surveys', 'Surveys'),
      icon: <ClipboardList className="w-4 h-4" />,
      shortcut: '⌘S',
      category: 'navigation',
      action: () => {
        setIsOpen(false);
        router.push('/surveys');
      },
      adminOnly: true,
    },
    {
      id: 'onboarding',
      label: t('nav.onboarding', 'Onboarding'),
      icon: <GraduationCap className="w-4 h-4" />,
      shortcut: '⌘O',
      category: 'navigation',
      action: () => {
        setIsOpen(false);
        router.push('/onboarding');
      },
      adminOnly: true,
    },
    {
      id: 'reports',
      label: t('nav.reports', 'Reports'),
      icon: <FileText className="w-4 h-4" />,
      shortcut: '⌘⇧R',
      category: 'navigation',
      action: () => {
        setIsOpen(false);
        router.push('/reports');
      },
      supervisorOnly: true,
    },
    {
      id: 'settings',
      label: t('nav.settings', 'Settings'),
      icon: <Settings className="w-4 h-4" />,
      shortcut: '⌘,',
      category: 'navigation',
      action: () => {
        setIsOpen(false);
        router.push('/settings');
      },
    },
    {
      id: 'find-user',
      label: t('superadmin.quickActions.findUser'),
      icon: <Search className="w-4 h-4" />,
      shortcut: '⌘F',
      category: 'action',
      action: () => {
        setIsOpen(false);
        // Focus global search if on superadmin page
        document.querySelector<HTMLInputElement>('#global-search-input')?.focus();
      },
    },
    {
      id: 'create-ticket',
      label: t('superadmin.quickActions.createTicket'),
      icon: <Ticket className="w-4 h-4" />,
      shortcut: '⌘N',
      category: 'action',
      action: () => {
        setIsOpen(false);
        router.push('/help?new=true');
      },
    },
    // Superadmin-only actions
    {
      id: 'bulk-approve',
      label: t('superadmin.quickActions.bulkApprove'),
      icon: <CheckCircle className="w-4 h-4" />,
      shortcut: '⌘A',
      category: 'action',
      action: () => {
        setIsOpen(false);
        router.push('/superadmin/bulk-actions');
      },
      superadminOnly: true,
    },
    {
      id: 'emergency',
      label: t('superadmin.quickActions.emergencyMode'),
      icon: <AlertTriangle className="w-4 h-4" />,
      shortcut: '⌘E',
      category: 'action',
      action: () => {
        setIsOpen(false);
        router.push('/superadmin/emergency');
      },
      superadminOnly: true,
    },
    {
      id: 'broadcast',
      label: t('superadmin.quickActions.broadcast'),
      icon: <MessageSquare className="w-4 h-4" />,
      shortcut: '⌘B',
      category: 'action',
      action: () => {
        setIsOpen(false);
        router.push('/superadmin/organizations?tab=announcements');
      },
      superadminOnly: true,
    },
    {
      id: 'maintenance',
      label: t('superadmin.quickActions.maintenanceMode'),
      icon: <Wrench className="w-4 h-4" />,
      shortcut: '⌘M',
      category: 'action',
      action: () => {
        setIsOpen(false);
        router.push('/superadmin/organizations?tab=maintenance');
      },
      superadminOnly: true,
    },
    {
      id: 'impersonate',
      label: t('superadmin.quickActions.impersonate'),
      icon: <User className="w-4 h-4" />,
      shortcut: '⌘I',
      category: 'action',
      action: () => {
        setIsOpen(false);
        router.push('/superadmin/impersonate');
      },
      superadminOnly: true,
    },
    {
      id: 'automation',
      label: t('superadmin.quickActions.automation'),
      icon: <Zap className="w-4 h-4" />,
      shortcut: '⌘L',
      category: 'action',
      action: () => {
        setIsOpen(false);
        router.push('/superadmin/automation');
      },
      superadminOnly: true,
    },
    {
      id: 'reports',
      label: t('superadmin.quickActions.reports'),
      icon: <FileText className="w-4 h-4" />,
      shortcut: '⌘R',
      category: 'action',
      action: () => {
        setIsOpen(false);
        router.push('/reports');
      },
    },
    {
      id: 'backups',
      label: t('superadmin.quickActions.backups'),
      icon: <Database className="w-4 h-4" />,
      shortcut: '⌘B',
      category: 'navigation',
      action: () => {
        setIsOpen(false);
        router.push('/superadmin/backups');
      },
      superadminOnly: true,
    },
    {
      id: 'security',
      label: t('superadmin.quickActions.security'),
      icon: <Shield className="w-4 h-4" />,
      shortcut: '⌘S',
      category: 'action',
      action: () => {
        setIsOpen(false);
        router.push('/superadmin/security');
      },
      superadminOnly: true,
    },
    {
      id: 'organizations',
      label: t('superadmin.quickActions.organizations'),
      icon: <Users className="w-4 h-4" />,
      shortcut: '⌘O',
      category: 'navigation',
      action: () => {
        setIsOpen(false);
        router.push('/superadmin/organizations');
      },
      superadminOnly: true,
    },
    {
      id: 'support',
      label: t('superadmin.quickActions.support'),
      icon: <Ticket className="w-4 h-4" />,
      shortcut: '⌘P',
      category: 'navigation',
      action: () => {
        setIsOpen(false);
        router.push(isSuperadmin ? '/superadmin/support' : '/help');
      },
    },
    {
      id: 'help',
      label: t('superadmin.quickActions.help'),
      icon: <HelpCircleIcon className="w-4 h-4" />,
      shortcut: '⌘H',
      category: 'navigation',
      action: () => {
        setIsOpen(false);
        router.push('/help');
      },
    },
  ];

  // Filter actions based on user role
  const actions = allActions.filter((action) => {
    if (action.superadminOnly && !isSuperadmin) {
      return false;
    }
    if (action.adminOnly && !isAdmin) {
      return false;
    }
    if (action.supervisorOnly && !isSupervisor && !isAdmin) {
      return false;
    }
    return true;
  });

  // Filter actions by search query
  const filteredActions = actions.filter((action) =>
    action.label.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K to toggle
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }

      // Close on Escape
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setSearchQuery('');
      }

      // Arrow down to navigate
      if (e.key === 'ArrowDown' && isOpen) {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filteredActions.length - 1));
      }

      // Arrow up to navigate
      if (e.key === 'ArrowUp' && isOpen) {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      }

      // Enter to select
      if (e.key === 'Enter' && isOpen && selectedIndex >= 0) {
        e.preventDefault();
        filteredActions[selectedIndex]?.action();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredActions, selectedIndex]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      // Use requestAnimationFrame to avoid cascading renders warning
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        setSelectedIndex(-1);
      });
    }
  }, [isOpen]);

  // Group actions by category
  const groupedActions = filteredActions.reduce(
    (acc, action) => {
      acc[action.category].push(action);
      return acc;
    },
    { action: [] as QuickAction[], navigation: [] as QuickAction[], user: [] as QuickAction[] },
  );

  return (
    <>
      {/* Trigger button (optional, can also use keyboard shortcut) */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-2 text-sm text-(--muted-foreground) hover:text-(--foreground) transition-colors"
      >
        <Command className="w-4 h-4" />
        <span className="hidden md:inline">{t('superadmin.quickActions.title')}</span>
        <kbd className="hidden md:inline-flex items-center gap-1 px-2 py-1 bg-(--background-subtle) border border-(--border) rounded text-[10px] font-medium text-(--muted-foreground)">
          <span>⌘K</span>
        </kbd>
      </button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 flex- items-center justify-center bg-black/10 dark:bg-black/50 z-50 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Palette */}
      {isOpen && (
        <div className="fixed top-1/2 left-1/2 -translate-1/2 w-full max-w-2xl z-50 animate-in fade-in zoom-in duration-200">
          <div className="bg-(--card) border border-(--border) rounded-xl shadow-2xl overflow-hidden">
            {/* Header with search */}
            <div className="border-b border-(--border) p-4 bg-(--background-subtle)/50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-(--muted-foreground) opacity-60" />
                <Input
                  ref={inputRef}
                  type="text"
                  placeholder={
                    t('superadmin.quickActions.placeholder') || 'Type a command or search...'
                  }
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSelectedIndex(-1);
                  }}
                  className="pl-9 pr-12 h-11 bg-(--input) border-(--input-border) text-(--text-primary) placeholder-(--text-muted)"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-(--background-subtle) rounded-full transition-colors"
                  >
                    <X className="w-3 h-3 text-(--muted-foreground)" />
                  </button>
                )}
              </div>
            </div>

            {/* Actions list */}
            <div ref={listRef} className="max-h-[60vh] overflow-y-auto p-2">
              {searchQuery ? (
                // Show filtered results
                filteredActions.length > 0 ? (
                  <div className="space-y-1">
                    {filteredActions.map((action, index) => (
                      <ActionButton
                        key={action.id}
                        action={action}
                        index={index}
                        selectedIndex={selectedIndex}
                        onSelect={() => {
                          action.action();
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    <p>{t('superadmin.quickActions.noResults')}</p>
                  </div>
                )
              ) : (
                // Show grouped actions
                <>
                  {groupedActions.action.length > 0 && (
                    <ActionGroup
                      title={t('superadmin.quickActions.actions')}
                      actions={groupedActions.action}
                      selectedIndex={selectedIndex}
                      setSelectedIndex={setSelectedIndex}
                    />
                  )}
                  {groupedActions.navigation.length > 0 && (
                    <ActionGroup
                      title={t('superadmin.quickActions.navigation')}
                      actions={groupedActions.navigation}
                      selectedIndex={selectedIndex}
                      setSelectedIndex={setSelectedIndex}
                    />
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-(--border) p-3 text-xs text-(--muted-foreground) flex items-center justify-between bg-(--background-subtle)/50">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-(--background) border border-(--border) rounded text-[10px] font-medium">
                    ↑↓
                  </kbd>
                  {t('superadmin.quickActions.navigate')}
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-(--background) border border-(--border) rounded text-[10px] font-medium">
                    ↵
                  </kbd>
                  {t('superadmin.quickActions.select')}
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-(--background) border border-(--border) rounded text-[10px] font-medium">
                    esc
                  </kbd>
                  {t('superadmin.quickActions.close')}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[10px]">
                <Command className="w-3 h-3" />
                <span className="font-medium">K</span>
                <span className="mx-1">{t('superadmin.quickActions.toClose')}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Action Group Component
function ActionGroup({
  title,
  actions,
  selectedIndex,
}: {
  title: string;
  actions: QuickAction[];
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
}) {
  const groupRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={groupRef} className="mb-4">
      <h3 className="px-3 py-2 text-xs font-semibold text-(--muted-foreground) uppercase tracking-wider">
        {title}
      </h3>
      <div className="space-y-1">
        {actions.map((action, index) => (
          <ActionButton
            key={action.id}
            action={action}
            index={index}
            selectedIndex={selectedIndex}
            onSelect={() => {
              action.action();
            }}
          />
        ))}
      </div>
    </div>
  );
}

// Action Button Component
function ActionButton({
  action,
  index,
  selectedIndex,
  onSelect,
}: {
  action: QuickAction;
  index: number;
  selectedIndex: number;
  onSelect: () => void;
}) {
  const isSelected = index === selectedIndex;

  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left',
        isSelected
          ? 'bg-(--primary)/10 text-(--foreground)'
          : 'hover:bg-(--background-subtle)/50 text-(--foreground)',
      )}
    >
      <span
        className={cn('shrink-0', isSelected ? 'text-(--primary)' : 'text-(--muted-foreground)')}
      >
        {action.icon}
      </span>
      <span className="flex-1 font-medium">{action.label}</span>
      <div className="flex items-center gap-2 shrink-0">
        <kbd
          className={cn(
            'px-1.5 py-0.5 rounded text-[10px] font-mono border',
            isSelected
              ? 'bg-(--primary)/20 border-(--primary)/30 text-(--primary)'
              : 'bg-(--background-subtle) border-(--border) text-(--muted-foreground)',
          )}
        >
          {action.shortcut}
        </kbd>
        <ArrowRight
          className={cn('w-4 h-4 transition-opacity', isSelected ? 'opacity-100' : 'opacity-0')}
        />
      </div>
    </button>
  );
}
