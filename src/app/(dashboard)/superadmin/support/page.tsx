'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/convex/_generated/api';
import { useAuthStore } from '@/store/useAuthStore';
import { CreateSupportTicketWizard } from '@/components/superadmin/CreateSupportTicketWizard';
import type { Id } from '@/convex/_generated/dataModel';
import { useTranslation } from 'react-i18next';
import {
  Ticket,
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingUp,
  Search,
  Filter,
  Plus,
  User,
  Building2,
  MessageSquare,
  Eye,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ShieldLoader } from '@/components/ui/ShieldLoader';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

export default function SupportTicketsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(searchParams.get('new') === 'true');

  const tickets = useQuery(api.tickets.getAllTickets, user?.id ? {} : 'skip') as any;

  const stats = useQuery(api.tickets.getTicketStats);

  const filteredTickets = tickets?.filter((ticket: any) => {
    const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || ticket.priority === priorityFilter;
    const matchesSearch =
      ticket.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.ticketNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.creatorName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesPriority && matchesSearch;
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-500/10 text-red-600 border-red-500/30';
      case 'high':
        return 'bg-orange-500/10 text-orange-600 border-orange-500/30';
      case 'medium':
        return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30';
      default:
        return 'bg-blue-500/10 text-blue-600 border-blue-500/30';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-blue-500/10 text-blue-600 border-blue-500/30';
      case 'in_progress':
        return 'bg-purple-500/10 text-purple-600 border-purple-500/30';
      case 'waiting_customer':
        return 'bg-orange-500/10 text-orange-600 border-orange-500/30';
      case 'resolved':
        return 'bg-green-500/10 text-green-600 border-green-500/30';
      case 'closed':
        return 'bg-gray-500/10 text-gray-600 border-gray-500/30';
      default:
        return 'bg-gray-500/10 text-gray-600 border-gray-500/30';
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <ShieldLoader size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="sticky top-0 z-10 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-4 mb-6 bg-[var(--background)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--background)]/60 border-b border-[var(--border)]">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1
                className="text-2xl sm:text-3xl font-bold tracking-tight mb-1"
                style={{ color: 'var(--text-primary)' }}
              >
                {t('superadmin.support.title')}
              </h1>
              <p className="text-sm text-muted-foreground">{t('superadmin.support.subtitle')}</p>
            </div>
            <Button
              onClick={() => setCreateDialogOpen(true)}
              className="gap-2 w-full sm:w-auto shrink-0 transition-all duration-200 hover:scale-105 active:scale-95 hover:shadow-lg"
            >
              <Plus className="w-4 h-4 transition-transform duration-200" />
              <span>{t('superadmin.support.createTicket')}</span>
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
            <StatCard
              title={t('superadmin.support.total')}
              value={stats.total}
              icon={Ticket}
              color="blue"
            />
            <StatCard
              title={t('superadmin.support.open')}
              value={stats.open}
              icon={AlertCircle}
              color="blue"
            />
            <StatCard
              title={t('superadmin.support.inProgress')}
              value={stats.inProgress}
              icon={Clock}
              color="purple"
            />
            <StatCard
              title={t('superadmin.support.waitingCustomer')}
              value={stats.waitingCustomer}
              icon={MessageSquare}
              color="orange"
            />
            <StatCard
              title={t('superadmin.support.resolved')}
              value={stats.resolved}
              icon={CheckCircle}
              color="green"
            />
            <StatCard
              title={t('superadmin.support.critical')}
              value={stats.critical}
              icon={AlertCircle}
              color="red"
            />
            <StatCard
              title={t('superadmin.support.overdue')}
              value={stats.overdue}
              icon={Clock}
              color="red"
            />
            <StatCard
              title={t('superadmin.support.avgTime')}
              value={`${stats.avgResponseTime}ч`}
              icon={TrendingUp}
              color="green"
            />
          </div>
        )}

        {/* Filters */}
        <Card className="mb-6 border-[var(--border)]" style={{ background: 'var(--card)' }}>
          <CardContent className="p-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={t('superadmin.support.searchTickets')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              <div className="flex flex-wrap gap-3 flex-1">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[160px] h-9">
                    <Filter className="w-3.5 h-3.5 mr-2" />
                    <SelectValue placeholder={t('superadmin.support.allStatuses')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('superadmin.support.allStatuses')}</SelectItem>
                    <SelectItem value="open">{t('superadmin.support.open')}</SelectItem>
                    <SelectItem value="in_progress">
                      {t('superadmin.support.inProgress')}
                    </SelectItem>
                    <SelectItem value="waiting_customer">
                      {t('superadmin.support.waitingCustomer')}
                    </SelectItem>
                    <SelectItem value="resolved">{t('superadmin.support.resolved')}</SelectItem>
                    <SelectItem value="closed">{t('superadmin.support.closed')}</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="w-[160px] h-9">
                    <SelectValue placeholder={t('superadmin.support.allPriorities')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('superadmin.support.allPriorities')}</SelectItem>
                    <SelectItem value="critical">{t('superadmin.support.critical')}</SelectItem>
                    <SelectItem value="high">{t('superadmin.support.high')}</SelectItem>
                    <SelectItem value="medium">{t('superadmin.support.medium')}</SelectItem>
                    <SelectItem value="low">{t('superadmin.support.low')}</SelectItem>
                  </SelectContent>
                </Select>
                {(statusFilter !== 'all' || priorityFilter !== 'all' || searchQuery) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 px-3 text-muted-foreground"
                    onClick={() => {
                      setStatusFilter('all');
                      setPriorityFilter('all');
                      setSearchQuery('');
                    }}
                  >
                    <X className="w-3.5 h-3.5 mr-1" />
                    Сбросить
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tickets List */}
        <Card style={{ background: 'var(--card)' }}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">{t('superadmin.support.tickets')}</CardTitle>
                <CardDescription className="mt-1">
                  {filteredTickets?.length || 0} {t('superadmin.support.ticketsFound')}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {filteredTickets === undefined ? (
              <div className="flex items-center justify-center py-12">
                <ShieldLoader size="sm" />
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="text-center py-12">
                <Ticket className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p className="text-muted-foreground">{t('superadmin.support.noTickets')}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredTickets.map((ticket: any) => (
                  <TicketRow
                    key={ticket._id}
                    ticket={ticket}
                    onClick={() => setSelectedTicket(ticket._id)}
                    getPriorityColor={getPriorityColor}
                    getStatusColor={getStatusColor}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Ticket Dialog - Using Wizard */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t('superadmin.support.createTicket')}</DialogTitle>
          </DialogHeader>
          <CreateSupportTicketWizard
            userId={user.id as Id<'users'>}
            organizationId={user.organizationId as Id<'organizations'>}
            onComplete={() => {
              setCreateDialogOpen(false);
              router.refresh();
            }}
            onCancel={() => setCreateDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Ticket Detail Dialog */}
      {selectedTicket && (
        <TicketDetailDialog
          ticketId={selectedTicket}
          open={!!selectedTicket}
          onOpenChange={(open) => !open && setSelectedTicket(null)}
          userId={user.id as Id<'users'>}
        />
      )}
    </div>
  );
}

// Stat Card Component
function StatCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string;
  value: number | string;
  icon: any;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    blue: 'text-blue-500',
    green: 'text-green-500',
    red: 'text-red-500',
    purple: 'text-purple-500',
    orange: 'text-orange-500',
  };

  return (
    <Card style={{ background: 'var(--background-subtle)' }}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-muted-foreground">{title}</p>
          <Icon className={`w-4 h-4 ${colorClasses[color]}`} />
        </div>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

// Ticket Row Component
function TicketRow({
  ticket,
  onClick,
  getPriorityColor,
  getStatusColor,
}: {
  ticket: any;
  onClick: () => void;
  getPriorityColor: (priority: string) => string;
  getStatusColor: (status: string) => string;
}) {
  const formatDate = (date: number) => {
    const now = new Date();
    const ticketDate = new Date(date);
    const diffDays = Math.floor((now.getTime() - ticketDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Сегодня';
    if (diffDays === 1) return 'Вчера';
    if (diffDays < 7) return `${diffDays} дн. назад`;
    return ticketDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  return (
    <div
      onClick={onClick}
      className="group p-5 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:border-primary/30 hover:shadow-md transition-all duration-300 ease-in-out cursor-pointer"
    >
      <div className="flex items-start gap-4">
        {/* Main Info */}
        <div className="flex-1 min-w-0">
          {/* Top Row: Number + Badges */}
          <div className="flex items-center gap-2 mb-2">
            <span
              className="font-mono text-xs transition-colors duration-200"
              style={{ color: 'var(--text-secondary)' }}
            >
              {ticket.ticketNumber}
            </span>
            <Badge
              className={`${getStatusColor(ticket.status)} text-xs px-2 py-0 transition-all duration-200`}
            >
              {ticket.status === 'open' && 'Открыт'}
              {ticket.status === 'in_progress' && 'В работе'}
              {ticket.status === 'waiting_customer' && 'Ждет клиента'}
              {ticket.status === 'resolved' && 'Решен'}
              {ticket.status === 'closed' && 'Закрыт'}
            </Badge>
            <Badge
              className={`${getPriorityColor(ticket.priority)} text-xs px-2 py-0 transition-all duration-200`}
            >
              {ticket.priority === 'critical' && 'Критичный'}
              {ticket.priority === 'high' && 'Высокий'}
              {ticket.priority === 'medium' && 'Средний'}
              {ticket.priority === 'low' && 'Низкий'}
            </Badge>
            {ticket.isOverdue && (
              <Badge
                variant="destructive"
                className="text-xs px-2 py-0 transition-all duration-200"
              >
                Просрочен
              </Badge>
            )}
          </div>

          {/* Title */}
          <h3
            className="text-base font-medium truncate mb-2 transition-all duration-200 group-hover:translate-x-1"
            style={{ color: 'var(--text-primary)' }}
          >
            {ticket.title}
          </h3>

          {/* Meta Info */}
          <div
            className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs transition-colors duration-200"
            style={{ color: 'var(--text-muted)' }}
          >
            <span>{ticket.creatorName}</span>
            {ticket.organizationName && (
              <>
                <span>•</span>
                <span>{ticket.organizationName}</span>
              </>
            )}
            <span>•</span>
            <span>{ticket.commentCount} комм.</span>
            <span>•</span>
            <span>{formatDate(ticket.createdAt)}</span>
          </div>
        </div>

        {/* Arrow */}
        <div className="self-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform group-hover:translate-x-1">
          <svg
            className="w-4 h-4"
            style={{ color: 'var(--text-muted)' }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </div>
  );
}

// Create Ticket Dialog Component
function CreateTicketDialog({
  open,
  onOpenChange,
  userId,
  organizationId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: Id<'users'>;
  organizationId?: Id<'organizations'>;
}) {
  const { t } = useTranslation();
  const createTicket = useMutation(api.tickets.createTicket);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [category, setCategory] = useState<
    'technical' | 'billing' | 'access' | 'feature_request' | 'bug' | 'other'
  >('technical');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !description.trim()) {
      toast.error(t('error.fillRequiredFields'));
      return;
    }

    try {
      const result = await createTicket({
        organizationId,
        createdBy: userId,
        title,
        description,
        priority,
        category,
      });

      toast.success(t('superadmin.support.ticketCreated', { ticketNumber: result.ticketNumber }));
      onOpenChange(false);
      setTitle('');
      setDescription('');
      setPriority('medium');
      setCategory('technical');
    } catch (error) {
      toast.error(t('superadmin.support.createError'));
      console.error(error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t('superadmin.support.create.title')}</DialogTitle>
            <DialogDescription>{t('superadmin.support.create.description')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="title">{t('superadmin.support.create.titleLabel')}</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('superadmin.support.create.titlePlaceholder')}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="priority">{t('superadmin.support.create.priorityLabel')}</Label>
                <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">{t('priority.low')}</SelectItem>
                    <SelectItem value="medium">{t('priority.medium')}</SelectItem>
                    <SelectItem value="high">{t('priority.high')}</SelectItem>
                    <SelectItem value="critical">{t('priority.critical')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="category">{t('superadmin.support.create.categoryLabel')}</Label>
                <Select value={category} onValueChange={(v: any) => setCategory(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="technical">{t('category.technical')}</SelectItem>
                    <SelectItem value="billing">{t('category.billing')}</SelectItem>
                    <SelectItem value="access">{t('category.access')}</SelectItem>
                    <SelectItem value="feature_request">{t('category.featureRequest')}</SelectItem>
                    <SelectItem value="bug">{t('category.bug')}</SelectItem>
                    <SelectItem value="other">{t('category.other')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor={t('common.description')}>
                {t('superadmin.support.create.descriptionLabel')}
              </Label>
              <Textarea
                id={t('common.description')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('superadmin.support.create.descriptionPlaceholder')}
                rows={6}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('actions.cancel')}
            </Button>
            <Button type="submit">{t('superadmin.support.create.submit')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Ticket Detail Dialog Component
function TicketDetailDialog({
  ticketId,
  open,
  onOpenChange,
  userId,
}: {
  ticketId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: Id<'users'>;
}) {
  const ticket = useQuery(
    api.tickets.getTicketById,
    open ? { ticketId: ticketId as Id<'supportTickets'> } : 'skip',
  );

  const updateStatus = useMutation(api.tickets.updateTicketStatus);
  const assignTicket = useMutation(api.tickets.assignTicket);
  const addComment = useMutation(api.tickets.addTicketComment);
  const resolveTicket = useMutation(api.tickets.resolveTicket);

  const [commentText, setCommentText] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [activeTab, setActiveTab] = useState('comments');

  const handleAddComment = async () => {
    if (!commentText.trim()) return;

    try {
      await addComment({
        ticketId: ticketId as Id<'supportTickets'>,
        authorId: userId,
        message: commentText,
        isInternal: isInternal,
      });
      setCommentText('');
      toast.success('Комментарий добавлен');
    } catch (error) {
      toast.error('Ошибка при добавлении комментария');
    }
  };

  const handleResolve = async () => {
    const resolution = prompt('Введите решение:');
    if (!resolution) return;

    try {
      await resolveTicket({
        ticketId: ticketId as Id<'supportTickets'>,
        resolution,
        userId,
      });
      toast.success('Тикет решен');
      onOpenChange(false);
    } catch (error) {
      toast.error('Ошибка при решении тикета');
    }
  };

  if (!ticket) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-blue-500/10 text-blue-600 border-blue-500/30';
      case 'in_progress':
        return 'bg-purple-500/10 text-purple-600 border-purple-500/30';
      case 'waiting_customer':
        return 'bg-orange-500/10 text-orange-600 border-orange-500/30';
      case 'resolved':
        return 'bg-green-500/10 text-green-600 border-green-500/30';
      case 'closed':
        return 'bg-gray-500/10 text-gray-600 border-gray-500/30';
      default:
        return 'bg-gray-500/10 text-gray-600 border-gray-500/30';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-500/10 text-red-600 border-red-500/30';
      case 'high':
        return 'bg-orange-500/10 text-orange-600 border-orange-500/30';
      case 'medium':
        return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30';
      default:
        return 'bg-blue-500/10 text-blue-600 border-blue-500/30';
    }
  };

  const ticketWithOverdue = ticket as any;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col p-0 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="border-b border-[var(--border)] px-6 py-5 transition-all duration-200">
          <div className="flex items-start gap-3 mb-3">
            <DialogTitle className="font-mono text-base" style={{ color: 'var(--text-muted)' }}>
              {ticket.ticketNumber}
            </DialogTitle>
            <Badge
              className={`${getStatusColor(ticket.status)} text-xs transition-all duration-200`}
            >
              {ticket.status === 'open' && 'Открыт'}
              {ticket.status === 'in_progress' && 'В работе'}
              {ticket.status === 'waiting_customer' && 'Ждет клиента'}
              {ticket.status === 'resolved' && 'Решен'}
              {ticket.status === 'closed' && 'Закрыт'}
            </Badge>
            <Badge
              className={`${getPriorityColor(ticket.priority)} text-xs transition-all duration-200`}
            >
              {ticket.priority === 'critical' && 'Критичный'}
              {ticket.priority === 'high' && 'Высокий'}
              {ticket.priority === 'medium' && 'Средний'}
              {ticket.priority === 'low' && 'Низкий'}
            </Badge>
            {ticketWithOverdue.isOverdue && (
              <Badge variant="destructive" className="text-xs transition-all duration-200">
                Просрочен
              </Badge>
            )}
          </div>
          <DialogDescription
            className="text-lg font-medium transition-all duration-200"
            style={{ color: 'var(--text-primary)' }}
          >
            {ticket.title}
          </DialogDescription>

          <div
            className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs transition-all duration-200"
            style={{ color: 'var(--text-muted)' }}
          >
            <span>{ticket.creatorName}</span>
            {ticket.organizationName && (
              <>
                <span>•</span>
                <span>{ticket.organizationName}</span>
              </>
            )}
            <span>•</span>
            <span>
              {new Date(ticket.createdAt).toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </span>
            <span>•</span>
            <span>{ticket.comments?.length || 0} комментариев</span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Tab Buttons */}
          <div className="border-b border-[var(--border)] px-4 sm:px-6 pt-4">
            <div className="flex gap-4">
              <button
                onClick={() => setActiveTab('comments')}
                className={`relative px-3 sm:px-4 py-3 text-sm font-medium border-b-2 transition-all duration-300 ease-in-out ${
                  activeTab === 'comments'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-primary'
                }`}
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  <span className="hidden sm:inline">Комментарии</span>
                  <span className="sm:hidden">Комм.</span>
                  {ticket.comments?.length > 0 && (
                    <span className="px-1.5 py-0.5 text-xs rounded-full bg-[var(--background-subtle)]">
                      {ticket.comments.length}
                    </span>
                  )}
                </div>
              </button>
              <button
                onClick={() => setActiveTab('details')}
                className={`relative px-3 sm:px-4 py-3 text-sm font-medium border-b-2 transition-all duration-300 ease-in-out ${
                  activeTab === 'details'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-primary'
                }`}
              >
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span className="hidden sm:inline">Детали</span>
                  <span className="sm:hidden">Инфо</span>
                </div>
              </button>
            </div>
          </div>

          {/* Tab Content Area */}
          <div className="px-4 sm:px-6 py-4">
            {/* Comments Tab Content */}
            <div
              className="grid transition-[grid-template-rows] duration-300 ease-in-out"
              style={{
                gridTemplateRows: activeTab === 'comments' ? '1fr' : '0fr',
              }}
            >
              <div className="overflow-hidden">
                <div className="space-y-3 pb-4">
                  {ticket.comments?.map((comment: any) => (
                    <div
                      key={comment._id}
                      className={`p-4 rounded-lg transition-all duration-200 hover:shadow-sm ${
                        comment.isInternal
                          ? 'bg-yellow-500/5 border border-yellow-500/20'
                          : 'bg-[var(--background-subtle)] hover:bg-[var(--background)]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium transition-colors duration-200">
                            {comment.authorName}
                          </p>
                          {comment.isInternal && (
                            <Badge
                              variant="secondary"
                              className="text-xs transition-all duration-200"
                            >
                              Внутренний
                            </Badge>
                          )}
                        </div>
                        <p
                          className="text-xs transition-colors duration-200"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {new Date(comment.createdAt).toLocaleString('ru-RU', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <p className="text-sm transition-colors duration-200">{comment.message}</p>
                    </div>
                  ))}

                  {(!ticket.comments || ticket.comments.length === 0) && (
                    <div className="text-center py-8 text-muted-foreground">
                      <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30 transition-transform duration-200" />
                      <p>Пока нет комментариев</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Details Tab Content */}
            <div
              className="grid transition-[grid-template-rows] duration-300 ease-in-out"
              style={{
                gridTemplateRows: activeTab === 'details' ? '1fr' : '0fr',
              }}
            >
              <div className="overflow-hidden">
                <div className="space-y-6 pb-4">
                  <div className="transition-all duration-200">
                    <h4
                      className="text-sm font-medium mb-3 flex items-center gap-2 transition-colors duration-200"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <svg
                        className="w-4 h-4 transition-transform duration-200"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 6h16M4 12h16M4 18h7"
                        />
                      </svg>
                      Описание
                    </h4>
                    <div className="p-4 rounded-lg bg-[var(--background-subtle)] transition-all duration-200 hover:shadow-sm">
                      <p className="text-sm leading-relaxed">{ticket.description}</p>
                    </div>
                  </div>

                  <div className="transition-all duration-200">
                    <h4
                      className="text-sm font-medium mb-3 flex items-center gap-2 transition-colors duration-200"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <svg
                        className="w-4 h-4 transition-transform duration-200"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                        />
                      </svg>
                      Информация о тикете
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg bg-[var(--background-subtle)] transition-colors duration-300 hover:bg-[var(--card)]">
                        <p
                          className="text-xs mb-1 transition-colors duration-200"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          Статус
                        </p>
                        <Badge
                          className={`${getStatusColor(ticket.status)} text-xs transition-all duration-200`}
                        >
                          {ticket.status === 'open' && 'Открыт'}
                          {ticket.status === 'in_progress' && 'В работе'}
                          {ticket.status === 'waiting_customer' && 'Ждет клиента'}
                          {ticket.status === 'resolved' && 'Решен'}
                          {ticket.status === 'closed' && 'Закрыт'}
                        </Badge>
                      </div>
                      <div className="p-3 rounded-lg bg-[var(--background-subtle)] transition-colors duration-300 hover:bg-[var(--card)]">
                        <p
                          className="text-xs mb-1 transition-colors duration-200"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          Приоритет
                        </p>
                        <Badge
                          className={`${getPriorityColor(ticket.priority)} text-xs transition-all duration-200`}
                        >
                          {ticket.priority === 'critical' && 'Критичный'}
                          {ticket.priority === 'high' && 'Высокий'}
                          {ticket.priority === 'medium' && 'Средний'}
                          {ticket.priority === 'low' && 'Низкий'}
                        </Badge>
                      </div>
                      <div className="p-3 rounded-lg bg-[var(--background-subtle)] transition-colors duration-300 hover:bg-[var(--card)]">
                        <p
                          className="text-xs mb-1 transition-colors duration-200"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          Категория
                        </p>
                        <p className="text-sm font-medium transition-colors duration-200">
                          {ticket.category}
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-[var(--background-subtle)] transition-colors duration-300 hover:bg-[var(--card)]">
                        <p
                          className="text-xs mb-1 transition-colors duration-200"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          Создан
                        </p>
                        <p className="text-sm font-medium transition-colors duration-200">
                          {new Date(ticket.createdAt).toLocaleDateString('ru-RU')}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Comment Input - always visible in comments tab */}
            {activeTab === 'comments' && (
              <div className="border-t border-[var(--border)] p-4 space-y-3 transition-all duration-300 ease-in-out tab-content-animate">
                <Textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Добавить комментарий..."
                  rows={3}
                  className="resize-none transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                />
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm cursor-pointer transition-all duration-200 hover:opacity-80">
                    <input
                      type="checkbox"
                      checked={isInternal}
                      onChange={(e) => setIsInternal(e.target.checked)}
                      className="rounded transition-all duration-200"
                    />
                    <span style={{ color: 'var(--text-muted)' }}>
                      Внутренний (не видно клиенту)
                    </span>
                  </label>
                  <Button
                    onClick={handleAddComment}
                    size="sm"
                    disabled={!commentText.trim()}
                    className="transition-all duration-200 hover:scale-105 active:scale-95"
                  >
                    Отправить
                  </Button>
                </div>
              </div>
            )}

            {/* Actions & Info Sidebar - below content on mobile, right side on desktop */}
            <div className="border-t lg:border-t-0 lg:border-l border-[var(--border)] p-4 sm:p-6 space-y-4 sm:space-y-6 transition-all duration-200">
              <div className="transition-all duration-200">
                <h4
                  className="text-sm font-medium mb-3 transition-colors duration-200"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Изменить статус
                </h4>
                <Select
                  value={ticket.status}
                  onValueChange={(value: any) => {
                    updateStatus({
                      ticketId: ticketId as Id<'supportTickets'>,
                      status: value,
                      userId,
                    });
                    toast.success('Статус обновлен');
                  }}
                >
                  <SelectTrigger className="w-full shadow-none transition-all duration-200 hover:shadow-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="select-dropdown-animate">
                    <SelectItem value="open" className="transition-all duration-150">
                      Открытый
                    </SelectItem>
                    <SelectItem value="in_progress" className="transition-all duration-150">
                      В работе
                    </SelectItem>
                    <SelectItem value="waiting_customer" className="transition-all duration-150">
                      Ждет ответа
                    </SelectItem>
                    <SelectItem value="resolved" className="transition-all duration-150">
                      Решен
                    </SelectItem>
                    <SelectItem value="closed" className="transition-all duration-150">
                      Закрыт
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {ticket.status !== 'closed' && ticket.status !== 'resolved' && (
                <Button
                  onClick={handleResolve}
                  variant="outline"
                  className="w-full transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] hover:shadow-sm"
                >
                  <CheckCircle className="w-4 h-4 mr-2 transition-transform duration-200" />
                  Решить тикет
                </Button>
              )}

              <div className="pt-3 sm:pt-4 border-t border-[var(--border)] transition-all duration-200">
                <h4
                  className="text-sm font-medium mb-3 transition-colors duration-200"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Информация
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between transition-all duration-200 hover:bg-[var(--background-subtle)] rounded p-1">
                    <span style={{ color: 'var(--text-muted)' }}>Приоритет:</span>
                    <span
                      className="font-medium transition-colors duration-200"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {ticket.priority}
                    </span>
                  </div>
                  <div className="flex justify-between transition-all duration-200 hover:bg-[var(--background-subtle)] rounded p-1">
                    <span style={{ color: 'var(--text-muted)' }}>Категория:</span>
                    <span
                      className="font-medium transition-colors duration-200"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {ticket.category}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
