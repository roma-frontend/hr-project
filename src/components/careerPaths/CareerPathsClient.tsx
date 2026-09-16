'use client';

import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Plus, Trash2, TrendingUp, GraduationCap, UsersRound } from 'lucide-react';
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
import { Skeleton } from '@/components/ui/skeleton';
import { useSelectedOrganization } from '@/hooks/useSelectedOrganization';
import { useAuthStore } from '@/store/useAuthStore';
import { useShallow } from 'zustand/shallow';

type OrgId = Id<'organizations'>;
type UserId = Id<'users'>;

const LEVELS = [1, 2, 3, 4, 5] as const;
const STEP_LEVELS = ['junior', 'mid', 'senior', 'lead'] as const;

interface MatrixRow {
  requirementId: Id<'skillRequirements'>;
  skillId: Id<'skills'>;
  skillName: string;
  category: string | null;
  requiredLevel: 1 | 2 | 3 | 4 | 5;
  isMandatory: boolean;
}

interface EmployeeSkillRow {
  skillId: Id<'skills'>;
  skillName: string;
  category: string | null;
  level: 0 | 1 | 2 | 3 | 4 | 5;
  notes: string | null;
}

interface TrackRow {
  trackId: Id<'careerTracks'>;
  name: string;
  description: string | null;
  department: string | null;
  steps: Array<{
    key: string;
    positionTitle: string;
    level: (typeof STEP_LEVELS)[number];
    minMonthsInStep?: number;
  }>;
}

interface ProgressRow {
  progressId: Id<'trackProgress'>;
  trackId: Id<'careerTracks'>;
  trackName: string;
  steps: TrackRow['steps'];
  currentStepKey: string;
  targetStepKey: string;
  status: 'on_track' | 'at_risk' | 'blocked';
  eligibleAt: number | null;
  notes: string | null;
}

interface GapRow {
  employeeId: UserId;
  positionTitle: string;
  readiness: number;
  readinessKey: string;
  gaps: Array<{
    skillId: Id<'skills'>;
    skillName: string;
    requiredLevel: number;
    currentLevel: number;
    gap: number;
    isMandatory: boolean;
  }>;
  mandatoryGapsCount: number;
  totalGapLevels: number;
  computedAt?: number;
}

interface MentorshipRow {
  mentorshipId: Id<'mentorships'>;
  mentor: { id: UserId; name: string };
  mentee: { id: UserId; name: string };
  focus: string | null;
  status: 'active' | 'completed' | 'cancelled';
  startedAt: number;
  endedAt: number | null;
}

const STATUS_STYLES: Record<string, string> = {
  on_track: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  at_risk: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  blocked: 'bg-red-500/15 text-red-600 dark:text-red-400',
  active: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
  completed: 'bg-teal-500/15 text-teal-600 dark:text-teal-400',
  cancelled: 'bg-neutral-500/15 text-neutral-500',
};

function gapColor(gap: number, mandatory: boolean): string {
  if (gap <= 0) return 'bg-emerald-500';
  if (mandatory) return 'bg-red-500';
  return 'bg-amber-400';
}

