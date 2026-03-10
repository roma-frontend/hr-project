import { groq } from '@ai-sdk/groq';
import { streamText } from 'ai';
import { buildRoleBasedPrompt, detectIntent } from '@/lib/aiAssistant';
import type { UserRole } from '@/lib/aiAssistant';

// Remove edge runtime to see better errors
// export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    console.log('🤖 AI Chat request received');
    const { messages, userId, lang } = await req.json();
    const langInstruction = lang === 'ru'
      ? 'ЯЗЫК: Пользователь пишет на русском. Отвечай ТОЛЬКО на русском языке.'
      : lang === 'hy'
      ? 'ԼԵdelays: Delaysdelays delays. Delaysdelays delaysdelaysdelaysdelays delaysdelays.'
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
    
    // Fetch AI insights (patterns, best dates, balance warnings)
    let aiInsights = '';
    try {
      const insightsRes = await fetch(`${req.headers.get('origin')}/api/chat/insights${userId ? `?userId=${userId}` : ''}`, {
        headers: { cookie: req.headers.get('cookie') || '' },
      });
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
      const fullRes = await fetch(`${req.headers.get('origin')}/api/chat/full-context?requesterId=${userId}`, {
        headers: { cookie: req.headers.get('cookie') || '' },
      });
      if (fullRes.ok) {
        const data = await fullRes.json();

        // Fetch available drivers
        try {
          const driversRes = await fetch(`${req.headers.get('origin')}/api/drivers/available?organizationId=${userOrgId}`, {
            headers: { cookie: req.headers.get('cookie') || '' },
          });
          if (driversRes.ok) {
            const drivers = await driversRes.json();
            console.log('[chat] Drivers API response:', { count: drivers?.length, orgId: userOrgId });
            if (drivers && drivers.length > 0) {
              availableDriversInfo = `\n\nAVAILABLE DRIVERS (use these driverId values for booking):\n${drivers.map((d: any) => `  - driverId: "${d._id}" | Name: ${d.userName} | Vehicle: ${d.vehicleInfo.model} (${d.vehicleInfo.plateNumber}) | Capacity: ${d.vehicleInfo.capacity} seats | Status: ${d.isAvailable ? 'Available' : 'Busy'}`).join('\n')}`;
            } else {
              availableDriversInfo = '\n\nAVAILABLE DRIVERS: No drivers available in your organization.';
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
        const employeesInfo = (data.employees ?? []).map((e: any) => {
          const presenceEmoji: Record<string, string> = {
            available: '🟢', in_meeting: '📅', in_call: '📞', out_of_office: '🏠', busy: '⛔'
          };
          const lines = [`👤 ${e.name} (${e.role}, ${e.department ?? 'No dept'}, ${e.position ?? 'No position'})`];
          lines.push(`  Status: ${presenceEmoji[e.presenceStatus] ?? '🟢'} ${e.presenceStatus ?? 'available'}`);
          if (e.supervisorName) lines.push(`  Supervisor: ${e.supervisorName}`);
          if (e.todayStatus) {
            lines.push(`  Today: ${e.todayStatus.status} | In: ${e.todayStatus.checkIn ?? '—'} | Out: ${e.todayStatus.checkOut ?? '—'}${e.todayStatus.isLate ? ` | LATE by ${e.todayStatus.lateMinutes}min` : ''} | Worked: ${e.todayStatus.workedHours ?? '—'}h`);
          } else {
            lines.push(`  Today: not checked in`);
          }
          if (e.currentLeave) {
            lines.push(`  🏖 ON LEAVE NOW: ${e.currentLeave.type} (${e.currentLeave.startDate} → ${e.currentLeave.endDate}) [leaveId: ${e.currentLeave.leaveId}]`);
          }
          if (e.upcomingLeaves?.length) {
            e.upcomingLeaves.forEach((l: any) => {
              lines.push(`  📅 Upcoming: ${l.type} ${l.startDate} → ${l.endDate} [leaveId: ${l.leaveId}]`);
            });
          }
          if (e.pendingLeaves?.length) {
            e.pendingLeaves.forEach((l: any) => {
              lines.push(`  ⏳ Pending: ${l.type} ${l.startDate} → ${l.endDate} (${l.days}d) [leaveId: ${l.leaveId}]`);
            });
          }
          if (e.allLeaves?.length) {
            lines.push(`  All leaves:`);
            e.allLeaves.forEach((l: any) => {
              lines.push(`    - ${l.type} ${l.startDate}→${l.endDate} status:${l.status} [leaveId: ${l.leaveId}]`);
            });
          }
          lines.push(`  Leave balance: Paid: ${e.leaveBalance?.paid ?? '?'}d, Sick: ${e.leaveBalance?.sick ?? '?'}d, Family: ${e.leaveBalance?.family ?? '?'}d`);
          if (e.tasks?.length) {
            lines.push(`  Tasks (${e.tasks.length}):`);
            e.tasks.forEach((t: any) => {
              const deadline = t.deadline ? ` | deadline: ${t.deadline}` : '';
              lines.push(`    - [${t.status}] ${t.title} (${t.priority} priority${deadline}) assigned by ${t.assignedBy} [taskId: ${t.taskId}]`);
            });
          }
          return lines.join('\n');
        }).join('\n\n');

        // Calendar events next 90 days
        const calendarInfo = (data.calendarEvents ?? []).map((ev: any) =>
          `  📅 ${ev.employee} (${ev.department}): ${ev.type} ${ev.startDate} → ${ev.endDate} (${ev.days} days)`
        ).join('\n');

        // Today's attendance
        const attendanceInfo = (data.todayAttendance ?? []).map((t: any) =>
          `  ${t.status === 'checked_in' ? '🟢' : t.status === 'checked_out' ? '🔵' : '🔴'} ${t.name} (${t.department}): ${t.checkIn ?? '—'} → ${t.checkOut ?? 'still working'}${t.isLate ? ` [LATE ${t.lateMinutes}min]` : ''}`
        ).join('\n');

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

    // Detect intent from last user message (for navigation actions)
    const lastUserMessage = messages.filter((m: any) => m.role === 'user').pop()?.content || '';
    const detectedIntent = detectIntent(lastUserMessage, userRole);
    
    let navigationHint = '';
    if (detectedIntent?.action) {
      navigationHint = `\n\nDETECTED INTENT: User wants to navigate to "${detectedIntent.name}". 
Route: ${detectedIntent.action}
Include this in your response: <NAVIGATE>${detectedIntent.action}</NAVIGATE>
Example: "Открываю календарь... 📅 <NAVIGATE>/calendar</NAVIGATE>"`;
    }

    const result = await streamText({
      model: groq('llama-3.3-70b-versatile'),
      system: `${roleBasedPrompt}

${dateContext}

${userContext}${aiInsights}${fullContext}
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
- **NAVIGATION** - When user asks to open/show a page, navigate them using <NAVIGATE>route</NAVIGATE> tags
  Available routes:
  * /calendar - календарь, calendar
  * /leaves - отпуска, leaves, мои отпуска
  * /employees - сотрудники, employees, команда, team
  * /tasks - задачи, tasks, мои задачи
  * /attendance - посещаемость, attendance
  * /analytics - аналитика, analytics, статистика
  * /reports - отчеты, reports
  * /settings - настройки, settings
  * /security - безопасность, security (for superadmin)
  * /organizations - организации, organizations (for superadmin)
  * /profile - профиль, profile, мой профиль
  * /dashboard - дашборд, dashboard, главная, home
  
  Examples:
  - "покажи безопасность" → "Открываю панель безопасности... 🔒 <NAVIGATE>/security</NAVIGATE>"
  - "открой страницу сотрудников" → "Показываю список сотрудников... 👥 <NAVIGATE>/employees</NAVIGATE>"

BOOKING LEAVES:
IMPORTANT: Before creating <ACTION> tag, you MUST:
1. Check for conflicts in user's department (analyze COMPLETE SYSTEM DATA)
2. If conflicts exist, suggest alternative dates and WAIT for user confirmation
3. Only generate <ACTION> tag AFTER user explicitly confirms the dates

When user CONFIRMS dates (either original or alternative), respond with:
<ACTION>
{
  "type": "BOOK_LEAVE",
  "leaveType": "paid|sick|family|unpaid|doctor",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "days": <number>,
  "reason": "<reason from user>"
}
</ACTION>

Example flow:
User: "организуй отпуск для Ивана с 10 по 15 марта"
AI: "Проверяю доступность... Я вижу, что Петр из отдела разработки уже в отпуске 12-14 марта. Рекомендую альтернативные даты: 17-22 марта (полное покрытие команды). Какие даты выбираете?"
User: "давай 17-22"
AI: "Отлично! Отправляю запрос... <ACTION>{...}</ACTION>"

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
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error 
      }), 
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
