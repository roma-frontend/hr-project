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

// Remove edge runtime to see better errors
// export const runtime = 'edge';

/**
 * Verify JWT auth token for chat API.
 * Chat requires authentication but we don't want to block the stream.
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

export const POST = withCsrfProtection(async (req: NextRequest) => {
  // SECURITY: Require authentication for AI chat (costly API)
  const auth = await verifyChatAuth();
  if (!auth) {
    return NextResponse.json(
      { error: 'Unauthorized. Please log in to use AI chat.' },
      {
        status: 401,
      },
    );
  }

  try {
    console.log('🤖 AI Chat request received');
    const { messages, userId, lang } = await req.json();

    console.log('📋 [AI Chat] Request params:', { userId, lang, messagesCount: messages.length });

    const langInstruction =
      lang === 'ru'
        ? 'ЯЗЫК: Пользователь пишет на русском. Отвечай ТОЛЬКО на русском языке.'
        : lang === 'hy'
          ? 'ԼԵԶՈՒ: Օգտացախան գրում է հայերենով.'
          : 'LANGUAGE: The user is writing in English. Reply ONLY in English.';

    // Current date & time context
    const now = new Date();
    const dateContext = `CURRENT DATE & TIME: ${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}. Use this to determine "today", "this week", "tomorrow", etc.`;
    console.log('📝 Messages count:', messages.length);

    // Fetch user context
    let userContext = '';
    let userRole: UserRole = 'employee';
    let userEmail = '';
    let userName = '';
    let userDepartment = '';
    let userPosition = '';
    let userOrgId = '';

    try {
      const contextRes = await fetch(`${req.headers.get('origin')}/api/chat/context`, {
        headers: {
          cookie: req.headers.get('cookie') || '',
        },
      });

      if (contextRes.ok) {
        const context = await contextRes.json();
        userRole = context.user.role as UserRole;
        userEmail = context.user.email;
        userName = context.user.name;
        userDepartment = context.user.department;
        userPosition = context.user.position;
        userOrgId = context.user.organizationId;

        userContext = `

USER CONTEXT:
- Name: ${context.user.name}
- Role: ${context.user.role}
- Department: ${context.user.department}

LEAVE BALANCES:
- Paid Leave: ${context.leaveBalances.paid} days
- Sick Leave: ${context.leaveBalances.sick} days
- Family Leave: ${context.leaveBalances.family} days

STATISTICS:
- Total days taken: ${context.stats.totalDaysTaken}
- Pending requests: ${context.stats.pendingDays} days

RECENT LEAVES:
${context.recentLeaves.map((l: any) => `- ${l.type}: ${l.startDate} to ${l.endDate} (${l.status})`).join('\n')}

TEAM AVAILABILITY (Next 30 days):
${context.teamAvailability.map((l: any) => `- ${l.userName} (${l.department}): ${l.startDate} to ${l.endDate}`).join('\n')}
`;

        console.log('👤 [AI Chat] User context:', {
          userId: context.user.id,
          orgId: context.user.organizationId,
          role: context.user.role,
        });
      }
    } catch (error) {
      console.error('Failed to fetch context:', error);
    }

    console.log('🧠 Calling Groq AI...');

    // Ensure API key is available
    const apiKey = process.env.GROQ_API_KEY;
    console.log('🔑 API Key available:', !!apiKey, 'Length:', apiKey?.length);

    if (!apiKey) {
      throw new Error('GROQ_API_KEY is not configured');
    }

    // ═══════════════════════════════════════════════════════════════
    // CONFLICT CHECK — Автоматическая проверка конфликтов
    // ═══════════════════════════════════════════════════════════════
    let conflictCheckData = '';
    const lastUserMessage = messages.filter((m: any) => m.role === 'user').pop()?.content || '';

    // Проверяем, хочет ли пользователь забронировать отпуск или водителя
    const wantsLeaveBooking =
      /хочу отпуск|book leave|request vacation|отпуск с \d|vacation from \d|sick leave|больничный/i.test(
        lastUserMessage,
      );
    const wantsDriverBooking = /заказать водителя|book driver|driver from \d|водитель/i.test(
      lastUserMessage,
    );

    if ((wantsLeaveBooking || wantsDriverBooking) && userId && userOrgId) {
      try {
        // Извлекаем даты из сообщения
        const dateMatch = lastUserMessage.match(
          /с (\d{1,2})[\/\.-](\d{1,2})|from (\d{1,2})[\/\.-](\d{1,2})|(\d{1,2})[\/\.-](\d{1,2}) (марта|марта|апреля|апреля|мая|мая|июня|июня)/i,
        );

        if (dateMatch) {
          const day1 = parseInt(dateMatch[1] || dateMatch[3] || dateMatch[5]);
          const monthStr = dateMatch[2] || dateMatch[4] || dateMatch[6];
          const monthMap: Record<string, number> = {
            '1': 0,
            '2': 1,
            '3': 2,
            '4': 3,
            '5': 4,
            '6': 5,
            марта: 2,
            апреля: 3,
            мая: 4,
            июня: 5,
          };
          const month = monthMap[monthStr.toLowerCase()] || parseInt(monthStr) - 1;
          const year = new Date().getFullYear();

          const startDate = new Date(year, month, day1).getTime();
          const endDate = new Date(year, month, day1 + 7).getTime(); // +7 дней по умолчанию

          const requestType = wantsLeaveBooking ? 'leave' : 'driver';

          console.log('🔍 [Conflict Check] Checking conflicts:', {
            userId,
            userOrgId,
            requestType,
            startDate,
            endDate,
          });

          const conflictRes = await fetch(
            `${req.headers.get('origin')}/api/chat/conflict-check?userId=${userId}&organizationId=${userOrgId}&requestType=${requestType}&startDate=${startDate}&endDate=${endDate}`,
            {
              headers: { cookie: req.headers.get('cookie') || '' },
            },
          );

          if (conflictRes.ok) {
            const conflictData = await conflictRes.json();

            if (conflictData.hasConflicts) {
              conflictCheckData = `

CONFLICT CHECK RESULTS:
- Has Conflicts: ${conflictData.hasConflicts}
- Critical Conflicts: ${conflictData.hasCriticalConflicts}
- Conflict Count: ${conflictData.conflictCount}
- AI Message: ${conflictData.aiMessage}
- Conflicts: ${JSON.stringify(conflictData.conflicts, null, 2)}
- Can Proceed: ${conflictData.canProceed}

IMPORTANT: If hasCriticalConflicts is true, inform the user about the conflict and suggest alternatives. DO NOT create <ACTION> tag until user confirms alternative dates.
`;
              console.log('⚠️ [Conflict Check] Conflicts found:', conflictData.conflictCount);
            } else {
              conflictCheckData = `

CONFLICT CHECK RESULTS:
- Has Conflicts: false
- Status: ✅ No conflicts detected
- Can Proceed: true

You can safely create the <ACTION> tag for this booking.
`;
              console.log('✅ [Conflict Check] No conflicts');
            }
          }
        }
      } catch (e) {
        console.error('[Conflict Check] Error:', e);
        // Ignore errors, continue without conflict check
      }
    }

    // Fetch AI insights (patterns, best dates, balance warnings)
    let aiInsights = '';
    try {
      const insightsRes = await fetch(
        `${req.headers.get('origin')}/api/chat/insights${userId ? `?userId=${userId}` : ''}`,
        {
          headers: { cookie: req.headers.get('cookie') || '' },
        },
      );
      if (insightsRes.ok) {
        const insights = await insightsRes.json();
        if (insights) {
          aiInsights = `

AI INSIGHTS FOR THIS EMPLOYEE:
${insights.balanceWarning ? `⚠️ BALANCE WARNING: ${insights.balanceWarning}` : ''}
${insights.patterns?.length ? `📊 ATTENDANCE PATTERNS:\n${insights.patterns.map((p: string) => `- ${p}`).join('\n')}` : ''}
${insights.bestDates?.length ? `📅 RECOMMENDED VACATION DATES (no team conflicts):\n${insights.bestDates.map((d: string) => `- ${d}`).join('\n')}` : ''}
${insights.teamConflicts?.length ? `⚠️ TEAM CONFLICTS (people already on leave):\n${insights.teamConflicts.map((c: string) => `- ${c}`).join('\n')}` : ''}
`;
        }
      }
    } catch (e) {
      // silently ignore
    }

    // Fetch FULL SYSTEM CONTEXT — all employees, leaves, calendar, attendance
    let fullContext = '';
    let availableDriversInfo = '';
    try {
      const fullRes = await fetch(
        `${req.headers.get('origin')}/api/chat/full-context?requesterId=${userId}`,
        {
          headers: { cookie: req.headers.get('cookie') || '' },
        },
      );
      if (fullRes.ok) {
        const data = await fullRes.json();

        // Fetch available drivers
        try {
          const driversRes = await fetch(
            `${req.headers.get('origin')}/api/drivers/available?organizationId=${userOrgId}`,
            {
              headers: { cookie: req.headers.get('cookie') || '' },
            },
          );
          if (driversRes.ok) {
            const drivers = await driversRes.json();
            console.log('[chat] Drivers API response:', {
              count: drivers?.length,
              orgId: userOrgId,
            });
            if (drivers && drivers.length > 0) {
              availableDriversInfo = `\n\nAVAILABLE DRIVERS (use these driverId values for booking):\n${drivers.map((d: any) => `  - driverId: "${d._id}" | Name: ${d.userName} | Vehicle: ${d.vehicleInfo.model} (${d.vehicleInfo.plateNumber}) | Capacity: ${d.vehicleInfo.capacity} seats | Status: ${d.isAvailable ? 'Available' : 'Busy'}`).join('\n')}`;
            } else {
              availableDriversInfo =
                '\n\nAVAILABLE DRIVERS: No drivers available in your organization.';
            }
          } else {
            console.error('[chat] Failed to fetch drivers, status:', driversRes.status);
            availableDriversInfo = '\n\nAVAILABLE DRIVERS: Could not fetch driver list.';
          }
        } catch (e) {
          console.error('[chat] Failed to fetch drivers:', e);
          availableDriversInfo = '\n\nAVAILABLE DRIVERS: Could not fetch driver list.';
        }

        // Build employees info
        const employeesInfo = (data.employees ?? [])
          .map((e: any) => {
            const presenceEmoji: Record<string, string> = {
              available: '🟢',
              in_meeting: '📅',
              in_call: '📞',
              out_of_office: '🏠',
              busy: '⛔',
            };
            const lines = [
              `👤 ${e.name} (${e.role}, ${e.department ?? 'No dept'}, ${e.position ?? 'No position'})`,
            ];
            lines.push(
              `  Status: ${presenceEmoji[e.presenceStatus] ?? '🟢'} ${e.presenceStatus ?? 'available'}`,
            );
            if (e.supervisorName) lines.push(`  Supervisor: ${e.supervisorName}`);
            if (e.todayStatus) {
              lines.push(
                `  Today: ${e.todayStatus.status} | In: ${e.todayStatus.checkIn ?? '—'} | Out: ${e.todayStatus.checkOut ?? '—'}${e.todayStatus.isLate ? ` | LATE by ${e.todayStatus.lateMinutes}min` : ''} | Worked: ${e.todayStatus.workedHours ?? '—'}h`,
              );
            } else {
              lines.push(`  Today: not checked in`);
            }
            if (e.currentLeave) {
              lines.push(
                `  🏖 ON LEAVE NOW: ${e.currentLeave.type} (${e.currentLeave.startDate} → ${e.currentLeave.endDate}) [leaveId: ${e.currentLeave.leaveId}]`,
              );
            }
            if (e.upcomingLeaves?.length) {
              e.upcomingLeaves.forEach((l: any) => {
                lines.push(
                  `  📅 Upcoming: ${l.type} ${l.startDate} → ${l.endDate} [leaveId: ${l.leaveId}]`,
                );
              });
            }
            if (e.pendingLeaves?.length) {
              e.pendingLeaves.forEach((l: any) => {
                lines.push(
                  `  ⏳ Pending: ${l.type} ${l.startDate} → ${l.endDate} (${l.days}d) [leaveId: ${l.leaveId}]`,
                );
              });
            }
            if (e.allLeaves?.length) {
              lines.push(`  All leaves:`);
              e.allLeaves.forEach((l: any) => {
                lines.push(
                  `    - ${l.type} ${l.startDate}→${l.endDate} status:${l.status} [leaveId: ${l.leaveId}]`,
                );
              });
            }
            lines.push(
              `  Leave balance: Paid: ${e.leaveBalance?.paid ?? '?'}d, Sick: ${e.leaveBalance?.sick ?? '?'}d, Family: ${e.leaveBalance?.family ?? '?'}d`,
            );
            if (e.tasks?.length) {
              lines.push(`  Tasks (${e.tasks.length}):`);
              e.tasks.forEach((t: any) => {
                const deadline = t.deadline ? ` | deadline: ${t.deadline}` : '';
                lines.push(
                  `    - [${t.status}] ${t.title} (${t.priority} priority${deadline}) assigned by ${t.assignedBy} [taskId: ${t.taskId}]`,
                );
              });
            }
            return lines.join('\n');
          })
          .join('\n\n');

        // Calendar events next 90 days
        const calendarInfo = (data.calendarEvents ?? [])
          .map(
            (ev: any) =>
              `  📅 ${ev.employee} (${ev.department}): ${ev.type} ${ev.startDate} → ${ev.endDate} (${ev.days} days)`,
          )
          .join('\n');

        // Today's attendance
        const attendanceInfo = (data.todayAttendance ?? [])
          .map(
            (t: any) =>
              `  ${t.status === 'checked_in' ? '🟢' : t.status === 'checked_out' ? '🔵' : '🔴'} ${t.name} (${t.department}): ${t.checkIn ?? '—'} → ${t.checkOut ?? 'still working'}${t.isLate ? ` [LATE ${t.lateMinutes}min]` : ''}`,
          )
          .join('\n');

        // Tickets info
        const ticketsInfo = (data.tickets ?? [])
          .map(
            (t: any) =>
              `  🎫 ${t.ticketNumber}: ${t.title} [${t.status}] Priority: ${t.priority} | Category: ${t.category} | Created by: ${t.createdBy}${t.assignedTo ? ` | Assigned to: ${t.assignedTo}` : ''}${t.isOverdue ? ' ⚠️ OVERDUE' : ''}`,
          )
          .join('\n');

        const ticketStatsInfo = data.ticketStats
          ? `  Total: ${data.ticketStats.total} | Open: ${data.ticketStats.open} | In Progress: ${data.ticketStats.inProgress} | Resolved: ${data.ticketStats.resolved} | Closed: ${data.ticketStats.closed} | Critical: ${data.ticketStats.critical}`
          : 'No ticket stats available';

        // Company events info
        const companyEventsInfo = (data.companyEvents ?? [])
          .map(
            (e: any) =>
              `  📅 ${e.name}: ${e.startDate} → ${e.endDate} [${e.eventType}] Priority: ${e.priority || 'N/A'} | Created by: ${e.createdBy} | Required depts: ${e.requiredDepartments?.join(', ') || 'All'}`,
          )
          .join('\n');

        // Automation workflows info
        const automationInfo = (data.automationWorkflows ?? [])
          .map(
            (w: any) =>
              `  ⚙️ ${w.name}: ${w.description || 'No description'} [${w.isActive ? 'Active' : 'Inactive'}]`,
          )
          .join('\n');

        // Driver requests info
        const driverRequestsInfo = (data.driverRequests ?? [])
          .map(
            (r: any) =>
              `  🚗 Request: ${r.pickupLocation} → ${r.dropoffLocation} [${r.status}] Scheduled: ${r.scheduledFor || 'TBD'} | Requested by: ${r.requestedBy}`,
          )
          .join('\n');

        // Available drivers info (from full-context, not the separate API call)
        const availableDriversContextInfo = (data.availableDrivers ?? [])
          .map(
            (d: any) => `  🚘 ${d.name}: ${d.vehicle || 'No vehicle'} [${d.status || 'Available'}]`,
          )
          .join('\n');

        fullContext = `

=== COMPLETE SYSTEM DATA ===

TOTAL EMPLOYEES: ${data.totalEmployees ?? 0}
CURRENTLY AT WORK TODAY: ${data.currentlyAtWork ?? 0}
ON LEAVE TODAY: ${data.onLeaveToday ?? 0}

ALL EMPLOYEES (with today's status, leaves, balances):
${employeesInfo || 'No employees found'}

TODAY'S ATTENDANCE:
${attendanceInfo || 'No attendance records today'}

CALENDAR — APPROVED LEAVES (next 90 days):
${calendarInfo || 'No upcoming approved leaves'}

SUPPORT TICKETS:
Stats: ${ticketStatsInfo}
${ticketsInfo || 'No tickets found'}

COMPANY EVENTS:
${companyEventsInfo || 'No upcoming events'}

AUTOMATION WORKFLOWS:
${automationInfo || 'No automation workflows'}

DRIVER REQUESTS:
${driverRequestsInfo || 'No pending driver requests'}

AVAILABLE DRIVERS:
${availableDriversContextInfo || 'No drivers available'}
${availableDriversInfo || ''}

ACTIVE SURVEYS:
${((data.activeSurveys as any[]) || []).map((s: any) => `📝 "${s.title}" - ${s.description || 'No description'} (Questions: ${s.questionsCount || 0}, Responses: ${s.responsesCount || 0})`).join('\n') || 'No active surveys'}
`;
      }
    } catch (e) {
      console.error('Failed to fetch full context:', e);
    }

    // Build role-based system prompt
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

    // Detect intent from last user message - ONLY for explicit navigation requests
    // lastUserMessage уже объявлена выше для Conflict Check
    const detectedIntent = detectIntent(lastUserMessage, userRole);

    let navigationHint = '';
    // ONLY navigate if user explicitly asks to OPEN/SHOW/GO TO a page
    // Keywords for explicit navigation: "открой", "покажи страницу", "перейди", "open", "show page", "go to"
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
      navigationHint = `\n\nDETECTED EXPLICIT NAVIGATION REQUEST: User wants to OPEN/SHOW page "${detectedIntent.name}".
Route: ${detectedIntent.action}
Include this in your response: <NAVIGATE>${detectedIntent.action}</NAVIGATE>
Example: "Открываю календарь... 📅 <NAVIGATE>/calendar</NAVIGATE>"`;
    } else if (detectedIntent?.action && !hasExplicitNavigation) {
      // User wants to DO something, not navigate - just inform them
      navigationHint = `\n\nDETECTED ACTION REQUEST: User wants to "${detectedIntent.name}" but did NOT ask to navigate.
DO NOT navigate! Just help them with their request using <ACTION> tags if needed, or provide information.`;
    }

    // Try Groq first (no retry - fallback to Gemini on rate limit), fallback to Google Gemini if rate limited
    let result;
    const corePrompt = `${roleBasedSystemPrompt}

🎨 FORMATTING RULES - Make responses BEAUTIFUL and SATISFYING:

📊 LISTS/TABLES - When showing multiple items, use markdown tables:
| Name | Department | Status | Details |
|------|------------|--------|---------|
| John | Engineering | ✅ Active | Remote worker |

📋 SUMMARIES - Use bullet points with emojis:
📌 **Summary:**
- ✅ 5 approved leaves
- ⏳ 2 pending requests
- ⚠️ 1 near limit

💰 NUMBERS - Format nicely:
- Leave balance: 15 days (not 15.0)
- Attendance: "8h 30m" not "510 minutes"

🎯 STATUS - Use clear indicators:
- ✅ Approved
- ⏳ Pending  
- ❌ Rejected
- 🔄 In Progress

🌐 EMOJIS - Use appropriately:
- 👤 Employee
- 📅 Leave/Dates
- ⏰ Time
- 📊 Stats
- 🎯 Tasks
- 🎫 Tickets
- 📝 Surveys
- 🚗 Drivers

📖 RESPONSES - Be concise but complete:
- Greet friendly: "Привет! 👋"
- Provide useful info
- End with offer to help: "Нужна помощь с чем-то ещё?"

RULES:
- Answer in the same language as the user
- Use EXACT data from above (names, dates, balances, numbers)
- Format everything beautifully with tables and emojis
- Make employee feel satisfied with response

NAVIGATION - Only use <NAVIGATE>/path</NAVIGATE> when user explicitly asks to OPEN/SHOW page:
- "покажи опросы" → show info in chat (NOT navigate)
- "открой страницу опросов" → <NAVIGATE>/surveys</NAVIGATE>
- "покажи сотрудников" → show in chat
- "открой страницу сотрудников" → <NAVIGATE>/employees</NAVIGATE>
- "открой календарь" → <NAVIGATE>/calendar</NAVIGATE>
- "открой отпуска" → <NAVIGATE>/leaves</NAVIGATE>
- "открой задачи" → <NAVIGATE>/tasks</NAVIGATE>
- "открой тикеты" → <NAVIGATE>/tickets</NAVIGATE>
- "открой аналитику" → <NAVIGATE>/analytics</NAVIGATE>
- "открой отчеты" → <NAVIGATE>/reports</NAVIGATE>
- "открой настройки" → <NAVIGATE>/settings</NAVIGATE>

LEAVE BOOKING - Use <ACTION> tag:
- "хочу отпуск", "забронировать отпуск" → ask for dates first
- Then use: <ACTION>{"type":"BOOK_LEAVE","leaveType":"paid","startDate":"YYYY-MM-DD","endDate":"YYYY-MM-DD","days":n,"reason":"..."}</ACTION>

If dates not specified, ask user first.`;

    try {
      console.log('🔄 Trying OpenRouter AI...');
      const stream = await openrouter.chat.completions.create({
        model: 'tencent/hy3-preview:free',
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

      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
        },
      });
    } catch (openrouterError: any) {
      console.log('⚠️ OpenRouter failed, trying Groq...', openrouterError.message);

      const fallbackPrompt = `You are an HR assistant. Access to: employees, leaves, attendance, tasks, tickets, surveys, drivers, calendar, events.
ROLE: ${userRole}
DATA: ${userContext.slice(0, 500)} ${fullContext.slice(0, 800)}
${langInstruction}

🎨 FORMATTING - Make responses BEAUTIFUL:
- Use markdown tables for lists
- Use emojis: 👤 📅 ⏰ 📊 🎯 🎫 📝 🚗 ✅ ⏳ ❌
- Format numbers nicely
- Make employee feel satisfied

Rules:
- Answer in user's language
- Use exact data from above
- Format beautifully with tables and emojis
- <NAVIGATE>/path for "открой страницу..."
- ACTION for leave booking: <ACTION>{"type":"BOOK_LEAVE","leaveType":"paid","startDate":"YYYY-MM-DD","endDate":"YYYY-MM-DD","days":n,"reason":"..."}</ACTION>
- If no dates, ask first`;

      // Fallback to Groq
      try {
        result = await streamText({
          model: groq('llama-3.1-8b-instant'),
          maxRetries: 0,
          system: fallbackPrompt,
          messages,
        });
      } catch {
        throw openrouterError;
      }
    }

    console.log('✅ AI response received');
    // Groq fallback returns stream response
    if (result) {
      return result.toTextStreamResponse();
    }
  } catch (error) {
    console.error('❌ Chat API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
});
