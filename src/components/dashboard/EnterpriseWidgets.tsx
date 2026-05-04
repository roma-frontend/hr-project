'use client';

import React from 'react';
import { motion } from '@/lib/cssMotion';
import { PlanGate } from '@/components/subscription/PlanGate';
import dynamic from 'next/dynamic';

const HolidayCalendarSync = dynamic(() => import('@/components/admin/HolidayCalendarSync'), {
  ssr: false,
});
const CostAnalysis = dynamic(() => import('@/components/admin/CostAnalysis'), { ssr: false });
const ConflictDetection = dynamic(() => import('@/components/admin/ConflictDetection'), {
  ssr: false,
});
const SmartSuggestions = dynamic(() => import('@/components/admin/SmartSuggestions'), {
  ssr: false,
});
const ResponseTimeSLA = dynamic(() => import('@/components/admin/ResponseTimeSLA'), { ssr: false });
const WeeklyDigestWidget = dynamic(() => import('@/components/ai/WeeklyDigestWidget'), {
  ssr: false,
});

export function EnterpriseWidgets() {
  return (
    <>
      <motion.div variants={itemVariants} className="lg:col-span-1">
        <PlanGate feature="slaSettings">
          <ResponseTimeSLA />
        </PlanGate>
      </motion.div>
      <motion.div variants={itemVariants} className="lg:col-span-1">
        <PlanGate feature="advancedAnalytics">
          <ConflictDetection />
        </PlanGate>
      </motion.div>
      <motion.div variants={itemVariants} className="lg:col-span-1">
        <PlanGate feature="analytics">
          <CostAnalysis />
        </PlanGate>
      </motion.div>
      <motion.div variants={itemVariants} className="lg:col-span-1">
        <PlanGate feature="calendarSync">
          <HolidayCalendarSync />
        </PlanGate>
      </motion.div>
      <motion.div variants={itemVariants} className="lg:col-span-1">
        <PlanGate feature="aiInsights">
          <SmartSuggestions />
        </PlanGate>
      </motion.div>
      <motion.div variants={itemVariants} className="lg:col-span-1">
        <PlanGate feature="aiChat">
          <WeeklyDigestWidget />
        </PlanGate>
      </motion.div>
    </>
  );
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};
