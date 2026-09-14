'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from 'convex/react';
import {
  HeartHandshake,
  Plus,
  Wallet,
  FileText,
  Users,
  CheckCircle,
  XCircle,
  BadgeCheck,
  CalendarDays,
} from 'lucide-react';

import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useAuthStore } from '@/store/useAuthStore';
import { ensureAppNamespaces } from '@/i18n/config';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * Benefits Administration — tabs mirror the Surveys/Expenses pattern:
 *   Catalog (all plans + self-service enroll)
 *   My Benefits (own enrollments, wallet, claims)
 *   Team Overview (staff: enrollments across the org)
 *   Admin (admins: plan CRUD, wallet grants, claim review)
 */

type PlanDoc = {
  _id: Id<'benefitPlans'>;
  name: string;
  description?: string;
  kind: 'allowance' | 'covered';
  category: string;
  annualAmount?: number;
  perClaimLimit?: number;
  eligibility?: {
    departments?: string[];
    minTenureDays?: number;
    employeeTypes?: Array<'staff' | 'contractor'>;
  };
  enrollmentOpensAt?: number;
  enrollmentClosesAt?: number;
  isActive: boolean;
};

type ClaimDoc = {
  _id: Id<'benefitClaims'>;
  planId: Id<'benefitPlans'>;
  userId: Id<'users'>;
  title: string;
  amount: number;
  currency: string;
  status: 'submitted' | 'approved' | 'rejected' | 'reimbursed';
  createdAt: number;
  reviewNotes?: string;
};

const CATEGORIES = [
  'insurance',
  'fitness',
  'education',
  'transport',
  'meals',
  'communication',
  'childcare',
  'other',
] as const;

