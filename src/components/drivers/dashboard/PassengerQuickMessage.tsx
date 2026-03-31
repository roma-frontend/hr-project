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

interface PassengerQuickMessageProps {
  driverUserId: Id<"users">;
  passengerUserId: Id<"users">;
  organizationId: Id<"organizations">;
  tripInfo: { from: string; to: string; purpose: string };
}

export function PassengerQuickMessage({
  driverUserId,
  passengerUserId,
  organizationId,
}: PassengerQuickMessageProps) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const getOrCreateDM = useMutation(api.chat.getOrCreateDM);
  const sendChatMessage = useMutation(api.chat.sendMessage);

  const PASSENGER_TEMPLATES = [
    { id: "omw", label: t("driver.templates.passengerOmw", "On My Way"), message: t("driver.templates.passengerOmwMsg", "Hi! I'm on my way to the pickup point. Be there shortly! 🚶") },
    { id: "ready", label: t("driver.templates.passengerReady", "Ready"), message: t("driver.templates.passengerReadyMsg", "Hi! I'm ready at the pickup location. 📍") },
    { id: "delayed", label: t("driver.templates.passengerDelayed", "Running Late"), message: t("driver.templates.passengerDelayedMsg", "Hi! I'll be about 5 minutes late. Sorry for the wait! ⏰") },
    { id: "cancel", label: t("driver.templates.passengerCancel", "Need to Cancel"), message: t("driver.templates.passengerCancelMsg", "Hi! I need to cancel/reschedule this trip. Sorry for the inconvenience. 🙏") },
    { id: "thanks", label: t("driver.templates.passengerThanks", "Thank You"), message: t("driver.templates.passengerThanksMsg", "Thank you for the ride! Great service! ⭐") },
  ];

  const handleSend = async (message: string) => {
    try {
      const conversationId = await getOrCreateDM({
        organizationId,
        currentUserId: passengerUserId,
        targetUserId: driverUserId,
      });
      await sendChatMessage({
        conversationId,
        senderId: passengerUserId,
        organizationId,
        type: "text",
        content: message,
      });
      toast.success("Message sent to driver");
      setOpen(false);
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Failed to send message");
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1 h-7 px-2 text-xs">
          <MessageSquare className="w-3 h-3" />
          {t("driver.messageDriver", "Message Driver")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {PASSENGER_TEMPLATES.map((tpl) => (
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
