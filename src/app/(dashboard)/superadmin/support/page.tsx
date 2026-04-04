'use client';

import { useState } from 'react';
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
  TrendingDown,
  Search,
  Filter,
  Plus,
  MoreHorizontal,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { t } from 'i18next';

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

  const tickets = useQuery(api.tickets.getAllTickets, user?.id ? {} : 'skip');

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
    <div className="min-h-screen p-4 md:p-6" style={{ background: 'var(--background)' }}>
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h1
                className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2"
                style={{ color: 'var(--text-primary)' }}
              >
                {t('superadmin.support.title')}
              </h1>
              <p className="text-muted-foreground text-sm sm:text-base">
                {t('superadmin.support.subtitle')}
              </p>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)} className="gap-2 w-full sm:w-auto">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">{t('superadmin.support.createTicket')}</span>
              <span className="sm:hidden">Create</span>
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
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
        <Card className="mb-6" style={{ background: 'var(--card)' }}>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={t('superadmin.support.searchTickets')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={t('superadmin.support.allStatuses')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('superadmin.support.allStatuses')}</SelectItem>
                  <SelectItem value="open">{t('superadmin.support.open')}</SelectItem>
                  <SelectItem value="in_progress">{t('superadmin.support.inProgress')}</SelectItem>
                  <SelectItem value="waiting_customer">
                    {t('superadmin.support.waitingCustomer')}
                  </SelectItem>
                  <SelectItem value="resolved">{t('superadmin.support.resolved')}</SelectItem>
                  <SelectItem value="closed">{t('superadmin.support.closed')}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-[180px]">
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
            </div>
          </CardContent>
        </Card>

        {/* Tickets List */}
        <Card style={{ background: 'var(--card)' }}>
          <CardHeader>
            <CardTitle>{t('superadmin.support.tickets')}</CardTitle>
            <CardDescription>
              {filteredTickets?.length || 0} {t('superadmin.support.ticketsFound')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredTickets === undefined ? (
              <div className="text-center py-8 text-muted-foreground">{t('loading')}</div>
            ) : filteredTickets.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Ticket className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>{t('superadmin.support.noTickets')}</p>
              </div>
            ) : (
              <div className="space-y-3">
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
  return (
    <div
      onClick={onClick}
      className="p-3 sm:p-4 rounded-lg border hover:border-primary/50 transition-colors cursor-pointer active:bg-[var(--background-subtle)]"
      style={{ background: 'var(--card)' }}
    >
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            <span
              className="font-semibold text-sm sm:text-base"
              style={{ color: 'var(--text-primary)' }}
            >
              {ticket.ticketNumber}
            </span>
            <Badge className={`${getStatusColor(ticket.status)} text-xs`}>
              <span className="hidden sm:inline">{ticket.status}</span>
              <span className="sm:hidden">
                {ticket.status === 'open'
                  ? 'Open'
                  : ticket.status === 'in_progress'
                    ? 'In Progress'
                    : ticket.status === 'waiting_customer'
                      ? 'Waiting'
                      : ticket.status === 'resolved'
                        ? 'Resolved'
                        : ticket.status}
              </span>
            </Badge>
            <Badge className={`${getPriorityColor(ticket.priority)} text-xs`}>
              <span className="hidden sm:inline">{ticket.priority}</span>
              <span className="sm:hidden">
                {ticket.priority === 'critical'
                  ? 'Crit'
                  : ticket.priority === 'high'
                    ? 'High'
                    : ticket.priority === 'medium'
                      ? 'Med'
                      : ticket.priority}
              </span>
            </Badge>
            {ticket.isOverdue && (
              <Badge variant="destructive" className="animate-pulse text-xs">
                Просрочен
              </Badge>
            )}
          </div>
          <p
            className="text-sm sm:text-base truncate mb-2"
            style={{ color: 'var(--text-primary)' }}
          >
            {ticket.title}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <User className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{ticket.creatorName}</span>
            </span>
            {ticket.organizationName && (
              <span className="flex items-center gap-1">
                <Building2 className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{ticket.organizationName}</span>
              </span>
            )}
            <span className="flex items-center gap-1">
              <MessageSquare className="w-3 h-3 flex-shrink-0" />
              {ticket.commentCount}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:self-start flex-shrink-0">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Eye className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>{ticket.ticketNumber}</DialogTitle>
              <DialogDescription>{ticket.title}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-6">
          {/* Ticket Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Статус</p>
              <Badge>{ticket.status}</Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Приоритет</p>
              <Badge>{ticket.priority}</Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Категория</p>
              <Badge>{ticket.category}</Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Создан</p>
              <p className="text-sm">{new Date(ticket.createdAt).toLocaleDateString()}</p>
            </div>
          </div>

          {/* Description */}
          <div>
            <h4 className="font-semibold mb-2">Описание</h4>
            <p className="text-sm whitespace-pre-wrap">{ticket.description}</p>
          </div>

          {/* Comments */}
          <div>
            <h4 className="font-semibold mb-4">Комментарии ({ticket.comments?.length || 0})</h4>
            <div className="space-y-3">
              {ticket.comments?.map((comment: any) => (
                <div
                  key={comment._id}
                  className={`p-3 rounded-lg ${comment.isInternal ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-muted'}`}
                  style={{ border: '1px solid var(--border)' }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{comment.authorName}</span>
                      {comment.isInternal && (
                        <Badge variant="secondary" className="text-xs">
                          Внутренний
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(comment.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm">{comment.message}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Add Comment */}
          <div className="space-y-2">
            <Textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Добавить комментарий..."
              rows={3}
            />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isInternal}
                  onChange={(e) => setIsInternal(e.target.checked)}
                  className="rounded"
                />
                Внутренний комментарий (не видно клиенту)
              </label>
              <Button onClick={handleAddComment} size="sm">
                Отправить
              </Button>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="border-t pt-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
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
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t('superadmin.status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Открытый</SelectItem>
                <SelectItem value="in_progress">В работе</SelectItem>
                <SelectItem value="waiting_customer">Ждет ответа</SelectItem>
                <SelectItem value="resolved">Решен</SelectItem>
                <SelectItem value="closed">Закрыт</SelectItem>
              </SelectContent>
            </Select>

            {ticket.status !== 'closed' && ticket.status !== 'resolved' && (
              <Button onClick={handleResolve} variant="outline" size="sm">
                Решить
              </Button>
            )}
          </div>

          <Button variant="destructive" size="sm">
            Закрыть
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
