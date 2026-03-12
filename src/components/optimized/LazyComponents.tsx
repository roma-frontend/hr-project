/**
 * Lazy-loaded компоненты для оптимизации производительности
 * Тяжелые библиотеки загружаются только когда нужны
 */

import dynamic from 'next/dynamic';
import { ShieldLoader } from '@/components/ui/ShieldLoader';

// Компонент загрузки
const LoadingSpinner = () => (
  <div className="flex items-center justify-center p-8">
    <ShieldLoader size="md" />
  </div>
);

// ===== 3D КОМПОНЕНТЫ (Three.js - очень тяжелый) =====
export const Lazy3DScene = dynamic(
  () => Promise.resolve({ default: () => null }),
  {
    loading: () => <LoadingSpinner />,
    ssr: false,
  }
);

// ===== AI CHAT WIDGET (большие AI библиотеки) =====
export const LazyChatWidget = dynamic(
  () => import('@/components/ai/ChatWidget'),
  {
    loading: () => <LoadingSpinner />,
    ssr: false,
  }
);

// ===== CHARTS (Recharts - тяжелая библиотека) =====
export const LazyChart = dynamic(
  () => import('@/components/analytics/LeavesTrendChart').catch(() => ({ default: () => null })),
  {
    loading: () => <LoadingSpinner />,
    ssr: false,
  }
);

export const LazyRevenueChart = dynamic(
  () => Promise.resolve({ default: () => null }),
  {
    loading: () => <LoadingSpinner />,
    ssr: false,
  }
);

// ===== FACE RECOGNITION (face-api.js - очень тяжелый) =====
export const LazyFaceRecognition = dynamic(
  () => Promise.resolve({ default: () => null }),
  {
    loading: () => <LoadingSpinner />,
    ssr: false,
  }
);

// ===== CALENDAR (react-day-picker) =====
export const LazyCalendar = dynamic(
  () => import('@/components/ui/calendar').then(mod => ({ default: mod.Calendar })).catch(() => ({ default: () => null })),
  {
    loading: () => <LoadingSpinner />,
    ssr: true,
  }
);

// ===== RICH TEXT EDITOR =====
export const LazyRichEditor = dynamic(
  () => Promise.resolve({ default: () => null }),
  {
    loading: () => <LoadingSpinner />,
    ssr: false,
  }
);

// ===== PDF VIEWER/GENERATOR =====
export const LazyPDFViewer = dynamic(
  () => Promise.resolve({ default: () => null }),
  {
    loading: () => <LoadingSpinner />,
    ssr: false,
  }
);

// ===== EXCEL EXPORT =====
export const LazyExcelExport = dynamic(
  () => Promise.resolve({ default: () => null }),
  {
    loading: () => <LoadingSpinner />,
    ssr: false,
  }
);

// ===== МОДАЛЫ =====
export const LazyModal = dynamic(
  () => import('@/components/ui/dialog').then(mod => ({ default: mod.Dialog })).catch(() => ({ default: () => null })),
  {
    loading: () => null,
    ssr: false,
  }
);

// ===== ПРОФИЛЬ С АВАТАРОМ =====
export const LazyAvatarUpload = dynamic(
  () => Promise.resolve({ default: () => null }),
  {
    loading: () => <LoadingSpinner />,
    ssr: false,
  }
);

export default {
  Lazy3DScene,
  LazyChatWidget,
  LazyChart,
  LazyRevenueChart,
  LazyFaceRecognition,
  LazyCalendar,
  LazyRichEditor,
  LazyPDFViewer,
  LazyExcelExport,
  LazyModal,
  LazyAvatarUpload,
};
