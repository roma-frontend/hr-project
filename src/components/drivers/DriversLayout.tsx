'use client';

import { motion } from '@/lib/cssMotion';
import { ReactNode } from 'react';
import { Car, Users, Calendar, TrendingUp } from 'lucide-react';

interface DriversLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  stats?: Array<{
    label: string;
    value: string | number;
    icon: React.ComponentType<{ className?: string }>;
    trend?: string;
    color?: string;
  }>;
  actions?: ReactNode;
}

const statIcons = [Car, Users, Calendar, TrendingUp];

export function DriversLayout({ children, title, subtitle, stats, actions }: DriversLayoutProps) {
  return (
    <div className="max-w-[1600px] mx-auto">
      {/* Header Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative mb-8"
      >
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--primary)]/5 via-[var(--primary)]/10 to-transparent rounded-3xl -z-10" />

        <div className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-[var(--primary)]/10">
                <Car className="w-7 h-7 text-[var(--primary)]" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold">{title}</h1>
                {subtitle && <p className="text-sm text-[var(--text-muted)] mt-1">{subtitle}</p>}
              </div>
            </div>
            {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
          </div>
        </div>
      </motion.div>

      {/* Stats Cards */}
      {stats && stats.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 mb-8"
        >
          {stats.map((stat, idx) => {
            const Icon = stat.icon || statIcons[idx % statIcons.length];
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: 0.1 + idx * 0.05 }}
                whileHover={{ scale: 1.02, y: -2 }}
              >
                <div className="relative p-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
                  {/* Gradient overlay */}
                  <div
                    className={`absolute top-0 right-0 w-20 h-20 rounded-full blur-2xl opacity-10 -z-10 ${
                      stat.color || 'bg-[var(--primary)]'
                    }`}
                    style={{ transform: 'translate(30%, -30%)' }}
                  />

                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-[var(--text-muted)] font-medium">{stat.label}</p>
                      <p className="text-2xl font-bold mt-1">{stat.value}</p>
                      {stat.trend && (
                        <p className="text-xs text-green-500 mt-1 flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          {stat.trend}
                        </p>
                      )}
                    </div>
                    <div className={`p-2 rounded-xl ${stat.color || 'bg-[var(--primary)]/10'}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        {children}
      </motion.div>
    </div>
  );
}
