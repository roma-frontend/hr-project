'use client';

import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  Plus,
  Trash2,
  UsersRound,
  AlertTriangle,
  ShieldCheck,
  TrendingUp,
  ChevronDown,
} from 'lucide-react';
import { useQuery, useMutation } from '@/lib/convex-typed';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetBody,
  SheetFooter,
  SheetTitle,
} from '@/components/ui/sheet';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useSelectedOrganization } from '@/hooks/useSelectedOrganization';
import { useAuthStore } from '@/store/useAuthStore';
import { useShallow } from 'zustand/shallow';

type OrgId = Id<'organizations'>;
type UserId = Id<'users'>;

/** Zone → badge color class (tailwind-safe literals). */
const ZONE_STYLES: Record<string, string> = {
  star: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  high_potential: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
  core_performer: 'bg-teal-500/15 text-teal-600 dark:text-teal-400',
  growth: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  specialist: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
  under_review: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  needs_support: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
  risk: 'bg-red-500/15 text-red-600 dark:text-red-400',
};

const RISK_STYLES: Record<string, string> = {
  critical: 'bg-red-500/15 text-red-600 dark:text-red-400',
  high: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
  moderate: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  low: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
};

const READINESS_ORDER = [
  'ready_now',
  'ready_within_year',
  'ready_within_two_years',
  'development_needed',
] as const;

interface PositionRow {
  positionId: Id<'keyPositions'>;
  positionTitle: string;
  department: string | null;
  criticality: 'high' | 'medium' | 'low';
  vacancyRisk: 'high' | 'medium' | 'low';
  incumbent: { id: UserId; name: string } | null;
  bench: Array<{
    successorId: Id<'successors'>;
    employeeId: UserId;
    employeeName: string;
    readiness: string;
  }>;
  risk: { risk: string; coverage: number; readyNow: number; effective: number };
}

interface PlanRow {
  planId: Id<'developmentPlans'>;
  employeeId: UserId;
  title: string;
  description: string | null;
  courseId: Id<'courses'> | null;
  actions: Array<{ key: string; title: string; completed: boolean; dueDate?: number }>;
  status: string;
  dueDate: number | null;
}

