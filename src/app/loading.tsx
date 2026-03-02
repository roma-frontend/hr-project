'use client';

import { ShieldLoader } from '@/components/ui/ShieldLoader';
import { useTranslation } from "react-i18next";

export default function Loading() {
  const { t } = useTranslation();
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#020817] via-[#0a0f2e] to-[#120820]">
      <ShieldLoader 
        size="xl" 
        message="Loading your workspace..." 
        className="text-white"
      />
    </div>
  );
}
