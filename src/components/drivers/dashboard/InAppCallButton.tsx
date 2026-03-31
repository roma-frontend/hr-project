"use client";

import React from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { PhoneCall } from "lucide-react";
import { toast } from "sonner";
import { CallModal } from "@/components/chat/CallModal";
import type { ActiveCall } from "@/components/chat/ChatClient";

interface InAppCallButtonProps {
  callerUserId: Id<"users">;
  callerName: string;
  remoteUserId: Id<"users">;
  remoteName: string;
  remotePhone?: string;
  organizationId: Id<"organizations">;
  label?: string;
}

export function InAppCallButton({
  callerUserId,
  callerName,
  remoteUserId,
  remoteName,
  remotePhone,
  organizationId,
  label,
}: InAppCallButtonProps) {
  const { t } = useTranslation();
  const [activeCall, setActiveCall] = React.useState<ActiveCall | null>(null);
  const [calling, setCalling] = React.useState(false);
  const getOrCreateDM = useMutation(api.chat.getOrCreateDM);
  const initiateCallMutation = useMutation(api.chat.initiateCall);

  const handleCall = async () => {
    if (calling) return;
    setCalling(true);
    try {
      const conversationId = await getOrCreateDM({
        organizationId,
        currentUserId: callerUserId,
        targetUserId: remoteUserId,
      });
      const callId = await initiateCallMutation({
        conversationId,
        organizationId,
        initiatorId: callerUserId,
        type: "audio",
        participantIds: [callerUserId, remoteUserId],
      });
      setActiveCall({
        callId,
        conversationId,
        type: "audio",
        isInitiator: true,
        remoteUserId,
        remoteUserName: remoteName,
      });
    } catch (error) {
      console.error("Failed to start call:", error);
      if (remotePhone) {
        window.open(`tel:${remotePhone}`);
      } else {
        toast.error("Failed to start call");
      }
    } finally {
      setCalling(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" className="gap-1 h-7 px-2 text-xs" onClick={handleCall} disabled={calling}>
        <PhoneCall className="w-3 h-3" />
        {label || t("driver.call", "Call") + ` ${remoteName}`}
      </Button>
      {activeCall && (
        <CallModal
          call={activeCall}
          currentUserId={callerUserId}
          currentUserName={callerName}
          onEnd={() => setActiveCall(null)}
        />
      )}
    </>
  );
}
