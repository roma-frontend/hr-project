'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShieldLoader } from '@/components/ui/ShieldLoader';
import {
  DollarSign,
  Users,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  Calendar,
  CreditCard,
  ShieldAlert,
  CheckCircle,
  XCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

const SUPERADMIN_EMAIL = 'romangulanyan@gmail.com';

interface StripeMetrics {
  totalSubscriptions: number;
  active: number;
  trialing: number;
  canceled: number;
  pastDue: number;
  mrr: number;
  totalRevenue: number;
  last30DaysRevenue: number;
  growth: string;
  trialEnding: number;
}

interface StripeSubscription {
  id: string;
  status: string;
  plan: string;
  amount: number;
  customer: { email: string; name: string };
  currentPeriodEnd: number;
  currentPeriodStart: number;
  cancelAtPeriodEnd: boolean;
  trialEnd?: number;
  created: number;
}

interface StripeTransaction {
  id: string;
  amount: number;
  currency: string;
  status: string;
  customer: string;
  date: string;
  description: string;
}

interface StripeData {
  metrics: StripeMetrics;
  subscriptions: StripeSubscription[];
  recentTransactions: StripeTransaction[];
}

export default function StripeDashboardPage() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { user: currentUser } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<StripeData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStripeData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/stripe/transactions');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || t('stripeDashboard.failedToFetchData', 'Failed to fetch data'));
      }

      setData(result);
      if (isRefresh) {
        toast.success(t('stripeDashboard.dataUpdated', 'Данные обновлены'));
      }
    } catch (err: any) {
      setError(err.message);
      if (isRefresh) {
        toast.error(t('stripeDashboard.dataUpdateFailed', 'Ошибка при обновлении данных'));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    if (currentUser) {
      fetchStripeData();
    } else {
      setLoading(false);
    }
    return () => {
      mounted = false;
    };
  }, [currentUser]);

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <ShieldLoader size="lg" />
      </div>
    );
  }

  const isSuperAdmin =
    currentUser.email?.toLowerCase() === SUPERADMIN_EMAIL || currentUser.role === 'superadmin';

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2 text-red-500">
              <ShieldAlert className="w-6 h-6" />
              <CardTitle>{t('stripe.accessDenied')}</CardTitle>
            </div>
            <CardDescription>{t('stripe.accessDeniedDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{t('stripe.restrictedAccess')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <ShieldLoader size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-red-500/50">
          <CardHeader>
            <CardTitle className="text-red-500 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              {t('stripeDashboard.errorLoadingData') || 'Error Loading Data'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => fetchStripeData()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              {t('stripeDashboard.tryAgain') || 'Try Again'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const { metrics, subscriptions, recentTransactions } = data;

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-500',
      trialing: 'bg-blue-500',
      canceled: 'bg-red-500',
      past_due: 'bg-yellow-500',
      incomplete: 'bg-gray-500',
    };
    return colors[status] || 'bg-gray-500';
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<
      string,
      { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
    > = {
      active: { label: t('stripe.status.active') || 'Active', variant: 'default' },
      trialing: { label: t('stripe.status.trialing') || 'Trialing', variant: 'default' },
      canceled: { label: t('stripe.status.canceled') || 'Canceled', variant: 'destructive' },
      past_due: { label: t('stripe.status.pastDue') || 'Past Due', variant: 'outline' },
      incomplete: { label: t('stripe.status.incomplete') || 'Incomplete', variant: 'secondary' },
    };
    return variants[status] || { label: status, variant: 'secondary' as const };
  };

  return (
    <div className="mx-auto space-y-6">
      {/* Header */}
      <div className="sticky top-0 z-10 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-4 mb-6 bg-(--background)/95 backdrop-blur supports-[backdrop-filter]:bg-(--background)/60 border-b border-(--border)">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <Button variant="ghost" onClick={() => router.back()} className="mb-4 -ml-2 text-sm">
              {t('stripe.backToDashboard')}
            </Button>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold">{t('stripe.dashboard')}</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-2">
              {t('stripe.realTimeAnalytics')}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => router.push('/superadmin/stripe-dashboard/data-studio')}
            >
              📊 {t('stripe.dataStudio.title', 'Data Studio')}
            </Button>
            <Button variant="outline" onClick={() => fetchStripeData(true)} disabled={refreshing}>
              {refreshing && <ShieldLoader size="xs" variant="inline" />}
              {!refreshing && <RefreshCw className="w-4 h-4 mr-2" />}
              {t('stripe.refresh')}
            </Button>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('stripe.totalSubscriptions')}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalSubscriptions}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.active} {t('stripe.metrics.active') || 'active'}, {metrics.trialing} {t('stripe.metrics.trialing') || 'trialing'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('stripe.monthlyRevenue')}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${metrics.mrr}</div>
            <p className="text-xs text-muted-foreground">
              {t('stripe.metrics.last30Days')}: ${metrics.last30DaysRevenue}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('stripe.growthRate')}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              {metrics.growth}%
              {parseFloat(metrics.growth) >= 0 ? (
                <ArrowUpRight className="w-4 h-4 text-green-500" />
              ) : (
                <ArrowDownRight className="w-4 h-4 text-red-500" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">{t('stripe.last30Days')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('stripe.trialEndingSoon')}</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.trialEnding}</div>
            <p className="text-xs text-muted-foreground">{t('stripe.within7Days')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Summary */}
      <Card>
        <CardHeader>
          <CardTitle>{t('stripe.revenue.total') || 'Total Revenue'}</CardTitle>
          <CardDescription>{t('stripe.revenue.totalDesc') || 'Total received from all subscriptions'}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-green-600">${metrics.totalRevenue}</div>
        </CardContent>
      </Card>

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            {t('stripe.transactions.recent') || 'Recent Transactions'}
          </CardTitle>
          <CardDescription>
            {t('stripe.transactions.recentDesc', { count: recentTransactions.length }) || `Last ${recentTransactions.length} payments from Stripe`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentTransactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>{t('stripe.transactions.empty') || 'No transactions'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 font-semibold">{t('stripe.table.client') || 'Client'}</th>
                    <th className="pb-3 font-semibold">{t('stripe.table.amount') || 'Amount'}</th>
                    <th className="pb-3 font-semibold">{t('stripe.table.status') || 'Status'}</th>
                    <th className="pb-3 font-semibold">{t('stripe.table.description') || 'Description'}</th>
                    <th className="pb-3 font-semibold">{t('stripe.table.date') || 'Date'}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTransactions.map((tx) => (
                    <tr key={tx.id} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium text-sm">{tx.customer}</span>
                        </div>
                      </td>
                      <td className="py-3 font-semibold">${tx.amount}</td>
                      <td className="py-3">
                        <Badge
                          variant={
                            tx.status === 'succeeded'
                              ? 'default'
                              : tx.status === 'failed'
                                ? 'destructive'
                                : 'secondary'
                          }
                          className="capitalize"
                        >
                          {tx.status === 'succeeded'
                            ? t('stripe.status.succeeded') || 'Succeeded'
                            : tx.status === 'failed'
                              ? t('stripe.status.failed') || 'Failed'
                              : tx.status}
                        </Badge>
                      </td>
                      <td className="py-3 text-sm text-muted-foreground">{tx.description}</td>
                      <td className="py-3 text-sm text-muted-foreground">
                        {new Date(tx.date).toLocaleDateString(i18n.language || 'en-GB')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Subscriptions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            {t('stripe.subscriptions.active') || 'Active Subscriptions'}
          </CardTitle>
          <CardDescription>
            {subscriptions.filter((s) => s.status === 'active').length} {t('stripe.subscriptions.activeCount') || 'active subscriptions'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {subscriptions.filter((s) => s.status === 'active').length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>{t('stripe.subscriptions.empty') || 'No active subscriptions'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 font-semibold">{t('stripe.table.client') || 'Client'}</th>
                    <th className="pb-3 font-semibold">{t('stripe.table.plan') || 'Plan'}</th>
                    <th className="pb-3 font-semibold">{t('stripe.table.amountPerMonth') || 'Amount/Month'}</th>
                    <th className="pb-3 font-semibold">{t('stripe.table.periodEnds') || 'Period Ends'}</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptions
                    .filter((s) => s.status === 'active')
                    .map((sub) => (
                      <tr key={sub.id} className="border-b hover:bg-muted/50 transition-colors">
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <CreditCard className="w-4 h-4 text-muted-foreground" />
                            <div>
                              <span className="font-medium text-sm block">
                                {sub.customer.email}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {sub.customer.name}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3">
                          <Badge variant="outline" className="capitalize">
                            {sub.plan}
                          </Badge>
                        </td>
                        <td className="py-3 font-semibold">${sub.amount}</td>
                        <td className="py-3 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(sub.currentPeriodEnd).toLocaleDateString(i18n.language || 'en-GB')}
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* All Subscriptions by Status */}
      <Card>
        <CardHeader>
          <CardTitle>{t('stripe.subscriptions.byStatus') || 'All Subscriptions by Status'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { label: t('stripe.status.active') || 'Active', count: metrics.active, color: 'bg-green-500', icon: CheckCircle },
            { label: t('stripe.status.trialing') || 'Trialing', count: metrics.trialing, color: 'bg-blue-500', icon: Clock },
            {
              label: t('stripe.status.pastDue') || 'Past Due',
              count: metrics.pastDue,
              color: 'bg-yellow-500',
              icon: AlertCircle,
            },
            { label: t('stripe.status.canceled') || 'Canceled', count: metrics.canceled, color: 'bg-red-500', icon: XCircle },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <item.icon className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{item.label}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-32 bg-muted rounded-full h-2">
                  <div
                    className={`${item.color} h-2 rounded-full transition-all`}
                    style={{
                      width: `${metrics.totalSubscriptions > 0 ? (item.count / metrics.totalSubscriptions) * 100 : 0}%`,
                    }}
                  />
                </div>
                <span className="text-sm font-bold w-12 text-right">{item.count}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