function formatMoney(amount: number | undefined, currency = 'AMD'): string {
  if (amount === undefined) return '—';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString()} ${currency}`;
  }
}

export default function BenefitsClient() {
  const { t } = useTranslation(['benefits', 'common']);
  const user = useAuthStore((s) => s.user);
  void ensureAppNamespaces();

  const role = user?.role ?? 'employee';
  const isAdmin = role === 'admin' || role === 'superadmin';
  const isStaff = isAdmin || role === 'supervisor';

  // Stable array identities for the useMemo dependencies below (the `?? []`
  // fallback would otherwise create a fresh array each render).
  const plansQuery = useQuery(api.benefits.listPlans, {});
  const myEnrollmentsQuery = useQuery(api.benefits.listMyEnrollments, {});
  const myWallet = useQuery(api.benefits.getMyWallet, {});
  const myClaimsQuery = useQuery(api.benefits.listClaims, {});
  const orgEnrollmentsQuery = useQuery(api.benefits.listEnrollmentsForOrg, isStaff ? {} : 'skip');
  const allClaimsQuery = useQuery(api.benefits.listClaims, isStaff ? {} : 'skip');

  const plans = useMemo(() => plansQuery ?? [], [plansQuery]);
  const myEnrollments = useMemo(() => myEnrollmentsQuery ?? [], [myEnrollmentsQuery]);
  const myClaims = useMemo(() => myClaimsQuery ?? [], [myClaimsQuery]);
  const orgEnrollments = useMemo(() => orgEnrollmentsQuery ?? [], [orgEnrollmentsQuery]);
  const allClaims = useMemo(() => allClaimsQuery ?? [], [allClaimsQuery]);

  const enroll = useMutation(api.benefits.enroll);
  const cancelEnrollment = useMutation(api.benefits.cancelEnrollment);
  const submitClaim = useMutation(api.benefits.submitClaim);
  const reviewClaim = useMutation(api.benefits.reviewClaim);
  const upsertPlan = useMutation(api.benefits.upsertPlan);

  const [error, setError] = useState<string | null>(null);
  // Wall clock captured once per mount — impure Date.now() must not run
  // during render (react-hooks/purity).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const [claimDialogPlan, setClaimDialogPlan] = useState<PlanDoc | null>(null);
  const [claimTitle, setClaimTitle] = useState('');
  const [claimAmount, setClaimAmount] = useState('');
  const [claimDate, setClaimDate] = useState('');
  const [claimReceipt, setClaimReceipt] = useState('');

  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [planName, setPlanName] = useState('');
  const [planKind, setPlanKind] = useState<'allowance' | 'covered'>('allowance');
  const [planCategory, setPlanCategory] = useState<string>('other');
  const [planAmount, setPlanAmount] = useState('');
  const [planPerClaim, setPlanPerClaim] = useState('');

  const enrollInPlan = async (planId: Id<'benefitPlans'>) => {
    setError(null);
    try {
      await enroll({ planId });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const submitNewClaim = async () => {
    if (!claimDialogPlan) return;
    setError(null);
    try {
      await submitClaim({
        planId: claimDialogPlan._id,
        title: claimTitle,
        amount: Number(claimAmount),
        expenseDate: claimDate ? new Date(claimDate).getTime() : Date.now(),
        receiptUrl: claimReceipt || undefined,
      });
      setClaimDialogPlan(null);
      setClaimTitle('');
      setClaimAmount('');
      setClaimDate('');
      setClaimReceipt('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const savePlan = async () => {
    setError(null);
    try {
      await upsertPlan({
        name: planName,
        kind: planKind,
        category: planCategory as (typeof CATEGORIES)[number],
        annualAmount: planAmount ? Number(planAmount) : undefined,
        perClaimLimit: planPerClaim ? Number(planPerClaim) : undefined,
        isActive: true,
      });
      setPlanDialogOpen(false);
      setPlanName('');
      setPlanAmount('');
      setPlanPerClaim('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const activeByPlan = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of orgEnrollments) {
      if (e.status === 'active') map.set(e.planId, (map.get(e.planId) ?? 0) + 1);
    }
    return map;
  }, [orgEnrollments]);

  const myActivePlanIds = useMemo(
    () =>
      new Set(myEnrollments.filter((e) => e.status === 'active').map((e) => e.planId as string)),
    [myEnrollments],
  );

  const pendingClaims = allClaims.filter((c) => c.status === 'submitted');

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <HeartHandshake className="h-6 w-6" />
          {t('benefits.dashboard')}
        </h1>
        <p className="text-muted-foreground text-sm">{t('benefits.subtitle')}</p>
      </div>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      <Tabs defaultValue="catalog">
        <TabsList>
          <TabsTrigger value="catalog">{t('benefits.tabs.catalog')}</TabsTrigger>
          <TabsTrigger value="mine">{t('benefits.tabs.myBenefits')}</TabsTrigger>
          {isStaff && <TabsTrigger value="team">{t('benefits.tabs.team')}</TabsTrigger>}
          {isAdmin && <TabsTrigger value="admin">{t('benefits.tabs.admin')}</TabsTrigger>}
        </TabsList>

        {/* ── Catalog ─────────────────────────────────────────────────────── */}
        <TabsContent value="catalog" className="space-y-4">
          {plans.length === 0 && (
            <p className="text-muted-foreground text-sm">{t('benefits.noPlans')}</p>
          )}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {plans.map((plan: PlanDoc) => {
              const isEnrolled = myActivePlanIds.has(plan._id);
              const windowClosed =
                (plan.enrollmentClosesAt !== undefined && now > plan.enrollmentClosesAt) ||
                (plan.enrollmentOpensAt !== undefined && now < plan.enrollmentOpensAt);
              return (
                <Card key={plan._id}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{plan.name}</span>
                      <Badge variant="outline">{t(`benefits.kind.${plan.kind}`)}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p className="text-muted-foreground">{plan.description}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{t(`benefits.category.${plan.category}`)}</Badge>
                      {plan.annualAmount !== undefined && (
                        <span>{formatMoney(plan.annualAmount)}</span>
                      )}
                    </div>
                    {activeByPlan.get(plan._id) !== undefined && isStaff && (
                      <div className="text-muted-foreground flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {activeByPlan.get(plan._id)}
                      </div>
                    )}
                    <div className="pt-2">
                      {isEnrolled ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const active = myEnrollments.find(
                              (e) => e.planId === plan._id && e.status === 'active',
                            );
                            if (active) void cancelEnrollment({ enrollmentId: active._id });
                          }}
                        >
                          {t('benefits.cancelEnrollment')}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          disabled={!plan.isActive || windowClosed}
                          onClick={() => enrollInPlan(plan._id)}
                        >
                          {windowClosed ? t('benefits.windowClosed') : t('benefits.enroll')}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ── My Benefits ─────────────────────────────────────────────────── */}
        <TabsContent value="mine" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Wallet className="h-4 w-4" />
                {t('benefits.wallet')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {myWallet ? (
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">{t('benefits.walletGranted')}</p>
                    <p className="font-semibold">{formatMoney(myWallet.granted)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t('benefits.walletSpent')}</p>
                    <p className="font-semibold">{formatMoney(myWallet.spent)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t('benefits.walletRemaining')}</p>
                    <p className="font-semibold">
                      {formatMoney(myWallet.granted - myWallet.spent)}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">{t('benefits.noWallet')}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('benefits.claims')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {myClaims.length === 0 && (
                <p className="text-muted-foreground text-sm">{t('benefits.noClaims')}</p>
              )}
              {myClaims.map((claim: ClaimDoc) => {
                const plan = plans.find((p: PlanDoc) => p._id === claim.planId);
                return (
                  <div
                    key={claim._id}
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">
                        {claim.title}{' '}
                        <span className="text-muted-foreground">
                          · {plan?.name ?? claim.planId}
                        </span>
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {formatMoney(claim.amount, claim.currency)}
                      </p>
                    </div>
                    <Badge
                      variant={
                        claim.status === 'approved' || claim.status === 'reimbursed'
                          ? 'default'
                          : claim.status === 'rejected'
                            ? 'destructive'
                            : 'secondary'
                      }
                    >
                      {t(`benefits.status.${claim.status}`)}
                    </Badge>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Team overview ───────────────────────────────────────────────── */}
        {isStaff && (
          <TabsContent value="team" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('benefits.enrollments')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {orgEnrollments.length === 0 && (
                  <p className="text-muted-foreground text-sm">{t('benefits.noEnrollments')}</p>
                )}
                {orgEnrollments.map((e) => (
                  <div
                    key={e._id}
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                  >
                    <span>{plans.find((p: PlanDoc) => p._id === e.planId)?.name ?? e.planId}</span>
                    <Badge variant={e.status === 'active' ? 'default' : 'secondary'}>
                      {t(`benefits.status.${e.status}`)}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ── Admin ───────────────────────────────────────────────────────── */}
        {isAdmin && (
          <TabsContent value="admin" className="space-y-4">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setPlanDialogOpen(true)}>
                <Plus className="mr-1 h-4 w-4" />
                {t('benefits.newPlan')}
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-4 w-4" />
                  {t('benefits.claims')} — {t('benefits.review')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {pendingClaims.length === 0 && (
                  <p className="text-muted-foreground text-sm">{t('benefits.noClaims')}</p>
                )}
                {pendingClaims.map((claim: ClaimDoc) => (
                  <div
                    key={claim._id}
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">{claim.title}</p>
                      <p className="text-muted-foreground text-xs">
                        {formatMoney(claim.amount, claim.currency)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => reviewClaim({ claimId: claim._id, decision: 'approved' })}
                      >
                        <CheckCircle className="mr-1 h-3.5 w-3.5" />
                        {t('benefits.approve')}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => reviewClaim({ claimId: claim._id, decision: 'rejected' })}
                      >
                        <XCircle className="mr-1 h-3.5 w-3.5" />
                        {t('benefits.reject')}
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* ── New claim dialog ──────────────────────────────────────────────── */}
      <Dialog open={!!claimDialogPlan} onOpenChange={(open) => !open && setClaimDialogPlan(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('benefits.newClaim')} — {claimDialogPlan?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder={t('benefits.claimTitle')}
              value={claimTitle}
              onChange={(e) => setClaimTitle(e.target.value)}
            />
            <Input
              type="number"
              placeholder={t('benefits.claimAmount')}
              value={claimAmount}
              onChange={(e) => setClaimAmount(e.target.value)}
            />
            <Input type="date" value={claimDate} onChange={(e) => setClaimDate(e.target.value)} />
            <Input
              placeholder={t('benefits.claimReceipt')}
              value={claimReceipt}
              onChange={(e) => setClaimReceipt(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClaimDialogPlan(null)}>
              {t('benefits.form.cancel')}
            </Button>
            <Button onClick={submitNewClaim} disabled={!claimTitle || !claimAmount}>
              {t('benefits.submitClaim')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── New plan dialog (admin) ───────────────────────────────────────── */}
      <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('benefits.newPlan')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder={t('benefits.form.name')}
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
            />
            <Select
              value={planKind}
              onValueChange={(v) => setPlanKind(v as 'allowance' | 'covered')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="allowance">{t('benefits.kind.allowance')}</SelectItem>
                <SelectItem value="covered">{t('benefits.kind.covered')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={planCategory} onValueChange={setPlanCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {t(`benefits.category.${c}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              placeholder={t('benefits.form.annualAmount')}
              value={planAmount}
              onChange={(e) => setPlanAmount(e.target.value)}
            />
            <Input
              type="number"
              placeholder={t('benefits.form.perClaimLimit')}
              value={planPerClaim}
              onChange={(e) => setPlanPerClaim(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanDialogOpen(false)}>
              {t('benefits.form.cancel')}
            </Button>
            <Button onClick={savePlan} disabled={!planName}>
              {t('benefits.form.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Submit-claim entry points for enrolled allowance plans */}
      <div className="flex flex-wrap gap-2">
        {plans
          .filter(
            (p: PlanDoc) => p.kind === 'allowance' && p.isActive && myActivePlanIds.has(p._id),
          )
          .map((plan: PlanDoc) => (
            <Button
              key={plan._id}
              size="sm"
              variant="ghost"
              onClick={() => setClaimDialogPlan(plan)}
            >
              <BadgeCheck className="mr-1 h-4 w-4" />
              {t('benefits.newClaim')}: {plan.name}
            </Button>
          ))}
      </div>

      {/* CalendarDays import retained for future date display refinements */}
      <span className="hidden">
        <CalendarDays />
      </span>
    </div>
  );
}
