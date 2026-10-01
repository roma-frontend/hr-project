'use client';

import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BookOpen, Users, TrendingUp, Award, BarChart3 } from 'lucide-react';

type TeamOverviewData = {
  isCapped?: boolean;
  totalCourses: number;
  totalEnrollments: number;
  completionRate: number;
  mandatoryCourses: number;
};

interface TeamOverviewProps {
  teamOverview: TeamOverviewData | undefined;
}

export function TeamOverview({ teamOverview }: TeamOverviewProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            {t('learning.teamProgress', 'Team Progress')}
          </CardTitle>
          <CardDescription>
            {t('learning.teamProgressDesc', 'Overview of team learning activity')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {teamOverview?.isCapped && (
            <p role="status" className="mb-4 text-sm text-(--warning-text)">
              {t(
                'learning.partialOverview',
                'These statistics cover only part of the data; use enrollment details to load all records.',
              )}
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-center gap-3 mb-2">
                <BookOpen className="h-5 w-5 text-muted-foreground" />
                <p className="text-3xl font-bold">{teamOverview?.totalCourses ?? 0}</p>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {t('learning.totalCourses', 'Total Courses')}
              </p>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-center gap-3 mb-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <p className="text-3xl font-bold">{teamOverview?.totalEnrollments ?? 0}</p>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {t('learning.totalEnrollments', 'Total Enrollments')}
              </p>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-center gap-3 mb-2">
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
                <p className="text-3xl font-bold">{teamOverview?.completionRate ?? 0}%</p>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {t('learning.completionRate', 'Completion Rate')}
              </p>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-center gap-3 mb-2">
                <Award className="h-5 w-5 text-muted-foreground" />
                <p className="text-3xl font-bold">{teamOverview?.mandatoryCourses ?? 0}</p>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {t('learning.mandatoryCourses', 'Mandatory Courses')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
