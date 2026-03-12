/**
 * Framer Motion wrapper - заглушка для совместимости
 */

'use client';

// Прямой импорт framer-motion без lazy loading для избежания ошибок типов
import { motion, AnimatePresence } from 'framer-motion';

// Типы для TypeScript
export type { HTMLMotionProps } from 'framer-motion';

// Re-export
export { motion, AnimatePresence };
