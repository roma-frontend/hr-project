'use client';

/**
 * ShiftsClient — weekly roster grid for shift-based teams.
 *
 * Layout: rows = employees (from the roster), columns = the 7 days of the
 * selected week, cells = shift chips (time range + note). Supervisors add/edit
 * shifts from templates or custom times and can apply a template to the whole
 * week; employees see only their own published shifts and can request a swap.
 */

import { useMemo, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import {
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/store/useAuthStore';

type RosterShift = {
  _id: string;
  userId: string;
  date: string;
  startMinute: number;
  endMinute: number;
  breakMinutes?: number;
  note?: string;
  status: 'draft' | 'published' | 'cancelled';
  userName: string;
  userPosition?: string;
  spanMinutes: number;
};

type SwapRequest = {
  _id: string;
  requesterId: string;
  targetUserId?: string;
  acceptedBy?: string;
  status: string;
  requesterName: string;
  targetName?: string | null;
  acceptedByName?: string | null;
};

type ShiftTemplate = {
  _id: string;
  name: string;
  startMinute: number;
  endMinute: number;
  breakMinutes?: number;
  color?: string;
};

function minutesToHHMM(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  const day = (copy.getDay() + 6) % 7; // Monday = 0
  copy.setDate(copy.getDate() - day);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export default function ShiftsClient() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [addOpen, setAddOpen] = useState(false);
  const [templateApplyOpen, setTemplateApplyOpen] = useState(false);
  const [editing, setEditing] = useState<RosterShift | null>(null);

  const weekDays = useMemo(() => {
    const days: { ds: string; weekday: string; dayNum: number; isToday: boolean }[] = [];
    const now = new Date();
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      days.push({
        ds: formatDate(d),
        weekday: d.toLocaleDateString(undefined, { weekday: 'short' }),
        dayNum: d.getDate(),
        isToday: formatDate(d) === formatDate(now),
      });
    }
    return days;
  }, [weekStart]);

  const from = weekDays[0]!.ds;
  const to = weekDays[6]!.ds;

  const roster = useQuery(api.shifts.getRoster, { from, to });
  const templates = useQuery(api.shifts.listTemplates, {}) ?? [];
  const swaps = useQuery(api.shifts.listSwapRequests, {}) ?? [];
  const canManage = roster?.canManage ?? false;

  const upsertShift = useMutation(api.shifts.upsertShift);
  const deleteShift = useMutation(api.shifts.deleteShift);
  const createTemplate = useMutation(api.shifts.createTemplate);
  const applyTemplateWeek = useMutation(api.shifts.applyTemplateWeek);
  const requestSwap = useMutation(api.shifts.requestSwap);
  const respondSwap = useMutation(api.shifts.respondSwap);
  const decideSwap = useMutation(api.shifts.decideSwap);

  const shiftsByUserDay = useMemo(() => {
    const map = new Map<string, RosterShift[]>();
    for (const s of (roster?.shifts ?? []) as RosterShift[]) {
      const key = `${s.userId}|${s.date}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return map;
  }, [roster]);

  // Row order: people with shifts this week, sorted by name; own row first.
  const rowUsers = useMemo(() => {
    const map = new Map<string, { name: string; position?: string }>();
    for (const s of (roster?.shifts ?? []) as RosterShift[]) {
      if (!map.has(s.userId)) map.set(s.userId, { name: s.userName, position: s.userPosition });
    }
    const rows = [...map.entries()].map(([userId, info]) => ({ userId, ...info }));
    rows.sort((a, b) => {
      if (a.userId === user?.id) return -1;
      if (b.userId === user?.id) return 1;
      return a.name.localeCompare(b.name);
    });
    return rows;
  }, [roster, user]);

  const pendingSwaps = (swaps as SwapRequest[]).filter(
    (s) => s.status === 'pending' || s.status === 'accepted',
  );

  const handleSaveShift = async (args: {
    userId: string;
    date: string;
    startTime: string;
    endTime: string;
    breakMinutes?: number;
    note?: string;
    templateId?: Id<'shiftTemplates'>;
  }) => {
    try {
      await upsertShift({
        shiftId: editing?._id as Id<'shifts'> | undefined,
        ...args,
        userId: args.userId as Id<'users'>,
      });
      toast.success(t('shifts.saved', 'Shift saved'));
      setAddOpen(false);
      setEditing(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save shift');
    }
  };

  const handleDelete = async (shiftId: string) => {
    try {
      await deleteShift({ shiftId: shiftId as Id<'shifts'> });
      toast.success(t('shifts.deleted', 'Shift removed'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to remove shift');
    }
  };

  const handleSwapRequest = async (shiftId: string) => {
    try {
      await requestSwap({ fromShiftId: shiftId as Id<'shifts'> });
      toast.success(t('shifts.swapRequested', 'Swap request sent'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to request swap');
    }
  };

  const handleRespondSwap = async (swapId: string, accept: boolean) => {
    try {
      await respondSwap({ swapId: swapId as Id<'shiftSwapRequests'>, accept });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to respond');
    }
  };

  const handleDecideSwap = async (swapId: string, approve: boolean) => {
    try {
      await decideSwap({ swapId: swapId as Id<'shiftSwapRequests'>, approve });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to decide');
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-(--text-primary) flex items-center gap-2">
            <CalendarClock className="w-6 h-6 text-(--brand-text)" />
            {t('nav.shifts', 'Shifts')}
          </h1>
          <p className="text-sm text-(--text-muted)">
            {t('shifts.subtitle', 'Plan and publish shift schedules for your team')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              const d = new Date(weekStart);
              d.setDate(d.getDate() - 7);
              setWeekStart(d);
            }}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekStart(startOfWeek(new Date()))}>
            {t('shifts.thisWeek', 'This week')}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              const d = new Date(weekStart);
              d.setDate(d.getDate() + 7);
              setWeekStart(d);
            }}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
          {canManage && (
            <>
              <Button
                size="sm"
                onClick={() => {
                  setEditing(null);
                  setAddOpen(true);
                }}
              >
                <Plus className="w-4 h-4 mr-1" />
                {t('shifts.addShift', 'Add shift')}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setTemplateApplyOpen(true)}>
                <Copy className="w-4 h-4 mr-1" />
                {t('shifts.applyTemplate', 'Apply template')}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Template creation (supervisors) */}
      {canManage && (
        <CreateTemplateInline
          onCreate={async (args) => {
            try {
              await createTemplate(args);
              toast.success(t('shifts.templateCreated', 'Template created'));
            } catch (e) {
              toast.error(e instanceof Error ? e.message : 'Failed to create template');
            }
          }}
          templates={templates as ShiftTemplate[]}
        />
      )}

      {/* Roster grid */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t('shifts.roster', 'Roster')} · {from} → {to}
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {roster === undefined ? (
            <div className="py-12 text-center text-(--text-muted)">
              {t('common.loading', 'Loading…')}
            </div>
          ) : rowUsers.length === 0 ? (
            <div className="py-12 text-center text-(--text-muted)">
              <CalendarClock className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>{t('shifts.empty', 'No shifts scheduled this week')}</p>
            </div>
          ) : (
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr>
                  <th className="w-44 text-left py-2 px-3 text-sm font-medium text-(--text-muted)">
                    {t('shifts.employee', 'Employee')}
                  </th>
                  {weekDays.map((d) => (
                    <th
                      key={d.ds}
                      className={`py-2 px-2 text-xs font-medium ${
                        d.isToday ? 'text-(--brand-text)' : 'text-(--text-muted)'
                      }`}
                    >
                      <div className="flex flex-col items-center">
                        <span>{d.weekday}</span>
                        <span
                          className={`text-sm font-bold ${d.isToday ? 'text-(--brand-text)' : 'text-(--text-primary)'}`}
                        >
                          {d.dayNum}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rowUsers.map((row) => (
                  <tr key={row.userId} className="border-t border-(--border)">
                    <td className="py-2 px-3">
                      <p className="text-sm font-medium text-(--text-primary)">{row.name}</p>
                      {row.position && (
                        <p className="text-xs text-(--text-muted)">{row.position}</p>
                      )}
                    </td>
                    {weekDays.map((d) => {
                      const cellShifts = shiftsByUserDay.get(`${row.userId}|${d.ds}`) ?? [];
                      return (
                        <td key={d.ds} className="py-1.5 px-1 align-top">
                          <div className="space-y-1">
                            {cellShifts.map((s) => (
                              <div
                                key={s._id}
                                className={`group relative rounded-lg px-2 py-1.5 text-xs border ${
                                  s.status === 'cancelled'
                                    ? 'opacity-40 border-(--border) text-(--text-muted) line-through'
                                    : s.status === 'draft'
                                      ? 'border-dashed border-(--border) bg-(--muted)'
                                      : 'border-(--brand-500-ch, 59 130 246) / 30 bg-(--primary)/5'
                                }`}
                              >
                                <span className="font-semibold text-(--text-primary) tabular-nums">
                                  {minutesToHHMM(s.startMinute)}–{minutesToHHMM(s.endMinute)}
                                </span>
                                {s.note && (
                                  <span className="block text-[10px] text-(--text-muted) truncate">
                                    {s.note}
                                  </span>
                                )}
                                {canManage && (
                                  <span className="absolute -top-1.5 -right-1.5 hidden group-hover:flex gap-0.5">
                                    <button
                                      type="button"
                                      className="w-5 h-5 rounded-full bg-(--card) border border-(--border) text-(--text-muted) hover:text-(--brand-text)"
                                      onClick={() => {
                                        setEditing(s);
                                        setAddOpen(true);
                                      }}
                                      aria-label={t('common.edit', 'Edit')}
                                    >
                                      <RefreshCw className="w-3 h-3 mx-auto" />
                                    </button>
                                    <button
                                      type="button"
                                      className="w-5 h-5 rounded-full bg-(--card) border border-(--border) text-(--text-muted) hover:text-(--danger-text)"
                                      onClick={() => void handleDelete(s._id)}
                                      aria-label={t('common.delete', 'Delete')}
                                    >
                                      <Trash2 className="w-3 h-3 mx-auto" />
                                    </button>
                                  </span>
                                )}
                                {!canManage &&
                                  s.userId === user?.id &&
                                  s.status === 'published' && (
                                    <button
                                      type="button"
                                      className="mt-1 text-[10px] text-(--brand-text) hover:underline"
                                      onClick={() => void handleSwapRequest(s._id)}
                                    >
                                      {t('shifts.requestSwap', 'Request swap')}
                                    </button>
                                  )}
                              </div>
                            ))}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Swap queue */}
      {pendingSwaps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('shifts.swapRequests', 'Swap requests')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingSwaps.map((s) => (
              <div
                key={s._id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-(--border) p-3"
              >
                <div className="text-sm">
                  <span className="font-medium text-(--text-primary)">{s.requesterName}</span>
                  {s.targetName && s.targetName !== s.requesterName && (
                    <span> → {s.targetName}</span>
                  )}
                  <Badge variant="secondary" className="ml-2 capitalize">
                    {s.status}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  {s.status === 'pending' && s.targetUserId === user?.id && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void handleRespondSwap(s._id, false)}
                      >
                        <X className="w-3.5 h-3.5 mr-1" />
                        {t('common.decline', 'Decline')}
                      </Button>
                      <Button size="sm" onClick={() => void handleRespondSwap(s._id, true)}>
                        <Check className="w-3.5 h-3.5 mr-1" />
                        {t('common.accept', 'Accept')}
                      </Button>
                    </>
                  )}
                  {s.status === 'accepted' && canManage && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void handleDecideSwap(s._id, false)}
                      >
                        <X className="w-3.5 h-3.5 mr-1" />
                        {t('common.reject', 'Reject')}
                      </Button>
                      <Button size="sm" onClick={() => void handleDecideSwap(s._id, true)}>
                        <Check className="w-3.5 h-3.5 mr-1" />
                        {t('common.approve', 'Approve')}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Add/Edit shift dialog */}
      <ShiftDialog
        open={addOpen}
        onOpenChange={(o) => {
          setAddOpen(o);
          if (!o) setEditing(null);
        }}
        editing={editing}
        users={rowUsers}
        templates={templates as ShiftTemplate[]}
        canManage={canManage}
        weekDays={weekDays}
        onSave={handleSaveShift}
      />

      {/* Apply template dialog */}
      <ApplyTemplateDialog
        open={templateApplyOpen}
        onOpenChange={setTemplateApplyOpen}
        templates={templates as ShiftTemplate[]}
        users={rowUsers}
        onApply={async (args) => {
          try {
            const res = await applyTemplateWeek({
              templateId: args.templateId as Id<'shiftTemplates'>,
              userId: args.userId as Id<'users'>,
              fromDate: args.fromDate,
              days: args.days,
              publish: true,
            });
            toast.success(
              t('shifts.templateApplied', '{{count}} shifts scheduled', { count: res.created }),
            );
            setTemplateApplyOpen(false);
          } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Failed to apply template');
          }
        }}
      />
    </div>
  );
}

// ── Shift add/edit dialog ────────────────────────────────────────────────────

function ShiftDialog({
  open,
  onOpenChange,
  editing,
  users,
  templates,
  canManage,
  weekDays,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: RosterShift | null;
  users: Array<{ userId: string; name: string }>;
  templates: ShiftTemplate[];
  canManage: boolean;
  weekDays: Array<{ ds: string; weekday: string; dayNum: number; isToday: boolean }>;
  onSave: (args: {
    userId: string;
    date: string;
    startTime: string;
    endTime: string;
    breakMinutes?: number;
    note?: string;
    templateId?: Id<'shiftTemplates'>;
  }) => Promise<void>;
}) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [userId, setUserId] = useState('');
  const [date, setDate] = useState(weekDays[0]?.ds ?? formatDate(new Date()));
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [breakMinutes, setBreakMinutes] = useState('0');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  // Sync the form when opened for editing.
  const [lastEditKey, setLastEditKey] = useState<string | null>(null);
  const editKey = editing?._id ?? (open ? 'new' : null);
  if (open && editKey !== lastEditKey) {
    setLastEditKey(editKey);
    setUserId(editing?.userId ?? user?.id ?? '');
    setDate(editing?.date ?? weekDays[0]?.ds ?? formatDate(new Date()));
    setStartTime(editing ? minutesToHHMM(editing.startMinute) : '09:00');
    setEndTime(editing ? minutesToHHMM(editing.endMinute) : '17:00');
    setBreakMinutes(String(editing?.breakMinutes ?? 0));
    setNote(editing?.note ?? '');
  }

  const pickTemplate = (templateId: string) => {
    const tpl = templates.find((x) => x._id === templateId);
    if (!tpl) return;
    setStartTime(minutesToHHMM(tpl.startMinute));
    setEndTime(minutesToHHMM(tpl.endMinute));
    if (tpl.breakMinutes !== undefined) setBreakMinutes(String(tpl.breakMinutes));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editing ? t('shifts.editShift', 'Edit shift') : t('shifts.addShift', 'Add shift')}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t('shifts.employee', 'Employee')}</Label>
            {editing || !canManage ? (
              <Input value={users.find((u) => u.userId === userId)?.name ?? ''} disabled />
            ) : (
              <select
                className="w-full h-10 rounded-lg border border-(--border) bg-(--card) px-3 text-sm"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
              >
                <option value="">{t('shifts.selectEmployee', 'Select employee')}</option>
                {users.map((u) => (
                  <option key={u.userId} value={u.userId}>
                    {u.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>{t('shifts.date', 'Date')}</Label>
            <select
              className="w-full h-10 rounded-lg border border-(--border) bg-(--card) px-3 text-sm"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            >
              {weekDays.map((d) => (
                <option key={d.ds} value={d.ds}>
                  {d.weekday}, {d.dayNum} ({d.ds})
                </option>
              ))}
            </select>
          </div>
          {templates.length > 0 && (
            <div className="space-y-1.5">
              <Label>{t('shifts.fromTemplate', 'From template')}</Label>
              <select
                className="w-full h-10 rounded-lg border border-(--border) bg-(--card) px-3 text-sm"
                defaultValue=""
                onChange={(e) => pickTemplate(e.target.value)}
              >
                <option value="">{t('shifts.customTimes', 'Custom times')}</option>
                {templates.map((tpl) => (
                  <option key={tpl._id} value={tpl._id}>
                    {tpl.name} ({minutesToHHMM(tpl.startMinute)}–{minutesToHHMM(tpl.endMinute)})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5">
              <Label>{t('shifts.start', 'Start')}</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('shifts.end', 'End')}</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('shifts.break', 'Break (min)')}</Label>
              <Input
                type="number"
                min={0}
                value={breakMinutes}
                onChange={(e) => setBreakMinutes(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t('shifts.note', 'Note')}</Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('shifts.notePlaceholder', 'Optional')}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            disabled={saving || !userId || !date}
            onClick={async () => {
              setSaving(true);
              try {
                await onSave({
                  userId,
                  date,
                  startTime,
                  endTime,
                  breakMinutes: Number(breakMinutes) || undefined,
                  note: note || undefined,
                });
              } finally {
                setSaving(false);
              }
            }}
          >
            {t('common.save', 'Save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Apply template dialog ────────────────────────────────────────────────────

function ApplyTemplateDialog({
  open,
  onOpenChange,
  templates,
  users,
  onApply,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  templates: ShiftTemplate[];
  users: Array<{ userId: string; name: string }>;
  onApply: (args: {
    templateId: string;
    userId: string;
    fromDate: string;
    days: number;
  }) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [templateId, setTemplateId] = useState('');
  const [userId, setUserId] = useState('');
  const [fromDate, setFromDate] = useState(formatDate(startOfWeek(new Date())));
  const [days, setDays] = useState(7);
  const [saving, setSaving] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('shifts.applyTemplate', 'Apply template')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t('shifts.template', 'Template')}</Label>
            <select
              className="w-full h-10 rounded-lg border border-(--border) bg-(--card) px-3 text-sm"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
            >
              <option value="">{t('shifts.selectTemplate', 'Select template')}</option>
              {templates.map((tpl) => (
                <option key={tpl._id} value={tpl._id}>
                  {tpl.name} ({minutesToHHMM(tpl.startMinute)}–{minutesToHHMM(tpl.endMinute)})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>{t('shifts.employee', 'Employee')}</Label>
            <select
              className="w-full h-10 rounded-lg border border-(--border) bg-(--card) px-3 text-sm"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            >
              <option value="">{t('shifts.selectEmployee', 'Select employee')}</option>
              {users.map((u) => (
                <option key={u.userId} value={u.userId}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>{t('shifts.fromDate', 'From')}</Label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('shifts.days', 'Days')}</Label>
              <Input
                type="number"
                min={1}
                max={31}
                value={days}
                onChange={(e) => setDays(Number(e.target.value) || 7)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            disabled={saving || !templateId || !userId}
            onClick={async () => {
              setSaving(true);
              try {
                await onApply({ templateId, userId, fromDate, days });
              } finally {
                setSaving(false);
              }
            }}
          >
            {t('common.apply', 'Apply')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Inline template creator ──────────────────────────────────────────────────

function CreateTemplateInline({
  onCreate,
  templates,
}: {
  onCreate: (args: {
    name: string;
    startTime: string;
    endTime: string;
    breakMinutes?: number;
  }) => Promise<void>;
  templates: ShiftTemplate[];
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('shifts.templates', 'Shift templates')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1.5">
            <Label>{t('shifts.templateName', 'Name')}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-40"
              placeholder={t('shifts.templateNamePlaceholder', 'e.g. Morning')}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('shifts.start', 'Start')}</Label>
            <Input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-28"
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('shifts.end', 'End')}</Label>
            <Input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-28"
            />
          </div>
          <Button
            disabled={!name.trim()}
            onClick={async () => {
              await onCreate({ name: name.trim(), startTime, endTime });
              setName('');
            }}
          >
            <Plus className="w-4 h-4 mr-1" />
            {t('shifts.createTemplate', 'Create')}
          </Button>
        </div>
        {templates.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {templates.map((tpl) => (
              <Badge key={tpl._id} variant="secondary" className="gap-1.5">
                {tpl.name}: {minutesToHHMM(tpl.startMinute)}–{minutesToHHMM(tpl.endMinute)}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
