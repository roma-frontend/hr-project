/**
 * Leave Request Wizard — Пошаговый мастер создания заявки на отпуск
 * 
 * 3 шага вместо одной сложной формы:
 * 1. Тип отпуска + Даты
 * 2. Баланс и детали
 * 3. Подтверждение
 */

"use client";

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, CheckCircle, ChevronRight, ChevronLeft, X, Info, AlertTriangle } from "lucide-react";
import { format, differenceInDays, addDays } from "date-fns";
import { ru } from "date-fns/locale";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { LEAVE_TYPE_LABELS, LEAVE_TYPE_COLORS, type LeaveType } from "@/lib/types";

interface LeaveRequestWizardProps {
  userId: Id<"users">;
  onClose: () => void;
}

type LeaveStep = "dates" | "details" | "confirm";

export function LeaveRequestWizard({ userId, onClose }: LeaveRequestWizardProps) {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState<LeaveStep>("dates");
  
  // Данные формы
  const [leaveType, setLeaveType] = useState<LeaveType>("paid");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [comment, setComment] = useState<string>("");

  // Загрузка баланса пользователя
  const user = useQuery(api.users.getUserById, { userId });
  const createLeave = useMutation(api.leaves.createLeave);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Вычисление дней
  const calculateDays = () => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    return differenceInDays(end, start) + 1;
  };

  const days = calculateDays();

  // Проверка баланса
  const getBalance = () => {
    if (!user) return 0;
    switch (leaveType) {
      case "paid": return user.paidLeaveBalance ?? 24;
      case "sick": return user.sickLeaveBalance ?? 10;
      case "family": return user.familyLeaveBalance ?? 5;
      default: return 999;
    }
  };

  const balance = getBalance();
  const remainingBalance = balance - days;
  const hasEnoughBalance = remainingBalance >= 0;

  // Переход к следующему шагу
  const handleNext = () => {
    if (currentStep === "dates" && startDate && endDate && days > 0) {
      setCurrentStep("details");
    } else if (currentStep === "details" && reason) {
      setCurrentStep("confirm");
    }
  };

  const handleBack = () => {
    if (currentStep === "details") {
      setCurrentStep("dates");
    } else if (currentStep === "confirm") {
      setCurrentStep("details");
    }
  };

  // Отправка заявки
  const handleSubmit = async () => {
    if (!hasEnoughBalance) {
      toast.error(t("leaveWizard.errors.insufficientBalance"));
      return;
    }

    setIsSubmitting(true);
    try {
      await createLeave({
        userId,
        type: leaveType,
        startDate,
        endDate,
        days,
        reason,
        comment: comment || undefined,
      });

      toast.success(t("leaveWizard.toast.success"), {
        description: t("leaveWizard.toast.description"),
      });
      onClose();
    } catch (error) {
      toast.error(t("leaveWizard.toast.error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Рендер шагов
  const renderStep = () => {
    switch (currentStep) {
      case "dates":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">{t("leaveWizard.steps.dates.title")}</h3>

              {/* Тип отпуска */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-6">
                {(Object.keys(LEAVE_TYPE_LABELS) as LeaveType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => setLeaveType(type)}
                    className={`p-3 rounded-lg border-2 transition-all text-sm font-medium ${
                      leaveType === type
                        ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                        : "border-[var(--border)] bg-[var(--card)] text-[var(--text-primary)] hover:border-[var(--primary)]/50"
                    }`}
                  >
                    {LEAVE_TYPE_LABELS[type]}
                  </button>
                ))}
              </div>

              {/* Даты */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-[var(--text-primary)] mb-2 block">{t("leaveWizard.startDate")}</Label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    min={format(new Date(), "yyyy-MM-dd")}
                    className="w-full p-3 rounded-lg border border-[var(--input-border)] bg-[var(--input)] text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent"
                    style={{
                      colorScheme: 'light',
                    }}
                  />
                </div>
                <div>
                  <Label className="text-[var(--text-primary)] mb-2 block">{t("leaveWizard.endDate")}</Label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate || format(new Date(), "yyyy-MM-dd")}
                    className="w-full p-3 rounded-lg border border-[var(--input-border)] bg-[var(--input)] text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent"
                    style={{
                      colorScheme: 'light',
                    }}
                  />
                </div>
              </div>

              {days > 0 && (
                <div className="mt-4 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  <span className="font-medium">
                    {t("leaveWizard.totalDays", { count: days })}
                  </span>
                  <span className="text-sm text-gray-500">
                    {format(new Date(startDate), "dd MMM", { locale: ru })} — {format(new Date(endDate), "dd MMM yyyy", { locale: ru })}
                  </span>
                </div>
              )}
            </div>
          </div>
        );

      case "details":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">{t("leaveWizard.steps.details.title")}</h3>

              {/* Баланс */}
              <div className={`p-4 rounded-lg mb-6 ${hasEnoughBalance ? "bg-[var(--success)]/10" : "bg-[var(--destructive)]/10"}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    {t("leaveWizard.currentBalance")}
                  </span>
                  <span className="text-lg font-bold text-[var(--text-primary)]">{balance} {t("leaveWizard.days")}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    {t("leaveWizard.afterLeave")}
                  </span>
                  <span className={`text-lg font-bold ${hasEnoughBalance ? "text-[var(--success)]" : "text-[var(--destructive)]"}`}>
                    {remainingBalance} {t("leaveWizard.days")}
                  </span>
                </div>
                {!hasEnoughBalance && (
                  <div className="mt-3 flex items-center gap-2 text-[var(--destructive)] text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    {t("leaveWizard.errors.insufficientBalance")}
                  </div>
                )}
              </div>

              {/* Причина */}
              <div className="mb-4">
                <Label className="text-[var(--text-primary)] block mb-2">{t("leaveWizard.reason")} *</Label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t("leaveWizard.reasonPlaceholder")}
                  className="w-full p-3 rounded-lg border border-[var(--input-border)] bg-[var(--input)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent"
                />
              </div>

              {/* Комментарий */}
              <div>
                <Label className="text-[var(--text-primary)] block mb-2">{t("leaveWizard.comment")} ({t("leaveWizard.optional")})</Label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={t("leaveWizard.commentPlaceholder")}
                  rows={3}
                  className="w-full p-3 rounded-lg border border-[var(--input-border)] bg-[var(--input)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent resize-none"
                />
              </div>
            </div>
          </div>
        );

      case "confirm":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">{t("leaveWizard.steps.confirm.title")}</h3>

              <div className="p-6 rounded-lg bg-[var(--background-subtle)] space-y-4">
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">{t("leaveWizard.type")}</span>
                  <span className="font-medium text-[var(--text-primary)]">{LEAVE_TYPE_LABELS[leaveType]}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">{t("leaveWizard.dates")}</span>
                  <span className="font-medium text-[var(--text-primary)]">
                    {format(new Date(startDate), "dd MMM")} — {format(new Date(endDate), "dd MMM yyyy", { locale: ru })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">{t("leaveWizard.totalDays", { count: days })}</span>
                  <span className="font-medium text-[var(--text-primary)]">{days} {t("leaveWizard.days")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">{t("leaveWizard.reason")}</span>
                  <span className="font-medium text-[var(--text-primary)]">{reason}</span>
                </div>
                {comment && (
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">{t("leaveWizard.comment")}</span>
                    <span className="font-medium text-[var(--text-primary)]">{comment}</span>
                  </div>
                )}
                <div className="pt-4 border-t border-[var(--border)]">
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">{t("leaveWizard.balanceAfter")}</span>
                    <span className={`font-bold ${remainingBalance >= 0 ? "text-[var(--success)]" : "text-[var(--destructive)]"}`}>
                      {remainingBalance} {t("leaveWizard.days")}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 rounded-lg bg-[var(--background-subtle)]">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-[var(--primary)] mt-0.5" />
                  <div className="text-sm text-[var(--text-secondary)]">
                    <p className="font-medium text-[var(--text-primary)] mb-1">{t("leaveWizard.info.title")}</p>
                    <p>{t("leaveWizard.info.description")}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-2xl"
      >
        <Card className="border-0 shadow-2xl">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{t("leaveWizard.title")}</CardTitle>
                <CardDescription>{t("leaveWizard.description")}</CardDescription>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Индикатор прогресса */}
            <div className="flex items-center gap-2 mt-6">
              {(["dates", "details", "confirm"] as LeaveStep[]).map((step, index) => (
                <React.Fragment key={step}>
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                        currentStep === step
                          ? "bg-blue-600 text-white"
                          : (["dates", "details", "confirm"].indexOf(currentStep) > index)
                          ? "bg-green-600 text-white"
                          : "bg-gray-200 dark:bg-gray-700 text-gray-500"
                      }`}
                    >
                      {["dates", "details", "confirm"].indexOf(currentStep) > index ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        index + 1
                      )}
                    </div>
                    <span className={`text-sm font-medium ${currentStep === step ? "text-blue-600" : "text-gray-500"}`}>
                      {t(`leaveWizard.steps.${step}.short`)}
                    </span>
                  </div>
                  {index < 2 && <ChevronRight className="w-4 h-4 text-gray-300" />}
                </React.Fragment>
              ))}
            </div>
          </CardHeader>

          <CardContent>
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                {renderStep()}
              </motion.div>
            </AnimatePresence>

            {/* Кнопки навигации */}
            <div className="flex justify-between mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              {currentStep !== "dates" ? (
                <Button onClick={handleBack} variant="outline">
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  {t("common.back")}
                </Button>
              ) : (
                <Button onClick={onClose} variant="ghost">
                  {t("common.cancel")}
                </Button>
              )}

              {currentStep === "confirm" ? (
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !hasEnoughBalance}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isSubmitting ? t("leaveWizard.submitting") : t("leaveWizard.submit")}
                </Button>
              ) : (
                <Button
                  onClick={handleNext}
                  disabled={(currentStep === "dates" && (!startDate || !endDate || days <= 0))}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {t("common.next")}
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
