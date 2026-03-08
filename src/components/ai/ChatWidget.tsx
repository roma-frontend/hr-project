"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Sparkles, CheckCircle, AlertCircle, Calendar, Pencil, Trash2, Mic, MicOff } from 'lucide-react';
import { ShieldLoader } from '@/components/ui/ShieldLoader';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/useAuthStore';
import { useUpgradeModal } from '@/components/subscription/PlanGate';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import { useRouter } from 'next/navigation';
import { getRoleSuggestions, type UserRole } from '@/lib/aiAssistant';

// SpeechRecognition type declarations
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: Event) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

interface BookingState {
  status: 'pending' | 'booked' | 'conflict' | 'loading';
  result?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actions?: AnyAction[];
  bookingStates?: Record<number, BookingState>;
  suggestions?: string[];
}

interface BookLeaveAction {
  type: 'BOOK_LEAVE';
  leaveType: 'paid' | 'sick' | 'family' | 'unpaid' | 'doctor';
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
}

interface EditLeaveAction {
  type: 'EDIT_LEAVE';
  leaveId: string;
  employeeName: string;
  startDate: string;
  endDate: string;
  days: number;
  reason?: string;
  leaveType: string;
}

interface DeleteLeaveAction {
  type: 'DELETE_LEAVE';
  leaveId: string;
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
}

type AnyAction = BookLeaveAction | EditLeaveAction | DeleteLeaveAction;

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

