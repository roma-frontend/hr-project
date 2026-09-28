'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from 'convex/react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Clock, Plus, Trash2, Mail, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';

interface ScheduledReportsSectionProps {
  organizationId: Id<'organizations'>;
}

export function ScheduledReportsSection({ organizationId }: ScheduledReportsSectionProps) {
  const { t } = useTranslation();
  const reports = useQuery(api.scheduledReports.listScheduledReports, { organizationId });
  const createReport = useMutation(api.scheduledReports.createScheduledReport);
  const toggleReport = useMutation(api.scheduledReports.toggleScheduledReport);
  const deleteReport = useMutation(api.scheduledReports.deleteScheduledReport);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [reportType, setReportType] = useState<
    'leaves_summary' | 'attendance_digest' | 'tasks_overview' | 'headcount_analytics'
  >('leaves_summary');
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [timeOfDayUTC, setTimeOfDayUTC] = useState('09:00');
  const [recipientInput, setRecipientInput] = useState('');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const handleAddRecipient = () => {
    const trimmed = recipientInput.trim().toLowerCase();
    if (trimmed && trimmed.includes('@') && !recipients.includes(trimmed)) {
      setRecipients([...recipients, trimmed]);
      setRecipientInput('');
    }
  };

  const handleRemoveRecipient = (email: string) => {
    setRecipients(recipients.filter((r) => r !== email));
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error(t('reports.nameRequired', 'Report name is required'));
      return;
    }
    if (recipients.length === 0) {
      toast.error(t('reports.recipientRequired', 'At least one recipient email is required'));
      return;
    }

    setSubmitting(true);
    try {
      await createReport({
        organizationId,
        name: name.trim(),
        reportType,
        frequency,
        dayOfWeek: frequency === 'weekly' ? dayOfWeek : undefined,
        timeOfDayUTC,
        recipients,
      });
      toast.success(t('reports.scheduleCreated', 'Scheduled report created successfully'));
      setDialogOpen(false);
      setName('');
      setRecipients([]);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create report schedule');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="mt-6 border">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            {t('reports.scheduledReports', 'Automated Scheduled Reports')}
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t(
              'reports.scheduledReportsDesc',
              'Receive email digests and metrics automatically via Resend',
            )}
          </p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-1" />
          {t('reports.newSchedule', 'New Schedule')}
        </Button>
      </CardHeader>
      <CardContent>
        {reports === undefined ? (
          <div className="py-6 text-center text-xs text-muted-foreground">Loading schedules...</div>
        ) : reports.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-sm border rounded-lg border-dashed">
            <Mail className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p>{t('reports.noScheduledReports', 'No automated reports scheduled yet.')}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {t(
                'reports.createFirstSchedule',
                'Configure a recurring report to keep managers and executives in the loop.',
              )}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((rep) => (
              <div
                key={rep._id}
                className="flex items-center justify-between p-3.5 rounded-lg border bg-card hover:shadow-xs transition-shadow"
              >
                <div className="min-w-0 pr-4">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-foreground truncate">{rep.name}</span>
                    <Badge variant="outline" className="text-[11px] capitalize">
                      {rep.frequency}
                    </Badge>
                    {rep.lastStatus === 'success' && (
                      <span className="flex items-center text-[11px] text-green-600 gap-0.5">
                        <CheckCircle2 className="w-3 h-3" /> {t('common.active', 'Delivered')}
                      </span>
                    )}
                    {rep.lastStatus === 'error' && (
                      <span className="flex items-center text-[11px] text-destructive gap-0.5">
                        <AlertCircle className="w-3 h-3" /> {t('common.error', 'Failed')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                    <span>{t(`reports.types.${rep.reportType}`, rep.reportType)}</span>
                    <span>•</span>
                    <span>
                      {rep.recipients.length} {t('reports.recipientsCount', 'recipient(s)')}
                    </span>
                    <span>•</span>
                    <span>Time: {rep.timeOfDayUTC} UTC</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <Switch
                    checked={rep.isEnabled}
                    onCheckedChange={(checked) =>
                      toggleReport({ reportId: rep._id, isEnabled: checked })
                    }
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteReport({ reportId: rep._id })}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Dialog Create */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {t('reports.createReportSchedule', 'Create Scheduled Report')}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">
                  {t('reports.reportName', 'Report Name')}
                </label>
                <Input
                  placeholder="e.g. Weekly Leaves & Attendance Digest"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">{t('reports.type', 'Report Type')}</label>
                  <Select value={reportType} onValueChange={(val: any) => setReportType(val)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="leaves_summary">
                        {t('reports.types.leaves_summary', 'Leaves Summary')}
                      </SelectItem>
                      <SelectItem value="headcount_analytics">
                        {t('reports.types.headcount_analytics', 'Headcount Analytics')}
                      </SelectItem>
                      <SelectItem value="attendance_digest">
                        {t('reports.types.attendance_digest', 'Attendance Digest')}
                      </SelectItem>
                      <SelectItem value="tasks_overview">
                        {t('reports.types.tasks_overview', 'Tasks Overview')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium">
                    {t('reports.frequency', 'Frequency')}
                  </label>
                  <Select value={frequency} onValueChange={(val: any) => setFrequency(val)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">
                        {t('reports.frequencies.daily', 'Daily')}
                      </SelectItem>
                      <SelectItem value="weekly">
                        {t('reports.frequencies.weekly', 'Weekly')}
                      </SelectItem>
                      <SelectItem value="monthly">
                        {t('reports.frequencies.monthly', 'Monthly')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {frequency === 'weekly' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">
                    {t('reports.dayOfWeek', 'Day of Week')}
                  </label>
                  <Select
                    value={String(dayOfWeek)}
                    onValueChange={(v) => setDayOfWeek(parseInt(v, 10))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Monday</SelectItem>
                      <SelectItem value="2">Tuesday</SelectItem>
                      <SelectItem value="3">Wednesday</SelectItem>
                      <SelectItem value="4">Thursday</SelectItem>
                      <SelectItem value="5">Friday</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-medium">
                  {t('reports.timeUTC', 'Delivery Time (UTC)')}
                </label>
                <Input
                  type="time"
                  value={timeOfDayUTC}
                  onChange={(e) => setTimeOfDayUTC(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium">
                  {t('reports.recipients', 'Recipients (Email)')}
                </label>
                <div className="flex gap-2">
                  <Input
                    placeholder="manager@company.com"
                    value={recipientInput}
                    onChange={(e) => setRecipientInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddRecipient();
                      }
                    }}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={handleAddRecipient}>
                    Add
                  </Button>
                </div>
                {recipients.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {recipients.map((em) => (
                      <Badge key={em} variant="secondary" className="gap-1 pr-1 text-xs">
                        {em}
                        <button
                          type="button"
                          className="hover:text-destructive cursor-pointer"
                          onClick={() => handleRemoveRecipient(em)}
                        >
                          ×
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button disabled={submitting} onClick={handleCreate}>
                {submitting ? t('common.saving', 'Saving...') : t('common.create', 'Create')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
