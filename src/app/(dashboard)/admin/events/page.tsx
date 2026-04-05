/**
 * Company Events Management Page
 * Admin interface for managing company events and viewing conflicts
 */

'use client';

import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldLoader } from '@/components/ui/ShieldLoader';
import { Badge } from '@/components/ui/badge';
import {
  Calendar,
  Plus,
  AlertCircle,
  Users,
  CheckCircle,
  RefreshCw,
  Edit,
  Trash2,
} from 'lucide-react';
import { CreateEventModal } from '@/components/events/CreateEventModal';
import { LeaveConflictAlerts } from '@/components/events/LeaveConflictAlerts';
import { useAuthStore } from '@/store/useAuthStore';
import { useSelectedOrganization } from '@/hooks/useSelectedOrganization';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function CompanyEventsPage() {
  const { t } = useTranslation();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'events' | 'conflicts'>('events');

  // Get current user from auth store
  const { user: authUser } = useAuthStore();
  const selectedOrgId = useSelectedOrganization();

  // For superadmin, use selectedOrgId if available, otherwise use user's organizationId
  const isSuperadmin = authUser?.role === 'superadmin';
  const effectiveOrgId = isSuperadmin && selectedOrgId ? selectedOrgId : authUser?.organizationId;
  const userId = authUser?.id as Id<'users'> | undefined;

  const events = useQuery(
    api.events.getCompanyEvents,
    effectiveOrgId ? { organizationId: effectiveOrgId as any } : 'skip',
  );

  // Get pending leave requests for admin review
  const pendingLeaves = useQuery(
    api.leaves.getLeavesForOrganization,
    effectiveOrgId ? { organizationId: effectiveOrgId as any } : 'skip',
  );

  const updateEvent = useMutation(api.events.updateCompanyEvent);
  const deleteEvent = useMutation(api.events.deleteCompanyEvent);
  const checkConflicts = useMutation(api.events.checkLeaveConflictsManual);

  const isAdmin = authUser?.role === 'admin' || authUser?.role === 'superadmin';

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-3 text-red-500" />
          <h2 className="text-xl font-semibold">{t('common.accessDenied', 'Access Denied')}</h2>
          <p className="text-muted-foreground">
            {t('events.adminOnly', 'Only administrators can manage company events')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">{t('events.title', 'Company Events')}</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            {t('events.subtitle', 'Manage events and review leave conflicts')}
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto flex-col sm:flex-row">
          <Button
            variant="outline"
            onClick={async () => {
              // Check conflicts for all pending leaves
              let totalConflicts = 0;
              const pendingList = (pendingLeaves as any[]).filter((l) => l.status === 'pending');
              for (const leave of pendingList) {
                try {
                  const result = await checkConflicts({
                    leaveRequestId: leave._id,
                    userId: leave.userId,
                    startDate: new Date(leave.startDate).getTime(),
                    endDate: new Date(leave.endDate).getTime(),
                    organizationId: effectiveOrgId as any,
                  });
                  totalConflicts += result.conflictsFound;
                } catch (e: any) {
                  console.error('Conflict check failed:', e);
                }
              }

              if (totalConflicts > 0) {
                toast.success(
                  t(
                    'events.conflictsFound',
                    'Found {{count}} conflict(s)! Check Conflict Alerts tab.',
                    { count: totalConflicts },
                  ),
                  {
                    description: t('events.leavesChecked', '{{count}} leave requests checked', {
                      count: pendingList.length,
                    }),
                    duration: 5000,
                  },
                );
              } else {
                toast.info(t('events.noConflicts', 'No conflicts found'), {
                  description: t('events.allClear', 'All leave requests are clear'),
                  duration: 3000,
                });
              }
              setActiveTab('conflicts');
            }}
            className="gap-2 w-full sm:w-auto"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">
              {t('events.checkConflicts', 'Check Conflicts')}
            </span>
            <span className="sm:hidden">{t('events.checkConflictsShort', 'Conflicts')}</span>
          </Button>
          <Button onClick={() => setShowCreateModal(true)} className="w-full sm:w-auto">
            <Plus className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">{t('events.createEvent', 'Create Event')}</span>
            <span className="sm:hidden">{t('events.createEventShort', 'Create')}</span>
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab('events')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'events'
              ? 'border-b-2 border-blue-600 text-blue-400'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Calendar className="w-4 h-4 inline mr-2" />
          {t('events.eventsTab', 'Events')}
        </button>
        <button
          onClick={() => setActiveTab('conflicts')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'conflicts'
              ? 'border-b-2 border-blue-600 text-blue-400'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <AlertCircle className="w-4 h-4 inline mr-2" />
          {t('events.conflictAlertsTab', 'Conflict Alerts')}
          {pendingLeaves &&
            (pendingLeaves as any[]).filter((l) => l.status === 'pending').length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {(pendingLeaves as any[]).filter((l) => l.status === 'pending').length}
              </Badge>
            )}
        </button>
      </div>

      {/* Content */}
      {activeTab === 'events' ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('events.upcomingEvents', 'Upcoming Events')}</CardTitle>
          </CardHeader>
          <CardContent>
            {!events ? (
              <div className="flex items-center justify-center py-12">
                <ShieldLoader size="sm" variant="inline" />
              </div>
            ) : events.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>{t('events.noEvents', 'No events created yet')}</p>
                <Button variant="link" onClick={() => setShowCreateModal(true)}>
                  {t('events.createFirst', 'Create your first event')}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {events.map((event: any) => (
                  <div
                    key={event._id}
                    className="p-4 border rounded-lg hover:shadow-md transition-shadow"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="font-semibold text-base sm:text-lg truncate">
                            {event.name}
                          </h3>
                          <Badge
                            variant={
                              event.priority === 'high'
                                ? 'destructive'
                                : event.priority === 'medium'
                                  ? 'default'
                                  : 'secondary'
                            }
                            className="flex-shrink-0"
                          >
                            {(() => {
                              const priority = event.priority || 'medium';
                              const priorityText = t(`events.priority.${priority}` as any);
                              // Fallback if translation returns object
                              return typeof priorityText === 'string' ? priorityText : priority;
                            })()}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {event.description || t('events.noDescription', 'No description')}
                        </p>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-3 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4 flex-shrink-0" />
                            <span className="truncate">
                              {new Date(event.startDate).toLocaleDateString()} -{' '}
                              {new Date(event.endDate).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Users className="w-4 h-4 flex-shrink-0" />
                            <span className="truncate">{event.requiredDepartments.join(', ')}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 sm:self-start">
                        <Badge variant="outline" className="capitalize">
                          {String(t(`events.type.${event.eventType}`, event.eventType))}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedEvent(event);
                            setShowEditModal(true);
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={async () => {
                            if (
                              confirm(
                                t('events.confirmDelete', 'Delete event "{{name}}"?', {
                                  name: event.name,
                                }),
                              )
                            ) {
                              try {
                                await deleteEvent({
                                  eventId: event._id,
                                  userId: userId!,
                                });
                                toast.success(t('events.eventDeleted', 'Event deleted'));
                              } catch (error: any) {
                                toast.error(
                                  error.message ||
                                    t('events.deleteFailed', 'Failed to delete event'),
                                );
                              }
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <LeaveConflictAlerts organizationId={effectiveOrgId as any} userId={userId!} />
      )}

      {/* Create Event Modal */}
      <CreateEventModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        organizationId={effectiveOrgId as any}
        userId={userId!}
        onSuccess={() => {
          toast.success(t('events.eventCreated', 'Event created successfully'));
        }}
      />

      {/* Edit Event Modal */}
      <Dialog
        open={showEditModal}
        onOpenChange={(open) => {
          setShowEditModal(open);
          if (!open) setSelectedEvent(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('events.editEvent', 'Edit Event')}</DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4 p-6">
              <div>
                <Label>{t('events.eventName', 'Event Name')}</Label>
                <Input defaultValue={selectedEvent.name} id="edit-name" />
              </div>
              <div>
                <Label>{t('events.description', 'Description')}</Label>
                <Textarea
                  defaultValue={selectedEvent.description || ''}
                  id={t('admin.editDescription')}
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t('events.startDate', 'Start Date')}</Label>
                  <Input
                    type="date"
                    defaultValue={new Date(selectedEvent.startDate).toISOString().split('T')[0]}
                    id={t('admin.editStart')}
                  />
                </div>
                <div>
                  <Label>{t('events.endDate', 'End Date')}</Label>
                  <Input
                    type="date"
                    defaultValue={new Date(selectedEvent.endDate).toISOString().split('T')[0]}
                    id="edit-end"
                  />
                </div>
              </div>
              <div>
                <Label>{t('admin.editPriority', 'Priority')}</Label>
                <Select
                  defaultValue={selectedEvent.priority || 'medium'}
                  onValueChange={(value) => {
                    // Force re-render by updating state
                    setSelectedEvent({ ...selectedEvent, priority: value });
                  }}
                >
                  <SelectTrigger id={t('admin.editPriority')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">
                      {String(t('events.priority.high', 'High'))}
                    </SelectItem>
                    <SelectItem value="medium">
                      {String(t('events.priority.medium', 'Medium'))}
                    </SelectItem>
                    <SelectItem value="low">{String(t('events.priority.low', 'Low'))}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowEditModal(false)}>
                  {t('common.cancel', 'Cancel')}
                </Button>
                <Button
                  onClick={async () => {
                    try {
                      const priorityValue = (
                        document.getElementById('edit-priority') as HTMLSelectElement
                      ).value;
                      await updateEvent({
                        eventId: selectedEvent._id,
                        userId: userId!,
                        name: (document.getElementById('edit-name') as HTMLInputElement).value,
                        description: (
                          document.getElementById('edit-description') as HTMLTextAreaElement
                        ).value,
                        startDate: new Date(
                          (document.getElementById('edit-start') as HTMLInputElement).value,
                        ).getTime(),
                        endDate: new Date(
                          (document.getElementById('edit-end') as HTMLInputElement).value,
                        ).getTime(),
                        priority: priorityValue as 'high' | 'medium' | 'low',
                      });
                      setShowEditModal(false);
                      toast.success(t('events.eventUpdated', 'Event updated successfully'));
                    } catch (error: any) {
                      toast.error(
                        error.message || t('events.updateFailed', 'Failed to update event'),
                      );
                    }
                  }}
                >
                  {t('common.save', 'Save Changes')}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
