/**
 * Team Sidebar — Боковая панель с информацией о команде
 */

"use client";

import { useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { motion } from "framer-motion";
import { 
  Users, UserCheck, UserX, Briefcase, Calendar, Award, 
  TrendingUp, Clock, Star, Zap 
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface TeamSidebarProps {
  userId?: Id<"users">;
}

export function TeamSidebar({ userId }: TeamSidebarProps) {
  const { t } = useTranslation();
  
  // Get all users for stats
  const allUsers = useQuery(
    api.users.getAllUsers,
    userId ? { requesterId: userId } : "skip"
  );

  // Calculate stats
  const stats = allUsers?.reduce((acc, user) => {
    if (!user.isActive) {
      acc.inactive++;
      return acc;
    }
    
    acc.total++;
    if (user.role === "admin") acc.admins++;
    else if (user.role === "supervisor") acc.supervisors++;
    else if (user.role === "employee") acc.employees++;
    else if (user.role === "driver") acc.drivers++;
    
    if ((user as any).employeeType === "contractor") acc.contractors++;
    else acc.staff++;
    
    return acc;
  }, {
    total: 0,
    admins: 0,
    supervisors: 0,
    employees: 0,
    drivers: 0,
    contractors: 0,
    staff: 0,
    inactive: 0,
  }) || {
    total: 0,
    admins: 0,
    supervisors: 0,
    employees: 0,
    drivers: 0,
    contractors: 0,
    staff: 0,
    inactive: 0,
  };

  // Recent employees (by createdAt)
  const recentEmployees = allUsers
    ?.filter((u: any) => u.isActive)
    .sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 5) || [];

  // Birthdays this month (if you have birthdate field)
  const currentMonth = new Date().getMonth();
  // const birthdaysThisMonth = allUsers?.filter((u: any) => {
  //   if (!u.birthdate) return false;
  //   return new Date(u.birthdate).getMonth() === currentMonth;
  // }) || [];

  return (
    <motion.aside
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
      className="space-y-4"
    >
      {/* Team Overview Card */}
      <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-2">
            <Users className="w-4 h-4" />
            {t('employees.teamOverview')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <div className="flex items-center gap-2 mb-1">
                <UserCheck className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-xs text-blue-600 font-medium">{t('employees.active')}</span>
              </div>
              <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
            </div>
            <div className="p-3 rounded-xl bg-gray-500/10 border border-gray-500/20">
              <div className="flex items-center gap-2 mb-1">
                <UserX className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-xs text-gray-600 font-medium">{t('employees.inactive')}</span>
              </div>
              <p className="text-2xl font-bold text-gray-600">{stats.inactive}</p>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-[var(--border)]">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--text-muted)] flex items-center gap-1.5">
                <Award className="w-3 h-3" /> {t('roles.admin')}
              </span>
              <Badge variant="secondary" className="bg-purple-500/20 text-purple-600 border-purple-500/30">
                {stats.admins}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--text-muted)] flex items-center gap-1.5">
                <Star className="w-3 h-3" /> {t('roles.supervisor')}
              </span>
              <Badge variant="secondary" className="bg-amber-500/20 text-amber-600 border-amber-500/30">
                {stats.supervisors}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--text-muted)] flex items-center gap-1.5">
                <UserCheck className="w-3 h-3" /> {t('roles.employee')}
              </span>
              <Badge variant="secondary" className="bg-green-500/20 text-green-600 border-green-500/30">
                {stats.employees}
              </Badge>
            </div>
            {stats.drivers > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-muted)] flex items-center gap-1.5">
                  <Zap className="w-3 h-3" /> {t('roles.driver')}
                </span>
                <Badge variant="secondary" className="bg-cyan-500/20 text-cyan-600 border-cyan-500/30">
                  {stats.drivers}
                </Badge>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-[var(--border)]">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--text-muted)] flex items-center gap-1.5">
                <Briefcase className="w-3 h-3" /> {t('employeeTypes.staff')}
              </span>
              <span className="font-semibold text-[var(--text-primary)]">{stats.staff}</span>
            </div>
            <div className="flex items-center justify-between text-xs mt-1.5">
              <span className="text-[var(--text-muted)] flex items-center gap-1.5">
                <Clock className="w-3 h-3" /> {t('employeeTypes.contractor')}
              </span>
              <span className="font-semibold text-[var(--text-primary)]">{stats.contractors}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Members Card */}
      {recentEmployees.length > 0 && (
        <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              {t('employees.newMembers')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentEmployees.map((emp: any, index) => (
              <motion.div
                key={emp._id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-[var(--background-subtle)] transition-colors"
              >
                <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center font-bold text-white text-xs bg-gradient-to-br from-blue-500 to-sky-500">
                  {emp.avatarUrl ? (
                    <img src={emp.avatarUrl} alt={emp.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    emp.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[var(--text-primary)] truncate">{emp.name}</p>
                  <p className="text-[10px] text-[var(--text-muted)]">{emp.position || t('common.noPosition')}</p>
                </div>
                <Badge variant="secondary" className="text-[10px] bg-green-500/20 text-green-600 border-green-500/30">
                  New
                </Badge>
              </motion.div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Quick Stats Card */}
      <Card className="border-0 shadow-lg bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border-emerald-500/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-2">
            <Award className="w-4 h-4" />
            {t('dashboard.quickStats')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-emerald-600 dark:text-emerald-400">{t('employees.supervisors')}</span>
            <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{stats.supervisors}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-emerald-600 dark:text-emerald-400">{t('employees.contractors')}</span>
            <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{stats.contractors}</span>
          </div>
          <div className="pt-2 border-t border-emerald-500/20">
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 text-center">
              💡 {t('employees.teamHealthGood')}
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.aside>
  );
}