export default function SuccessionClient() {
  const { t } = useTranslation();
  const user = useAuthStore(useShallow((s) => s.user));
  const selectedOrgId = useSelectedOrganization();
  const organizationId = (selectedOrgId ?? user?.organizationId ?? undefined) as OrgId | undefined;

  const [period, setPeriod] = useState('2026-H2');
  const [editingPosition, setEditingPosition] = useState<PositionRow | 'new' | null>(null);
  const [benchPosition, setBenchPosition] = useState<PositionRow | null>(null);
  const [planEmployee, setPlanEmployee] = useState<UserId | null>(null);

  const periods = useQuery(
    api.succession.listPeriods,
    organizationId ? { organizationId } : 'skip',
  );
  const nineBox = useQuery(
    api.succession.getNineBox,
    organizationId ? { organizationId, period } : 'skip',
  );
  const overview = useQuery(
    api.succession.getSuccessionOverview,
    organizationId ? { organizationId } : 'skip',
  );
  const plans = useQuery(
    api.succession.listDevelopmentPlans,
    organizationId ? { organizationId } : 'skip',
  );
  const employees = useQuery(
    api.users.queries.getUsersByOrganizationId,
    organizationId ? { organizationId, limit: 100 } : 'skip',
  );

  const upsertRating = useMutation(api.succession.upsertNineBoxRating);
  const deleteRating = useMutation(api.succession.deleteNineBoxRating);
  const removeSuccessor = useMutation(api.succession.removeSuccessor);
  const toggleAction = useMutation(api.succession.togglePlanAction);

  const perfLabels = useMemo(
    () => [t('succession.perf.low'), t('succession.perf.mid'), t('succession.perf.high')],
    [t],
  );
  const potLabels = useMemo(
    () => [t('succession.pot.low'), t('succession.pot.mid'), t('succession.pot.high')],
    [t],
  );

  if (!organizationId) {
    return (
      <div className="p-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-4 h-64 w-full rounded-2xl" />
      </div>
    );
  }

  /** 3 columns (potential) × 3 rows (performance, descending). */
  const gridCells = (perf: 1 | 2 | 3, pot: 1 | 2 | 3) =>
    (nineBox?.cells ?? []).filter((c) => c.performance === perf && c.potential === pot);

  const handleRate = async (employeeId: UserId, performance: 1 | 2 | 3, potential: 1 | 2 | 3) => {
    try {
      await upsertRating({ organizationId, employeeId, period, performance, potential });
      toast.success(t('succession.toasts.rated'));
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-(--text-primary)">{t('succession.title')}</h1>
          <p className="mt-1 text-sm text-(--text-muted)">{t('succession.subtitle')}</p>
        </div>
        <div className="w-44">
          <CustomSelect
            value={period}
            onChange={setPeriod}
            options={(periods ?? [period]).map((p) => ({ value: p, label: p }))}
          />
        </div>
      </div>

      {/* Risk summary band */}
      {overview?.summary ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {(['critical', 'high', 'moderate', 'low'] as const).map((level) => (
            <Card key={level} className="py-3">
              <CardContent className="flex items-center gap-3 px-4">
                {level === 'critical' ? (
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                ) : level === 'low' ? (
                  <ShieldCheck className="h-5 w-5 text-emerald-500" />
                ) : (
                  <TrendingUp className="h-5 w-5 text-amber-500" />
                )}
                <div>
                  <p className="text-xl font-bold text-(--text-primary)">
                    {overview.summary[level]}
                  </p>
                  <p className="text-xs text-(--text-muted)">{t(`succession.risk.${level}`)}</p>
                </div>
              </CardContent>
            </Card>
          ))}
          <Card className="py-3">
            <CardContent className="flex items-center gap-3 px-4">
              <UsersRound className="h-5 w-5 text-(--brand)" />
              <div>
                <p className="text-xl font-bold text-(--text-primary)">
                  {overview.summary.noSuccessors}
                </p>
                <p className="text-xs text-(--text-muted)">{t('succession.risk.noSuccessors')}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Tabs defaultValue="grid">
        <TabsList>
          <TabsTrigger value="grid">{t('succession.tabs.nineBox')}</TabsTrigger>
          <TabsTrigger value="positions">{t('succession.tabs.positions')}</TabsTrigger>
          <TabsTrigger value="plans">{t('succession.tabs.plans')}</TabsTrigger>
        </TabsList>

        {/* ── 9-Box grid ─────────────────────────────────────────────────── */}
        <TabsContent value="grid" className="mt-4 space-y-4">
          <div className="grid grid-cols-[auto_1fr_1fr_1fr] gap-2">
            {/* potential axis header */}
            <div />
            {potLabels.map((label) => (
              <div key={label} className="text-center text-xs font-semibold text-(--text-muted)">
                {label}
              </div>
            ))}
            {[3, 2, 1].map((perf) => (
              <React.Fragment key={perf}>
                <div className="flex items-center pr-2 text-right text-xs font-semibold text-(--text-muted)">
                  {perfLabels[perf - 1]}
                </div>
                {[1, 2, 3].map((pot) => {
                  const cells = gridCells(perf as 1 | 2 | 3, pot as 1 | 2 | 3);
                  const sample = cells[0];
                  return (
                    <div
                      key={`${perf}-${pot}`}
                      className="min-h-32 rounded-2xl border border-(--border) bg-(--background-subtle) p-3"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        {sample ? (
                          <Badge className={`${ZONE_STYLES[sample.zone] ?? ''} border-0`}>
                            {t(`succession.zones.${sample.labelKey}`)}
                          </Badge>
                        ) : (
                          <span className="text-[11px] text-(--text-muted)">
                            {t(
                              `succession.zones.${['risk', 'growth', 'star'][(pot - 1) * (4 - perf)] ?? 'growth'}`,
                              { defaultValue: '' },
                            )}
                          </span>
                        )}
                        <span className="text-[11px] text-(--text-muted)">{cells.length}</span>
                      </div>
                      <ul className="space-y-1">
                        {cells.map((c) => (
                          <li
                            key={c.ratingId}
                            className="group flex items-center justify-between rounded-lg px-2 py-1 text-xs hover:bg-(--background)"
                          >
                            <span className="truncate text-(--text-primary)">{c.employeeName}</span>
                            <button
                              type="button"
                              aria-label={t('common.delete')}
                              className="ml-2 opacity-0 transition group-hover:opacity-100"
                              onClick={async () => {
                                try {
                                  await deleteRating({ organizationId, ratingId: c.ratingId });
                                } catch (e) {
                                  toast.error(String((e as Error).message ?? e));
                                }
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-(--text-muted)" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>

          <RateEmployeeForm
            employees={employees ?? []}
            onRate={handleRate}
            perfLabels={perfLabels}
            potLabels={potLabels}
          />
        </TabsContent>

        {/* ── Key positions ──────────────────────────────────────────────── */}
        <TabsContent value="positions" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button onClick={() => setEditingPosition('new')} className="gap-2">
              <Plus className="h-4 w-4" />
              {t('succession.positions.add')}
            </Button>
          </div>

          {(overview?.positions ?? []).map((p) => (
            <Card key={p.positionId}>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">{p.positionTitle}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge className={`${RISK_STYLES[p.risk.risk] ?? ''} border-0`}>
                      {t(`succession.risk.${p.risk.risk}`)}
                    </Badge>
                    <span className="text-xs text-(--text-muted)">
                      {t('succession.coverage', { n: p.risk.coverage })}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-(--text-muted)">
                  {p.incumbent
                    ? t('succession.positions.incumbent', { name: p.incumbent.name })
                    : t('succession.positions.noIncumbent')}
                  {' · '}
                  {t('succession.positions.criticalityLabel')}{' '}
                  {t(`succession.levels.${p.criticality}`)}
                  {' · '}
                  {t('succession.positions.vacancyLabel')} {t(`succession.levels.${p.vacancyRisk}`)}
                </p>

                <div className="space-y-1.5">
                  {p.bench.length === 0 ? (
                    <p className="text-xs italic text-(--text-muted)">
                      {t('succession.positions.emptyBench')}
                    </p>
                  ) : (
                    p.bench.map((s) => (
                      <div
                        key={s.successorId}
                        className="flex items-center justify-between rounded-lg bg-(--background-subtle) px-3 py-1.5"
                      >
                        <span className="text-sm text-(--text-primary)">{s.employeeName}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-(--text-muted)">
                            {t(`succession.readiness.${s.readiness}`)}
                          </span>
                          <button
                            type="button"
                            aria-label={t('common.delete')}
                            onClick={async () => {
                              try {
                                await removeSuccessor({
                                  organizationId,
                                  successorRowId: s.successorId,
                                });
                              } catch (e) {
                                toast.error(String((e as Error).message ?? e));
                              }
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-(--text-muted)" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setBenchPosition(p)}>
                    {t('succession.positions.manageBench')}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditingPosition(p)}>
                    {t('common.edit')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ── Development plans ──────────────────────────────────────────── */}
        <TabsContent value="plans" className="mt-4 space-y-3">
          <PlanCreateForm
            organizationId={organizationId}
            employees={employees ?? []}
            onCreated={() => setPlanEmployee(null)}
          />
          {(plans ?? []).map((plan) => (
            <DevelopmentPlanCard
              key={plan.planId}
              plan={plan as PlanRow}
              organizationId={organizationId}
              onToggle={async (actionKey, completed) => {
                try {
                  await toggleAction({ organizationId, planId: plan.planId, actionKey, completed });
                } catch (e) {
                  toast.error(String((e as Error).message ?? e));
                }
              }}
            />
          ))}
        </TabsContent>
      </Tabs>

      {/* Position editor sheet */}
      {editingPosition ? (
        <PositionSheet
          organizationId={organizationId}
          employees={employees ?? []}
          position={editingPosition === 'new' ? null : editingPosition}
          onClose={() => setEditingPosition(null)}
        />
      ) : null}

      {/* Bench management sheet */}
      {benchPosition ? (
        <BenchSheet
          organizationId={organizationId}
          position={benchPosition}
          employees={employees ?? []}
          readinessOrder={READINESS_ORDER}
          onClose={() => setBenchPosition(null)}
        />
      ) : null}

      {planEmployee ? null : null}
      <span className="hidden">{ChevronDown.displayName}</span>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function RateEmployeeForm({
  employees,
  onRate,
  perfLabels,
  potLabels,
}: {
  employees: Array<{ _id: UserId; name: string }>;
  onRate: (employeeId: UserId, performance: 1 | 2 | 3, potential: 1 | 2 | 3) => void;
  perfLabels: string[];
  potLabels: string[];
}) {
  const { t } = useTranslation();
  const [employeeId, setEmployeeId] = useState('');
  const [performance, setPerformance] = useState('2');
  const [potential, setPotential] = useState('2');

  const options = employees.map((e) => ({ value: e._id, label: e.name }));

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-(--border) bg-(--background-subtle) p-4">
      <div className="min-w-48 flex-1">
        <label className="mb-1 block text-xs font-medium text-(--text-muted)">
          {t('succession.rate.employee')}
        </label>
        <CustomSelect
          value={employeeId}
          onChange={setEmployeeId}
          options={options}
          placeholder={t('succession.rate.pickEmployee')}
        />
      </div>
      <div className="w-40">
        <label className="mb-1 block text-xs font-medium text-(--text-muted)">
          {t('succession.rate.performance')}
        </label>
        <CustomSelect
          value={performance}
          onChange={setPerformance}
          options={perfLabels.map((label, i) => ({ value: String(i + 1), label }))}
        />
      </div>
      <div className="w-40">
        <label className="mb-1 block text-xs font-medium text-(--text-muted)">
          {t('succession.rate.potential')}
        </label>
        <CustomSelect
          value={potential}
          onChange={setPotential}
          options={potLabels.map((label, i) => ({ value: String(i + 1), label }))}
        />
      </div>
      <Button
        disabled={!employeeId}
        onClick={() =>
          onRate(
            employeeId as UserId,
            Number(performance) as 1 | 2 | 3,
            Number(potential) as 1 | 2 | 3,
          )
        }
      >
        {t('succession.rate.submit')}
      </Button>
    </div>
  );
}

function PositionSheet({
  organizationId,
  employees,
  position,
  onClose,
}: {
  organizationId: OrgId;
  employees: Array<{ _id: UserId; name: string }>;
  position: PositionRow | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const upsertPosition = useMutation(api.succession.upsertKeyPosition);
  const archivePosition = useMutation(api.succession.archiveKeyPosition);

  const [title, setTitle] = useState(position?.positionTitle ?? '');
  const [department, setDepartment] = useState(position?.department ?? '');
  const [criticality, setCriticality] = useState<string>(position?.criticality ?? 'medium');
  const [vacancyRisk, setVacancyRisk] = useState<string>(position?.vacancyRisk ?? 'medium');
  const [incumbentId, setIncumbentId] = useState(position?.incumbent?.id ?? '');
  const [saving, setSaving] = useState(false);

  const levelOptions = ['high', 'medium', 'low'].map((l) => ({
    value: l,
    label: t(`succession.levels.${l}`),
  }));

  const save = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await upsertPosition({
        organizationId,
        positionId: position?.positionId,
        positionTitle: title.trim(),
        department: department.trim() || undefined,
        criticality: criticality as 'high' | 'medium' | 'low',
        vacancyRisk: vacancyRisk as 'high' | 'medium' | 'low',
        incumbentId: (incumbentId || undefined) as UserId | undefined,
      });
      toast.success(t('succession.toasts.saved'));
      onClose();
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>
            {position ? t('succession.positions.edit') : t('succession.positions.add')}
          </SheetTitle>
        </SheetHeader>
        <SheetBody className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-(--text-muted)">
              {t('succession.positions.title')}
            </label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-(--text-muted)">
              {t('succession.positions.department')}
            </label>
            <Input value={department} onChange={(e) => setDepartment(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-(--text-muted)">
              {t('succession.positions.criticalityLabel')}
            </label>
            <CustomSelect value={criticality} onChange={setCriticality} options={levelOptions} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-(--text-muted)">
              {t('succession.positions.vacancyLabel')}
            </label>
            <CustomSelect value={vacancyRisk} onChange={setVacancyRisk} options={levelOptions} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-(--text-muted)">
              {t('succession.positions.incumbent')}
            </label>
            <CustomSelect
              value={incumbentId}
              onChange={setIncumbentId}
              options={employees.map((e) => ({ value: e._id, label: e.name }))}
              placeholder={t('succession.positions.pickIncumbent')}
            />
          </div>
          {position ? (
            <Button
              variant="ghost"
              className="text-red-500"
              onClick={async () => {
                try {
                  await archivePosition({ organizationId, positionId: position.positionId });
                  toast.success(t('succession.toasts.archived'));
                  onClose();
                } catch (e) {
                  toast.error(String((e as Error).message ?? e));
                }
              }}
            >
              {t('succession.positions.archive')}
            </Button>
          ) : null}
        </SheetBody>
        <SheetFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={save} disabled={saving || !title.trim()}>
            {t('common.save')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function BenchSheet({
  organizationId,
  position,
  employees,
  readinessOrder,
  onClose,
}: {
  organizationId: OrgId;
  position: PositionRow;
  employees: Array<{ _id: UserId; name: string }>;
  readinessOrder: readonly string[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const upsertSuccessor = useMutation(api.succession.upsertSuccessor);

  const [successorId, setSuccessorId] = useState('');
  const [readiness, setReadiness] = useState<string>('ready_within_year');
  const [saving, setSaving] = useState(false);

  const eligible = employees.filter((e) => e._id !== position.incumbent?.id);

  const add = async () => {
    if (!successorId) return;
    setSaving(true);
    try {
      await upsertSuccessor({
        organizationId,
        keyPositionId: position.positionId,
        successorId: successorId as UserId,
        readiness: readiness as (typeof READINESS_ORDER)[number] & string,
      });
      toast.success(t('succession.toasts.saved'));
      setSuccessorId('');
      onClose();
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>
            {t('succession.bench.title', { position: position.positionTitle })}
          </SheetTitle>
        </SheetHeader>
        <SheetBody className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-(--text-muted)">
              {t('succession.bench.successor')}
            </label>
            <CustomSelect
              value={successorId}
              onChange={setSuccessorId}
              options={eligible.map((e) => ({ value: e._id, label: e.name }))}
              placeholder={t('succession.rate.pickEmployee')}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-(--text-muted)">
              {t('succession.bench.readiness')}
            </label>
            <CustomSelect
              value={readiness}
              onChange={setReadiness}
              options={readinessOrder.map((r) => ({
                value: r,
                label: t(`succession.readiness.${r}`),
              }))}
            />
          </div>
        </SheetBody>
        <SheetFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={add} disabled={saving || !successorId}>
            {t('succession.bench.add')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function DevelopmentPlanCard({
  plan,
  organizationId: _organizationId,
  onToggle,
}: {
  plan: PlanRow;
  organizationId: OrgId;
  onToggle: (actionKey: string, completed: boolean) => void;
}) {
  const { t } = useTranslation();
  const completed = plan.actions.filter((a) => a.completed).length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">{plan.title}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{t(`succession.planStatus.${plan.status}`)}</Badge>
            <span className="text-xs text-(--text-muted)">
              {completed}/{plan.actions.length}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {plan.description ? (
          <p className="mb-3 text-sm text-(--text-muted)">{plan.description}</p>
        ) : null}
        <ul className="space-y-1.5">
          {plan.actions.map((a) => (
            <li key={a.key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={a.completed}
                onChange={(e) => onToggle(a.key, e.target.checked)}
                className="h-4 w-4"
                aria-label={a.title}
              />
              <span
                className={
                  a.completed ? 'text-(--text-muted) line-through' : 'text-(--text-primary)'
                }
              >
                {a.title}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function PlanCreateForm({
  organizationId,
  employees,
  onCreated,
}: {
  organizationId: OrgId;
  employees: Array<{ _id: UserId; name: string }>;
  onCreated: () => void;
}) {
  const { t } = useTranslation();
  const upsertPlan = useMutation(api.succession.upsertDevelopmentPlan);

  const [employeeId, setEmployeeId] = useState('');
  const [title, setTitle] = useState('');
  const [steps, setSteps] = useState('');
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!employeeId || !title.trim()) return;
    setSaving(true);
    try {
      const actions = steps
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line, i) => ({ key: `a${i + 1}`, title: line, completed: false }));
      await upsertPlan({
        organizationId,
        employeeId: employeeId as UserId,
        title: title.trim(),
        actions,
        status: 'active',
      });
      toast.success(t('succession.toasts.saved'));
      setTitle('');
      setSteps('');
      setEmployeeId('');
      onCreated();
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-(--border) bg-(--background-subtle) p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-(--text-muted)">
            {t('succession.rate.employee')}
          </label>
          <CustomSelect
            value={employeeId}
            onChange={setEmployeeId}
            options={employees.map((e) => ({ value: e._id, label: e.name }))}
            placeholder={t('succession.rate.pickEmployee')}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-(--text-muted)">
            {t('succession.plan.title')}
          </label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-(--text-muted)">
          {t('succession.plan.steps')}
        </label>
        <Textarea
          rows={3}
          value={steps}
          onChange={(e) => setSteps(e.target.value)}
          placeholder={t('succession.plan.stepsHint')}
        />
      </div>
      <div className="flex justify-end">
        <Button onClick={create} disabled={saving || !employeeId || !title.trim()}>
          {t('succession.plan.create')}
        </Button>
      </div>
    </div>
  );
}
