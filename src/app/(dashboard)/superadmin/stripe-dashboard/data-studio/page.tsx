'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldLoader } from '@/components/ui/ShieldLoader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Search,
  Download,
  FileSpreadsheet,
  Copy,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  CreditCard,
  DollarSign,
  RefreshCw,
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

const SUPERADMIN_EMAIL = 'romangulanyan@gmail.com';

interface Transaction {
  id: string;
  amount: number;
  currency: string;
  status: string;
  customer: string;
  date: string;
  description: string;
  cardLast4: string | null;
  cardBrand: string | null;
  cardExp: string | null;
  receiptUrl: string | null;
}

interface StripeData {
  metrics: {
    totalRevenue: number;
    last30DaysRevenue: number;
    successRate: number;
    totalTransactions: number;
  };
  recentTransactions: Transaction[];
}

export default function StripeSupportStudio() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<StripeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  const fetchStripeData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/stripe/transactions');
      const result = await response.json();

      if (!response.ok) throw new Error(result.error || t('stripeDashboard.failedToFetch', 'Failed to fetch'));

      // Calculate success rate
      const txs = result.recentTransactions || [];
      const successCount = txs.filter((t: any) => t.status === 'succeeded').length;
      const successRate = txs.length > 0 ? (successCount / txs.length) * 100 : 0;

      setData({
        metrics: {
          ...result.metrics,
          successRate,
          totalTransactions: txs.length,
        },
        recentTransactions: txs,
      });
    } catch (err: any) {
      setError(err.message);
      toast.error(t('stripeDashboard.dataLoadFailed', 'Ошибка загрузки данных'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchStripeData();
    } else {
      setLoading(false);
    }
  }, [user]);

  // Filtering Logic
  const filteredData = useMemo(() => {
    if (!data?.recentTransactions) return [];
    const q = searchQuery.toLowerCase();

    return data.recentTransactions.filter((tx) => {
      const emailMatch = tx.customer.toLowerCase().includes(q);
      const amountMatch = tx.amount.toString().includes(q);
      const cardMatch = tx.cardLast4?.includes(q) || tx.cardBrand?.toLowerCase().includes(q);
      const idMatch = tx.id.toLowerCase().includes(q);

      // Date format matching (DD.MM.YYYY)
      const date = new Date(tx.date);
      const dateStr = date.toLocaleDateString(i18n.language || 'en-GB');
      const dateMatch = dateStr.includes(q);

      return emailMatch || amountMatch || cardMatch || idMatch || dateMatch;
    });
  }, [data, searchQuery]);

  const handleExport = (): void => {
    if (!filteredData.length) {
      toast.error(t('stripeDashboard.noDataToExport', 'Нет данных для экспорта'));
      return;
    }

    const headers = [
      t('stripeDashboard.csvHeaders.id', 'ID'),
      t('stripeDashboard.csvHeaders.customer', 'Customer'),
      t('stripeDashboard.csvHeaders.amount', 'Amount'),
      t('stripeDashboard.csvHeaders.status', 'Status'),
      t('stripeDashboard.csvHeaders.date', 'Date'),
      t('stripeDashboard.csvHeaders.card', 'Card'),
      t('stripeDashboard.csvHeaders.description', 'Description'),
    ];
    const csvContent = [
      headers.join(','),
      ...filteredData.map((tx) =>
        [
          tx.id,
          tx.customer,
          tx.amount,
          tx.status,
          new Date(tx.date).toLocaleDateString(i18n.language || 'en-GB'),
          `${tx.cardBrand}..${tx.cardLast4}`,
          tx.description,
        ].join(','),
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `stripe_support_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    toast.success(t('stripeDashboard.dataExported', 'Данные экспортированы'));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'succeeded':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  if (loading)
    return (
      <div className="flex justify-center h-screen items-center">
        <ShieldLoader size="lg" />
      </div>
    );

  if (!user) return <div className="p-6">{t('common.pleaseLogIn') || 'Please log in'}</div>;

  return (
    <div className="min-h-screen p-6 space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div>
          <h1 className="text-3xl font-bold mb-1">{t('stripe.dataStudio.title') || 'Stripe Support Studio'}</h1>
          <p className="text-muted-foreground">{t('stripe.dataStudio.subtitle') || 'Search transactions, card data, and support'}</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Button variant="outline" onClick={() => router.push('/superadmin/stripe-dashboard')}>
            📊 {t('stripe.dataStudio.dashboard') || 'Dashboard'}
          </Button>
          <Button variant="outline" onClick={handleExport} disabled={filteredData.length === 0}>
            <FileSpreadsheet className="w-4 h-4 mr-2" /> {t('stripe.dataStudio.export') || 'Export'}
          </Button>
          <Button onClick={() => fetchStripeData(true)} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {t('stripe.dataStudio.refresh') || 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Stats */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('stripe.dataStudio.revenueTotal') || 'Total Revenue'}</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${data.metrics.totalRevenue}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('stripe.dataStudio.revenue30Days') || 'Last 30 Days'}</CardTitle>
              <TrendingUpIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${data.metrics.last30DaysRevenue}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('stripe.dataStudio.successRate') || 'Success Rate'}</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.metrics.successRate.toFixed(1)}%</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('stripe.dataStudio.totalPayments') || 'Total Payments'}</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.metrics.totalTransactions}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle>{t('stripe.dataStudio.searchTransactions') || 'Search Transactions'}</CardTitle>
          <CardDescription>{t('stripe.dataStudio.searchDesc') || 'Enter Email, Amount, Date, or Card Number'}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('stripe.dataStudio.searchPlaceholder') || 'Search...'}
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="p-3 font-medium">{t('stripe.table.status') || 'Status'}</th>
                <th className="p-3 font-medium">{t('stripe.table.amount') || 'Amount'}</th>
                <th className="p-3 font-medium">{t('stripe.table.client') || 'Client'}</th>
                <th className="p-3 font-medium">{t('stripe.table.card') || 'Card'}</th>
                <th className="p-3 font-medium">{t('stripe.table.date') || 'Date'}</th>
                <th className="p-3 font-medium">{t('stripe.table.id') || 'ID'}</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    {t('stripe.dataStudio.noResults') || 'No results found'}
                  </td>
                </tr>
              ) : (
                filteredData.map((tx) => (
                  <tr
                    key={tx.id}
                    className="border-t hover:bg-muted/20 cursor-pointer transition-colors"
                    onClick={() => setSelectedTx(tx)}
                  >
                    <td className="p-3">{getStatusIcon(tx.status)}</td>
                    <td className="p-3 font-bold">${tx.amount}</td>
                    <td className="p-3 max-w-[200px] truncate">{tx.customer}</td>
                    <td className="p-3">
                      {tx.cardBrand ? (
                        <Badge variant="outline" className="font-mono">
                          {tx.cardBrand} •••• {tx.cardLast4}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {new Date(tx.date).toLocaleDateString(i18n.language || 'en-GB')}
                    </td>
                    <td className="p-3 text-xs font-mono text-muted-foreground">
                      {tx.id.slice(-8)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedTx} onOpenChange={(open) => !open && setSelectedTx(null)}>
        <DialogContent className="max-w-lg">
          {selectedTx && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {getStatusIcon(selectedTx.status)}
                  {t('stripe.dataStudio.transactionDetails') || 'Transaction Details'}
                </DialogTitle>
                <DialogDescription>{selectedTx.id}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4 p-4">
                {/* Main Info Grid */}
                <div className="grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded-lg">
                  <div>
                    <p className="text-xs text-muted-foreground">{t('stripe.table.amount') || 'Amount'}</p>
                    <p className="text-xl font-bold text-green-600">${selectedTx.amount}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t('stripe.table.status') || 'Status'}</p>
                    <Badge
                      variant={selectedTx.status === 'succeeded' ? 'default' : 'secondary'}
                      className="mt-1"
                    >
                      {selectedTx.status}
                    </Badge>
                  </div>
                </div>

                {/* Card Details */}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <CreditCard className="w-4 h-4" /> {t('stripe.dataStudio.paymentMethod') || 'Payment Method'}
                  </h4>
                  <div className="p-3 border rounded-lg bg-card">
                    {selectedTx.cardBrand ? (
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-lg">
                          {selectedTx.cardBrand.toUpperCase()} •••• {selectedTx.cardLast4}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Exp: {selectedTx.cardExp}
                        </span>
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm">{t('stripe.dataStudio.noCardData') || 'No card data available'}</p>
                    )}
                  </div>
                </div>

                {/* Customer & Time */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">{t('stripe.table.client') || 'Client'}</p>
                    <p className="font-medium">{selectedTx.customer}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t('stripe.dataStudio.time') || 'Time'}</p>
                    <p className="font-medium">
                      {new Date(selectedTx.date).toLocaleString(i18n.language || 'en-GB')}
                    </p>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <p className="text-xs text-muted-foreground">{t('stripe.table.description') || 'Description'}</p>
                  <p className="text-sm bg-muted/20 p-2 rounded">{selectedTx.description}</p>
                </div>

                {/* Actions */}
                {selectedTx.receiptUrl && (
                  <Button
                    className="w-full gap-2"
                    onClick={() => window.open(selectedTx.receiptUrl!, '_blank')}
                  >
                    <Copy className="w-4 h-4" /> {t('stripe.dataStudio.openStripeReceipt') || 'Open Stripe Receipt'}
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Helper Icon
function TrendingUpIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}
