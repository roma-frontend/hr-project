"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "@/lib/cssMotion";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  Sparkles, Send, Plus, MessageSquare, Bot, User, Copy,
  MoreHorizontal, Trash2, Edit2, PanelLeftClose, Calendar,
  ClipboardList, Users, TrendingUp, Zap, ArrowDown, ChevronRight, Check, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

type Message = {
  _id?: string;
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  actions?: AnyAction[];
  suggestions?: string[];
  isNew?: boolean;
};

type AnyAction = {
  type: string;
  payload: Record<string, any>;
};

type Conversation = {
  _id: string;
  title: string;
  date: Date;
};

// ═══════════════════════════════════════════════════════════════
// Parse AI response for ACTION tags
// ═══════════════════════════════════════════════════════════════
function parseActions(content: string): { cleanContent: string; actions: AnyAction[] } {
  const actionMatches = [...content.matchAll(/<ACTION>([\s\S]*?)<\/ACTION>/g)];
  if (actionMatches.length === 0) return { cleanContent: content, actions: [] };

  const actions: AnyAction[] = [];
  for (const match of actionMatches) {
    try {
      const action = JSON.parse(match[1].trim()) as AnyAction;
      actions.push(action);
    } catch {
      // skip invalid JSON
    }
  }

  const cleanContent = content.replace(/<ACTION>[\s\S]*?<\/ACTION>/g, '').replace(/\s{2,}/g, ' ').trim();
  return { cleanContent, actions };
}

// ═══════════════════════════════════════════════════════════════
// Follow-up suggestions
// ═══════════════════════════════════════════════════════════════
function getFollowUpSuggestions(content: string, userRole: string, t: (key: string) => string): string[] {
  const lower = content.toLowerCase();

  if (lower.includes('book') || lower.includes('leave') || lower.includes('submitted') || lower.includes('approved')) {
    return [t("chatWidget.showBalance"), t("chatWidget.viewUpcoming"), t("chatWidget.whoOnLeave")];
  }
  if (lower.includes('balance') || lower.includes('days left') || lower.includes('remaining')) {
    return ['📆 Book a vacation', '🤒 Request sick leave', '📊 Show my leave history'];
  }
  if (lower.includes('sick') || lower.includes('doctor') || lower.includes('medical')) {
    return ['🤒 Book sick leave for today', '👨‍⚕️ Book a doctor visit', t("chatWidget.showBalance")];
  }
  if (lower.includes('team') || lower.includes('colleague') || lower.includes('who is')) {
    return ['📅 Show team calendar', '📋 My leave balance', '📆 Book time off'];
  }
  if (lower.includes('cancel') || lower.includes('delete') || lower.includes('removed')) {
    return ['📋 Show my pending leaves', '📆 Book new leave', '📊 My leave balance'];
  }
  if (userRole === 'admin' || userRole === 'supervisor') {
    return [t("chatWidget.whoOnLeaveToday"), t("chatWidget.teamStats"), t("chatWidget.pendingApprovals")];
  }
  return ['📆 Book a vacation', t("chatWidget.showBalance"), '👥 Who is on leave this week?'];
}

// ═══════════════════════════════════════════════════════════════
// Language detection
// ═══════════════════════════════════════════════════════════════
function detectLanguage(text: string): 'en' | 'ru' | 'hy' {
  const ruPattern = /[\u0400-\u04FF]/;
  const hyPattern = /[\u0530-\u058F]/;

  if (ruPattern.test(text)) return 'ru';
  if (hyPattern.test(text)) return 'hy';
  return 'en';
}

