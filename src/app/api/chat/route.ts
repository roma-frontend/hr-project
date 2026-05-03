import { groq } from '@ai-sdk/groq';
import OpenAI from 'openai';
import { streamText } from 'ai';
import { buildRoleBasedPrompt, detectIntent } from '@/lib/aiAssistant';
import type { UserRole } from '@/lib/aiAssistant';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { withCsrfProtection } from '@/lib/csrf-middleware';
import { NextRequest, NextResponse } from 'next/server';

const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    'X-Title': 'HR Project',
  },
});

// In-memory cache for context data (5 min TTL)
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const contextCache = new Map<string, CacheEntry<any>>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCached<T>(key: string): T | null {
  const entry = contextCache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data as T;
  }
  if (entry) contextCache.delete(key);
  return null;
}

function setCache<T>(key: string, data: T): void {
  contextCache.set(key, { data, timestamp: Date.now() });
}

// Fetch with timeout
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = 8000,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

export const POST = withCsrfProtection(async (req: NextRequest) => {
  const startTime = Date.now();

  // SECURITY: Require authentication for AI chat (costly API)
  const auth = await verifyChatAuth();
  if (!auth) {
    return NextResponse.json(
      { error: 'Unauthorized. Please log in to use AI chat.' },
      { status: 401 },
    );
  }

  try {
    console.log('🤖 AI Chat request received');
    const { messages, userId, lang } = await req.json();

    const langInstruction =
      lang === 'ru'
        ? 'ЯЗЫК: Пользователь пишет на русском. Отвечай ТОЛЬКО на русском языке.'
        : lang === 'hy'
          ? 'ԼԵԶՈՒ: Օգտացախան գրում է հայերենով.'
          : 'LANGUAGE: The user is writing in English. Reply ONLY in English.';

    const now = new Date();
    const dateContext = `CURRENT DATE & TIME: ${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;

    const lastUserMessage = messages.filter((m: any) => m.role === 'user').pop()?.content || '';

    // Detect intent EARLY to fetch only relevant context
    const userRoleFromAuth = (auth.role as UserRole) || 'employee';
    const detectedIntent = detectIntent(lastUserMessage, userRoleFromAuth);

    // Determine what data we need based on intent
    const needsFullContext = !detectedIntent || detectedIntent.action;
    const needsConflictCheck =
      /хочу отпуск|book leave|request vacation|отпуск с \d|sick leave|больничный|заказать водителя|book driver|водитель/i.test(
        lastUserMessage,
      );
    const needsInsights = /отпуск|leave|vacation|баланс|balance|посещаемость|attendance/i.test(
      lastUserMessage,
    );

    // ═══════════════════════════════════════════════════════════════
    // PARALLEL FETCH — Запускаем все запросы одновременно
    // ═══════════════════════════════════════════════════════════════
    const origin = req.headers.get('origin') || '';
    const cookieHeader = req.headers.get('cookie') || '';
    const authHeaders = { cookie: cookieHeader };

    const [contextResult, insightsResult, fullResult, conflictResult] = await Promise.allSettled([
      // 1. User context (always needed)
      fetchWithTimeout(`${origin}/api/chat/context`, { headers: authHeaders }, 5000),

      // 2. AI insights (only if relevant)
      needsInsights && userId
        ? fetchWithTimeout(
            `${origin}/api/chat/insights?userId=${userId}`,
            { headers: authHeaders },
            4000,
          )
        : Promise.resolve(null),

      // 3. Full context (only if needed)
      needsFullContext
        ? fetchWithTimeout(
            `${origin}/api/chat/full-context?requesterId=${userId}`,
            { headers: authHeaders },
            6000,
          )
        : Promise.resolve(null),

      // 4. Conflict check (only for booking requests)
      needsConflictCheck && userId
        ? (async () => {
            const dateMatch = lastUserMessage.match(
              /с (\d{1,2})[\/\.-](\d{1,2})|from (\d{1,2})[\/\.-](\d{1,2})|(\d{1,2})[\/\.-](\d{1,2})/i,
            );
            if (!dateMatch) return null;
            const day1 = parseInt(dateMatch[1] || dateMatch[3] || dateMatch[5]);
            const monthStr = dateMatch[2] || dateMatch[4] || dateMatch[6];
            const monthMap: Record<string, number> = {
              '1': 0,
              '2': 1,
              '3': 2,
              '4': 3,
              '5': 4,
              '6': 5,
              '7': 6,
              '8': 7,
              '9': 8,
              '10': 9,
              '11': 10,
              '12': 11,
            };
            const month = monthMap[monthStr] ?? parseInt(monthStr) - 1;
            const year = new Date().getFullYear();
            const startDate = new Date(year, month, day1).getTime();
            const endDate = new Date(year, month, day1 + 7).getTime();
            const requestType = /водитель|driver/i.test(lastUserMessage) ? 'driver' : 'leave';
            return fetchWithTimeout(
              `${origin}/api/chat/conflict-check?userId=${userId}&organizationId=&requestType=${requestType}&startDate=${startDate}&endDate=${endDate}`,
              { headers: authHeaders },
              4000,
            );
          })()
        : Promise.resolve(null),
    ]);

    // Process user context
    let userContext = '';
    let userRole: UserRole = 'employee';
    let userEmail = '';
    let userName = '';
    let userDepartment = '';
    let userPosition = '';
    let userOrgId = '';

    if (contextResult.status === 'fulfilled' && contextResult.value?.ok) {
      try {
        const context = await contextResult.value.json();
        userRole = context.user.role as UserRole;
        userEmail = context.user.email;
        userName = context.user.name;
        userDepartment = context.user.department;
        userPosition = context.user.position;
        userOrgId = context.user.organizationId;

        userContext = `
USER: ${context.user.name} | Role: ${context.user.role} | Dept: ${context.user.department}
Leave balances: Paid=${context.leaveBalances.paid}d, Sick=${context.leaveBalances.sick}d, Family=${context.leaveBalances.family}d
Stats: Taken=${context.stats.totalDaysTaken}d, Pending=${context.stats.pendingDays}d
Recent leaves: ${
          context.recentLeaves
            ?.slice(0, 3)
            .map((l: any) => `${l.type} ${l.startDate}-${l.endDate} (${l.status})`)
            .join(', ') || 'none'
        }
Team on leave: ${
          context.teamAvailability
            ?.slice(0, 5)
            .map((l: any) => `${l.userName} (${l.startDate}-${l.endDate})`)
            .join(', ') || 'none'
        }
`.trim();
      } catch (e) {
        console.error('Failed to parse context:', e);
      }
    }

    // Process AI insights
    let aiInsights = '';
    if (insightsResult.status === 'fulfilled' && insightsResult.value?.ok) {
      try {
        const insights = await insightsResult.value.json();
        if (insights) {
          aiInsights = [
            insights.balanceWarning && `⚠️ ${insights.balanceWarning}`,
            insights.patterns?.length && `Patterns: ${insights.patterns.slice(0, 3).join(', ')}`,
            insights.bestDates?.length &&
              `Best dates: ${insights.bestDates.slice(0, 3).join(', ')}`,
            insights.teamConflicts?.length &&
              `Conflicts: ${insights.teamConflicts.slice(0, 3).join(', ')}`,
          ]
            .filter(Boolean)
            .join('\n');
        }
      } catch (e) {
        /* ignore */
      }
    }

    // Process conflict check
    let conflictCheckData = '';
    if (conflictResult.status === 'fulfilled' && conflictResult.value?.ok) {
      try {
        const conflictData = await conflictResult.value.json();
        if (conflictData.hasConflicts) {
          conflictCheckData = `⚠️ CONFLICTS: ${conflictData.conflictCount} found. ${conflictData.aiMessage || ''}`;
        } else {
          conflictCheckData = '✅ No conflicts detected';
        }
      } catch (e) {
        /* ignore */
      }
    }

    // Process full context (compact version)
    let fullContext = '';
    let availableDriversInfo = '';

    if (fullResult.status === 'fulfilled' && fullResult.value?.ok) {
      try {
        const data = await fullResult.value.json();

        // Compact employees summary
        const employeesSummary = (data.employees ?? [])
          .slice(0, 15)
          .map((e: any) => {
            const status =
              e.presenceStatus === 'available'
                ? '🟢'
                : e.presenceStatus === 'in_meeting'
                  ? '📅'
                  : e.presenceStatus === 'in_call'
                    ? '📞'
                    : e.presenceStatus === 'out_of_office'
                      ? '🏠'
                      : '⛔';
            const leaveInfo = e.currentLeave
              ? ` | ON LEAVE: ${e.currentLeave.type} (${e.currentLeave.startDate}-${e.currentLeave.endDate})`
              : '';
            const pendingInfo = e.pendingLeaves?.length
              ? ` | Pending: ${e.pendingLeaves.length}`
              : '';
            return `${status} ${e.name} (${e.department})${leaveInfo}${pendingInfo}`;
          })
          .join('\n');

        // Compact calendar
        const calendarSummary = (data.calendarEvents ?? [])
          .slice(0, 10)
          .map((ev: any) => `📅 ${ev.employee}: ${ev.type} ${ev.startDate}-${ev.endDate}`)
          .join('\n');

        // Compact attendance
        const attendanceSummary = (data.todayAttendance ?? [])
          .slice(0, 10)
          .map(
            (t: any) =>
              `${t.status === 'checked_in' ? '🟢' : '🔴'} ${t.name}: ${t.checkIn || '—'}${t.isLate ? ` (LATE ${t.lateMinutes}min)` : ''}`,
          )
          .join('\n');

        // Compact tickets
        const ticketsSummary = (data.tickets ?? [])
          .slice(0, 5)
          .map(
            (t: any) => `🎫 ${t.ticketNumber}: ${t.title} [${t.status}] ${t.isOverdue ? '⚠️' : ''}`,
          )
          .join('\n');

        // Compact drivers
        const driversSummary = (data.availableDrivers ?? [])
          .slice(0, 5)
          .map(
            (d: any) => `🚘 ${d.name}: ${d.vehicle || 'No vehicle'} [${d.status || 'Available'}]`,
          )
          .join('\n');

        fullContext = `
Company: ${data.totalEmployees ?? 0} employees, ${data.currentlyAtWork ?? 0} at work, ${data.onLeaveToday ?? 0} on leave

Employees:
${employeesSummary || 'No data'}

Calendar:
${calendarSummary || 'No upcoming leaves'}

Attendance:
${attendanceSummary || 'No data'}

Tickets (${data.ticketStats?.total || 0} total):
${ticketsSummary || 'No tickets'}

Drivers:
${driversSummary || 'No drivers'}
`.trim();

        // Fetch drivers separately if not in full context
        if (!data.availableDrivers?.length && userOrgId) {
          try {
            const driversRes = await fetchWithTimeout(
              `${origin}/api/drivers/available?organizationId=${userOrgId}`,
              { headers: authHeaders },
              3000,
            );
            if (driversRes.ok) {
              const drivers = await driversRes.json();
              if (drivers?.length) {
                availableDriversInfo = `Available drivers: ${drivers.map((d: any) => `${d.userName} (${d.vehicleInfo.model})`).join(', ')}`;
              }
            }
          } catch (e) {
            /* ignore */
          }
        }
      } catch (e) {
        console.error('Failed to parse full context:', e);
      }
    }

    const fetchTime = Date.now() - startTime;
    console.log(`⚡ Context fetch completed in ${fetchTime}ms`);

    // ═══════════════════════════════════════════════════════════════
    // BUILD PROMPT — Compact and focused
    // ═══════════════════════════════════════════════════════════════
    const roleBasedSystemPrompt = buildRoleBasedPrompt(
      {
        userId: userId || '',
        name: userName,
        email: userEmail,
        role: userRole,
        organizationId: userOrgId,
        department: userDepartment,
        position: userPosition,
      },
      {
        userContext,
        fullContext,
        aiInsights,
        conflictCheckData,
        availableDriversInfo,
        dateContext,
      },
    );

    // Navigation hint
    let navigationHint = '';
    const explicitNavigationKeywords = [
      'открой',
      'откройте',
      'покажи страницу',
      'покажи мне страницу',
      'перейди',
      'перейдите',
      'go to',
      'open',
      'show page',
      'navigate to',
    ];
    const hasExplicitNavigation = explicitNavigationKeywords.some((keyword) =>
      lastUserMessage.toLowerCase().includes(keyword),
    );

    if (detectedIntent?.action && hasExplicitNavigation) {
      navigationHint = `\n\nNAVIGATION: <NAVIGATE>${detectedIntent.action}</NAVIGATE>`;
    } else if (detectedIntent?.action && !hasExplicitNavigation) {
      navigationHint = `\n\nACTION REQUEST (do NOT navigate): Help with "${detectedIntent.name}" using <ACTION> tags if needed.`;
    }

    // ═══════════════════════════════════════════════════════════════
    // GROQ PRIMARY — Fast inference
    // ═══════════════════════════════════════════════════════════════
    const corePrompt = `${roleBasedSystemPrompt}

LIVE DATA:
${userContext}
${fullContext ? '\n' + fullContext : ''}
${aiInsights ? '\n' + aiInsights : ''}
${conflictCheckData ? '\n' + conflictCheckData : ''}
${navigationHint}

${langInstruction}

FORMAT RULES:
- Use markdown tables for lists
- Use emojis: 👤📅⏰📊🎯🎫📝🚗✅⏳❌
- Be concise but complete
- Answer in user's language
- <NAVIGATE>/path only for explicit page requests
- <ACTION>{"type":"BOOK_LEAVE",...} for leave booking (ask dates first if missing)
`;

    try {
      console.log('🚀 Using Groq (primary)...');
      const result = await streamText({
        model: groq('llama-3.1-8b-instant'),
        maxRetries: 0,
        system: corePrompt,
        messages,
      });

      console.log(`✅ Groq response streamed in ${Date.now() - startTime}ms`);
      return result.toTextStreamResponse();
    } catch (groqError: any) {
      console.log('⚠️ Groq failed, trying OpenRouter...', groqError.message);

      try {
        const stream = await openrouter.chat.completions.create({
          model: 'meta-llama/llama-3.3-70b-instruct:free',
          messages: [{ role: 'system', content: corePrompt }, ...messages],
          stream: true,
        });

        const readableStream = new ReadableStream({
          async start(controller) {
            const encoder = new TextEncoder();
            for await (const chunk of stream) {
              const content = chunk.choices[0]?.delta?.content;
              if (content) {
                controller.enqueue(encoder.encode(content));
              }
            }
            controller.close();
          },
        });

        console.log(`✅ OpenRouter response streamed in ${Date.now() - startTime}ms`);
        return new Response(readableStream, {
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      } catch (openrouterError: any) {
        console.error('❌ Both providers failed:', openrouterError.message);
        throw groqError;
      }
    }
  } catch (error) {
    console.error('❌ Chat API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
});

/**
 * Verify JWT auth token for chat API.
 */
async function verifyChatAuth(): Promise<{ userId: string; role: string } | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('hr-auth-token') || cookieStore.get('oauth-session');
    if (!token) return null;

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) return null;

    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jwtVerify(token.value, secret);
    return { userId: payload.sub as string, role: (payload.role as string) || 'employee' };
  } catch {
    return null;
  }
}
