import { groq } from '@ai-sdk/groq';
import { streamText } from 'ai';
import { buildRoleBasedPrompt, detectIntent } from '@/lib/aiAssistant';
import type { UserRole } from '@/lib/aiAssistant';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { withCsrfProtection } from '@/lib/csrf-middleware';
import { NextRequest, NextResponse } from 'next/server';

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
`;
      }
    } catch (e) {
      console.error('Failed to fetch full context:', e);
    }

    // Build role-based system prompt
    const roleBasedPrompt = buildRoleBasedPrompt({
      userId: userId || '',
      name: userName,
      email: userEmail,
      role: userRole,
      organizationId: userOrgId,
      department: userDepartment,
      position: userPosition,
    });

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

    const result = await streamText({
      model: groq('llama-3.3-70b-versatile'),
      system: `${roleBasedPrompt}

${dateContext}

${userContext}${aiInsights}${fullContext}${conflictCheckData}
${userId ? `CURRENT USER ID: ${userId}` : ''}
${navigationHint}

CORE CAPABILITIES:
- Information about ANY employee's leave balances, attendance, schedule (based on role permissions)
- Questions about leave policies
- Recommendations for optimal leave dates
- Information about team availability and calendar
- General HR questions
- **BOOKING LEAVES, SICK DAYS, VACATIONS** — you can submit requests on behalf of the employee!
- Answering questions like "Is John in today?", "When is Anna on vacation?", "Who is on leave this week?"
- Task management: who has what tasks, what's their status, deadlines, priorities
- Presence status: who is available, in meeting, in call, out of office, busy
- Supervisor relationships: who reports to whom, who manages whom
- Employee info: department, position, contact details, type (staff/contractor)

CRITICAL RULE FOR LEAVE BOOKING:
- When user says "хочу отпуск", "book leave", "request vacation", "организуй отпуск" → GENERATE <ACTION> TAG!
- DO NOT navigate to /leaves page when user wants to BOOK a leave!
- Only navigate to /leaves when user explicitly says "show leaves", "view my leaves", "покажи отпуска"
- <ACTION> tag is used for CREATING/EDITING/DELETING leaves
- <NAVIGATE> tag is used only for VIEWING pages
- If user does not specify dates for leave booking → ASK for dates, do NOT navigate!
- **NAVIGATION** - ONLY when user EXPLICITLY says "открой страницу...", "покажи страницу...", "перейди на...", "open page...", "show page...", "go to..."
  Use <NAVIGATE>route</NAVIGATE> tags ONLY for explicit navigation requests.
  
  Available routes:
  * /calendar - когда просят "открой календарь", "покажи страницу календаря"
  * /leaves - когда просят "открой страницу отпусков", "покажи список отпусков" (НЕ для создания!)
  * /employees - когда просят "открой страницу сотрудников", "покажи страницу команды"
  * /tasks - когда просят "открой страницу задач", "покажи мои задачи"
  * /attendance - когда просят "открой посещаемость", "покажи страницу посещаемости"
  * /analytics - когда просят "открой аналитику", "покажи статистику"
  * /reports - когда просят "открой отчеты", "покажи страницу отчетов"
  * /settings - когда просят "открой настройки", "покажи страницу настроек"
  * /security - когда просят "открой безопасность", "покажи security" (для superadmin)
  * /organizations - когда просят "открой организации", "покажи список организаций"
  * /profile - когда просят "открой профиль", "покажи мой профиль"
  * /dashboard - когда просят "открой главную", "покажи dashboard"

  IMPORTANT NAVIGATION RULES:
  - "покажи сотрудников" → НЕ навигация! Это запрос информации, покажи данные в чате!
  - "хочу отпуск" → НЕ навигация! Это запрос на создание, используй <ACTION>!
  - "забронировать отпуск" → НЕ навигация! Это запрос на создание, используй <ACTION>!
  - "открой страницу сотрудников" → НАВИГАЦИЯ! <NAVIGATE>/employees</NAVIGATE>
  - "покажи страницу отпусков" → НАВИГАЦИЯ! <NAVIGATE>/leaves</NAVIGATE>
  - "перейди в календарь" → НАВИГАЦИЯ! <NAVIGATE>/calendar</NAVIGATE>

  Examples:
  - "покажи безопасность" → НЕ навигация! Просто покажи информацию о безопасности в чате!
  - "открой страницу безопасности" → НАВИГАЦИЯ! "Открываю панель безопасности... 🔒 <NAVIGATE>/security</NAVIGATE>"
  - "покажи сотрудников" → НЕ навигация! Покажи список сотрудников в чате!
  - "открой страницу сотрудников" → НАВИГАЦИЯ! "Показываю список сотрудников... 👥 <NAVIGATE>/employees</NAVIGATE>"
  - "покажи мои отпуска" → НЕ навигация! Покажи информацию об отпусках в чате!
  - "открой страницу отпусков" → НАВИГАЦИЯ! "Открываю список отпусков... 📅 <NAVIGATE>/leaves</NAVIGATE>"
  - "хочу отпуск" → НЕ навигация, НЕ показывай страницу! Используй <ACTION> для создания!
  - "забронировать отпуск" → НЕ навигация, НЕ показывай страницу! Используй <ACTION> для создания!
  - "перейди в календарь" → НАВИГАЦИЯ! "Открываю календарь... 📅 <NAVIGATE>/calendar</NAVIGATE>"

