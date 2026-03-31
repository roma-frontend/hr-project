"use client";

import React from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MessageSquare } from "lucide-react";
import { toast } from "sonner";

interface DriverQuickMessageProps {
  passengerUserId: Id<"users">;
  passengerName?: string;
  driverUserId: Id<"users">;
  organizationId: Id<"organizations">;
  tripInfo: { from: string; to: string; purpose: string };
}

export function DriverQuickMessage({
  passengerUserId,
  passengerName,
  driverUserId,
  organizationId,
}: DriverQuickMessageProps) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const getOrCreateDM = useMutation(api.chat.getOrCreateDM);
  const sendChatMessage = useMutation(api.chat.sendMessage);

  const DRIVER_TEMPLATES = [
    { id: "arrived", label: t("driver.templates.arrived", "I've Arrived"), message: t("driver.templates.arrivedMsg", "Hi! I've arrived at the pickup location. Ready when you are! 🚗") },
    { id: "delayed", label: t("driver.templates.delayed", "Running Late"), message: t("driver.templates.delayedMsg", "Hi! I'm running about 5 minutes late due to traffic. Apologies! ⏰") },
    { id: "waiting", label: t("driver.templates.waiting", "Waiting"), message: t("driver.templates.waitingMsg", "Hi! I'm waiting at the pickup point. Please let me know when you're ready. 👋") },
    { id: "confirming", label: t("driver.templates.confirming", "Confirming Trip"), message: t("driver.templates.confirmingMsg", "Hi! Confirming your trip. See you soon! ✅") },
    { id: "cant_find", label: t("driver.templates.cantFind", "Can't Find Location"), message: t("driver.templates.cantFindMsg", "Hi! I'm having trouble finding the pickup location. Can you provide more details? 📍") },
    { id: "completed", label: t("driver.templates.completed", "Trip Completed"), message: t("driver.templates.completedMsg", "Thank you for choosing our service! Hope you had a great trip. ⭐") },
  ];

  const handleSend = async (message: string) => {
    try {
      const msg = passengerName ? message.replace("Hi!", `Hi ${passengerName}!`) : message;
      const conversationId = await getOrCreateDM({
        organizationId,
        currentUserId: driverUserId,
        targetUserId: passengerUserId,
      });
      await sendChatMessage({
        conversationId,
        senderId: driverUserId,
        organizationId,
        type: "text",
        content: msg,
      });
      toast.success(t("toasts.messageSentToPassenger"));
      setOpen(false);
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error(t("toasts.messageFailedToSend"));
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1 h-7 px-2 text-xs">
          <MessageSquare className="w-3 h-3" />
          {t("driver.message", "Message")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {DRIVER_TEMPLATES.map((tpl) => (
          <DropdownMenuItem
            key={tpl.id}
            onClick={() => handleSend(tpl.message)}
            className="flex flex-col items-start gap-1 py-2"
          >
            <span className="font-medium text-sm">{tpl.label}</span>
            <span className="text-xs text-muted-foreground line-clamp-1">{tpl.message}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
