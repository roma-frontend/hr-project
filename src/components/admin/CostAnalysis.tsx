"use client";

import { useTranslation } from "react-i18next";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign } from "lucide-react";
import { ShieldLoader } from "@/components/ui/ShieldLoader";

export default function CostAnalysis() {
  
  const { t } = useTranslation();
const [period, setPeriod] = useState<"month" | "quarter" | "year">("month");
  
  const data = useQuery(api.admin.getCostAnalysis, { period });

  if (!data) {
    return (
      <Card className="border-[var(--border)]">
        <CardContent className="flex items-center justify-center p-8">
          <ShieldLoader size="lg" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-[var(--border)]">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-500" />
            Cost Analysis
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant={period === "month" ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriod("month")}
            >
              Month
            </Button>
            <Button
              variant={period === "quarter" ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriod("quarter")}
            >
              Quarter
            </Button>
            <Button
              variant={period === "year" ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriod("year")}
            >
              Year
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Total Cost */}
        <div className="rounded-lg bg-gradient-to-br from-green-500/10 to-emerald-500/10 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--text-secondary)]">{t("costAnalysis.totalCost")}</p>
              <p className="text-3xl font-bold text-[var(--text-primary)]">
                ${data.totalCost.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                {data.totalLeaves} leaves В· {data.totalDays} days
              </p>
            </div>
          </div>
        </div>

        {/* By Department */}
        {data.byDepartment.length > 0 && (
          <div>
            <h4 className="mb-2 font-semibold text-[var(--text-primary)]">{t("costAnalysis.byDepartment")}</h4>
            <div className="space-y-2">
              {data.byDepartment.map((dept) => (
                <div key={dept.name} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--text-secondary)]">{dept.name}</span>
                    <span className="font-medium text-[var(--text-primary)]">
                      ${dept.cost.toLocaleString()} ({dept.percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--background-subtle)]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-500"
                      style={{ width: `${dept.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* By Type */}
        {data.byType.length > 0 && (
          <div>
            <h4 className="mb-2 font-semibold text-[var(--text-primary)]">{t("costAnalysis.byLeaveType")}</h4>
            <div className="space-y-2">
              {data.byType.map((typeData) => (
                <div key={typeData.type} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--text-secondary)] capitalize">{typeData.type}</span>
                    <span className="font-medium text-[var(--text-primary)]">
                      ${typeData.cost.toLocaleString()} ({typeData.percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--background-subtle)]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-500"
                      style={{ width: `${typeData.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.totalCost === 0 && (
          <p className="text-center text-sm text-[var(--text-secondary)]">
            {t("costAnalysis.noData")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

