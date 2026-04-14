'use client';
import Image from 'next/image';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  Phone,
  Video,
  Search,
  Pin,
  Info,
  Send,
  Paperclip,
  Smile,
  X,
  FileText,
  Clock,
  BarChart2,
  Mic,
} from 'lucide-react';
import { ShieldLoader } from '@/components/ui/ShieldLoader';
import Link from 'next/link';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ThreadPanel } from './ThreadPanel';
import { ConversationInfoPanel } from './ConversationInfoPanel';
import { format, isToday, isYesterday } from 'date-fns';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';
import EmojiPicker from './EmojiPicker';
import { VoiceMessageRecorder } from './VoiceMessageRecorder';
import { uploadChatAttachment } from '@/actions/cloudinary';
import { playChatMessageSound } from '@/lib/notificationSound';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { getInitials, formatFileSize } from '@/lib/stringUtils';

interface Props {
  conversationId: Id<'chatConversations'>;
  currentUserId: Id<'users'>;
  organizationId: Id<'organizations'>;
  currentUserName: string;
  currentUserAvatar?: string;
  onBack: () => void;
  onStartCall: (
    convId: Id<'chatConversations'>,
    type: 'audio' | 'video',
    participantIds: Id<'users'>[],
    remoteUserName?: string,
  ) => void;
}

interface PendingFile {
  file: File;
  previewUrl: string | null; // for images
  isPDF: boolean;
  uploading: boolean;
  error?: string;
}

