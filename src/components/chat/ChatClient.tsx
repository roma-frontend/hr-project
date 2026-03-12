"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { ConversationList } from "./ConversationList";
import { ChatWindow } from "./ChatWindow";
import { NewConversationModal } from "./NewConversationModal";
import { CallModal } from "./CallModal";
import { cn } from "@/lib/utils";
import { MessageCircle } from "lucide-react";
import { useOrgSelectorStore } from "@/store/useOrgSelectorStore";
import { ShieldLoader } from "@/components/ui/ShieldLoader";
import { useTranslation } from "react-i18next";

interface Props {
  userId: string;
  organizationId: string;
  userName: string;
  userAvatar?: string;
  userRole: string;
}

export interface ActiveCall {
  callId: Id<"chatCalls">;
  conversationId: Id<"chatConversations">;
  type: "audio" | "video";
  isInitiator: boolean;
  remoteUserId?: Id<"users">;
  remoteUserName?: string;
}

export default function ChatClient({ userId, organizationId, userName, userAvatar, userRole }: Props) {
  const [selectedConvId, setSelectedConvId] = useState<Id<"chatConversations"> | null>(null);
  const [showNewConv, setShowNewConv] = useState(false);
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [chatVisible, setChatVisible] = useState(false);

  const uid = userId as Id<"users">;
  const orgId = organizationId as Id<"organizations">;

  // Respect org selector: if a specific org is selected (e.g. superadmin), use it
  const { selectedOrgId } = useOrgSelectorStore();
  const effectiveOrgId = (selectedOrgId ? selectedOrgId as Id<"organizations"> : orgId);

  const conversations = useQuery(
    api.chat.getMyConversations,
    uid && effectiveOrgId ? { userId: uid, organizationId: effectiveOrgId } : "skip"
  );

  const initiateCallMutation = useMutation(api.chat.initiateCall);

  // Conversation management mutations
  const togglePinMutation = useMutation(api.chat.togglePin);
  const deleteConversationMutation = useMutation(api.chat.deleteConversation);
  const restoreConversationMutation = useMutation(api.chat.restoreConversation);
  const toggleArchiveMutation = useMutation(api.chat.toggleArchive);
  const toggleMuteMutation = useMutation(api.chat.toggleMute);

  const handleSelectConversation = useCallback((convId: Id<"chatConversations">) => {
    setSelectedConvId(convId);
    setMobileShowChat(true);
    // slight delay so animation fires after state set
    setTimeout(() => setChatVisible(true), 10);
  }, []);

  // When deselecting on mobile
  const handleBack = useCallback(() => {
    setChatVisible(false);
    setTimeout(() => {
      setMobileShowChat(false);
      setSelectedConvId(null);
    }, 280);
  }, []);

  const handleStartCall = useCallback(async (
    convId: Id<"chatConversations">,
    type: "audio" | "video",
    participantIds: Id<"users">[],
    remoteUserName?: string,
  ) => {
    console.log('[ChatClient] Starting call', {
      convId,
      initiator: uid,
      participants: participantIds,
      org: effectiveOrgId,
    });

    const callId = await initiateCallMutation({
      conversationId: convId,
      organizationId: effectiveOrgId,
      initiatorId: uid,
      type,
      participantIds,
    });
    setActiveCall({
      callId,
      conversationId: convId,
      type,
      isInitiator: true,
      remoteUserId: participantIds.find((id) => id !== uid),
      remoteUserName,
    });
  }, [initiateCallMutation, effectiveOrgId, uid]);

  const handleEndCall = useCallback(() => {
    setActiveCall(null);
  }, []);

  // Animate chat panel in when selectedConvId changes on md+
  useEffect(() => {
    if (selectedConvId) {
      setTimeout(() => setChatVisible(true), 10);
    } else {
      setChatVisible(false);
    }
  }, [selectedConvId]);

  if (!uid || !effectiveOrgId) return (
    <div className="flex h-full items-center justify-center" style={{ background: "var(--background)" }}>
      <ShieldLoader size="lg" />
    </div>
  );

  return (
    <>
      {/* New Conversation Modal - OUTSIDE overflow-hidden container */}
      {showNewConv && (
        <>
          <NewConversationModal
            currentUserId={uid}
            organizationId={effectiveOrgId}
            userRole={userRole}
            onClose={() => setShowNewConv(false)}
            onCreated={(convId) => {
              setSelectedConvId(convId);
              setShowNewConv(false);
              setMobileShowChat(true);
            }}
          />
        </>
      )}

      <div
        className="flex flex-1 min-h-0 h-full overflow-hidden sm:rounded-xl border-0 sm:border relative"
        style={{ borderColor: "var(--border)", background: "var(--background)" }}
      >
      {/* ── Sidebar: Conversation List ───────────────────────────────── */}
      <div
        className={cn(
          "flex flex-col border-r shrink-0 transition-all duration-300 ease-in-out",
          // Mobile: full height of parent (parent already accounts for navbar)
          "absolute inset-0 md:relative md:inset-auto",
          "md:w-72 lg:w-80",
          // Desktop: always visible and interactive
          "md:opacity-100 md:translate-x-0 md:pointer-events-auto",
          // Mobile: hide/show based on mobileShowChat
          mobileShowChat 
            ? "opacity-0 pointer-events-none -translate-x-4"
            : "opacity-100 translate-x-0 pointer-events-auto",
          "z-10 md:z-auto"
        )}
        style={{ borderColor: "var(--border)", background: "var(--sidebar-bg)" }}
      >
        <ConversationList
          conversations={(conversations ?? []).filter(Boolean) as any}
          selectedId={selectedConvId}
          currentUserId={uid}
          onSelect={handleSelectConversation}
          onNewConversation={() => {
            setShowNewConv(true);
          }}
          onTogglePin={async (convId) => { await togglePinMutation({ conversationId: convId, userId: uid }); }}
          onDelete={async (convId) => { await deleteConversationMutation({ conversationId: convId, userId: uid }); }}
          onRestore={async (convId) => { await restoreConversationMutation({ conversationId: convId, userId: uid }); }}
          onToggleArchive={async (convId) => { await toggleArchiveMutation({ conversationId: convId, userId: uid }); }}
          onToggleMute={async (convId) => { await toggleMuteMutation({ conversationId: convId, userId: uid }); }}
        />
      </div>

      {/* ── Main: Chat Window ──────────────────────────────────────────── */}
      <div
        className={cn(
          "flex-1 flex flex-col min-w-0 overflow-x-hidden",
          // Mobile: absolute overlay sliding from right
          // Parent container already starts below navbar, so inset-0 is correct
          "absolute inset-0 md:relative md:inset-auto",
          "z-20 md:z-auto",
          mobileShowChat
            ? "translate-x-0 opacity-100"
            : "translate-x-full opacity-0 md:translate-x-0 md:opacity-100",
          "transition-all duration-300 ease-in-out"
        )}
        style={{ background: "var(--background)" }}
      >
        {selectedConvId ? (
          /* Animate the chat window content in */
          <div
            className={cn(
              "flex flex-col h-full transition-all duration-300 ease-out",
              chatVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
            )}
          >
            <ChatWindow
              key={selectedConvId}
              conversationId={selectedConvId}
              currentUserId={uid}
              organizationId={effectiveOrgId}
              currentUserName={userName}
              currentUserAvatar={userAvatar}
              onBack={handleBack}
              onStartCall={handleStartCall}
            />
          </div>
        ) : (
          <EmptyState onNewConversation={() => setShowNewConv(true)} />
        )}
      </div>
      </div>

      {/* Active Call Modal */}
      {activeCall && (
        <CallModal
          call={activeCall}
          currentUserId={uid}
          currentUserName={userName}
          currentUserAvatar={userAvatar}
          onEnd={handleEndCall}
        />
      )}

    </>
  );
}

function EmptyState({ onNewConversation }: { onNewConversation: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-5 p-8 select-none animate-fade-in">
      {/* Animated shield icon */}
      <div
        className="w-20 h-20 rounded-2xl flex items-center justify-center shadow-lg"
        style={{
          background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-dark, var(--primary)) 100%)",
          animation: "float 3s ease-in-out infinite",
        }}
      >
        <MessageCircle className="w-9 h-9 text-white" />
      </div>
      <div className="text-center">
        <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
          {t('chat.yourMessages')}
        </h2>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {t('chat.yourMessagesSubtitle')}
        </p>
      </div>
      <button
        onClick={onNewConversation}
        className="px-5 py-2.5 rounded-xl text-sm font-medium text-white shadow-md transition-all duration-200 hover:scale-105 hover:shadow-lg active:scale-95"
        style={{ background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-dark, var(--primary)) 100%)" }}
      >
        {t('chat.startConversation')}
      </button>

      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
      `}</style>
    </div>
  );
}
