'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from '@/lib/cssMotion';
import {
  X,
  Send,
  Sparkles,
  CheckCircle,
  AlertCircle,
  Calendar,
  Pencil,
  Trash2,
  Mic,
  MicOff,
  Car,
  Maximize2,
} from 'lucide-react';
import { ShieldLoader } from '@/components/ui/ShieldLoader';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/useAuthStore';
import { useUpgradeModal } from '@/components/subscription/PlanGate';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
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
  conflicts?: any[]; // Массив конфликтов из Conflict Service
  alternativeDates?: string[]; // Альтернативные даты от AI
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

interface BookDriverAction {
  type: 'BOOK_DRIVER';
  driverId: string;
  driverName: string;
  startTime: string;
  endTime: string;
  from: string;
  to: string;
  purpose: string;
  passengerCount: number;
  notes?: string;
}

type AnyAction = BookLeaveAction | EditLeaveAction | DeleteLeaveAction | BookDriverAction;

function parseActions(content: string): { cleanContent: string; actions: AnyAction[] } {
  const actionMatches = [...content.matchAll(/<ACTION>([\s\S]*?)<\/ACTION>/g)];
  if (actionMatches.length === 0) return { cleanContent: content, actions: [] };

  const actions: AnyAction[] = [];
  for (const match of actionMatches) {
    try {
      const actionStr = match[1]?.trim();
      if (actionStr) {
        const action = JSON.parse(actionStr) as AnyAction;
        actions.push(action);
      }
    } catch {
      // skip invalid JSON
    }
  }

  const cleanContent = content
    .replace(/<ACTION>[\s\S]*?<\/ACTION>/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return { cleanContent, actions };
}

// Generate follow-up suggestions based on assistant response content
function getFollowUpSuggestions(
  content: string,
  userRole: string,
  t: (key: string) => string,
): string[] {
  const lower = content.toLowerCase();

  if (
    lower.includes('book') ||
    lower.includes(t('chatWidget.leaveRequest')) ||
    lower.includes('submitted') ||
    lower.includes('approved')
  ) {
    return [t('chatWidget.showBalance'), t('chatWidget.viewUpcoming'), t('chatWidget.whoOnLeave')];
  }
  if (lower.includes('balance') || lower.includes('days left') || lower.includes('remaining')) {
    return ['📆 Book a vacation', '🤒 Request sick leave', '📊 Show my leave history'];
  }
  if (lower.includes('sick') || lower.includes('doctor') || lower.includes('medical')) {
    return ['🤒 Book sick leave for today', '👨‍⚕️ Book a doctor visit', t('chatWidget.showBalance')];
  }
  if (lower.includes('team') || lower.includes('colleague') || lower.includes('who is')) {
    return ['📅 Show team calendar', '📋 My leave balance', '📆 Book time off'];
  }
  if (lower.includes('cancel') || lower.includes('delete') || lower.includes('removed')) {
    return ['📋 Show my pending leaves', '📆 Book new leave', '📊 My leave balance'];
  }
  if (userRole === 'admin' || userRole === 'supervisor') {
    return [
      t('chatWidget.whoOnLeaveToday'),
      t('chatWidget.teamStats'),
      t('chatWidget.pendingApprovals'),
    ];
  }
  return ['📆 Book a vacation', t('chatWidget.showBalance'), '👥 Who is on leave this week?'];
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
  if (!role)
    return [
      '💰 Show my leave balance',
      '📆 Book a vacation',
      '🤒 I feel sick today',
      '👥 Who is on leave this week?',
    ];

  return getRoleSuggestions(role as UserRole);
};

export function ChatWidget() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [wakeWordActive, setWakeWordActive] = useState(false);
  const [voiceInput, setVoiceInput] = useState('');
  const [showVoiceModal, setShowVoiceModal] = useState(false);

  // AI button hint system
  const [hintIndex, setHintIndex] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [lastActivityTime, setLastActivityTime] = useState(Date.now());
  const [hintsShownCount, setHintsShownCount] = useState(0);
  const MAX_HINTS_PER_SESSION = 3;
  const HINT_INTERVAL_MS = 20000; // 20 seconds between hints
  const INACTIVITY_THRESHOLD_MS = 15000; // 15 seconds of inactivity
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

  // ── AI Button hint system ───────────────────────────────────────
  const getHintText = useCallback(
    (index: number): string => {
      const hints = [
        t('hints.help', { defaultValue: "Need help? I'm here! 💡" }),
        t('hints.leaveRequest', { defaultValue: 'Try /leave to request time off' }),
        t('hints.reports', { defaultValue: 'Ask me about team reports' }),
      ];
      return hints[index % hints.length] ?? '';
    },
    [t],
  );

  // Track user activity
  const trackActivity = useCallback(() => {
    setLastActivityTime(Date.now());
    setShowHint(false);
  }, []);

  // Show hint after inactivity
  useEffect(() => {
    if (isOpen || hintsShownCount >= MAX_HINTS_PER_SESSION) return;

    const checkInactivity = () => {
      const now = Date.now();
      const inactive = now - lastActivityTime > INACTIVITY_THRESHOLD_MS;

      if (inactive && !showHint) {
        setShowHint(true);
        setHintsShownCount((prev) => prev + 1);

        // Hide hint after 5 seconds
        setTimeout(() => {
          setShowHint(false);
          // Rotate to next hint
          setHintIndex((prev) => (prev + 1) % 3);
        }, 5000);
      }
    };

    const interval = setInterval(checkInactivity, HINT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isOpen, lastActivityTime, showHint, hintsShownCount]);

  // Listen for user activity
  useEffect(() => {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    const handler = trackActivity;

    events.forEach((event) => {
      window.addEventListener(event, handler, { passive: true });
    });

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handler);
      });
    };
  }, [trackActivity]);

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

    const greetings = t('hello', { returnObjects: true }) as string[];
    const text = greetings[Math.floor(Math.random() * greetings.length)];
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.95;
    utterance.pitch = 1.2;

    // Pick a female voice if available
    const pickVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      const female =
        voices.find(
          (v) =>
            /female|woman|girl|zira|samantha|victoria|karen|moira|fiona|veena|susan|catherine|alice|amelie|anna|joanna|kendra|kimberly|ivy|salli/i.test(
              v.name,
            ) && v.lang.startsWith('en'),
        ) || voices.find((v) => v.lang.startsWith('en'));
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
    return;
  }, []);

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
        const t = e.results[i]?.[0]?.transcript || '';
        if (e.results[i]?.isFinal) final += t;
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
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? {
                ...m,
                bookingStates: {
                  ...m.bookingStates,
                  [actionIndex]: { status: 'conflict', result: 'Not logged in.' },
                },
              }
            : m,
        ),
      );
      return;
    }

    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? { ...m, bookingStates: { ...m.bookingStates, [actionIndex]: { status: 'loading' } } }
          : m,
      ),
    );

    try {
      let url = '';
      let body: Record<string, unknown> = {};

      if (action.type === 'BOOK_LEAVE') {
        // ═══════════════════════════════════════════════════════════════
        // CONFLICT CHECK — Перед созданием запроса проверяем конфликты
        // ═══════════════════════════════════════════════════════════════
        if (user.organizationId) {
          const conflictCheckRes = await fetch(
            `/api/chat/conflict-check?userId=${user.id}&organizationId=${user.organizationId}&requestType=leave&startDate=${new Date(action.startDate).getTime()}&endDate=${new Date(action.endDate).getTime()}`,
          );

          if (conflictCheckRes.ok) {
            const conflictData = await conflictCheckRes.json();

            // Если есть критические конфликты — показываем предупреждение
            if (conflictData.hasCriticalConflicts) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === messageId
                    ? {
                        ...m,
                        bookingStates: {
                          ...m.bookingStates,
                          [actionIndex]: {
                            status: 'conflict',
                            result:
                              conflictData.aiMessage ||
                              'Обнаружены критические конфликты. Пожалуйста, выберите другие даты или обсудите с руководителем.',
                            conflicts: conflictData.conflicts,
                            alternativeDates: conflictData.alternativeDates || [],
                          },
                        },
                      }
                    : m,
                ),
              );
              return; // Не продолжаем, если критический конфликт
            }
          }
        }

        url = '/api/chat/book-leave';
        body = {
          userId: user.id,
          organizationId: user.organizationId, // ← Добавили organizationId
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
      } else if (action.type === 'BOOK_DRIVER') {
        url = '/api/chat/book-driver';
        console.log('[ChatWidget] BOOK_DRIVER action:', action);
        console.log('[ChatWidget] User:', { id: user.id, organizationId: user.organizationId });

        const startTime = new Date(action.startTime).getTime();
        const endTime = new Date(action.endTime).getTime();

        if (!user.organizationId) {
          throw new Error('Organization not selected. Please select an organization first.');
        }
        if (isNaN(startTime) || isNaN(endTime)) {
          throw new Error('Invalid date/time for driver booking.');
        }

        // ═══════════════════════════════════════════════════════════════
        // CONFLICT CHECK — Проверяем доступность водителя
        // ═══════════════════════════════════════════════════════════════
        const conflictCheckRes = await fetch(
          `/api/chat/conflict-check?userId=${user.id}&organizationId=${user.organizationId}&requestType=driver&startDate=${startTime}&endDate=${endTime}`,
        );

        if (conflictCheckRes.ok) {
          const conflictData = await conflictCheckRes.json();

          // Если водитель занят — показываем предупреждение
          if (conflictData.hasCriticalConflicts) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === messageId
                  ? {
                      ...m,
                      bookingStates: {
                        ...m.bookingStates,
                        [actionIndex]: {
                          status: 'conflict',
                          result:
                            conflictData.aiMessage ||
                            'Водитель уже забронирован на это время. Пожалуйста, выберите другое время или другого водителя.',
                          conflicts: conflictData.conflicts,
                        },
                      },
                    }
                  : m,
              ),
            );
            return; // Не продолжаем, если критический конфликт
          }
        }

        body = {
          userId: user.id,
          organizationId: user.organizationId,
          driverId: action.driverId,
          startTime,
          endTime,
          tripInfo: {
            from: action.from,
            to: action.to,
            purpose: action.purpose,
            passengerCount: action.passengerCount,
            notes: action.notes,
          },
        };
      }

      console.log('[ChatWidget] Sending request to:', url, body);

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      let data: Record<string, unknown>;
      try {
        data = await res.json();
      } catch {
        data = { error: `Server error (${res.status})` };
      }

      if (res.ok) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  bookingStates: {
                    ...m.bookingStates,
                    [actionIndex]: {
                      status: 'booked',
                      result: (data.message as string) || 'Done!',
                    },
                  },
                }
              : m,
          ),
        );
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  bookingStates: {
                    ...m.bookingStates,
                    [actionIndex]: {
                      status: 'conflict',
                      result: (data.error as string) || 'Something went wrong.',
                    },
                  },
                }
              : m,
          ),
        );
      }
    } catch (err) {
      console.error('[ChatWidget] Action error:', err);
      const errorMsg = err instanceof Error ? err.message : 'Network error. Please try again.';
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? {
                ...m,
                bookingStates: {
                  ...m.bookingStates,
                  [actionIndex]: { status: 'conflict', result: errorMsg },
                },
              }
            : m,
        ),
      );
    }
  };

  // Smart navigation - detect navigation commands
  // IMPORTANT: Only navigate for VIEW requests, not for CREATE/BOOK requests!
  const handleNavigation = useCallback(
    (text: string) => {
      const lowerText = text.toLowerCase();

      // 🔴 Ключевые слова для СОЗДАНИЯ запросов — НЕ перенаправлять!
      const createKeywords = [
        'хочу',
        'book',
        'request',
        'создать',
        'забронировать',
        'организуй',
        'взять отпуск',
        'go on leave',
        'vacation',
        'с \\d',
        'from \\d',
        'до \\d',
        'by \\d',
      ];

      // Проверяем, не хочет ли пользователь создать что-то
      const isCreateRequest = createKeywords.some((keyword) => {
        // Проверяем как точное совпадение, так и regex
        if (keyword.includes('\\d')) {
          // Это regex паттерн для дат
          const regex = new RegExp(keyword, 'i');
          return regex.test(lowerText);
        }
        return lowerText.includes(keyword);
      });

      if (isCreateRequest) {
        // НЕ перенаправлять, отправить AI для обработки
        console.log('🚫 [handleNavigation] Create request detected, skipping navigation:', text);
        return false;
      }

      const navigationMap: { [key: string]: string } = {
        'покажи календарь': '/calendar',
        'открой календарь': '/calendar',
        'show calendar': '/calendar',
        'view calendar': '/calendar',
        календарь: '/calendar',
        calendar: '/calendar',

        'покажи отпуска': '/leaves',
        'покажи мои отпуска': '/leaves',
        'view my leaves': '/leaves',
        'show leaves': '/leaves',
        'my leaves': '/leaves',
        'view leaves': '/leaves',

        'покажи сотрудников': '/employees',
        'show employees': '/employees',
        'view team': '/employees',
        сотрудники: '/employees',
        employees: '/employees',
        команда: '/employees',
        team: '/employees',

        'покажи задачи': '/tasks',
        'show tasks': '/tasks',
        'my tasks': '/tasks',
        задачи: '/tasks',
        tasks: '/tasks',

        посещаемость: '/attendance',
        attendance: '/attendance',
        присутствие: '/attendance',

        аналитика: '/analytics',
        analytics: '/analytics',
        статистика: '/analytics',
        reports: '/reports',
        отчеты: '/reports',

        настройки: '/settings',
        settings: '/settings',

        дашборд: '/dashboard',
        dashboard: '/dashboard',
        главная: '/dashboard',
        home: '/dashboard',

        профиль: '/profile',
        profile: '/profile',
        'мой профиль': '/profile',
        'my profile': '/profile',
      };

      for (const [keyword, path] of Object.entries(navigationMap)) {
        // Точное совпадение или "покажи/открой X"
        if (
          lowerText === keyword ||
          lowerText.startsWith('покажи ') ||
          lowerText.startsWith('открой ') ||
          lowerText.startsWith('show ') ||
          lowerText.startsWith('view ') ||
          lowerText.startsWith('open ')
        ) {
          if (keyword.includes(lowerText.split(' ')[1] || '')) {
            router.push(path);
            setIsOpen(false);
            return true;
          }
        }
      }

      return false;
    },
    [router],
  );

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

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      console.log('🤖 [ChatWidget] Sending message to AI:', {
        userId: user?.id,
        organizationId: user?.organizationId,
        message: input,
      });

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({ role: m.role, content: m.content })),
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
      setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          fullContent += decoder.decode(value, { stream: true });
          const { cleanContent } = parseActions(fullContent);
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: cleanContent } : m)),
          );
        }
      }

      const { cleanContent, actions } = parseActions(fullContent);
      const suggestions = getFollowUpSuggestions(cleanContent, user?.role || 'employee', t);

      // 🔍 DEBUG: Логируем полный ответ AI
      console.log('🤖 [AI Response] Full content:', fullContent);
      console.log('🤖 [AI Response] Clean content:', cleanContent);
      console.log('🤖 [AI Response] Actions:', actions);

      // Check for navigation tags in response
      const navMatch = fullContent.match(/<NAVIGATE>(.*?)<\/NAVIGATE>/);
      if (navMatch && navMatch[1]) {
        const route = navMatch[1];
        console.log('🎯 [AI Navigation] Route:', route);
        console.log('🎯 [AI Navigation] Full match:', navMatch[0]);
        // Navigate after a short delay to show the message
        setTimeout(() => {
          router.push(route);
          setIsOpen(false);
        }, 800);
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: cleanContent.replace(/<NAVIGATE>.*?<\/NAVIGATE>/g, '').trim(),
                actions,
                bookingStates: Object.fromEntries(
                  actions.map((_, i) => [i, { status: 'pending' as const }]),
                ),
                suggestions,
              }
            : m,
        ),
      );
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
            Hey HR! I&apos;m listening…
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upgrade modal (rendered at root level) */}
      {upgradeModal}

      {/* Toggle Button - Hidden on /ai-chat page */}
      {pathname !== '/ai-chat' && (
        <>
          {/* Pulsing animation background */}
          <motion.div
            className="fixed bottom-6 right-6 z-50 w-10 sm:w-14 h-10 sm:h-14 rounded-full bg-primary/20"
            animate={{
              scale: [1, 1.2, 1] as any,
              opacity: [0.7, 0, 0.7] as any,
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />

          {/* Rotating hints tooltip */}
          <AnimatePresence>
            {showHint && hintIndex < MAX_HINTS_PER_SESSION && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="fixed bottom-24 right-6 z-50 max-w-[200px] px-3 py-2 rounded-lg text-xs font-medium shadow-lg"
                style={{
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                }}
              >
                {getHintText(hintIndex)}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main button */}
          <motion.button
            aria-label={t('chatWidget.openAssistant', { defaultValue: 'Open AI assistant' })}
            onClick={() => {
              if (!hasAiChat) {
                openModal({
                  featureTitle: 'AI HR Assistant',
                  featureDescription:
                    'AI-powered leave assistant, smart suggestions, and voice commands are available on the Professional plan.',
                  recommendedPlan: 'professional',
                });
                return;
              }
              setIsOpen((o) => !o);
              // Reset hint timer when user opens chat
              setLastActivityTime(Date.now());
            }}
            className="fixed bottom-6 right-6 z-50 w-10 sm:w-14 h-10 sm:h-14 rounded-full flex items-center gap-2 justify-center bg-linear-to-r from-(--primary) to-(--primary-dark,var(--primary)) hover:opacity-90 transition-opacity text-white font-medium shadow-md hover:shadow-lg"
            whileTap={{ scale: 0.95 }}
          >
            <AnimatePresence mode="wait">
              {isOpen ? (
                <motion.div
                  key="x"
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <X className="w-6 h-6" />
                </motion.div>
              ) : (
                <motion.div
                  key="chat"
                  initial={{ rotate: 90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: -90, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <Sparkles className="w-4 sm:w-6 h-4 sm:h-6" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        </>
      )}

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed bottom-24 right-2 sm:right-6 z-50 w-[calc(100vw-1rem)] sm:w-[380px] max-h-[calc(100vh-8rem)] sm:max-h-[600px] flex flex-col rounded-2xl border border-(--border) shadow-2xl overflow-hidden"
            style={{ background: 'var(--card)' }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-(--border) shrink-0 bg-linear-to-r from-[#2563eb]/10 to-[#0ea5e9]/10">
              <div className="w-8 h-8 rounded-xl bg-linear-to-r from-(--primary) to-(--primary-dark,var(--primary)) hover:opacity-90 transition-opacity flex items-center justify-center shadow">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-(--text-primary)">Shield HR AI</p>
                <p className="text-[10px] text-(--text-muted)">
                  {t('chatWidget.subtitle', { defaultValue: 'Your intelligent HR assistant' })}
                </p>
              </div>
              <div className="flex items-center gap-1 ml-auto">
                <button
                  onClick={() => {
                    router.push('/ai-chat');
                    setIsOpen(false);
                  }}
                  className="p-1.5 rounded-lg hover:bg-(--background-subtle) transition-colors"
                  aria-label="Open full screen chat"
                  title="Открыть на весь экран"
                >
                  <Maximize2 className="w-4 h-4 text-(--text-muted)" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-(--background-subtle) transition-colors"
                  aria-label={t('chatWidget.closeChat', { defaultValue: 'Close chat' })}
                >
                  <X className="w-4 h-4 text-(--text-muted)" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
              {/* Initial suggestions (shown when no messages) */}
              {messages.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3"
                >
                  <p className="text-xs text-(--text-muted) text-center mb-1">
                    👋 {t('chatWidget.greeting', { name: user?.name?.split(' ')[0] || 'there' })}
                  </p>
                  <p className="text-[10px] text-(--text-muted)/70 text-center mb-2">
                    💡{' '}
                    {t('chatWidget.smartHint', {
                      defaultValue: 'I know everything about Shield HR — ask me anything!',
                    })}
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {getInitialSuggestions(user?.role as UserRole).map((s) => (
                      <button
                        key={s}
                        onClick={() => handleSuggestion(s)}
                        disabled={isLoading}
                        className="text-left px-3 py-2 rounded-xl border border-(--border) bg-(--background-subtle) hover:border-[#2563eb]/50 hover:bg-[#2563eb]/5 hover:text-[#3b82f6] text-xs text-(--text-primary) transition-all duration-150 disabled:opacity-50"
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
                    <div
                      className={`max-w-[85%] space-y-2 ${isUser ? 'items-end' : 'items-start'} flex flex-col`}
                    >
                      <div
                        className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                          isUser
                            ? 'bg-linear-to-br from-[#2563eb] to-[#0ea5e9] text-white rounded-br-sm'
                            : 'bg-(--background-subtle) text-(--text-primary) rounded-bl-sm'
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
                            const isBookDriver = action.type === 'BOOK_DRIVER';

                            return (
                              <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`rounded-xl border p-3 text-xs space-y-2 ${
                                  isDelete
                                    ? 'border-red-500/20 bg-red-500/5'
                                    : isEdit
                                      ? 'border-yellow-500/20 bg-yellow-500/5'
                                      : isBookDriver
                                        ? 'border-purple-500/20 bg-purple-500/5'
                                        : 'border-[#2563eb]/20 bg-[#2563eb]/5'
                                }`}
                              >
                                <div className="flex items-center gap-2 font-semibold text-(--text-primary)">
                                  {isDelete ? (
                                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                  ) : isEdit ? (
                                    <Pencil className="w-3.5 h-3.5 text-yellow-500" />
                                  ) : isBookDriver ? (
                                    <Car className="w-3.5 h-3.5 text-purple-500" />
                                  ) : (
                                    <Calendar className="w-3.5 h-3.5 text-[#2563eb]" />
                                  )}
                                  {isDelete
                                    ? t('chatWidget.cancelLeave')
                                    : isEdit
                                      ? t('chatWidget.updateLeave')
                                      : isBookDriver
                                        ? t('chatWidget.bookDriver', 'Book Driver')
                                        : (LEAVE_TYPE_LABELS[
                                            (action as BookLeaveAction).leaveType
                                          ] ?? t('chatWidget.leaveRequest'))}
                                </div>
                                <div className="text-(--text-muted) space-y-0.5">
                                  {isBookDriver ? (
                                    <>
                                      <p>🚗 {(action as BookDriverAction).driverName}</p>
                                      <p>
                                        📅{' '}
                                        {new Date(
                                          (action as BookDriverAction).startTime,
                                        ).toLocaleString(
                                          i18n.language === 'ru'
                                            ? 'ru-RU'
                                            : i18n.language === 'hy'
                                              ? 'hy-AM'
                                              : 'en-US',
                                        )}
                                      </p>
                                      <p>
                                        📍 {(action as BookDriverAction).from} →{' '}
                                        {(action as BookDriverAction).to}
                                      </p>
                                      <p>
                                        👥 {(action as BookDriverAction).passengerCount} passengers
                                      </p>
                                      {(action as BookDriverAction).purpose && (
                                        <p>💼 {(action as BookDriverAction).purpose}</p>
                                      )}
                                    </>
                                  ) : action.type !== 'DELETE_LEAVE' ? (
                                    <>
                                      <p>
                                        📅 {action.startDate} → {action.endDate}
                                      </p>
                                      <p>
                                        ⏱️ {action.days} day{action.days !== 1 ? 's' : ''}
                                      </p>
                                      {(action as BookLeaveAction).reason && (
                                        <p>📝 {(action as BookLeaveAction).reason}</p>
                                      )}
                                    </>
                                  ) : (
                                    <>
                                      <p>👤 {(action as DeleteLeaveAction).employeeName}</p>
                                      <p>
                                        📅 {(action as DeleteLeaveAction).startDate} →{' '}
                                        {(action as DeleteLeaveAction).endDate}
                                      </p>
                                      <p className="text-red-500 font-medium">
                                        ⚠️ This action cannot be undone
                                      </p>
                                    </>
                                  )}
                                </div>

                                {state.status === 'pending' && (
                                  <button
                                    onClick={() => handleAction(m.id, action, idx)}
                                    className={`w-full py-2 px-3 text-white text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity ${
                                      isDelete
                                        ? 'bg-linear-to-r from-red-500 to-red-600'
                                        : isEdit
                                          ? 'bg-linear-to-r from-yellow-500 to-orange-500'
                                          : 'bg-linear-to-r from-[#2563eb] to-[#0ea5e9]'
                                    }`}
                                  >
                                    {isDelete
                                      ? t('chatWidget.confirmDelete')
                                      : isEdit
                                        ? t('chatWidget.confirmUpdate')
                                        : t('chatWidget.confirmSend')}
                                  </button>
                                )}
                                {state.status === 'loading' && (
                                  <div className="flex items-center justify-center gap-2 py-2">
                                    <ShieldLoader size="xs" variant="inline" />
                                    <span className="text-xs text-(--text-muted)">
                                      {t('chatWidget.submitting')}
                                    </span>
                                  </div>
                                )}
                                {state.status === 'booked' && (
                                  <div className="flex items-start gap-2 p-2 bg-green-500/10 rounded-lg border border-green-500/20">
                                    <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                                    <p className="text-xs text-green-600 dark:text-green-400">
                                      {state.result}
                                    </p>
                                  </div>
                                )}
                                {state.status === 'conflict' && (
                                  <div className="flex items-start gap-2 p-2 bg-red-500/10 rounded-lg border border-red-500/20">
                                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                                    <div className="flex-1">
                                      <p className="text-xs text-red-600 dark:text-red-400 whitespace-pre-line">
                                        {state.result}
                                      </p>

                                      {state.conflicts && state.conflicts.length > 0 && (
                                        <div className="mt-2 space-y-1">
                                          {state.conflicts.map((conflict: any, idx: number) => (
                                            <div
                                              key={idx}
                                              className="text-xs text-red-700 dark:text-red-300 bg-red-500/5 p-2 rounded border border-red-500/10"
                                            >
                                              <p className="font-medium">{conflict.title}</p>
                                              <p className="mt-0.5 text-red-600 dark:text-red-400">
                                                {conflict.message}
                                              </p>
                                              <p className="mt-1 text-red-500 dark:text-red-300">
                                                💡 {conflict.suggestion}
                                              </p>
                                            </div>
                                          ))}
                                        </div>
                                      )}

                                      {/* Кнопки альтернативных дат */}
                                      {state.alternativeDates &&
                                        state.alternativeDates.length > 0 && (
                                          <div className="mt-3">
                                            <p className="text-xs font-medium text-red-700 dark:text-red-300 mb-1">
                                              ✅ Доступные даты без конфликтов:
                                            </p>
                                            <div className="flex flex-wrap gap-1.5">
                                              {state.alternativeDates.map((dateRange, idx) => (
                                                <button
                                                  key={idx}
                                                  onClick={() => {
                                                    // Вставляем даты в input
                                                    setInput(`Хочу отпуск ${dateRange}`);
                                                    // Обновляем состояние — убираем конфликт
                                                    setMessages((prev) =>
                                                      prev.map((msg) =>
                                                        msg.id === m.id
                                                          ? {
                                                              ...msg,
                                                              bookingStates: {
                                                                ...msg.bookingStates,
                                                                [idx]: { status: 'pending' },
                                                              },
                                                            }
                                                          : msg,
                                                      ),
                                                    );
                                                  }}
                                                  className="px-3 py-1.5 rounded-full border border-green-500/30 bg-green-500/10 hover:bg-green-500/20 text-xs text-green-700 dark:text-green-400 font-medium transition-all"
                                                >
                                                  📅 {dateRange}
                                                </button>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                    </div>
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
                  <div className="bg-(--background-subtle) px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-2">
                    <ShieldLoader size="xs" variant="inline" />
                    <span className="text-xs text-(--text-muted)">
                      {t('chatWidget.thinking', { defaultValue: 'Thinking...' })}
                    </span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Error */}
            {error && (
              <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/20 shrink-0">
                <p className="text-xs text-red-500">⚠️ {error}</p>
              </div>
            )}

            {/* Input */}
            <form onSubmit={handleSubmit} className="p-4 border-t border-(--border) shrink-0">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={
                      isListening ? t('chatWidget.listening') : t('chatWidget.placeholder')
                    }
                    className={`w-full px-4 py-2 pr-10 bg-(--input) border rounded-xl text-(--text-primary) placeholder:text-(--text-muted) focus:outline-none focus:ring-2 focus:ring-[#2563eb] text-sm transition-colors ${
                      isListening
                        ? 'border-[#2563eb] ring-2 ring-[#2563eb]/30'
                        : 'border-(--border)'
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
                    title={isListening ? t('chatWidget.stopListening') : t('chatWidget.voiceInput')}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg transition-colors disabled:opacity-50 ${
                      isListening
                        ? 'text-[#2563eb] animate-pulse'
                        : 'text-(--text-muted) hover:text-[#3b82f6]'
                    }`}
                  >
                    {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>
                </div>
                <Button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className="bg-linear-to-r from-(--primary) to-(--primary-dark,var(--primary)) hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {isLoading ? (
                    <ShieldLoader size="xs" variant="inline" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
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