export default function AIChatPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuthStore();
  const userId = user?.id as Id<"users"> | undefined;

  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [deletingConversationId, setDeletingConversationId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);

  // Update sidebar state when screen size changes
  useEffect(() => {
    setSidebarOpen(!isMobile);
  }, [isMobile]);

  // Handle conversation selection - close sidebar on mobile
  const handleSelectConversation = (conversationId: string) => {
    setActiveConversationId(conversationId);
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  // Convex queries
  const savedConversations = useQuery(
    userId ? api.aiChat.getConversations : api.aiChat.getConversations,
    userId ? { userId } : "skip"
  );

  const fullContext = useQuery(
    userId ? api.aiChat.getFullContext : api.aiChat.getFullContext,
    userId ? { userId } : "skip"
  );

  // Load messages for active conversation
  const savedMessages = useQuery(
    activeConversationId ? api.aiChat.getMessages : api.aiChat.getMessages,
    activeConversationId ? { conversationId: activeConversationId as Id<"aiConversations"> } : "skip"
  );

  // Convex mutations
  const createConversation = useMutation(api.aiChatMutations.createConversation);
  const updateConversationTitle = useMutation(api.aiChatMutations.updateConversationTitle);
  const deleteConversation = useMutation(api.aiChatMutations.deleteConversation);
  const addMessage = useMutation(api.aiChatMutations.addMessage);
  const deleteMessage = useMutation(api.aiChatMutations.deleteMessage);
  const autoRenameConversation = useMutation(api.aiChatMutations.autoRenameConversation);
  const createLeaveRequest = useMutation(api.aiChatMutations.createLeaveRequest);
  const createTask = useMutation(api.aiChatMutations.createTask);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  // Scroll button visibility
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const scrollHeight = container.scrollHeight;
      const clientHeight = container.clientHeight;
      setShowScrollButton(scrollHeight - scrollTop - clientHeight > 200);
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  // Load conversations from Convex
  const [conversations, setConversations] = useState<Conversation[]>([]);

  useEffect(() => {
    if (savedConversations) {
      const convs = savedConversations.map(c => ({
        _id: c._id,
        title: c.title,
        date: new Date(c.createdAt),
      }));
      setConversations(convs);

      // Auto-select first conversation if none selected
      if (convs.length > 0 && !activeConversationId) {
        setActiveConversationId(convs[0]._id);
      }
    }
  }, [savedConversations]);

  // Load messages when conversation selected
  useEffect(() => {
    if (savedMessages && activeConversationId) {
      const loadedMessages: Message[] = savedMessages.map(m => ({
        _id: m._id,
        id: m._id,
        role: m.role,
        content: m.content,
        timestamp: new Date(m.createdAt),
        actions: [],
        suggestions: [],
      }));
      setMessages(loadedMessages);
    }
  }, [savedMessages, activeConversationId]);

  // Auto-focus input
  useEffect(() => {
    if (textareaRef.current) {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 300);
    }
  }, []);

  // ═══════════════════════════════════════════════════════════════
  // Create new conversation
  // ═══════════════════════════════════════════════════════════════
  const handleNewConversation = async () => {
    if (!userId) return;

    try {
      const { conversationId } = await createConversation({
        userId,
        title: t("aiChat.newChat") || "New Chat",
      });

      setActiveConversationId(conversationId);
      setMessages([]);
      setConversations(prev => [{
        _id: conversationId,
        title: t("aiChat.newChat") || "New Chat",
        date: new Date(),
      }, ...prev]);

      toast.success(t("aiChat.newChatCreated") || "New chat created");
      setTimeout(() => textareaRef.current?.focus(), 100);
    } catch (error) {
      console.error('[Create conversation error]:', error);
      toast.error(t("aiChat.createError") || "Failed to create chat");
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // Delete conversation with animation
  // ═══════════════════════════════════════════════════════════════
  const handleDeleteConversation = async (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      // Start animation
      setDeletingConversationId(conversationId);

      // Wait for animation
      await new Promise(resolve => setTimeout(resolve, 300));

      // Delete from Convex (also deletes all messages)
      await deleteConversation({ conversationId: conversationId as Id<"aiConversations"> });

      // Update local state
      setConversations(prev => prev.filter(c => c._id !== conversationId));

      if (activeConversationId === conversationId) {
        setMessages([]);
        setActiveConversationId(null);
      }

      setDeletingConversationId(null);
      toast.success(t("aiChat.chatDeleted") || "Chat deleted");
    } catch (error) {
      console.error('[Delete conversation error]:', error);
      setDeletingConversationId(null);
      toast.error(t("aiChat.deleteError") || "Failed to delete chat");
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // Start editing title
  // ═══════════════════════════════════════════════════════════════
  const startEditingTitle = (conv: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTitleId(conv._id);
    setEditingTitle(conv.title);
  };

  // ═══════════════════════════════════════════════════════════════
  // Save edited title
  // ═══════════════════════════════════════════════════════════════
  const saveEditedTitle = async (conversationId: string) => {
    try {
      await updateConversationTitle({
        conversationId: conversationId as Id<"aiConversations">,
        title: editingTitle,
      });

      setConversations(prev => prev.map(c =>
        c._id === conversationId ? { ...c, title: editingTitle } : c
      ));
      setEditingTitleId(null);
      toast.success(t("aiChat.titleUpdated") || "Title updated");
    } catch (error) {
      console.error('[Update title error]:', error);
      toast.error(t("aiChat.updateError") || "Failed to update title");
    }
  };

  const cancelEditingTitle = () => {
    setEditingTitleId(null);
    setEditingTitle("");
  };

  // ═══════════════════════════════════════════════════════════════
  // Send message - FULL LOGIC from ChatWidget
  // ═══════════════════════════════════════════════════════════════
  const handleSend = async () => {
    if (!input.trim() || !userId || isLoading) return;

    const lang = detectLanguage(input);
    const userMessageContent = input.trim();

    // If no active conversation, create one
    let currentConvId = activeConversationId;
    if (!currentConvId) {
      try {
        const { conversationId } = await createConversation({
          userId,
          title: userMessageContent.slice(0, 50),
        });
        currentConvId = conversationId;
        setActiveConversationId(conversationId);
        setConversations(prev => [{
          _id: conversationId,
          title: userMessageContent.slice(0, 50),
          date: new Date(),
        }, ...prev]);
      } catch (error) {
        console.error('[Create conversation error]:', error);
        toast.error(t("toasts.conversationCreateFailed"));
        return;
      }
    }

    // Create optimistic user message
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: userMessageContent,
      timestamp: new Date(),
      isNew: true,
    };

    // Add to UI immediately (optimistic update)
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // Save user message to Convex
    try {
      await addMessage({
        conversationId: currentConvId as Id<"aiConversations">,
        role: "user",
        content: userMessage.content,
      });
    } catch (error) {
      console.error('[Save message error]:', error);
    }

    try {
      console.log('🤖 [AI Chat Page] Sending message to AI:', {
        userId,
        message: input
      });

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({ role: m.role, content: m.content })),
          userId,
          lang,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server error ${res.status}`);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      const assistantId = `ai-${Date.now()}`;
      setMessages(prev => [...prev, {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        actions: [],
        suggestions: [],
        isNew: true,
      }]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          fullContent += decoder.decode(value, { stream: true });
          const { cleanContent } = parseActions(fullContent);
          setMessages(prev => prev.map(m =>
            m.id === assistantId ? { ...m, content: cleanContent } : m
          ));
        }
      }

      const { cleanContent, actions } = parseActions(fullContent);
      const suggestions = getFollowUpSuggestions(cleanContent, user?.role || 'employee', t);

      // Check for navigation tags in response
      const navMatch = fullContent.match(/<NAVIGATE>(.*?)<\/NAVIGATE>/);
      if (navMatch && navMatch[1]) {
        const route = navMatch[1];
        console.log('🎯 [AI Navigation] Route:', route);
        setTimeout(() => {
          router.push(route);
        }, 800);
      }

      // Save AI message to Convex
      try {
        await addMessage({
          conversationId: currentConvId as Id<"aiConversations">,
          role: "assistant",
          content: cleanContent.replace(/<NAVIGATE>.*?<\/NAVIGATE>/g, '').trim(),
        });
      } catch (error) {
        console.error('[Save AI message error]:', error);
      }

      // Auto-rename if first message (only user message in loaded messages)
      if (savedMessages && savedMessages.length === 0 && currentConvId) {
        try {
          await autoRenameConversation({
            conversationId: currentConvId as Id<"aiConversations">,
            firstMessage: userMessage.content,
          });
          setConversations(prev => prev.map(c =>
            c._id === currentConvId ? { ...c, title: userMessage.content.slice(0, 50) } : c
          ));
        } catch (error) {
          console.error('[Auto-rename error]:', error);
        }
      }

      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? {
            ...m,
            content: cleanContent.replace(/<NAVIGATE>.*?<\/NAVIGATE>/g, '').trim(),
            actions,
            suggestions,
          }
          : m
      ));
    } catch (error) {
      console.error('[AI Chat Page] Error:', error);
      toast.error(t("aiChat.error") || "Failed to get response");

      // Add error message
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: "❌ " + (error instanceof Error ? error.message : "Unknown error"),
        timestamp: new Date(),
        isNew: true,
      }]);
    } finally {
      setIsLoading(false);
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  };

  const handleSuggestion = (suggestion: string) => {
    const clean = suggestion.replace(/^[\p{Emoji}\s]+/u, '').trim();
    setInput(clean);
    setTimeout(() => handleSend(), 50);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(t("aiChat.copied") || "Copied!");
  };

  const initialSuggestions = [
    { icon: <Calendar className="w-4 h-4" />, label: t("aiChat.quickLeave") || "Отпуск", query: "Создать заявку на отпуск с 1 по 10 января" },
    { icon: <ClipboardList className="w-4 h-4" />, label: t("aiChat.quickTasks") || "Задачи", query: "Показать мои задачи" },
    { icon: <Users className="w-4 h-4" />, label: t("aiChat.quickTeam") || "Команда", query: "Показать сотрудников" },
    { icon: <TrendingUp className="w-4 h-4" />, label: t("aiChat.quickAttendance") || "Посещаемость", query: "Моя посещаемость" },
  ];

  return (
    <div className="flex h-full bg-gradient-to-br from-[var(--background)] via-[var(--background)] to-[var(--primary)]/[0.02]" style={{ contain: "layout" }}>
      {/* Sidebar */}
      <aside
        className={`fixed md:relative z-50 h-full bg-[var(--card)] border-r border-[var(--border)] flex-shrink-0 overflow-hidden ${
          isMobile ? "w-full" : ""
        }`}
        style={{
          position: isMobile ? 'fixed' : 'relative',
          top: 0,
          left: 0,
          height: '100%',
          width: sidebarOpen ? (isMobile ? '100vw' : 300) : 0,
          transform: isMobile ? `translateX(${sidebarOpen ? '0' : '-100%'})` : 'none',
          opacity: sidebarOpen ? 1 : 0,
          willChange: 'width',
          pointerEvents: sidebarOpen || !isMobile ? 'auto' : 'none',
          transition: isMobile
            ? 'transform 300ms ease-in-out, opacity 300ms ease-in-out'
            : `width 600ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 600ms cubic-bezier(0.34, 1.56, 0.64, 1)`,
        }}
      >
        <div className="p-4 h-full flex flex-col" style={{ width: '100%' }}>
          {/* Mobile close button */}
          {isMobile && (
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-[var(--text-primary)] flex items-center gap-2 truncate">
                <MessageSquare className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{t("aiChat.conversations") || "Conversations"}</span>
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setSidebarOpen(false);
                }}
                className="h-8 w-8 p-0 flex-shrink-0 z-50 relative"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Desktop header */}
          {!isMobile && (
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-semibold text-[var(--text-primary)] flex items-center gap-2 truncate">
                <MessageSquare className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{t("aiChat.conversations") || "Conversations"}</span>
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNewConversation}
                className="h-8 w-8 p-0 flex-shrink-0"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Mobile new chat button */}
          {isMobile && (
            <Button
              variant="secondary"
              onClick={handleNewConversation}
              className="w-full mb-4"
            >
              <Plus className="w-4 h-4 mr-2" />
              {t("aiChat.newChat") || "New Chat"}
            </Button>
          )}

          <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
            <AnimatePresence>
              {conversations.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-8 text-[var(--text-muted)] text-sm"
                >
                  {t("aiChat.noConversations") || "No conversations yet"}
                </motion.div>
              ) : (
                conversations.map(conv => (
                  <div
                    key={conv._id}
                    className={`group relative flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-all ${activeConversationId === conv._id
                        ? "bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20"
                        : "hover:bg-[var(--background-subtle)] border border-transparent"
                      }`}
                    onClick={() => handleSelectConversation(conv._id)}
                  >
                    <MessageSquare className="w-4 h-4 flex-shrink-0" />

                    {editingTitleId === conv._id ? (
                      <div className="flex-1 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEditedTitle(conv._id);
                            if (e.key === 'Escape') cancelEditingTitle();
                          }}
                          className="flex-1 min-w-0 bg-transparent border-b border-[var(--primary)] outline-none text-sm"
                          autoFocus
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-green-600"
                          onClick={() => saveEditedTitle(conv._id)}
                        >
                          <Check className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-red-600"
                          onClick={cancelEditingTitle}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <span className="flex-1 text-sm truncate block" title={conv.title}>{conv.title}</span>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={(e) => startEditingTitle(conv, e)}
                          >
                            <Edit2 className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                            onClick={(e) => handleDeleteConversation(conv._id, e)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>
      </aside>

      {/* Main Chat */}
      <main className={`flex-1 flex flex-col min-w-0 h-full overflow-hidden ${!isMobile && !sidebarOpen ? 'md:ml-0' : ''}`}>
        {/* Header */}
        <header className="flex items-center justify-between p-4 border-b border-[var(--border)] bg-[var(--card)]/50 backdrop-blur flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="h-9 w-9 p-0 flex-shrink-0"
            >
              {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </Button>
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--primary)] to-[var(--primary)]/70 flex items-center justify-center flex-shrink-0">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="font-semibold text-[var(--text-primary)] truncate">
                  {t("aiChat.title") || "Shield HR AI"}
                </h1>
                <p className="text-xs text-[var(--text-muted)] truncate">
                  {user?.role === "superadmin" ? "👑 Superadmin" : user?.role === "admin" ? "🛡️ Admin" : "👤 Employee"}
                </p>
              </div>
            </div>
          </div>

          <Badge variant="secondary" className="gap-1 flex-shrink-0">
            <Zap className="w-3 h-3" />
            AI Powered
          </Badge>
        </header>

        {/* Messages */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-0"
        >
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center max-w-2xl px-4"
              >
                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-[var(--primary)] to-[var(--primary)]/70 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-[var(--primary)]/20">
                  <Sparkles className="w-12 h-12 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
                  {t("aiChat.welcomeTitle") || "Welcome!"} {user?.name}
                </h2>
                <p className="text-[var(--text-muted)] mb-8">
                  {t("aiChat.welcomeSubtitle") || "I'm your AI assistant. How can I help?"}
                </p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {initialSuggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestion(suggestion.query)}
                      className="flex flex-col items-center gap-2 p-4 rounded-xl border border-[var(--border)] hover:bg-[var(--background-subtle)] hover:border-[var(--primary)]/30 hover:shadow-lg hover:shadow-[var(--primary)]/10 transition-all group"
                    >
                      <div className="p-2 rounded-lg bg-[var(--primary)]/10 group-hover:bg-[var(--primary)]/20 transition-colors">
                        {suggestion.icon}
                      </div>
                      <span className="text-sm font-medium">{suggestion.label}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            </div>
          ) : (
            <div className="space-y-4 max-w-4xl mx-auto mt-4 p-4">
              {messages.map((message, index) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: message.isNew ? 20 : 0 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: message.isNew ? index * 0.05 : 0 }}
                  className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}
                >
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    <AvatarFallback className={message.role === "user" ? "bg-[var(--primary)] text-white" : "bg-gradient-to-br from-[var(--primary)] to-[var(--primary)]/70 text-white"}>
                      {message.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </AvatarFallback>
                  </Avatar>

                  <div className={`flex-1 max-w-[80%] ${message.role === "user" ? "text-right" : ""}`}>
                    <Card className={`p-4 border-0 shadow-sm ${message.role === "user"
                        ? "bg-[var(--primary)] text-white"
                        : "bg-[var(--card)] border-[var(--border)]"
                      }`}>
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    </Card>

                    <div className={`flex items-center gap-2 mt-1 ${message.role === "user" ? "justify-end" : ""}`}>
                      <span className="text-xs text-[var(--text-muted)]">
                        {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>

                      {message.role === "assistant" && (
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => copyToClipboard(message.content)}>
                          <Copy className="w-3 h-3" />
                        </Button>
                      )}
                    </div>

                    {/* Follow-up suggestions */}
                    {message.role === "assistant" && message.suggestions && message.suggestions.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {message.suggestions.map((suggestion, i) => (
                          <button
                            key={i}
                            onClick={() => handleSuggestion(suggestion)}
                            className="text-xs px-3 py-1.5 rounded-full bg-[var(--background-subtle)] hover:bg-[var(--primary)]/10 hover:text-[var(--primary)] transition-colors border border-[var(--border)] hover:border-[var(--primary)]/30"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}

              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-3"
                >
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-gradient-to-br from-[var(--primary)] to-[var(--primary)]/70 text-white">
                      <Bot className="w-4 h-4" />
                    </AvatarFallback>
                  </Avatar>
                  <Card className="p-4 bg-[var(--card)] border-[var(--border)]">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 rounded-full bg-[var(--primary)] animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 rounded-full bg-[var(--primary)] animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 rounded-full bg-[var(--primary)] animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </Card>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-4 border-t border-[var(--border)] bg-[var(--card)]/50 backdrop-blur flex-shrink-0">
          <div className="flex gap-3 max-w-4xl mx-auto">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={isListening ? t("chatWidget.listening") : (t("aiChat.inputPlaceholder") || "Ask anything...")}
              className="flex-1 resize-none bg-[var(--background)] border border-[var(--border)] rounded-xl p-4 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 min-h-[56px] max-h-[200px]"
              rows={1}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="px-6 rounded-xl flex-shrink-0"
              size="lg"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>

          <p className="text-xs text-center text-[var(--text-muted)] mt-3">
            {t("aiChat.disclaimer") || "AI may make mistakes. Please verify important information."}
          </p>
        </div>
      </main>

      {/* Scroll button */}
      <AnimatePresence>
        {showScrollButton && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={scrollToBottom}
            className="absolute bottom-28 right-6 p-3 rounded-full bg-[var(--primary)] text-white shadow-lg hover:shadow-xl transition-shadow"
          >
            <ArrowDown className="w-4 h-4" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