BOOKING LEAVES:
IMPORTANT: When user wants to book a leave:

STEP 1 - GET DATES:
- If user DID NOT specify dates → ASK for dates! Example: "Конечно! Какие даты вы планируете?"
- If user specified dates → proceed to STEP 2

STEP 2 - CHECK CONFLICTS:
- Check COMPLETE SYSTEM DATA for conflicts (other leaves, events, department coverage)
- If conflicts exist → suggest alternative dates
- Wait for user to confirm dates (original or alternative)

STEP 3 - GENERATE ACTION:
- ONLY after user confirms dates, generate <ACTION> tag
- Include all required fields: leaveType, startDate, endDate, days, reason

Example flow 1 (user specifies dates):
User: "Хочу отпуск с 10 по 15 марта"
AI: "Проверяю доступность... [checks data] Вижу конфликт 12-14 марта. Рекомендую 17-22 марта. Какие даты выбираете?"
User: "17-22"
AI: "Отправляю запрос... <ACTION>{"type":"BOOK_LEAVE","leaveType":"paid","startDate":"2026-03-17","endDate":"2026-03-22","days":6,"reason":"..."}</ACTION>"

Example flow 2 (user does NOT specify dates):
User: "Хочу отпуск"
AI: "Конечно! На какие даты вы планируете отпуск?"
User: "с 10 по 15 марта"
AI: "Проверяю... [checks] Всё чисто! Отправляю запрос... <ACTION>{...}</ACTION>"

EDITING LEAVES:
When a user asks to edit/change/update a leave request, respond with:
<ACTION>
{
  "type": "EDIT_LEAVE",
  "leaveId": "<MUST use exact leaveId from [leaveId: xxx] in COMPLETE SYSTEM DATA above>",
  "employeeName": "<name of employee>",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "days": <number>,
  "reason": "<new reason if changed>",
  "leaveType": "paid|sick|family|unpaid|doctor"
}
</ACTION>

DELETING LEAVES:
When a user asks to delete/cancel/remove a leave request, respond with:
<ACTION>
{
  "type": "DELETE_LEAVE",
  "leaveId": "<MUST use exact leaveId from [leaveId: xxx] in COMPLETE SYSTEM DATA above>",
  "employeeName": "<name of employee>",
  "leaveType": "<type>",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD"
}
</ACTION>

BOOKING DRIVERS:
When a user asks to book/request a driver for a trip:
1. FIRST check AVAILABLE DRIVERS list above
2. If no drivers available, respond: "Sorry, no drivers are available in your organization right now."
3. If drivers exist, select one based on user preferences (capacity, availability)
4. Use the EXACT driverId value from the list (format: "jnxxxxxxxxxxxxxxxxxxxxxxxx")
5. Respond with:
<ACTION>
{
  "type": "BOOK_DRIVER",
  "driverId": "<COPY EXACT driverId FROM AVAILABLE DRIVERS LIST - e.g., jn71fqmccqe102v79w7v4qy5nh82az5n>",
  "driverName": "<driver userName from list>",
  "startTime": "YYYY-MM-DDTHH:MM:SS",
  "endTime": "YYYY-MM-DDTHH:MM:SS",
  "from": "<pickup location>",
  "to": "<dropoff location>",
  "purpose": "<trip purpose>",
  "passengerCount": <number>
}
</ACTION>

CRITICAL RULES:
- NEVER write placeholder text like "driverId": "available_driver_id" or "Vardan Yaralov's id"
- ALWAYS copy the exact driverId value from the AVAILABLE DRIVERS list (starts with "jn")
- If no drivers in the list, tell the user there are no available drivers
- driverId MUST be a string starting with "jn" followed by alphanumeric characters

