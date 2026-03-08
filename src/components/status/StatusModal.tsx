"use client";

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  Clock,
  Phone,
  Home,
  Zap,
  X,
} from "lucide-react";
import { toast } from "sonner";

interface StatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: Id<"users">;
  currentStatus?: string;
  onStatusChange?: (status: string) => void;
}

type StatusType = "available" | "in_meeting" | "in_call" | "out_of_office" | "busy";

interface StatusOption {
  value: StatusType;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

export function StatusModal({
  isOpen,
  onClose,
  currentUserId,
  currentStatus = "available",
  onStatusChange,
}: StatusModalProps) {
  const { t, i18n } = useTranslation();
  const [selectedStatus, setSelectedStatus] = useState<StatusType>(
    (currentStatus as StatusType) || "available"
  );
  const [showConfirm, setShowConfirm] = useState(false);
  const [outOfOfficeMsg, setOutOfOfficeMsg] = useState("");

  const updateStatusMutation = useMutation(api.users.updatePresenceStatus);

  const statusOptions: {
    [key in StatusType]: StatusOption;
  } = {
    available: {
      value: "available",
      icon: <CheckCircle2 className="w-12 h-12" />,
      color: "text-green-500",
      bgColor: "bg-green-50 dark:bg-green-950",
    },
    in_meeting: {
      value: "in_meeting",
      icon: <Clock className="w-12 h-12" />,
      color: "text-yellow-500",
      bgColor: "bg-yellow-50 dark:bg-yellow-950",
    },
    in_call: {
      value: "in_call",
      icon: <Phone className="w-12 h-12" />,
      color: "text-blue-500",
      bgColor: "bg-blue-50 dark:bg-blue-950",
    },
    out_of_office: {
      value: "out_of_office",
      icon: <Home className="w-12 h-12" />,
      color: "text-orange-500",
      bgColor: "bg-orange-50 dark:bg-orange-950",
    },
    busy: {
      value: "busy",
      icon: <Zap className="w-12 h-12" />,
      color: "text-red-500",
      bgColor: "bg-red-50 dark:bg-red-950",
    },
  };

  const getStatusDescription = (status: StatusType): string => {
    const key = `status.${status}.description`;
    return t(key, `Status: ${status}`);
  };

  const getStatusNotification = (status: StatusType): string => {
    const key = `status.${status}.notification`;
    return t(key, "");
  };

  const handleStatusSelect = (status: StatusType) => {
    setSelectedStatus(status);
    if (status === "out_of_office") {
      setShowConfirm(true);
    } else {
      setShowConfirm(true);
    }
  };

  const handleConfirm = async () => {
    try {
      await updateStatusMutation({
        userId: currentUserId,
        presenceStatus: selectedStatus as any,
        outOfOfficeMessage: outOfOfficeMsg,
      });

      // Show notification
      const notification = getStatusNotification(selectedStatus);
      toast.success(notification || `Status changed to ${selectedStatus}`);

      onStatusChange?.(selectedStatus);
      setShowConfirm(false);
      onClose();
    } catch (error) {
      console.error("Failed to update status:", error);
      toast.error(t("status.updateFailed", "Failed to update status"));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl mx-4 rounded-3xl overflow-hidden shadow-2xl bg-white dark:bg-slate-900 animate-scale-in">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        {!showConfirm ? (
          <div className="p-8">
            <h2 className="text-3xl font-bold text-center mb-2">
              {t("status.selectStatus", "Select Your Status")}
            </h2>
            <p className="text-center text-gray-600 dark:text-gray-400 mb-8">
              {t("status.selectSubtitle", "Choose how you want to be perceived by your team")}
            </p>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {Object.values(statusOptions).map((option) => {
                const isSelected = selectedStatus === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => handleStatusSelect(option.value)}
                    className={cn(
                      "p-4 rounded-2xl transition-all duration-200 flex flex-col items-center gap-3",
                      isSelected
                        ? `${option.bgColor} border-2 border-current ${option.color}`
                        : "bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 border-2 border-transparent"
                    )}
                  >
                    <div className={cn("transition-colors", isSelected && option.color)}>
                      {option.icon}
                    </div>
                    <span className="text-sm font-semibold text-center line-clamp-2">
                      {t(`status.${option.value}.label`, option.value)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="p-8">
            <h2 className="text-3xl font-bold text-center mb-6">
              {t("status.confirmChange", "Confirm Status Change")}
            </h2>

            <div className="mb-8 p-6 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-l-4 border-blue-500">
              <h3 className="font-semibold text-lg mb-2">
                {t(`status.${selectedStatus}.label`, selectedStatus)}
              </h3>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                {getStatusDescription(selectedStatus as StatusType)}
              </p>
              <div className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t("status.whatHappens", "What's going to change:")}
                </p>
                <p className="text-base font-semibold text-gray-900 dark:text-white mt-2">
                  {getStatusNotification(selectedStatus as StatusType)}
                </p>
              </div>
            </div>

            {selectedStatus === "out_of_office" && (
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  {t("status.outOfOfficeMsg", "Out of office message (optional)")}
                </label>
                <textarea
                  value={outOfOfficeMsg}
                  onChange={(e) => setOutOfOfficeMsg(e.target.value)}
                  placeholder={t("status.outOfOfficePlaceholder", "Tell your team when you'll be back...")}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows={3}
                />
              </div>
            )}

            <div className="flex gap-4">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 px-6 py-3 rounded-lg border border-gray-300 dark:border-gray-600 font-semibold hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              >
                {t("status.back", "Back")}
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 px-6 py-3 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold hover:shadow-lg transition-all"
              >
                {t("status.confirm", "Confirm")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
