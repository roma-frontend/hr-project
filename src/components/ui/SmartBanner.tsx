"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle,
  AlertCircle,
  Info,
  XCircle,
  Lightbulb,
  ArrowRight,
  X,
  Sparkles,
} from "lucide-react";

export type BannerType = "success" | "warning" | "info" | "error" | "purple";

export interface SmartBannerProps {
  type: BannerType;
  message: string;
  suggestion?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  dismissable?: boolean;
  autoDismiss?: number; // ms — auto-hide after this duration
  onDismiss?: () => void;
  className?: string;
  icon?: React.ReactNode; // custom icon override
}

const colorClasses: Record<BannerType, string> = {
  success:
    "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400",
  warning:
    "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400",
  info: "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400",
  error: "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400",
  purple:
    "bg-violet-500/10 border-violet-500/20 text-violet-600 dark:text-violet-400",
};

const iconColors: Record<BannerType, string> = {
  success: "text-emerald-500",
  warning: "text-amber-500",
  info: "text-blue-500",
  error: "text-red-500",
  purple: "text-violet-500",
};

const defaultIcons: Record<BannerType, React.ComponentType<{ className?: string }>> = {
  success: CheckCircle,
  warning: AlertCircle,
  info: Info,
  error: XCircle,
  purple: Sparkles,
};

export function SmartBanner({
  type,
  message,
  suggestion,
  action,
  dismissable = true,
  autoDismiss,
  onDismiss,
  className = "",
  icon,
}: SmartBannerProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (autoDismiss && autoDismiss > 0) {
      const timer = setTimeout(() => {
        setVisible(false);
        onDismiss?.();
      }, autoDismiss);
      return () => clearTimeout(timer);
    }
  }, [autoDismiss, onDismiss]);

  const handleDismiss = () => {
    setVisible(false);
    onDismiss?.();
  };

  const Icon = defaultIcons[type];

  return (
    <AnimatePresence mode="wait">
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className={`relative overflow-hidden rounded-xl border p-4 ${colorClasses[type]} ${className}`}
        >
          {/* Animated background gradient */}
          <motion.div
            className="absolute inset-0 opacity-30"
            animate={{
              background: [
                "radial-gradient(circle at 0% 0%, currentColor 0%, transparent 50%)",
                "radial-gradient(circle at 100% 100%, currentColor 0%, transparent 50%)",
                "radial-gradient(circle at 0% 0%, currentColor 0%, transparent 50%)",
              ],
            }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          />

          {/* Dismiss button */}
          {dismissable && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              onClick={handleDismiss}
              className="absolute top-3 right-3 p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors z-10"
            >
              <X className="w-3.5 h-3.5" />
            </motion.button>
          )}

          <div className="relative flex gap-3">
            {/* Animated icon */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 25 }}
              className="flex-shrink-0"
            >
              {icon || <Icon className={`w-5 h-5 ${iconColors[type]}`} />}
            </motion.div>

            <div className="flex-1 space-y-2 pr-4">
              {/* Main message */}
              <motion.p
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="text-sm font-medium leading-relaxed"
              >
                {message}
              </motion.p>

              {/* Suggestion */}
              {suggestion && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="flex items-start gap-2 text-xs opacity-90"
                >
                  <Lightbulb className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <p className="leading-relaxed">{suggestion}</p>
                </motion.div>
              )}

              {/* Action button */}
              {action && (
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  onClick={action.onClick}
                  className="flex items-center gap-1.5 text-xs font-medium underline underline-offset-2 hover:no-underline transition-all group"
                >
                  {action.label}
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </motion.button>
              )}
            </div>
          </div>

          {/* Auto-dismiss progress bar */}
          {autoDismiss && autoDismiss > 0 && (
            <motion.div
              className="absolute bottom-0 left-0 h-0.5 bg-current opacity-30"
              initial={{ width: "100%" }}
              animate={{ width: "0%" }}
              transition={{ duration: autoDismiss / 1000, ease: "linear" }}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