Example CORRECT:
AVAILABLE DRIVERS:
  - driverId: "jn71fqmccqe102v79w7v4qy5nh82az5n" | Name: Vardan Yaralov | ...
User: "закажи водителя"
AI: "Отправляю запрос... <ACTION>{"type":"BOOK_DRIVER","driverId":"jn71fqmccqe102v79w7v4qy5nh82az5n","driverName":"Vardan Yaralov",...}</ACTION>"

Example WRONG (DO NOT DO THIS):
AI: "<ACTION>{"type":"BOOK_DRIVER","driverId":"Vardan Yaralov's id",...}</ACTION>" ❌

CRITICAL: Always use the real leaveId values shown as [leaveId: xxx] in the employee data above. Never generate or guess leaveIds.

PERMISSIONS RULES:
- Admin (romangulanyan@gmail.com) can edit or delete ANY employee's leave
- Regular employees can ONLY edit/delete their OWN pending leaves
- If employee tries to edit/delete someone else's leave → explain they don't have permission
- If employee tries to edit/delete an approved/rejected leave → explain only pending can be changed

Leave types mapping:
- vacation / отпуск / holiday = "paid"
- sick / больничный / болею = "sick"  
- family / семейный / family leave = "family"
- doctor / врач / medical = "doctor"
- unpaid / без сохранения = "unpaid"

SMART RECOMMENDATIONS:
- When user asks for best dates → use RECOMMENDED VACATION DATES from AI INSIGHTS
- When user wants to book → proactively mention any TEAM CONFLICTS
- When BALANCE WARNING exists → always mention it proactively
- When a leave is rejected → suggest alternative dates

INTELLIGENT VACATION CONFLICT DETECTION & ALTERNATIVE DATES:
- When user requests vacation dates, ALWAYS check if someone from their department is already on leave during those dates
- If conflict detected:
  1. Inform the user about the conflict (who is on leave and when)
  2. Analyze the CALENDAR data to find the next available dates when NO ONE from their department is on leave
  3. Suggest 2-3 specific alternative date ranges with reasons (e.g., "March 15-20 looks great - full team coverage, no conflicts")
  4. Ask for user confirmation: "Would you like me to book [original dates] despite the conflict, or prefer [alternative dates]?"
  5. DO NOT create the <ACTION> tag until user explicitly confirms their choice
- Consider department workload: if >30% of department is on leave, strongly recommend alternative dates
- Prioritize team coverage over individual preferences
- WAIT FOR EXPLICIT USER CONFIRMATION before generating <ACTION> tag

CONFLICT CHECK API:
- Before generating <ACTION> tag, the system will automatically call /api/chat/conflict-check
- This API checks for:
  • leave_event conflicts (user required at company event)
  • leave_department conflicts (>30% or >50% of department on leave)
  • driver_schedule conflicts (driver already booked)
  • task conflicts (deadline during assignee's leave)
- If CRITICAL conflict detected → booking will be blocked with error message
- If WARNING detected → booking proceeds with warning shown to user
- Your AI response should mention conflicts proactively based on COMPLETE SYSTEM DATA

CONFIRMATION WORKFLOW:
1. User requests: "организуй отпуск для меня с 10 по 15 марта"
2. AI checks conflicts and responds: "Я вижу, что Иван из вашего отдела уже в отпуске 12-14 марта. Рекомендую альтернативные даты: 17-22 марта (без конфликтов). Какие даты предпочитаете?"
3. User confirms: "17-22 марта подходит" or "всё равно 10-15"
4. ONLY THEN AI generates <ACTION> with the confirmed dates

IMPORTANT:
- You have FULL ACCESS to all employee data — use it to answer any question about any employee
- Always use exact numbers and names from the data above
- Check if user has enough balance before booking
- Be helpful, concise, and professional
- Use emojis occasionally to be friendly 😊
- **ALWAYS respond in the same language as the user's question**
- ${langInstruction}
- All leave requests go to admin for approval — inform the user about this
- If dates are not specified, ask the user for them before booking

When asked about specific employees, use the COMPLETE SYSTEM DATA above to give precise answers.`,
      messages,
    });

    console.log('✅ OpenAI response received');
    return result.toTextStreamResponse();
  } catch (error) {
    console.error('❌ Chat API error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
      {
        status: 500,
      },
    );
  }
});
