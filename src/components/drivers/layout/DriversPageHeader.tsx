/**
 * DriversPageHeader - Header matching the app theme
 */

'use client';

import React, { memo } from 'react';

interface DriversPageHeaderProps {
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
}

export const DriversPageHeader = memo(function DriversPageHeader({
  title,
  subtitle,
  actions,
}: DriversPageHeaderProps) {
  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-4 mb-6 bg-(--background)/95 backdrop-blur supports-[backdrop-filter]:bg-(--background)/60 border-b border-(--border)">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            {title}
          </h1>
          <p className="text-sm sm:text-base mt-1" style={{ color: 'var(--text-muted)' }}>
            {subtitle}
          </p>
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
});