export default function CareerPathsClient() {
  const { t } = useTranslation();
  const user = useAuthStore(useShallow((s) => s.user));
  const selectedOrgId = useSelectedOrganization();
  const organizationId = (selectedOrgId ?? user?.organizationId ?? undefined) as OrgId | undefined;

  const [positionTitle, setPositionTitle] = useState('');
  const [employeeId, setEmployeeId] = useState('');

  const employees = useQuery(
    api.users.queries.getUsersByOrganizationId,
    organizationId ? { organizationId, limit: 100 } : 'skip',
  );
  const skills = useQuery(api.careerPaths.listSkills, organizationId ? { organizationId } : 'skip');
  const matrix = useQuery(
    api.careerPaths.getPositionMatrix,
    organizationId && positionTitle.trim()
      ? { organizationId, positionTitle: positionTitle.trim() }
      : 'skip',
  );
  const selfId = user?.id as UserId | undefined;
  const employeeSkills = useQuery(
    api.careerPaths.getEmployeeSkills,
    organizationId ? { organizationId, employeeId: (employeeId || selfId) as UserId } : 'skip',
  );
  const tracks = useQuery(api.careerPaths.listTracks, organizationId ? { organizationId } : 'skip');
  const progress = useQuery(
    api.careerPaths.getMyTrackProgress,
    organizationId
      ? { organizationId, employeeId: (employeeId || undefined) as UserId | undefined }
      : 'skip',
  );
  const gapAnalysis = useQuery(
    api.careerPaths.getGapAnalysis,
    organizationId && positionTitle.trim()
      ? {
          organizationId,
          employeeId: (employeeId || selfId) as UserId,
          positionTitle: positionTitle.trim(),
        }
      : 'skip',
  );
  const mentorships = useQuery(
    api.careerPaths.listMentorships,
    organizationId ? { organizationId } : 'skip',
  );

  const upsertSkill = useMutation(api.careerPaths.upsertSkill);
  const _deleteSkill = useMutation(api.careerPaths.deleteSkill);
  const setRequirement = useMutation(api.careerPaths.setSkillRequirement);
  const deleteRequirement = useMutation(api.careerPaths.deleteSkillRequirement);
  const setEmployeeSkill = useMutation(api.careerPaths.setEmployeeSkill);
  const upsertTrack = useMutation(api.careerPaths.upsertTrack);
  const upsertProgress = useMutation(api.careerPaths.upsertTrackProgress);
  const recomputeGap = useMutation(api.careerPaths.recomputeGapAnalysis);
  const upsertMentorship = useMutation(api.careerPaths.upsertMentorship);
  const endMentorship = useMutation(api.careerPaths.endMentorship);

  const employeeOptions = useMemo(
    () => (employees ?? []).map((e) => ({ value: e._id, label: e.name })),
    [employees],
  );
  const skillOptions = useMemo(
    () => (skills ?? []).map((s) => ({ value: s._id, label: s.name })),
    [skills],
  );

  if (!organizationId) {
    return (
      <div className="p-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-4 h-64 w-full rounded-2xl" />
      </div>
    );
  }

  const errText = (e: unknown) => String((e as Error).message ?? e);

  const gaps = (gapAnalysis?.gaps ?? []) as unknown as GapRow['gaps'];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-(--text-primary)">{t('careerPaths.title')}</h1>
        <p className="mt-1 text-sm text-(--text-muted)">{t('careerPaths.subtitle')}</p>
      </div>

      <Tabs defaultValue="matrix">
        <TabsList>
          <TabsTrigger value="matrix">{t('careerPaths.tabs.matrix')}</TabsTrigger>
          <TabsTrigger value="tracks">{t('careerPaths.tabs.tracks')}</TabsTrigger>
          <TabsTrigger value="progress">{t('careerPaths.tabs.progress')}</TabsTrigger>
          <TabsTrigger value="gaps">{t('careerPaths.tabs.gaps')}</TabsTrigger>
          <TabsTrigger value="mentorship">{t('careerPaths.tabs.mentorship')}</TabsTrigger>
        </TabsList>

        {/* ── Skill matrix ───────────────────────────────────────────────── */}
        <TabsContent value="matrix" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-(--border) bg-(--background-subtle) p-4">
            <div className="min-w-56 flex-1">
              <label className="mb-1 block text-xs font-medium text-(--text-muted)">
                {t('careerPaths.matrix.position')}
              </label>
              <Input
                value={positionTitle}
                onChange={(e) => setPositionTitle(e.target.value)}
                placeholder={t('careerPaths.matrix.positionHint')}
              />
            </div>
            <div className="min-w-56 flex-1">
              <label className="mb-1 block text-xs font-medium text-(--text-muted)">
                {t('careerPaths.matrix.employee')}
              </label>
              <CustomSelect
                value={employeeId}
                onChange={setEmployeeId}
                options={employeeOptions}
                placeholder={t('careerPaths.matrix.allEmployees')}
              />
            </div>
            <SkillCreateButton
              onCreate={async (name, category) => {
                try {
                  await upsertSkill({ organizationId, name, category: category || undefined });
                  toast.success(t('common.saved'));
                } catch (e) {
                  toast.error(errText(e));
                }
              }}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Required vs actual for the typed position */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {positionTitle.trim()
                    ? t('careerPaths.matrix.forPosition', { position: positionTitle.trim() })
                    : t('careerPaths.matrix.typePosition')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(matrix?.requirements ?? []).length === 0 && positionTitle.trim() ? (
                  <p className="text-sm italic text-(--text-muted)">
                    {t('careerPaths.matrix.noRequirements')}
                  </p>
                ) : null}
                {(matrix?.requirements ?? []).map((req: MatrixRow) => (
                  <div key={req.requirementId} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-(--text-primary)">
                        {req.skillName}
                        {req.isMandatory ? (
                          <span
                            className="ml-1 text-red-500"
                            title={t('careerPaths.matrix.mandatory')}
                          >
                            *
                          </span>
                        ) : null}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-(--text-muted)">
                          {t('careerPaths.matrix.required')}: {req.requiredLevel}/5
                        </span>
                        <button
                          type="button"
                          aria-label={t('common.delete')}
                          onClick={async () => {
                            try {
                              await deleteRequirement({
                                organizationId,
                                requirementId: req.requirementId,
                              });
                            } catch (e) {
                              toast.error(errText(e));
                            }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-(--text-muted)" />
                        </button>
                      </div>
                    </div>
                    {/* Required vs actual bar */}
                    <div className="flex gap-1">
                      {LEVELS.map((lvl) => {
                        const actual = gaps.find((g) => g.skillId === req.skillId)?.currentLevel;
                        return (
                          <button
                            key={lvl}
                            type="button"
                            title={t('careerPaths.matrix.setLevel', { level: lvl })}
                            className={`h-2 flex-1 rounded-full ${
                              lvl <= req.requiredLevel
                                ? 'bg-(--brand)'
                                : lvl <= (actual ?? 0)
                                  ? 'bg-emerald-400'
                                  : 'bg-(--border)'
                            }`}
                            onClick={async () => {
                              if (!positionTitle.trim()) return;
                              try {
                                await setRequirement({
                                  organizationId,
                                  positionTitle: positionTitle.trim(),
                                  skillId: req.skillId,
                                  requiredLevel: lvl,
                                  isMandatory: req.isMandatory,
                                });
                              } catch (e) {
                                toast.error(errText(e));
                              }
                            }}
                          >
                            <span className="sr-only">{lvl}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {positionTitle.trim() && skillOptions.length > 0 ? (
                  <AddRequirementForm
                    skillOptions={skillOptions}
                    positionTitle={positionTitle.trim()}
                    onAdd={async (skillId, requiredLevel, isMandatory) => {
                      try {
                        await setRequirement({
                          organizationId,
                          positionTitle: positionTitle.trim(),
                          skillId: skillId as Id<'skills'>,
                          requiredLevel: requiredLevel as 1 | 2 | 3 | 4 | 5,
                          isMandatory,
                        });
                        toast.success(t('common.saved'));
                      } catch (e) {
                        toast.error(errText(e));
                      }
                    }}
                  />
                ) : null}
              </CardContent>
            </Card>

            {/* Employee observed skills */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <GraduationCap className="h-4 w-4 text-(--brand)" />
                  {employeeId
                    ? t('careerPaths.matrix.employeeSkillsFor', {
                        name: employeeOptions.find((o) => o.value === employeeId)?.label ?? '',
                      })
                    : t('careerPaths.matrix.mySkills')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(employeeSkills?.skills ?? []).length === 0 ? (
                  <p className="text-sm italic text-(--text-muted)">
                    {t('careerPaths.matrix.noSkillsAssessed')}
                  </p>
                ) : null}
                {(employeeSkills?.skills ?? []).map((s: EmployeeSkillRow) => (
                  <div key={s.skillId} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-(--text-primary)">{s.skillName}</span>
                      <span className="text-xs text-(--text-muted)">{s.level}/5</span>
                    </div>
                    <div className="flex gap-1">
                      {([0, 1, 2, 3, 4, 5] as const).map((lvl) => (
                        <button
                          key={lvl}
                          type="button"
                          title={t('careerPaths.matrix.setLevel', { level: lvl })}
                          className={`h-2 flex-1 rounded-full ${
                            lvl <= s.level ? gapColor(s.level - lvl, false) : 'bg-(--border)'
                          } ${lvl === s.level ? 'ring-1 ring-(--brand)' : ''}`}
                          onClick={async () => {
                            try {
                              await setEmployeeSkill({
                                organizationId,
                                employeeId: (employeeId || selfId) as UserId,
                                skillId: s.skillId,
                                level: lvl,
                              });
                            } catch (e) {
                              toast.error(errText(e));
                            }
                          }}
                        >
                          <span className="sr-only">{lvl}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Tracks ─────────────────────────────────────────────────────── */}
        <TabsContent value="tracks" className="mt-4 space-y-3">
          <TrackCreateForm
            onCreate={async (name, department, steps) => {
              try {
                await upsertTrack({
                  organizationId,
                  name,
                  department: department || undefined,
                  steps,
                });
                toast.success(t('common.saved'));
              } catch (e) {
                toast.error(errText(e));
              }
            }}
          />
          {(tracks ?? []).map((tr: TrackRow) => (
            <Card key={tr.trackId}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{tr.name}</CardTitle>
              </CardHeader>
              <CardContent>
                {tr.description ? (
                  <p className="mb-3 text-sm text-(--text-muted)">{tr.description}</p>
                ) : null}
                <ol className="flex flex-wrap items-center gap-2">
                  {tr.steps.map((step, i) => (
                    <li key={step.key} className="flex items-center gap-2">
                      <span className="rounded-full bg-(--background-subtle) px-3 py-1 text-xs text-(--text-primary)">
                        {step.positionTitle} · {t(`careerPaths.levels.${step.level}`)}
                        {step.minMonthsInStep
                          ? ` · ${t('careerPaths.tracks.months', { n: step.minMonthsInStep })}`
                          : ''}
                      </span>
                      {i < tr.steps.length - 1 ? (
                        <TrendingUp className="h-3.5 w-3.5 text-(--text-muted)" />
                      ) : null}
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ── Progress ───────────────────────────────────────────────────── */}
        <TabsContent value="progress" className="mt-4 space-y-3">
          <div className="max-w-sm">
            <CustomSelect
              value={employeeId}
              onChange={setEmployeeId}
              options={employeeOptions}
              placeholder={t('careerPaths.progress.pickEmployee')}
            />
          </div>
          {(progress ?? []).length === 0 ? (
            <p className="text-sm italic text-(--text-muted)">{t('careerPaths.progress.empty')}</p>
          ) : null}
          {(progress ?? []).map((p: ProgressRow) => (
            <Card key={p.progressId}>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">{p.trackName}</CardTitle>
                  <Badge className={`${STATUS_STYLES[p.status] ?? ''} border-0`}>
                    {t(`careerPaths.progressStatus.${p.status}`)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  {p.steps.map((step) => {
                    const isCurrent = step.key === p.currentStepKey;
                    const isTarget = step.key === p.targetStepKey;
                    const isPast =
                      p.steps.findIndex((s) => s.key === step.key) <
                      p.steps.findIndex((s) => s.key === p.currentStepKey);
                    return (
                      <span
                        key={step.key}
                        className={`rounded-full px-3 py-1 text-xs ${
                          isCurrent
                            ? 'bg-(--brand) text-white'
                            : isPast
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                              : 'bg-(--background-subtle) text-(--text-muted)'
                        }`}
                      >
                        {step.positionTitle}
                        {isTarget ? ` ★` : ''}
                      </span>
                    );
                  })}
                </div>
                {p.eligibleAt ? (
                  <p className="text-xs text-(--text-muted)">
                    {t('careerPaths.progress.eligible', {
                      date: new Date(p.eligibleAt).toLocaleDateString(),
                    })}
                  </p>
                ) : null}
                <ProgressEditor
                  steps={p.steps}
                  currentStepKey={p.currentStepKey}
                  targetStepKey={p.targetStepKey}
                  onSave={async (currentStepKey: string, targetStepKey: string) => {
                    try {
                      await upsertProgress({
                        organizationId,
                        employeeId: (employeeId || selfId) as UserId,
                        trackId: p.trackId,
                        currentStepKey,
                        targetStepKey,
                      });
                      toast.success(t('common.saved'));
                    } catch (e) {
                      toast.error(errText(e));
                    }
                  }}
                />
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ── Gap analysis ───────────────────────────────────────────────── */}
        <TabsContent value="gaps" className="mt-4 space-y-3">
          <p className="text-sm text-(--text-muted)">{t('careerPaths.gaps.explain')}</p>
          {!positionTitle.trim() || !(gapAnalysis as { gapId?: unknown } | null)?.gapId ? (
            <p className="text-sm italic text-(--text-muted)">
              {t('careerPaths.gaps.typePositionAndEmployee')}
            </p>
          ) : (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">
                    {t('careerPaths.gaps.vsPosition', { position: positionTitle.trim() })}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge
                      className={`${
                        gapAnalysis && gapAnalysis.mandatoryGapsCount > 0
                          ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                          : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                      } border-0`}
                    >
                      {t('careerPaths.gaps.mandatoryGaps', {
                        n: gapAnalysis?.mandatoryGapsCount ?? 0,
                      })}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        try {
                          await recomputeGap({
                            organizationId,
                            employeeId: (employeeId || selfId) as UserId,
                            positionTitle: positionTitle.trim(),
                          });
                          toast.success(t('common.saved'));
                        } catch (e) {
                          toast.error(errText(e));
                        }
                      }}
                    >
                      {t('careerPaths.gaps.recompute')}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {gaps.map((g) => (
                  <div key={g.skillId} className="flex items-center justify-between text-sm">
                    <span className="text-(--text-primary)">
                      {g.skillName}
                      {g.isMandatory ? <span className="ml-1 text-red-500">*</span> : null}
                    </span>
                    <span className="text-xs text-(--text-muted)">
                      {t('careerPaths.gaps.row', {
                        current: g.currentLevel,
                        required: g.requiredLevel,
                        gap: g.gap,
                      })}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Mentorship ─────────────────────────────────────────────────── */}
        <TabsContent value="mentorship" className="mt-4 space-y-3">
          <MentorshipForm
            employeeOptions={employeeOptions}
            trackOptions={(tracks ?? []).map((tr: TrackRow) => ({
              value: tr.trackId,
              label: tr.name,
            }))}
            onCreate={async (mentorId, menteeId, focus, trackId) => {
              try {
                await upsertMentorship({
                  organizationId,
                  mentorId: mentorId as UserId,
                  menteeId: menteeId as UserId,
                  focus: focus || undefined,
                  trackId: (trackId || undefined) as Id<'careerTracks'> | undefined,
                });
                toast.success(t('common.saved'));
              } catch (e) {
                toast.error(errText(e));
              }
            }}
          />
          {(mentorships ?? []).length === 0 ? (
            <p className="text-sm italic text-(--text-muted)">
              {t('careerPaths.mentorship.empty')}
            </p>
          ) : null}
          {(mentorships ?? []).map((m: MentorshipRow) => (
            <Card key={m.mentorshipId}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div className="flex items-center gap-2 text-sm">
                  <UsersRound className="h-4 w-4 text-(--brand)" />
                  <span className="text-(--text-primary)">
                    {m.mentor.name} → {m.mentee.name}
                  </span>
                  {m.focus ? (
                    <span className="text-xs text-(--text-muted)">· {m.focus}</span>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={`${STATUS_STYLES[m.status] ?? ''} border-0`}>
                    {t(`careerPaths.mentorshipStatus.${m.status}`)}
                  </Badge>
                  {m.status === 'active' ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        try {
                          await endMentorship({
                            organizationId,
                            mentorshipId: m.mentorshipId,
                            status: 'completed',
                          });
                          toast.success(t('common.saved'));
                        } catch (e) {
                          toast.error(errText(e));
                        }
                      }}
                    >
                      {t('careerPaths.mentorship.complete')}
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function SkillCreateButton({ onCreate }: { onCreate: (name: string, category: string) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="gap-2">
        <Plus className="h-4 w-4" />
        {t('careerPaths.matrix.newSkill')}
      </Button>
      {open ? (
        <Sheet open onOpenChange={(o) => !o && setOpen(false)}>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>{t('careerPaths.matrix.newSkill')}</SheetTitle>
            </SheetHeader>
            <SheetBody className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-(--text-muted)">
                  {t('careerPaths.matrix.skillName')}
                </label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-(--text-muted)">
                  {t('careerPaths.matrix.skillCategory')}
                </label>
                <Input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder={t('careerPaths.matrix.skillCategoryHint')}
                />
              </div>
            </SheetBody>
            <SheetFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                disabled={!name.trim()}
                onClick={() => {
                  onCreate(name.trim(), category.trim());
                  setName('');
                  setCategory('');
                  setOpen(false);
                }}
              >
                {t('common.save')}
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      ) : null}
    </>
  );
}

function AddRequirementForm({
  skillOptions,
  positionTitle,
  onAdd,
}: {
  skillOptions: Array<{ value: string; label: string }>;
  positionTitle: string;
  onAdd: (skillId: string, requiredLevel: number, isMandatory: boolean) => void;
}) {
  const { t } = useTranslation();
  const [skillId, setSkillId] = useState('');
  const [requiredLevel, setRequiredLevel] = useState('3');
  const [isMandatory, setIsMandatory] = useState(false);

  return (
    <div className="flex flex-wrap items-end gap-2 border-t border-(--border) pt-3">
      <div className="min-w-40 flex-1">
        <CustomSelect
          value={skillId}
          onChange={setSkillId}
          options={skillOptions}
          placeholder={t('careerPaths.matrix.pickSkill')}
        />
      </div>
      <div className="w-28">
        <CustomSelect
          value={requiredLevel}
          onChange={setRequiredLevel}
          options={LEVELS.map((l) => ({ value: String(l), label: `${l}/5` }))}
        />
      </div>
      <label className="flex items-center gap-1.5 text-xs text-(--text-muted)">
        <input
          type="checkbox"
          checked={isMandatory}
          onChange={(e) => setIsMandatory(e.target.checked)}
          className="h-4 w-4"
        />
        {t('careerPaths.matrix.mandatory')}
      </label>
      <Button
        size="sm"
        disabled={!skillId}
        onClick={() => {
          onAdd(skillId, Number(requiredLevel), isMandatory);
          setSkillId('');
        }}
      >
        <Plus className="h-4 w-4" />
      </Button>
      <span className="sr-only">{positionTitle}</span>
    </div>
  );
}

function TrackCreateForm({
  onCreate,
}: {
  onCreate: (
    name: string,
    department: string,
    steps: Array<{
      key: string;
      positionTitle: string;
      level: (typeof STEP_LEVELS)[number];
      minMonthsInStep?: number;
    }>,
  ) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [lines, setLines] = useState('');
  const [saving, setSaving] = useState(false);

  const parseSteps = () =>
    lines
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, i) => {
        // Format: "Position Title | junior|mid|senior|lead | months"
        const [title = '', level = '', months = ''] = line.split('|').map((part) => part.trim());
        const lvl = (STEP_LEVELS as readonly string[]).includes(level)
          ? (level as (typeof STEP_LEVELS)[number])
          : 'mid';
        return {
          key: `s${i + 1}`,
          positionTitle: title,
          level: lvl,
          ...(months ? { minMonthsInStep: Number(months) || undefined } : {}),
        };
      });

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          {t('careerPaths.tracks.new')}
        </Button>
      </div>
      {open ? (
        <Sheet open onOpenChange={(o) => !o && setOpen(false)}>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>{t('careerPaths.tracks.new')}</SheetTitle>
            </SheetHeader>
            <SheetBody className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-(--text-muted)">
                  {t('careerPaths.tracks.name')}
                </label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-(--text-muted)">
                  {t('careerPaths.tracks.department')}
                </label>
                <Input value={department} onChange={(e) => setDepartment(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-(--text-muted)">
                  {t('careerPaths.tracks.steps')}
                </label>
                <textarea
                  rows={4}
                  value={lines}
                  onChange={(e) => setLines(e.target.value)}
                  placeholder={t('careerPaths.tracks.stepsHint')}
                  className="w-full rounded-xl border border-(--border) bg-(--background) p-3 text-sm text-(--text-primary)"
                />
              </div>
            </SheetBody>
            <SheetFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                disabled={saving || !name.trim() || !lines.trim()}
                onClick={async () => {
                  setSaving(true);
                  try {
                    onCreate(name.trim(), department.trim(), parseSteps());
                    setOpen(false);
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                {t('common.save')}
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      ) : null}
    </>
  );
}

function ProgressEditor({
  steps,
  currentStepKey,
  targetStepKey,
  onSave,
}: {
  steps: TrackRow['steps'];
  currentStepKey: string;
  targetStepKey: string;
  onSave: (currentStepKey: string, targetStepKey: string) => void;
}) {
  const { t } = useTranslation();
  const [current, setCurrent] = useState(currentStepKey);
  const [target, setTarget] = useState(targetStepKey);

  const stepOptions = steps.map((s) => ({
    value: s.key,
    label: `${s.positionTitle} · ${t(`careerPaths.levels.${s.level}`)}`,
  }));

  return (
    <div className="flex flex-wrap items-end gap-2 border-t border-(--border) pt-3">
      <div className="w-44">
        <label className="mb-1 block text-xs font-medium text-(--text-muted)">
          {t('careerPaths.progress.current')}
        </label>
        <CustomSelect value={current} onChange={setCurrent} options={stepOptions} />
      </div>
      <div className="w-44">
        <label className="mb-1 block text-xs font-medium text-(--text-muted)">
          {t('careerPaths.progress.target')}
        </label>
        <CustomSelect value={target} onChange={setTarget} options={stepOptions} />
      </div>
      <Button
        size="sm"
        onClick={() => onSave(current, target)}
        disabled={!current || !target || current === target}
      >
        {t('common.save')}
      </Button>
    </div>
  );
}

function MentorshipForm({
  employeeOptions,
  trackOptions,
  onCreate,
}: {
  employeeOptions: Array<{ value: string; label: string }>;
  trackOptions: Array<{ value: string; label: string }>;
  onCreate: (mentorId: string, menteeId: string, focus: string, trackId: string) => void;
}) {
  const { t } = useTranslation();
  const [mentorId, setMentorId] = useState('');
  const [menteeId, setMenteeId] = useState('');
  const [focus, setFocus] = useState('');
  const [trackId, setTrackId] = useState('');
  const [saving, setSaving] = useState(false);

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-(--border) bg-(--background-subtle) p-4">
      <div className="min-w-44 flex-1">
        <label className="mb-1 block text-xs font-medium text-(--text-muted)">
          {t('careerPaths.mentorship.mentor')}
        </label>
        <CustomSelect value={mentorId} onChange={setMentorId} options={employeeOptions} />
      </div>
      <div className="min-w-44 flex-1">
        <label className="mb-1 block text-xs font-medium text-(--text-muted)">
          {t('careerPaths.mentorship.mentee')}
        </label>
        <CustomSelect value={menteeId} onChange={setMenteeId} options={employeeOptions} />
      </div>
      <div className="min-w-40 flex-1">
        <label className="mb-1 block text-xs font-medium text-(--text-muted)">
          {t('careerPaths.mentorship.focus')}
        </label>
        <Input value={focus} onChange={(e) => setFocus(e.target.value)} />
      </div>
      <div className="min-w-40 flex-1">
        <label className="mb-1 block text-xs font-medium text-(--text-muted)">
          {t('careerPaths.mentorship.track')}
        </label>
        <CustomSelect
          value={trackId}
          onChange={setTrackId}
          options={trackOptions}
          placeholder={t('careerPaths.mentorship.noTrack')}
        />
      </div>
      <Button
        disabled={saving || !mentorId || !menteeId || mentorId === menteeId}
        onClick={() => {
          setSaving(true);
          try {
            onCreate(mentorId, menteeId, focus.trim(), trackId);
            setMenteeId('');
            setFocus('');
          } finally {
            setSaving(false);
          }
        }}
      >
        {t('careerPaths.mentorship.create')}
      </Button>
    </div>
  );
}