export const ChatWindow = React.memo(function ChatWindow({
  conversationId,
  currentUserId,
  organizationId,
  currentUserName,
  currentUserAvatar,
  onBack,
  onStartCall,
}: Props) {
  const { t, i18n } = useTranslation();
  console.log(
    `[ChatWindow] Loaded with organizationId: ${organizationId}, userId: ${currentUserId}`,
  );
  const [input, setInput] = useState('');
  const [replyTo, setReplyTo] = useState<{
    id: Id<'chatMessages'>;
    content: string;
    senderName: string;
  } | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showInfo, setShowInfo] = useState(false);
  const [isTypingTimeout, setIsTypingTimeout] = useState<NodeJS.Timeout | null>(null);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [sending, setSending] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduledFor, setScheduledFor] = useState('');
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [thread, setThread] = useState<{ id: Id<'chatMessages'>; content: string } | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState<number>(-1);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesParentRef = useRef<HTMLDivElement>(null);

  const messages = (useQuery as any)(
    (api.chat.queries as any).getMessages,
    {
      conversationId,
      userId: currentUserId,
      limit: 200,
    },
  ) as any;

  // Debug: Log first message sender
  if (messages && messages.length > 0 && !messages[0]?.sender) {
    console.warn('[ChatWindow] Message without sender:', messages[0]);
  }
  const members = useQuery(api.chat.queries.getConversationMembers, { conversationId });
  const typingUsers = useQuery(api.chat.queries.getTypingUsers, { conversationId, currentUserId });
  const conversation = useQuery(api.chat.queries.getMyConversations, {
    userId: currentUserId,
    organizationId,
  });
  const pinnedMessages = useQuery(api.chat.queries.getPinnedMessages, { conversationId });
  const currentUser = useQuery(api.users.queries.getUserById, { userId: currentUserId });
  const searchResults = useQuery(
    api.chat.queries.searchMessages,
    showSearch && searchQuery.length > 1
      ? { conversationId, userId: currentUserId, query: searchQuery }
      : 'skip',
  );

  // Virtualization for messages
  const virtualizer = useVirtualizer({
    count: messages?.length ?? 0,
    getScrollElement: () => messagesParentRef.current,
    estimateSize: () => 100, // Estimate average message height
    overscan: 5,
  });

  const sendMessage = useMutation(api.chat.mutations.sendMessage);
  const scheduleMessage = useMutation(api.chat.mutations.scheduleMessage);
  const markAsRead = useMutation(api.chat.mutations.markAsRead);
  const setTyping = useMutation(api.chat.mutations.setTyping);

  const conv = conversation?.find((c) => c != null && c._id === conversationId) ?? null;
  const otherUser = conv?.type === 'direct' ? (conv as any).otherUser : null;
  const displayName =
    conv?.type === 'group' ? ((conv as any).name ?? 'Group') : (otherUser?.name ?? 'Chat');
  const otherMembers = members?.filter((m) => m.userId !== currentUserId) ?? [];
  const otherMemberIds = otherMembers.map((m: any) => m.userId as Id<'users'>);

  // Track previous message count to only scroll on NEW messages, not on conversation switch
  const prevMsgCountRef = useRef<number>(0);
  const isFirstLoadRef = useRef(true);

  useEffect(() => {
    if (conversationId) {
      // Mark conversation as read with a small debounce to avoid duplicate calls
      const timer = setTimeout(() => {
        markAsRead({ conversationId, userId: currentUserId });
      }, 100);
      return () => clearTimeout(timer);
    }
    // Reset on conversation change
    prevMsgCountRef.current = 0;
    isFirstLoadRef.current = true;
    initialLoadDoneRef.current = false;
    lastPlayedMsgIdRef.current = null;
    return;
  }, [conversationId, markAsRead, currentUserId]);

  useEffect(() => {
    if (messages === undefined) return;
    const count = messages.filter(Boolean).length;
    if (isFirstLoadRef.current) {
      // First load: jump instantly to bottom, no animation
      messagesEndRef.current?.scrollIntoView({ behavior: 'instant' as ScrollBehavior });
      isFirstLoadRef.current = false;
      prevMsgCountRef.current = count;
    } else if (count > prevMsgCountRef.current) {
      // New message arrived: smooth scroll
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      prevMsgCountRef.current = count;
    }
  }, [messages]);

  const handleTyping = useCallback(() => {
    setTyping({ conversationId, userId: currentUserId, organizationId, isTyping: true });
    if (isTypingTimeout) clearTimeout(isTypingTimeout);
    const t = setTimeout(() => {
      setTyping({ conversationId, userId: currentUserId, organizationId, isTyping: false });
    }, 3000);
    setIsTypingTimeout(t);
  }, [conversationId, currentUserId, organizationId, isTypingTimeout, setTyping]);

  // ── File picking ──────────────────────────────────────────────────────────
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    // reset input so same file can be picked again
    e.target.value = '';

    const newPending: PendingFile[] = files.map((file: any) => ({
      file,
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
      isPDF: file.type === 'application/pdf',
      uploading: false,
    }));
    setPendingFiles((prev) => [...prev, ...newPending]);
  }, []);

  const removePendingFile = (idx: number) => {
    setPendingFiles((prev) => {
      const updated = [...prev];
      if (updated[idx]?.previewUrl) URL.revokeObjectURL(updated[idx].previewUrl!);
      updated.splice(idx, 1);
      return updated;
    });
  };

  // ── Send ──────────────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text && pendingFiles.length === 0) return;
    setSending(true);

    try {
      // Upload all pending files to Cloudinary
      const uploadedAttachments: Array<{ url: string; name: string; type: string; size: number }> =
        [];

      for (const pf of pendingFiles) {
        // Convert file to base64
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(pf.file);
        });

        const result = await uploadChatAttachment(base64, pf.file.name, pf.file.type);
        uploadedAttachments.push({
          url: result.url,
          name: result.name,
          type: result.type,
          size: pf.file.size,
        });
      }

      // Revoke object URLs
      pendingFiles.forEach((pf) => {
        if (pf.previewUrl) URL.revokeObjectURL(pf.previewUrl);
      });
      setPendingFiles([]);
      setInput('');
      setReplyTo(null);
      setShowEmoji(false);
      setShowSchedule(false);
      setShowPollCreator(false);
      if (isTypingTimeout) clearTimeout(isTypingTimeout);
      await setTyping({ conversationId, userId: currentUserId, organizationId, isTyping: false });

      // Scheduled send
      if (scheduledFor) {
        const scheduledTs = new Date(scheduledFor).getTime();
        if (scheduledTs > Date.now()) {
          await scheduleMessage({
            conversationId,
            senderId: currentUserId,
            organizationId,
            content: text,
            scheduledFor: scheduledTs,
          });
          setScheduledFor('');
          setSending(false);
          return;
        }
        setScheduledFor('');
      }

      // Determine message type
      const msgType =
        uploadedAttachments.length > 0
          ? uploadedAttachments[0]?.type.startsWith('image/')
            ? 'image'
            : 'file'
          : 'text';

      // Parse @mentions
      const mentionRegex =
        /@([a-zA-Zа-яА-ЯёЁа-ֆА-Ֆ\u0531-\u0587][a-zA-Zа-яА-ЯёЁа-ֆА-Ֆ\u0531-\u0587\s]*?)(?=\s|$|[^a-zA-Zа-яА-ЯёЁ])/g;
      const mentionedIds: Id<'users'>[] = [];
      let match;
      while ((match = mentionRegex.exec(text)) !== null) {
        const mentionName = match[1]?.toLowerCase();
        if (!mentionName) continue;
        const member = members?.find((m) => m.user?.name.toLowerCase().includes(mentionName));
        if (member) mentionedIds.push(member.userId as Id<'users'>);
      }

      await sendMessage({
        conversationId,
        senderId: currentUserId,
        organizationId,
        type: msgType,
        content: text || (uploadedAttachments.length > 0 ? '' : ''),
        attachments: uploadedAttachments.length > 0 ? uploadedAttachments : undefined,
        replyToId: replyTo?.id,
        mentionedUserIds: mentionedIds.length > 0 ? mentionedIds : undefined,
      });

      // Reset textarea height
      if (inputRef.current) {
        inputRef.current.style.height = 'auto';
      }
    } catch (err) {
      console.error('Send failed:', err);
    } finally {
      setSending(false);
    }
  }, [
    input,
    pendingFiles,
    replyTo,
    conversationId,
    currentUserId,
    organizationId,
    sendMessage,
    setTyping,
    members,
    isTypingTimeout,
  ]);

  // Compute mention suggestions from conversation members
  const mentionSuggestions = React.useMemo(() => {
    if (mentionQuery === null || !members) return [];
    const q = mentionQuery.toLowerCase();
    return members
      .filter((m) => m.userId !== currentUserId && m.user?.name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [mentionQuery, members, currentUserId]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle mention navigation
    if (mentionQuery !== null && mentionSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex((prev) => (prev + 1) % mentionSuggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex(
          (prev) => (prev - 1 + mentionSuggestions.length) % mentionSuggestions.length,
        );
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const selected = mentionSuggestions[mentionIndex];
        if (selected?.user?.name) {
          insertMention(selected.user.name);
        }
        return;
      }
      if (e.key === 'Escape') {
        setMentionQuery(null);
        setMentionStart(-1);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const insertMention = (name: string) => {
    const before = input.slice(0, mentionStart);
    const after = input.slice(inputRef.current?.selectionStart ?? input.length);
    const newInput = `${before}@${name} ${after}`;
    setInput(newInput);
    setMentionQuery(null);
    setMentionStart(-1);
    setMentionIndex(0);
    // Focus back to input
    setTimeout(() => {
      if (inputRef.current) {
        const cursorPos = before.length + name.length + 2; // +2 for @ and space
        inputRef.current.selectionStart = cursorPos;
        inputRef.current.selectionEnd = cursorPos;
        inputRef.current.focus();
      }
    }, 0);
  };

  // ── Voice Message ──────────────────────────────────────────────────────────
  const handleVoiceMessage = useCallback(
    async (blob: Blob, duration: number) => {
      try {
        // Convert blob to base64 (without data URL prefix)
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            // Remove data URL prefix (e.g., "data:audio/webm;base64,")
            const base64Data = result.split(',')[1] || result;
            resolve(base64Data);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        // Upload audio file
        const result = await uploadChatAttachment(base64, 'voice.webm', 'audio/webm');

        // Send voice message with attachments array
        await sendMessage({
          conversationId,
          senderId: currentUserId,
          organizationId,
          type: 'audio',
          content: `Voice message (${duration}s)`,
          attachments: [
            {
              url: result.url,
              name: 'voice.webm',
              type: 'audio/webm',
              size: blob.size,
            },
          ],
          audioDuration: duration,
        });

        toast.success(t('chat.voiceMessageSent'));
        setShowVoiceRecorder(false);
        setIsRecording(false);
      } catch (err) {
        console.error('Error sending voice message:', err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error('Error details:', errorMessage);
        toast.error(`${t('chat.voiceMessageFailed')}: ${errorMessage}`);
        setShowVoiceRecorder(false);
        setIsRecording(false);
      }
    },
    [conversationId, currentUserId, organizationId, sendMessage, t],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);
    handleTyping();
    // Avoid forced reflow: read scrollHeight before writing style
    const scrollHeight = e.target.scrollHeight;
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(scrollHeight, 120) + 'px';

    // Detect @mention — look backward from cursor for '@'
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = value.slice(0, cursorPos);
    const atIdx = textBeforeCursor.lastIndexOf('@');
    if (atIdx >= 0) {
      const charBeforeAt = atIdx > 0 ? (textBeforeCursor[atIdx - 1] ?? ' ') : ' ';
      // Only trigger if @ is at start or preceded by whitespace
      if (atIdx === 0 || /\s/.test(charBeforeAt)) {
        const query = textBeforeCursor.slice(atIdx + 1);
        // No spaces in the query (to avoid false positives on regular text)
        if (!query.includes(' ') || query.length < 20) {
          setMentionQuery(query);
          setMentionStart(atIdx);
          setMentionIndex(0);
          return;
        }
      }
    }
    setMentionQuery(null);
    setMentionStart(-1);
  };

  const handleEmojiSelect = (emoji: string) => {
    setInput((prev) => prev + emoji);
    setShowEmoji(false);
    inputRef.current?.focus();
  };

  const handleStartCall = (type: 'audio' | 'video') => {
    onStartCall(conversationId, type, otherMemberIds, otherUser?.name);
  };

  // Send a poll
  const handleSendPoll = useCallback(async () => {
    const q = pollQuestion.trim();
    const opts = pollOptions.map((o: any) => o.trim()).filter(Boolean);
    if (!q || opts.length < 2) return;
    setSending(true);
    try {
      await sendMessage({
        conversationId,
        senderId: currentUserId,
        organizationId,
        type: 'text',
        content: `📊 ${q}`,
        poll: {
          question: q,
          options: opts.map((text: any, i: any) => ({ id: `opt_${i}`, text, votes: [] })),
        } as any,
      });
      setPollQuestion('');
      setPollOptions(['', '']);
      setShowPollCreator(false);
    } finally {
      setSending(false);
    }
  }, [pollQuestion, pollOptions, conversationId, currentUserId, organizationId, sendMessage]);

  // Track whether initial messages have already been loaded (to avoid sound on open)
  const initialLoadDoneRef = useRef(false);
  const lastPlayedMsgIdRef = useRef<string | null>(null);

  // Browser notification + sound for incoming messages
  useEffect(() => {
    if (!messages || messages.length === 0) return;

    // Skip sound on the very first load — just mark as loaded
    if (!initialLoadDoneRef.current) {
      initialLoadDoneRef.current = true;
      const latest = messages[messages.length - 1];
      if (latest) lastPlayedMsgIdRef.current = latest._id;
      return;
    }

    const latest = messages[messages.length - 1];
    if (!latest) return;
    // Don't play for own messages
    if (latest.senderId === currentUserId) return;
    // Don't play the same message twice
    if (lastPlayedMsgIdRef.current === latest._id) return;
    // Don't play for system service broadcasts (informational only)
    if (latest.isServiceBroadcast) return;
    // Don't play if conversation is muted
    if (conv?.membership?.isMuted) return;
    lastPlayedMsgIdRef.current = latest._id;

    // If chat is active (tab focused) — mark as read immediately, play sound
    if (document.hasFocus()) {
      // Ensure this call completes by using Promise handling
      void markAsRead({ conversationId, userId: currentUserId });
      playChatMessageSound();
      return;
    }

    // Tab not focused — play sound + show browser notification
    playChatMessageSound();
    if (Notification.permission === 'granted') {
      new Notification(latest.sender?.name ?? 'New message', {
        body: latest.content?.slice(0, 80) || '📎 Attachment',
        icon: latest.sender?.avatarUrl ?? '/favicon.ico',
        badge: '/favicon.ico',
        tag: latest._id,
        silent: true, // sound is handled by playChatMessageSound
      });
    } else if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [messages, conv?.membership?.isMuted, currentUserId, conversationId, markAsRead]);

  const canSend = (input.trim().length > 0 || pendingFiles.length > 0) && !sending;

  // Check if current user can send messages (not blocked from System Announcements)
  const isSystemAnnouncementsChannel = (conv as any)?.name === 'System Announcements';
  const canUserSendMessage = !isSystemAnnouncementsChannel || currentUser?.role === 'superadmin';

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      <div className="flex flex-col flex-1 min-w-0 min-h-0 h-full overflow-hidden">
        {/* Header */}
        <div
          className="flex items-center gap-3 px-4 py-3 border-b shrink-0"
          style={{ borderColor: 'var(--border)', background: 'var(--background)' }}
        >
          <button
            onClick={onBack}
            className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:opacity-70"
          >
            <ArrowLeft className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          </button>

          {/* Avatar — clickable for DM (goes to employee profile) */}
          <div className="relative shrink-0">
            {conv?.type === 'direct' && otherUser?._id ? (
              <Link
                href={`/employees/${otherUser._id}`}
                className="block rounded-full transition-transform duration-200 hover:scale-110 hover:opacity-90"
                title={`View ${displayName}'s profile`}
              >
                <Avatar className="w-9 h-9">
                  {otherUser?.avatarUrl && <AvatarImage src={otherUser.avatarUrl} />}
                  <AvatarFallback
                    className="text-xs font-bold text-white"
                    style={{
                      background:
                        'linear-gradient(135deg, var(--primary), var(--primary-dark, var(--primary)))',
                    }}
                  >
                    {getInitials(displayName)}
                  </AvatarFallback>
                </Avatar>
              </Link>
            ) : (
              <Avatar className="w-9 h-9">
                {(conv as any)?.avatarUrl && <AvatarImage src={(conv as any).avatarUrl} />}
                <AvatarFallback
                  className="text-xs font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                >
                  {getInitials(displayName)}
                </AvatarFallback>
              </Avatar>
            )}
            {conv?.type === 'direct' && otherUser?.presenceStatus === 'available' && (
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-white pointer-events-none" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
              {displayName}
            </h3>
            <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
              {conv?.type === 'group'
                ? `${conv.memberCount ?? members?.length ?? 0} ${t('chat.members')}`
                : otherUser?.presenceStatus === 'available'
                  ? t('chat.activeNow')
                  : otherUser?.presenceStatus === 'in_meeting'
                    ? t('chat.inMeeting')
                    : otherUser?.presenceStatus === 'busy'
                      ? t('chat.busy')
                      : t('chat.offline')}
            </p>
          </div>

          <div className="flex items-center gap-1">
            {/* Disable calls for System Announcements channel */}
            {(conv as any)?.name !== 'System Announcements' && (
              <>
                <button
                  onClick={() => handleStartCall('audio')}
                  className="w-8 h-8 flex items-center justify-center rounded-lg transition-all hover:scale-105"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--sidebar-item-hover)';
                    e.currentTarget.style.color = 'var(--primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--text-muted)';
                  }}
                  title={t('chat.voiceCall')}
                >
                  <Phone className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleStartCall('video')}
                  className="w-8 h-8 flex items-center justify-center rounded-lg transition-all hover:scale-105"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--sidebar-item-hover)';
                    e.currentTarget.style.color = 'var(--primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--text-muted)';
                  }}
                  title={t('chat.videoCall')}
                >
                  <Video className="w-4 h-4" />
                </button>
              </>
            )}
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
              style={{
                color: showSearch ? 'var(--primary)' : 'var(--text-muted)',
                background: showSearch ? 'var(--sidebar-item-active)' : 'transparent',
              }}
              onMouseEnter={(e) => {
                if (!showSearch) {
                  e.currentTarget.style.background = 'var(--sidebar-item-hover)';
                  e.currentTarget.style.color = 'var(--primary)';
                }
              }}
              onMouseLeave={(e) => {
                if (!showSearch) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--text-muted)';
                }
              }}
              title={t('chat.searchMessages')}
            >
              <Search className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowInfo(!showInfo)}
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--sidebar-item-hover)';
                e.currentTarget.style.color = 'var(--primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text-muted)';
              }}
              title={t('chat.info')}
            >
              <Info className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search bar */}
        {showSearch && (
          <div
            className="px-4 py-2 border-b"
            style={{ borderColor: 'var(--border)', background: 'var(--background-subtle)' }}
          >
            <input
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('chat.searchInConversation')}
              className="w-full px-3 py-1.5 text-sm rounded-lg border border-[var(--input-border)] bg-[var(--input)] text-[var(--text-primary)] outline-none"
            />
            {searchResults && searchResults.length > 0 && (
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                {searchResults.length} result{searchResults.length > 1 ? 's' : ''}
              </p>
            )}
          </div>
        )}

        {/* Pinned messages banner */}
        {pinnedMessages && pinnedMessages.length > 0 && (
          <div
            className="px-4 py-2 border-b flex items-center gap-2"
            style={{ borderColor: 'var(--border)', background: 'var(--background-subtle)' }}
          >
            <Pin className="w-3.5 h-3.5" style={{ color: 'var(--primary)' }} />
            <span
              className="text-xs font-medium truncate flex-1"
              style={{ color: 'var(--text-muted)' }}
            >
              📌 {pinnedMessages[pinnedMessages.length - 1]?.content}
            </span>
          </div>
        )}

        {/* Messages area with virtualization */}
        <div
          ref={messagesParentRef}
          className="flex-1 overflow-y-auto overflow-x-hidden px-2 xs:px-3 sm:px-4 py-3 xs:py-4 custom-scrollbar"
          style={{ background: 'var(--background)' }}
        >
          {messages === undefined ? (
            <div className="space-y-3 animate-pulse" role="status" aria-label="Loading messages">
              {[...Array(5)].map((_: any, i: any) => (
                <div key={i} className={cn('flex gap-3', i % 2 === 0 ? '' : 'flex-row-reverse')}>
                  <div className="w-8 h-8 rounded-full bg-white/5 shrink-0" />
                  <div className={cn('space-y-1', i % 2 === 0 ? '' : 'items-end flex flex-col')}>
                    <div className="h-3 w-16 rounded bg-white/5" />
                    <div className="h-10 w-48 rounded-2xl bg-white/5" />
                  </div>
                </div>
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                No messages yet
              </p>
            </div>
          ) : (
            <div
              role="log"
              aria-label="Chat messages"
              aria-live="polite"
              aria-relevant="additions"
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {virtualizer.getVirtualItems().map((virtualRow: any) => {
                const msg = messages[virtualRow.index];
                if (!msg) return null;

                const isOwn = msg.senderId === currentUserId;
                const prevMsg = messages[virtualRow.index - 1];
                const isFirstOfStreak =
                  virtualRow.index === 0 || prevMsg?.senderId !== msg.senderId;
                const isSystemAnnouncements = (conv as any)?.name === 'System Announcements';
                const showAvatar = isFirstOfStreak && !isSystemAnnouncements;
                const showName = isSystemAnnouncements
                  ? false
                  : isFirstOfStreak && !isOwn && conv?.type === 'group';

                return (
                  <div
                    key={msg._id}
                    data-index={virtualRow.index}
                    ref={virtualizer.measureElement}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <MessageBubble
                      message={msg}
                      isOwn={isOwn}
                      showAvatar={showAvatar}
                      showName={!!showName}
                      currentUserId={currentUserId}
                      currentUserAvatar={currentUserAvatar}
                      currentUserName={currentUserName}
                      onReply={(id, content, senderName) => setReplyTo({ id, content, senderName })}
                      onOpenThread={(id, content) => setThread({ id, content })}
                      onSendMessage={async (text) => {
                        await sendMessage({
                          conversationId,
                          senderId: currentUserId,
                          organizationId,
                          type: 'text',
                          content: text,
                        });
                      }}
                      lang={i18n.language || 'en'}
                    />
                  </div>
                );
              })}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Typing indicator */}
        {typingUsers && typingUsers.length > 0 && (
          <div
            className="px-4 py-2 border-t"
            style={{ borderColor: 'var(--border)', background: 'var(--background)' }}
          >
            <TypingIndicator users={typingUsers} />
          </div>
        )}

        {/* Pending file previews */}
        {pendingFiles.length > 0 && (
          <div
            className="px-2 xs:px-3 sm:px-4 py-2 border-t flex gap-2 flex-wrap"
            style={{ borderColor: 'var(--border)', background: 'var(--background-subtle)' }}
          >
            {pendingFiles.map((pf: any, idx: any) => (
              <div key={idx} className="relative group/pf">
                {pf.previewUrl ? (
                  // Image preview
                  <div
                    className="relative w-14 xs:w-16 h-14 xs:h-16 rounded-xl overflow-hidden border"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={pf.previewUrl}
                      alt={pf.file.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : pf.isPDF ? (
                  // PDF preview
                  <div
                    className="w-14 xs:w-16 h-14 xs:h-16 rounded-xl border flex flex-col items-center justify-center gap-0.5"
                    style={{ borderColor: 'var(--border)', background: 'var(--background)' }}
                  >
                    <FileText className="w-5 xs:w-6 h-5 xs:h-6 text-red-400" />
                    <span
                      className="text-[8px] xs:text-[9px] text-center px-1 truncate w-full"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      PDF
                    </span>
                  </div>
                ) : (
                  // Generic file
                  <div
                    className="w-14 xs:w-16 h-14 xs:h-16 rounded-xl border flex flex-col items-center justify-center gap-0.5 px-1"
                    style={{ borderColor: 'var(--border)', background: 'var(--background)' }}
                  >
                    <span className="text-lg">📎</span>
                    <span
                      className="text-[7px] xs:text-[9px] text-center truncate w-full"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {pf.file.name.split('.').pop()?.toUpperCase()}
                    </span>
                  </div>
                )}
                {/* File name tooltip & size */}
                <div className="absolute -bottom-5 left-0 right-0 text-center">
                  <span
                    className="text-[8px] xs:text-[9px] truncate block"
                    style={{ color: 'var(--text-disabled)' }}
                  >
                    {formatFileSize(pf.file.size)}
                  </span>
                </div>
                {/* Remove button */}
                <button
                  onClick={() => removePendingFile(idx)}
                  className="absolute -top-1.5 -right-1.5 w-4 xs:w-4.5 h-4 xs:h-4.5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover/pf:opacity-100 transition-opacity"
                >
                  <X className="w-2.5 xs:w-3 h-2.5 xs:h-3" />
                </button>
              </div>
            ))}
            <p
              className="w-full text-[9px] xs:text-[10px] mt-5"
              style={{ color: 'var(--text-disabled)' }}
            >
              {pendingFiles.length}{' '}
              {pendingFiles.length > 1 ? t('chat.filesReadyToSend') : t('chat.fileReadyToSend')}
            </p>
          </div>
        )}

        {/* Reply preview */}
        {replyTo && (
          <div
            className="px-2 xs:px-3 sm:px-4 py-2 border-t flex items-center gap-2"
            style={{ borderColor: 'var(--border)', background: 'var(--background-subtle)' }}
          >
            <div className="w-0.5 h-8 rounded-full" style={{ background: 'var(--primary)' }} />
            <div className="flex-1 min-w-0">
              <p
                className="text-[10px] xs:text-[11px] font-medium"
                style={{ color: 'var(--primary)' }}
              >
                {t('chat.replyingTo')} {replyTo.senderName}
              </p>
              <p className="text-[9px] xs:text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                {replyTo.content}
              </p>
            </div>
            <button
              onClick={() => setReplyTo(null)}
              className="w-5 h-5 flex items-center justify-center rounded-full hover:opacity-70 shrink-0"
            >
              ✕
            </button>
          </div>
        )}

        {/* Poll Creator */}
        {showPollCreator && (
          <div
            className="px-2 xs:px-3 sm:px-4 py-3 border-t animate-slide-up"
            style={{ borderColor: 'var(--border)', background: 'var(--background-subtle)' }}
          >
            <div className="flex items-center justify-between mb-2">
              <p
                className="text-[10px] xs:text-xs font-semibold flex items-center gap-1"
                style={{ color: 'var(--text-primary)' }}
              >
                <BarChart2
                  className="w-3 xs:w-3.5 h-3 xs:h-3.5"
                  style={{ color: 'var(--primary)' }}
                />{' '}
                {t('chat.createPoll')}
              </p>
              <button
                onClick={() => setShowPollCreator(false)}
                className="text-[9px] hover:opacity-70"
                style={{ color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>
            <input
              value={pollQuestion}
              onChange={(e) => setPollQuestion(e.target.value)}
              placeholder={t('chat.pollQuestion')}
              className="w-full px-2.5 xs:px-3 py-1.5 text-[10px] xs:text-xs rounded-lg border border-[var(--input-border)] bg-[var(--input)] text-[var(--text-primary)] outline-none mb-2"
            />
            {pollOptions.map((opt: any, i: any) => (
              <div key={i} className="flex items-center gap-1 mb-1">
                <input
                  value={opt}
                  onChange={(e) => {
                    const o = [...pollOptions];
                    o[i] = e.target.value;
                    setPollOptions(o);
                  }}
                  placeholder={`${t('chat.option')} ${i + 1}`}
                  className="flex-1 px-2.5 xs:px-3 py-1.5 text-[10px] xs:text-xs rounded-lg border border-[var(--input-border)] bg-[var(--input)] text-[var(--text-primary)] outline-none"
                />
                {pollOptions.length > 2 && (
                  <button
                    onClick={() => setPollOptions(pollOptions.filter((_, j) => j !== i))}
                    className="text-red-400 hover:opacity-70 px-1"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {pollOptions.length < 5 && (
                <button
                  onClick={() => setPollOptions([...pollOptions, ''])}
                  className="text-[10px] xs:text-[11px] hover:opacity-70"
                  style={{ color: 'var(--primary)' }}
                >
                  {t('chat.addOption')}
                </button>
              )}
              <button
                onClick={handleSendPoll}
                disabled={!pollQuestion.trim() || pollOptions.filter(Boolean).length < 2 || sending}
                className="ml-auto px-2.5 xs:px-3 py-1 rounded-lg text-[10px] xs:text-xs font-medium text-white transition-all hover:opacity-80 disabled:opacity-40 min-h-8"
                style={{
                  background:
                    'linear-gradient(135deg, var(--primary), var(--primary-dark, var(--primary)))',
                }}
              >
                {t('chat.sendPoll')}
              </button>
            </div>
          </div>
        )}

        {/* Scheduled send picker */}
        {showSchedule && (
          <div
            className="px-2 xs:px-3 sm:px-4 py-2 border-t flex items-center gap-2 animate-slide-up flex-wrap"
            style={{ borderColor: 'var(--border)', background: 'var(--background-subtle)' }}
          >
            <Clock
              className="w-3 xs:w-3.5 h-3 xs:h-3.5 shrink-0"
              style={{ color: 'var(--primary)' }}
            />
            <input
              type="datetime-local"
              value={scheduledFor}
              min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
              onChange={(e) => setScheduledFor(e.target.value)}
              className="flex-1 text-[9px] xs:text-xs px-2 xs:px-2.5 py-1 rounded-lg border outline-none"
              style={{
                background: 'var(--background)',
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
              }}
            />
            <button
              onClick={() => {
                setShowSchedule(false);
                setScheduledFor('');
              }}
              className="text-[9px] hover:opacity-70"
              style={{ color: 'var(--text-muted)' }}
            >
              ✕
            </button>
          </div>
        )}
        {scheduledFor && (
          <div
            className="px-2 xs:px-3 sm:px-4 py-1 flex items-center gap-2 flex-wrap"
            style={{ background: 'var(--background-subtle)' }}
          >
            <Clock className="w-2.5 xs:w-3 h-2.5 xs:h-3" style={{ color: 'var(--primary)' }} />
            <span className="text-[8px] xs:text-[9px]" style={{ color: 'var(--primary)' }}>
              {t('chat.scheduledFor')} {new Date(scheduledFor).toLocaleString()}
            </span>
            <button
              onClick={() => setScheduledFor('')}
              className="ml-auto text-[8px] xs:text-[9px] text-red-400 hover:opacity-70"
            >
              {t('chat.cancel')}
            </button>
          </div>
        )}

        {/* Input area */}
        {canUserSendMessage ? (
          <div
            className="px-2 xs:px-3 sm:px-4 py-2 xs:py-3 border-t shrink-0"
            style={{ borderColor: 'var(--border)', background: 'var(--background)' }}
          >
            <div
              className="flex items-center gap-1.5 xs:gap-2 rounded-2xl border px-2 xs:px-3 py-1.5 xs:py-2 transition-all"
              style={{ borderColor: 'var(--border)', background: 'var(--background-subtle)' }}
            >
              {/* Attachment */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-6 xs:w-7 h-6 xs:h-7 flex items-center justify-center rounded-lg transition-all hover:scale-110 hover:opacity-100 relative group/attach shrink-0"
                style={{
                  color: pendingFiles.length > 0 ? 'var(--primary)' : 'var(--text-disabled)',
                }}
                title={t('chat.attachFile')}
                type="button"
              >
                <Paperclip className="w-4 xs:w-4.5 h-4 xs:h-4.5" />
                {pendingFiles.length > 0 && (
                  <span
                    className="absolute -top-1 -right-1 w-3 h-3 rounded-full text-[7px] xs:text-[8px] font-bold text-white flex items-center justify-center"
                    style={{ background: 'var(--primary)' }}
                  >
                    {pendingFiles.length}
                  </span>
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
                className="hidden"
                onChange={handleFileChange}
                aria-hidden="true"
              />

              {/* Poll button */}
              <button
                onClick={() => {
                  setShowPollCreator(!showPollCreator);
                  setShowSchedule(false);
                }}
                className="w-6 xs:w-7 h-6 xs:h-7 flex items-center justify-center rounded-lg transition-all hover:scale-110 shrink-0"
                style={{ color: showPollCreator ? 'var(--primary)' : 'var(--text-disabled)' }}
                title={t('chat.createPollShort')}
              >
                <BarChart2 className="w-4 xs:w-4.5 h-4 xs:h-4.5" />
              </button>

              {/* Scheduled send */}
              <button
                onClick={() => {
                  setShowSchedule(!showSchedule);
                  setShowPollCreator(false);
                }}
                className="w-6 xs:w-7 h-6 xs:h-7 flex items-center justify-center rounded-lg transition-all hover:scale-110 shrink-0"
                style={{ color: scheduledFor ? 'var(--primary)' : 'var(--text-disabled)' }}
                title={t('chat.scheduleMessage')}
              >
                <Clock className="w-4 xs:w-4.5 h-4 xs:h-4.5" />
              </button>

              {/* Voice message button */}
              <button
                onClick={() => setShowVoiceRecorder(!showVoiceRecorder)}
                className="w-6 xs:w-7 h-6 xs:h-7 flex items-center justify-center rounded-lg transition-all hover:scale-110 shrink-0"
                style={{
                  color:
                    showVoiceRecorder || isRecording ? 'var(--primary)' : 'var(--text-disabled)',
                }}
                title="Voice message"
              >
                <Mic className="w-4 xs:w-4.5 h-4 xs:h-4.5" />
              </button>

              {/* Text input + @mention popup */}
              <div className="flex-1 relative min-w-0">
                {/* @mention autocomplete popup */}
                {mentionQuery !== null && mentionSuggestions.length > 0 && (
                  <div
                    className="absolute bottom-full left-0 right-0 mb-2 rounded-xl shadow-2xl border overflow-hidden z-50 animate-slide-up"
                    style={{ background: 'var(--background)', borderColor: 'var(--border)' }}
                  >
                    {mentionSuggestions.map((m: any, idx: any) => (
                      <button
                        key={m.userId}
                        onClick={() => m.user?.name && insertMention(m.user.name)}
                        className="w-full flex items-center gap-2 px-2 xs:px-3 py-1.5 xs:py-2 text-[9px] xs:text-xs transition-all"
                        style={{
                          background:
                            idx === mentionIndex ? 'var(--sidebar-item-active)' : 'transparent',
                          color: idx === mentionIndex ? 'var(--primary)' : 'var(--text-primary)',
                        }}
                        onMouseEnter={() => setMentionIndex(idx)}
                      >
                        <Avatar className="w-4 xs:w-5 h-4 xs:h-5 shrink-0">
                          {m.user?.avatarUrl && <AvatarImage src={m.user.avatarUrl} />}
                          <AvatarFallback
                            className="text-[6px] xs:text-[8px] font-bold text-white"
                            style={{ background: 'var(--primary)' }}
                          >
                            {(m.user?.name ?? '?').slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate font-medium text-[9px] xs:text-xs">
                          {m.user?.name ?? 'Unknown'}
                        </span>
                        {m.user?.department && (
                          <span
                            className="text-[7px] xs:text-[9px] truncate ml-auto"
                            style={{ color: 'var(--text-disabled)' }}
                          >
                            {m.user.department}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    pendingFiles.length > 0 ? t('chat.addCaption') : t('chat.messagePlaceholder')
                  }
                  rows={1}
                  className="w-full resize-none bg-transparent outline-none text-xs xs:text-sm leading-5"
                  style={{ color: 'var(--text-primary)', maxHeight: '120px' }}
                />
              </div>

              {/* Emoji */}
              <div className="relative">
                <button
                  onClick={() => setShowEmoji(!showEmoji)}
                  className="w-6 xs:w-7 h-6 xs:h-7 flex items-center justify-center rounded-lg transition-all hover:scale-110 shrink-0"
                  style={{ color: showEmoji ? 'var(--primary)' : 'var(--text-disabled)' }}
                >
                  <Smile className="w-4 xs:w-4.5 h-4 xs:h-4.5" />
                </button>
                {showEmoji && (
                  <EmojiPicker onSelect={handleEmojiSelect} onClose={() => setShowEmoji(false)} />
                )}
              </div>

              {/* Voice Message Recorder */}
              {showVoiceRecorder && (
                <VoiceMessageRecorder
                  onRecordingStart={() => setIsRecording(true)}
                  onRecordingStop={handleVoiceMessage}
                  onRecordingCancel={() => {
                    setShowVoiceRecorder(false);
                    setIsRecording(false);
                  }}
                  disabled={false}
                />
              )}

              {/* Send */}
              <button
                onClick={handleSend}
                disabled={!canSend}
                className="w-7 xs:w-8 h-7 xs:h-8 flex items-center justify-center rounded-xl transition-all hover:scale-105 disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                style={{
                  background: canSend
                    ? 'linear-gradient(135deg, var(--primary), var(--primary-dark, var(--primary)))'
                    : 'var(--border)',
                }}
              >
                {sending ? (
                  <ShieldLoader size="xs" variant="inline" />
                ) : scheduledFor ? (
                  <Clock className="w-3 xs:w-3.5 h-3 xs:h-3.5 text-white" />
                ) : (
                  <svg
                    className="w-3 xs:w-3.5 h-3 xs:h-3.5 text-white"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                )}
              </button>
            </div>
            <p
              className="text-[10px] xs:text-[12px] mt-1 text-center"
              style={{ color: 'var(--text-disabled)' }}
            >
              {t('chat.enterHint')}
            </p>
          </div>
        ) : (
          <div
            className="px-2 xs:px-3 sm:px-4 py-3 xs:py-4 border-t text-center shrink-0"
            style={{ borderColor: 'var(--border)', background: 'var(--background)' }}
          >
            <div
              className="p-3 xs:p-4 rounded-xl"
              style={{ background: 'var(--background-elevated)' }}
            >
              <p
                className="text-xs xs:text-sm font-medium"
                style={{ color: 'var(--text-primary)' }}
              >
                🔒 Read-Only Channel
              </p>
              <p className="text-[9px] xs:text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                This is an information-only channel. Messages are sent by administrators only.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Thread Panel — slides in from right */}
      {thread && (
        <ThreadPanel
          parentMessageId={thread.id}
          parentContent={thread.content}
          currentUserId={currentUserId}
          conversationId={conversationId}
          organizationId={organizationId}
          onClose={() => setThread(null)}
        />
      )}

      {/* Conversation Info Panel — slides in from right */}
      {showInfo && (
        <ConversationInfoPanel
          conversationId={conversationId}
          currentUserId={currentUserId}
          organizationId={organizationId}
          onClose={() => setShowInfo(false)}
        />
      )}
    </div>
  );
});
