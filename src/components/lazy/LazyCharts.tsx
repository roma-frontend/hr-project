'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

const ChartLoading = () => (
  <div className="flex items-center justify-center h-64">
    <Loader2 className="h-6 w-6 animate-spin text-primary" />
  </div>
);

/**
 * Lazy-loaded Recharts components.
 * Recharts + D3 load ONLY when charts are rendered.
 */
export const LazyBarChart = dynamic(
  () => import('recharts').then((mod) => mod.BarChart),
  { ssr: false, loading: ChartLoading }
);

export const LazyLineChart = dynamic(
  () => import('recharts').then((mod) => mod.LineChart),
  { ssr: false, loading: ChartLoading }
);

export const LazyPieChart = dynamic(
  () => import('recharts').then((mod) => mod.PieChart),
  { ssr: false, loading: ChartLoading }
);

export const LazyAreaChart = dynamic(
  () => import('recharts').then((mod) => mod.AreaChart),
  { ssr: false, loading: ChartLoading }
);