// Generate follow-up suggestions based on assistant response content
function getFollowUpSuggestions(content: string, userRole: string, t: (key: string) => string): string[] {
  const lower = content.toLowerCase();

  if (lower.includes('book') || lower.includes(t("chatWidget.leaveRequest")) || lower.includes('submitted') || lower.includes('approved')) {
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

const LEAVE_TYPE_LABELS: Record<string, string> = {
  paid: '🏖️ Paid Leave',
  sick: '🤒 Sick Leave',
  family: '👨‍👩‍👧 Family Leave',
  unpaid: '💼 Unpaid Leave',
  doctor: '🏥 Doctor Visit',
};

// Dynamic suggestions based on user role - will be set in component
const getInitialSuggestions = (role: UserRole | undefined): string[] => {
  if (!role) return [
    '💰 Show my leave balance',
    '📆 Book a vacation',
    '🤒 I feel sick today',
    '👥 Who is on leave this week?',
  ];
  
  return getRoleSuggestions(role as UserRole);
};

export function ChatWidget() {
  const { t } = useTranslation();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [wakeWordActive, setWakeWordActive] = useState(false);
  const [voiceInput, setVoiceInput] = useState('');
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const user = useAuthStore((s) => s.user);
  const wakeRecogRef = useRef<SpeechRecognition[]>([]);
  const voiceRecogRef = useRef<SpeechRecognition | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isListeningRef = useRef(false);
  const accumulatedTranscriptRef = useRef('');

  // Plan gating
  const { canAccess } = usePlanFeatures();
  const hasAiChat = canAccess('aiChat');
  const { openModal, modal: upgradeModal } = useUpgradeModal();

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  // Auto-focus input when chat opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
    }
  }, [isOpen]);

  // ── Detect language of text (EN / RU / HY) ──────────────────────
  const detectLanguage = useCallback((text: string): 'ru' | 'en' | 'hy' => {
    const armenianCount = (text.match(/[\u0530-\u058F]/g) || []).length;
    if (armenianCount > text.length * 0.15) return 'hy';
    const cyrillicCount = (text.match(/[\u0400-\u04FF]/g) || []).length;
    return cyrillicCount > text.length * 0.2 ? 'ru' : 'en';
  }, []);

  // ── TTS greeting with female voice ───────────────────────────────
  const speakGreeting = useCallback(() => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    const greetings = [
      "Hi! How can I help you today?",
      "Hello! What can I do for you?",
      "Hey! I'm here to help. What do you need?",
    ];
    const text = greetings[Math.floor(Math.random() * greetings.length)];
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.95;
    utterance.pitch = 1.2;

    // Pick a female voice if available
    const pickVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      const female = voices.find(v =>
        /female|woman|girl|zira|samantha|victoria|karen|moira|fiona|veena|susan|catherine|alice|amelie|anna|joanna|kendra|kimberly|ivy|salli/i.test(v.name)
        && v.lang.startsWith('en')
      ) || voices.find(v => v.lang.startsWith('en'));
      if (female) utterance.voice = female;
      window.speechSynthesis.speak(utterance);
    };

    // voices may not be loaded yet
    if (window.speechSynthesis.getVoices().length > 0) {
      pickVoice();
    } else {
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.onvoiceschanged = null;
        pickVoice();
      };
    }
  }, []);

  // ── Wake word listener: "Hey HR" (DISABLED - only manual mic button) ─
  useEffect(() => {
    // Disabled auto wake word detection
    return;

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    // All wake phrases — EN recognizer will also pick up some RU-like phonetics
    const ALL_PHRASES = [
      // English
      'hey hr', 'hi hr', 'hey h r', 'hi h r', 'hey age are', 'hey aitch ar',
      // Russian phonetics as heard by en-US engine
      'привет', 'эй hr',
    ];

    let stopped = false;

    const createRecognizer = (lang: string) => {
      const rec = new SR();
      rec.continuous = true;
      rec.interimResults = false;
      rec.lang = lang;

      rec.onresult = (e: SpeechRecognitionEvent) => {
        const last = e.results[e.results.length - 1];
        const transcript = last[0].transcript.toLowerCase().trim();
        const matched = ALL_PHRASES.some(p => transcript.includes(p));
        if (matched) {
          setIsOpen(prev => {
            if (!prev) {
              setWakeWordActive(true);
              setTimeout(() => setWakeWordActive(false), 2500);
              setTimeout(() => speakGreeting(), 400);
            }
            return true;
          });
        }
      };

      rec.onend = () => {
        if (!stopped) {
          try { rec.start(); } catch { /* ignore */ }
        }
      };

      try { rec.start(); } catch { /* browser may block */ }
      return rec;
    };

    // Primary EN recognizer — works in all Chrome browsers
    const enRec = createRecognizer('en-US');
    wakeRecogRef.current = [enRec];

    // Try RU recognizer only if browser allows multiple (non-Chrome may support it)
    let ruRec: SpeechRecognition | null = null;
    try {
      ruRec = createRecognizer('ru-RU');
      wakeRecogRef.current = [enRec, ...(ruRec ? [ruRec] : [])] as SpeechRecognition[];
    } catch {
      // Browser doesn't allow second recognizer — OK, en-US handles it
    }

    return () => {
      stopped = true;
      wakeRecogRef.current.forEach(rec => {
        rec.onend = null;
        try { rec.stop(); } catch { /* ignore */ }
      });
      wakeRecogRef.current = [];
    };
  }, [speakGreeting]);

  // ── Voice input: mic button ───────────────────────────────────────
  const startVoiceInput = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    if (voiceRecogRef.current) {
      voiceRecogRef.current.stop();
      voiceRecogRef.current = null;
      setIsListening(false);
      return;
    }

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    // Default to Russian for voice input
    rec.lang = 'ru-RU';
    voiceRecogRef.current = rec;

    setIsListening(true);

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let interim = '';
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      const text = final || interim;
      setInput(text);

      // Reset silence timer - auto-send after 1 second of silence
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      if (text.trim()) {
        silenceTimerRef.current = setTimeout(() => {
          // Auto-submit after 1 second of silence
          if (voiceRecogRef.current) {
            voiceRecogRef.current.stop();
            voiceRecogRef.current = null;
            setIsListening(false);
            setTimeout(() => {
              inputRef.current?.form?.requestSubmit();
            }, 100);
          }
        }, 1000); // 1 second pause
      }
    };

    rec.onend = () => {
      // Clean up silence timer
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      setIsListening(false);
      voiceRecogRef.current = null;
    };

    rec.onerror = () => {
      setIsListening(false);
      voiceRecogRef.current = null;
    };

    rec.start();
  }, [messages, detectLanguage]);

  const handleAction = async (messageId: string, action: AnyAction, actionIndex: number) => {
    if (!user?.id) {
      setMessages(prev => prev.map(m =>
        m.id === messageId
          ? { ...m, bookingStates: { ...m.bookingStates, [actionIndex]: { status: 'conflict', result: 'Not logged in.' } } }
          : m
      ));
      return;
    }

    setMessages(prev => prev.map(m =>
      m.id === messageId
        ? { ...m, bookingStates: { ...m.bookingStates, [actionIndex]: { status: 'loading' } } }
        : m
    ));

    try {
      let url = '';
      let body: Record<string, unknown> = {};

      if (action.type === 'BOOK_LEAVE') {
        url = '/api/chat/book-leave';
        body = {
          userId: user.id,
          type: action.leaveType,
          startDate: action.startDate,
          endDate: action.endDate,
          days: action.days,
          reason: action.reason,
        };
      } else if (action.type === 'EDIT_LEAVE') {
        url = '/api/chat/edit-leave';
        body = {
          requesterId: user.id,
          leaveId: action.leaveId,
          startDate: action.startDate,
          endDate: action.endDate,
          days: action.days,
          reason: action.reason,
          type: action.leaveType,
        };
      } else if (action.type === 'DELETE_LEAVE') {
        url = '/api/chat/delete-leave';
        body = {
          requesterId: user.id,
          leaveId: action.leaveId,
          employeeName: (action as DeleteLeaveAction).employeeName,
          startDate: (action as DeleteLeaveAction).startDate,
          endDate: (action as DeleteLeaveAction).endDate,
          leaveType: (action as DeleteLeaveAction).leaveType,
        };
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.ok) {
        setMessages(prev => prev.map(m =>
          m.id === messageId
            ? { ...m, bookingStates: { ...m.bookingStates, [actionIndex]: { status: 'booked', result: data.message || 'Done!' } } }
            : m
        ));
      } else {
        setMessages(prev => prev.map(m =>
          m.id === messageId
            ? { ...m, bookingStates: { ...m.bookingStates, [actionIndex]: { status: 'conflict', result: data.error || 'Something went wrong.' } } }
            : m
        ));
      }
    } catch {
      setMessages(prev => prev.map(m =>
        m.id === messageId
          ? { ...m, bookingStates: { ...m.bookingStates, [actionIndex]: { status: 'conflict', result: 'Network error. Please try again.' } } }
          : m
      ));
    }
  };

  // Smart navigation - detect navigation commands
  const handleNavigation = useCallback((text: string) => {
    const lowerText = text.toLowerCase();

    const navigationMap: { [key: string]: string } = {
      'календарь': '/calendar',
      'calendar': '/calendar',
      'покажи календарь': '/calendar',
      'открой календарь': '/calendar',
      'show calendar': '/calendar',

      'отпуск': '/leaves',
      'отпуска': '/leaves',
      'leaves': '/leaves',
      'мои отпуска': '/leaves',
      'my leaves': '/leaves',
      'запросы на отпуск': '/leaves',

      'сотрудники': '/employees',
      'employees': '/employees',
      'команда': '/employees',
      'team': '/employees',
      'покажи сотрудников': '/employees',

      'задачи': '/tasks',
      'tasks': '/tasks',
      'мои задачи': '/tasks',
      'my tasks': '/tasks',

      'посещаемость': '/attendance',
      'attendance': '/attendance',
      'присутствие': '/attendance',

      'аналитика': '/analytics',
      'analytics': '/analytics',
      'статистика': '/analytics',
      'reports': '/reports',
      'отчеты': '/reports',

      'настройки': '/settings',
      'settings': '/settings',

      'безопасность': '/security',
      'security': '/security',
      'покажи безопасность': '/security',
      'show security': '/security',
      'открой безопасность': '/security',
      'open security': '/security',

      'дашборд': '/dashboard',
      'dashboard': '/dashboard',
      'главная': '/dashboard',
      'home': '/dashboard',
      
      'организации': '/organizations',
      'organizations': '/organizations',
      'все организации': '/organizations',
      'all organizations': '/organizations',
      'покажи организации': '/organizations',
      
      'профиль': '/profile',
      'profile': '/profile',
      'мой профиль': '/profile',
      'my profile': '/profile',
    };

    for (const [keyword, path] of Object.entries(navigationMap)) {
      if (lowerText.includes(keyword)) {
        router.push(path);
        setIsOpen(false);
        return true;
      }
    }

    return false;
  }, [router]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    // Check for navigation command first
    if (handleNavigation(text)) {
      return;
    }

    const lang = detectLanguage(text);

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text.trim(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({ role: m.role, content: m.content })),
          userId: user?.id,
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

      const assistantId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

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
        console.log('🎯 AI requested navigation to:', route);
        // Navigate after a short delay to show the message
        setTimeout(() => {
          router.push(route);
          setIsOpen(false);
        }, 800);
      }

      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? {
            ...m,
            content: cleanContent.replace(/<NAVIGATE>.*?<\/NAVIGATE>/g, '').trim(),
            actions,
            bookingStates: Object.fromEntries(actions.map((_, i) => [i, { status: 'pending' as const }])),
            suggestions,
          }
          : m
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleSuggestion = (suggestion: string) => {
    // Strip emoji prefix for cleaner message
    const clean = suggestion.replace(/^[\p{Emoji}\s]+/u, '').trim();
    sendMessage(clean);
  };

  return (
    <>
      {/* Wake word toast */}
      <AnimatePresence>
        {wakeWordActive && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="fixed bottom-24 right-6 z-50 px-4 py-2 rounded-xl bg-[#2563eb] text-white text-sm font-medium shadow-lg flex items-center gap-2"
          >
            <Mic className="w-4 h-4 animate-pulse" />
            Hey HR! I'm listening…
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upgrade modal (rendered at root level) */}
      {upgradeModal}

      {/* Toggle Button */}
      <motion.button
        aria-label={t('chatWidget.openAssistant', { defaultValue: 'Open AI assistant' })}
        onClick={() => {
          if (!hasAiChat) {
            openModal({
              featureTitle: 'AI HR Assistant',
              featureDescription: 'AI-powered leave assistant, smart suggestions, and voice commands are available on the Professional plan.',
              recommendedPlan: 'professional',
            });
            return;
          }
          setIsOpen(o => !o);
        }}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-[#2563eb] to-[#0ea5e9] text-white shadow-2xl shadow-[#2563eb]/40 flex items-center justify-center hover:scale-105 transition-transform"
        whileTap={{ scale: 0.95 }}
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <X className="w-6 h-6" />
            </motion.div>
          ) : (
            <motion.div key="chat" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <Sparkles className="w-6 h-6" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed bottom-24 right-2 sm:right-6 z-50 w-[calc(100vw-1rem)] sm:w-[380px] max-h-[calc(100vh-8rem)] sm:max-h-[600px] flex flex-col rounded-2xl border border-[var(--border)] shadow-2xl overflow-hidden"
            style={{ background: 'var(--card)' }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] flex-shrink-0 bg-gradient-to-r from-[#2563eb]/10 to-[#0ea5e9]/10">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#2563eb] to-[#0ea5e9] flex items-center justify-center shadow">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">Shield HR AI</p>
                <p className="text-[10px] text-[var(--text-muted)]">{t('chatWidget.subtitle', { defaultValue: 'Your intelligent HR assistant' })}</p>
              </div>
              <button onClick={() => setIsOpen(false)} className="ml-auto p-1.5 rounded-lg hover:bg-[var(--background-subtle)] transition-colors" aria-label={t('chatWidget.closeChat', { defaultValue: 'Close chat' })}>
                <X className="w-4 h-4 text-[var(--text-muted)]" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">

              {/* Initial suggestions (shown when no messages) */}
              {messages.length === 0 && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                  <p className="text-xs text-[var(--text-muted)] text-center mb-1">👋 {t("chatWidget.greeting", { name: user?.name?.split(" ")[0] || "there" })}</p>
                  <p className="text-[10px] text-[var(--text-muted)]/70 text-center mb-2">💡 {t('chatWidget.smartHint', { defaultValue: 'I know everything about Shield HR — ask me anything!' })}</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {getInitialSuggestions(user?.role as UserRole).map((s) => (
                      <button
                        key={s}
                        onClick={() => handleSuggestion(s)}
                        disabled={isLoading}
                        className="text-left px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--background-subtle)] hover:border-[#2563eb]/50 hover:bg-[#2563eb]/5 hover:text-[#2563eb] text-xs text-[var(--text-primary)] transition-all duration-150 disabled:opacity-50"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Messages */}
              {messages.map((m) => {
                const isUser = m.role === 'user';
                return (
                  <div key={m.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] space-y-2 ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
                      <div
                        className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${isUser
                          ? 'bg-gradient-to-br from-[#2563eb] to-[#0ea5e9] text-white rounded-br-sm'
                          : 'bg-[var(--background-subtle)] text-[var(--text-primary)] rounded-bl-sm'
                          }`}
                      >
                        {m.content}
                      </div>

                      {/* Action cards */}
                      {m.actions && m.actions.length > 0 && (
                        <div className="w-full space-y-2">
                          {m.actions.map((action, idx) => {
                            const state = m.bookingStates?.[idx] ?? { status: 'pending' };
                            const isDelete = action.type === 'DELETE_LEAVE';
                            const isEdit = action.type === 'EDIT_LEAVE';

                            return (
                              <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`rounded-xl border p-3 text-xs space-y-2 ${isDelete ? 'border-red-500/20 bg-red-500/5' : isEdit ? 'border-yellow-500/20 bg-yellow-500/5' : 'border-[#2563eb]/20 bg-[#2563eb]/5'
                                  }`}
                              >
                                <div className="flex items-center gap-2 font-semibold text-[var(--text-primary)]">
                                  {isDelete ? <Trash2 className="w-3.5 h-3.5 text-red-500" /> : isEdit ? <Pencil className="w-3.5 h-3.5 text-yellow-500" /> : <Calendar className="w-3.5 h-3.5 text-[#2563eb]" />}
                                  {isDelete ? t("chatWidget.cancelLeave") : isEdit ? t("chatWidget.updateLeave") : (LEAVE_TYPE_LABELS[(action as BookLeaveAction).leaveType] ?? t("chatWidget.leaveRequest"))}
                                </div>
                                <div className="text-[var(--text-muted)] space-y-0.5">
                                  {action.type !== 'DELETE_LEAVE' && (
                                    <>
                                      <p>📅 {action.startDate} → {action.endDate}</p>
                                      <p>⏱️ {action.days} day{action.days !== 1 ? 's' : ''}</p>
                                      {(action as BookLeaveAction).reason && <p>📝 {(action as BookLeaveAction).reason}</p>}
                                    </>
                                  )}
                                  {action.type === 'DELETE_LEAVE' && (
                                    <>
                                      <p>👤 {(action as DeleteLeaveAction).employeeName}</p>
                                      <p>📅 {(action as DeleteLeaveAction).startDate} → {(action as DeleteLeaveAction).endDate}</p>
                                      <p className="text-red-500 font-medium">⚠️ This action cannot be undone</p>
                                    </>
                                  )}
                                </div>

                                {state.status === 'pending' && (
                                  <button
                                    onClick={() => handleAction(m.id, action, idx)}
                                    className={`w-full py-2 px-3 text-white text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity ${isDelete ? 'bg-gradient-to-r from-red-500 to-red-600' : isEdit ? 'bg-gradient-to-r from-yellow-500 to-orange-500' : 'bg-gradient-to-r from-[#2563eb] to-[#0ea5e9]'
                                      }`}
                                  >
                                    {isDelete ? t("chatWidget.confirmDelete") : isEdit ? t("chatWidget.confirmUpdate") : t("chatWidget.confirmSend")}
                                  </button>
                                )}
                                {state.status === 'loading' && (
                                  <div className="flex items-center justify-center gap-2 py-2">
                                    <ShieldLoader size="xs" variant="inline" />
                                    <span className="text-xs text-[var(--text-muted)]">Submitting...</span>
                                  </div>
                                )}
                                {state.status === 'booked' && (
                                  <div className="flex items-start gap-2 p-2 bg-green-500/10 rounded-lg border border-green-500/20">
                                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                                    <p className="text-xs text-green-600 dark:text-green-400">{state.result}</p>
                                  </div>
                                )}
                                {state.status === 'conflict' && (
                                  <div className="flex items-start gap-2 p-2 bg-red-500/10 rounded-lg border border-red-500/20">
                                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                                    <p className="text-xs text-red-600 dark:text-red-400">{state.result}</p>
                                  </div>
                                )}
                              </motion.div>
                            );
                          })}
                        </div>
                      )}

                      {/* Follow-up suggestions after assistant message */}
                      {!isUser && m.suggestions && m.suggestions.length > 0 && !isLoading && (
                        <motion.div
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.3 }}
                          className="flex flex-wrap gap-1.5 mt-1"
                        >
                          {m.suggestions.map((s) => (
                            <button
                              key={s}
                              onClick={() => handleSuggestion(s)}
                              disabled={isLoading}
                              className="px-2.5 py-1 rounded-full border border-[#2563eb]/30 bg-[#2563eb]/5 hover:bg-[#2563eb]/15 hover:border-[#2563eb]/60 text-[10px] text-[#2563eb] font-medium transition-all duration-150 disabled:opacity-50"
                            >
                              {s}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Loading indicator */}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-[var(--background-subtle)] px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-2">
                    <ShieldLoader size="xs" variant="inline" />
                    <span className="text-xs text-[var(--text-muted)]">{t('chatWidget.thinking', { defaultValue: 'Thinking...' })}</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Error */}
            {error && (
              <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/20 flex-shrink-0">
                <p className="text-xs text-red-500">⚠️ {error}</p>
              </div>
            )}

            {/* Input */}
            <form onSubmit={handleSubmit} className="p-4 border-t border-[var(--border)] flex-shrink-0">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={isListening ? t("chatWidget.listening") : t("chatWidget.placeholder")}
                    className={`w-full px-4 py-2 pr-10 bg-[var(--background-subtle)] border rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#2563eb] text-sm transition-colors ${isListening ? 'border-[#2563eb] ring-2 ring-[#2563eb]/30' : 'border-[var(--border)]'
                      }`}
                    disabled={isLoading}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit(e as any);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={startVoiceInput}
                    disabled={isLoading}
                    title={isListening ? t("chatWidget.stopListening") : t("chatWidget.voiceInput")}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg transition-colors disabled:opacity-50 ${isListening
                      ? 'text-[#2563eb] animate-pulse'
                      : 'text-[var(--text-muted)] hover:text-[#2563eb]'
                      }`}
                  >
                    {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>
                </div>
                <Button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className="bg-gradient-to-br from-[#2563eb] to-[#0ea5e9] hover:opacity-90 disabled:opacity-50"
                >
                  {isLoading ? <ShieldLoader size="xs" variant="inline" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default ChatWidget;

