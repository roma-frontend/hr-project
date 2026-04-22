'use client';

import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { CreateSupportTicketWizard } from '@/components/superadmin/CreateSupportTicketWizard';
import { useTranslation } from 'react-i18next';
import {
  useAllTickets,
  useTicketStats,
  useTicketById,
  useTicketChatStatus,
  useCreateTicket,
  useUpdateTicketStatus,
  useAssignTicket,
  useAddTicketComment,
  useResolveTicket,
  useCreateTicketChat,
  useActivateTicketChat,
} from '@/hooks/useTickets';
import {
  Ticket,
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingUp,
  Search,
  Filter,
  Plus,
  MessageSquare,
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

export default function SupportTicketsClient() {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);

  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(searchParams.get('new') === 'true');

  const { data: tickets } = useAllTickets();
  const { data: stats } = useTicketStats();

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
        <div className="sticky top-0 z-10 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-4 mb-6 bg-(--background)/95 backdrop-blur supports-[backdrop-filter]:bg-(--background)/60 border-b border-(--border)">
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
              className="flex items-center gap-2 w-full sm:w-auto justify-center bg-linear-to-r from-(--primary) to-(--primary-dark,var(--primary)) hover:opacity-90 transition-opacity text-white font-medium shadow-md hover:shadow-lg"
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
              value={`${stats.avgResponseTime}${t('common.hoursShort')}`}
              icon={TrendingUp}
              color="green"
            />
          </div>
        )}

        {/* Filters */}
        <Card className="mb-6 border-(--border)" style={{ background: 'var(--card)' }}>
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
                  <SelectTrigger className="w-full sm:w-[160px] h-9">
                    <Filter className="hidden sm:block w-3.5 h-3.5 mr-2" />
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
                  <SelectTrigger className="w-full sm:w-[160px] h-9">
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
                    {t('superadmin.support.resetFilters')}
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
                    key={ticket.id}
                    ticket={ticket}
                    onClick={() => setSelectedTicket(ticket.id)}
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
        <DialogContent className="w-[95vw] sm:w-[90vw] md:w-[85vw] max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-lg md:text-xl">{t('superadmin.support.createTicket')}</DialogTitle>
            <DialogDescription className="text-sm">{t('superadmin.support.createDescription')}</DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto">
            <CreateSupportTicketWizard
            userId={user.id ?? ''}
            organizationId={user.organizationId ?? ''}
            onComplete={() => {
              setCreateDialogOpen(false);
              router.refresh();
            }}
            onCancel={() => setCreateDialogOpen(false)}
          />
          </div>
        </DialogContent>
      </Dialog>

      {/* Ticket Detail Dialog */}
      {selectedTicket && (
        <TicketDetailDialog
          ticketId={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          getPriorityColor={getPriorityColor}
          getStatusColor={getStatusColor}
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
  const { t, i18n } = useTranslation();
  const formatDate = (date: number) => {
    const now = new Date();
    const ticketDate = new Date(date);
    const diffDays = Math.floor((now.getTime() - ticketDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return t('superadmin.support.dateToday');
    if (diffDays === 1) return t('superadmin.support.dateYesterday');
    if (diffDays < 7) return t('superadmin.support.daysAgo', { count: diffDays });
    return ticketDate.toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' });
  };

  return (
    <div
      onClick={onClick}
      className="group p-5 rounded-xl border border-(--border) bg-(--card) hover:border-primary/30 hover:shadow-md transition-all duration-300 ease-in-out cursor-pointer"
    >
      <div className="flex items-start gap-4">
        {/* Main Info */}
        <div className="flex-1 min-w-0">
          {/* Top Row: Number + Badges */}
          <div className="flex items-center flex-wrap gap-2 mb-2">
            <span
              className="font-mono text-xs transition-colors duration-200"
              style={{ color: 'var(--text-secondary)' }}
            >
              {ticket.ticketNumber}
            </span>
            <Badge
              className={`${getStatusColor(ticket.status)} text-xs px-2 py-0 transition-all duration-200`}
            >
              {ticket.status === 'open' && t('superadmin.support.statusOpen')}
              {ticket.status === 'in_progress' && t('superadmin.support.statusInProgress')}
              {ticket.status === 'waiting_customer' &&
                t('superadmin.support.statusWaitingCustomer')}
              {ticket.status === 'resolved' && t('superadmin.support.statusResolved')}
              {ticket.status === 'closed' && t('superadmin.support.statusClosed')}
            </Badge>
            <Badge
              className={`${getPriorityColor(ticket.priority)} text-xs px-2 py-0 transition-all duration-200`}
            >
              {ticket.priority === 'critical' && t('superadmin.support.priorityCritical')}
              {ticket.priority === 'high' && t('superadmin.support.priorityHigh')}
              {ticket.priority === 'medium' && t('superadmin.support.priorityMedium')}
              {ticket.priority === 'low' && t('superadmin.support.priorityLow')}
            </Badge>
            {ticket.isOverdue && (
              <Badge
                variant="destructive"
                className="text-xs px-2 py-0 transition-all duration-200"
              >
                {t('superadmin.support.overdue')}
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
            <span>
              {ticket.commentCount} {t('superadmin.support.commentsShort')}
            </span>
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

function TicketDetailDialog({
  ticketId,
  onClose,
  getPriorityColor,
  getStatusColor,
}: {
  ticketId: string;
  onClose: () => void;
  getPriorityColor: (priority: string) => string;
  getStatusColor: (status: string) => string;
}) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [comment, setComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [newStatus, setNewStatus] = useState<string>('');
  const [newAssignee, setNewAssignee] = useState<string>('');

  const { data: ticket } = useTicketById(ticketId);
  const { data: chatStatus } = useTicketChatStatus(ticketId);
  const addComment = useAddTicketComment();
  const updateStatus = useUpdateTicketStatus();
  const assignTicket = useAssignTicket();
  const resolveTicket = useResolveTicket();
  const createChat = useCreateTicketChat();
  const activateChat = useActivateTicketChat();

  if (!ticket) {
    return (
      <Dialog open={true} onOpenChange={() => onClose()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-center py-8">
            <ShieldLoader size="lg" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const handleAddComment = async () => {
    if (!comment.trim() || !user?.id) return;
    try {
      await addComment.mutateAsync({
        ticketId,
        authorId: user.id,
        message: comment.trim(),
        isInternal,
      });
      setComment('');
      toast.success(t('support.commentAdded', 'Comment added'));
    } catch {
      toast.error(t('support.commentFailed', 'Failed to add comment'));
    }
  };

  const handleStatusChange = async () => {
    if (!newStatus || !user?.id) return;
    try {
      await updateStatus.mutateAsync({ ticketId, status: newStatus, userId: user.id });
      toast.success(t('support.statusUpdated', 'Status updated'));
      setNewStatus('');
    } catch {
      toast.error(t('support.statusUpdateFailed', 'Failed to update status'));
    }
  };

  const handleAssign = async () => {
    if (!newAssignee) return;
    try {
      await assignTicket.mutateAsync({ ticketId, assignedTo: newAssignee });
      toast.success(t('support.ticketAssigned', 'Ticket assigned'));
      setNewAssignee('');
    } catch {
      toast.error(t('support.assignFailed', 'Failed to assign ticket'));
    }
  };

  const handleResolve = async () => {
    if (!user?.id) return;
    try {
      await resolveTicket.mutateAsync({
        ticketId,
        resolution: comment.trim() || t('support.resolved', 'Resolved'),
        userId: user.id,
      });
      toast.success(t('support.ticketResolved', 'Ticket resolved'));
    } catch {
      toast.error(t('support.resolveFailed', 'Failed to resolve ticket'));
    }
  };

  const handleCreateChat = async () => {
    if (!user?.id) return;
    try {
      await createChat.mutateAsync({ ticketId, superadminId: user.id });
      toast.success(t('support.chatCreated', 'Support chat created'));
    } catch {
      toast.error(t('support.chatCreateFailed', 'Failed to create chat'));
    }
  };

  const handleActivateChat = async () => {
    if (!user?.id) return;
    try {
      await activateChat.mutateAsync({
        ticketId,
        superadminId: user.id,
        message: comment.trim() || t('support.chatActivated', 'Chat activated'),
      });
      toast.success(t('support.chatActivated', 'Chat activated'));
      setComment('');
    } catch {
      toast.error(t('support.chatActivateFailed', 'Failed to activate chat'));
    }
  };

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm">{ticket.ticketNumber}</span>
            <DialogTitle>{ticket.title}</DialogTitle>
          </div>
          <DialogDescription>{ticket.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Ticket Info */}
          <div className="flex flex-wrap gap-2">
            <Badge className={getStatusColor(ticket.status)}>{ticket.status}</Badge>
            <Badge className={getPriorityColor(ticket.priority)}>{ticket.priority}</Badge>
            {ticket.category && (
              <Badge variant="outline">{ticket.category}</Badge>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t('support.updateStatus', 'Update Status')}</Label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('support.selectStatus', 'Select status')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">{t('support.statusOpen', 'Open')}</SelectItem>
                    <SelectItem value="in_progress">{t('support.statusInProgress', 'In Progress')}</SelectItem>
                    <SelectItem value="waiting_customer">{t('support.statusWaiting', 'Waiting Customer')}</SelectItem>
                    <SelectItem value="resolved">{t('support.statusResolved', 'Resolved')}</SelectItem>
                    <SelectItem value="closed">{t('support.statusClosed', 'Closed')}</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleStatusChange} disabled={!newStatus} size="sm" className="w-full">
                  {t('support.update', 'Update')}
                </Button>
              </div>

              <div className="space-y-2">
                <Label>{t('support.assignTo', 'Assign To')}</Label>
                <Input
                  value={newAssignee}
                  onChange={(e) => setNewAssignee(e.target.value)}
                  placeholder={t('support.userId', 'User ID')}
                />
                <Button onClick={handleAssign} disabled={!newAssignee} size="sm" className="w-full">
                  {t('support.assign', 'Assign')}
                </Button>
              </div>
            </div>

            {/* Chat Actions */}
            {chatStatus && (
              <div className="space-y-2">
                <Label>{t('support.chatActions', 'Chat Actions')}</Label>
                <div className="flex gap-2">
                  {!chatStatus.hasChat ? (
                    <Button onClick={handleCreateChat} size="sm">
                      {t('support.createChat', 'Create Chat')}
                    </Button>
                  ) : !chatStatus.chatActivated ? (
                    <Button onClick={handleActivateChat} size="sm">
                      {t('support.activateChat', 'Activate Chat')}
                    </Button>
                  ) : (
                    <Badge className="bg-green-500/10 text-green-600">
                      {t('support.chatActive', 'Chat Active')}
                    </Badge>
                  )}
                  <Button onClick={handleResolve} variant="outline" size="sm">
                    {t('support.resolveTicket', 'Resolve Ticket')}
                  </Button>
                </div>
              </div>
            )}

            {/* Comment */}
            <div className="space-y-2">
              <Label>{t('support.addComment', 'Add Comment')}</Label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t('support.commentPlaceholder', 'Type your comment...')}
                rows={3}
              />
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="internal"
                  checked={isInternal}
                  onChange={(e) => setIsInternal(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="internal" className="text-sm">
                  {t('support.internalComment', 'Internal comment')}
                </Label>
              </div>
              <Button onClick={handleAddComment} disabled={!comment.trim()} size="sm" className="w-full">
                <MessageSquare className="w-4 h-4 mr-2" />
                {t('support.addComment', 'Add Comment')}
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.close', 'Close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
