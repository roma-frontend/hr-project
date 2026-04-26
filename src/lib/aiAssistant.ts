/**
 * AI Assistant Router - Intelligent request processing based on user roles
 *
 * Deep knowledge engine for the ShieldOffice HR platform.
 * Every feature, policy, and capability is documented here so the AI
 * can answer any question about the system with expert-level accuracy.
 */

export type UserRole = 'superadmin' | 'admin' | 'supervisor' | 'employee';

export interface UserContext {
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  organizationId?: string;
  department?: string;
  position?: string;
}

export interface AICapability {
  id: string;
  name: string;
  description: string;
  requiredRole: UserRole[];
  keywords: string[];
  action?: string;
}

/**
 * Define capabilities available to each role
 */
export const AI_CAPABILITIES: AICapability[] = [
  // ═══════════════════════════════════════════════════════════════
  // EMPLOYEE CAPABILITIES
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'view_calendar',
    name: 'View Calendar',
    description: 'Open and view the team calendar with all approved leaves',
    requiredRole: ['employee', 'supervisor', 'admin', 'superadmin'],
    keywords: [
      'calendar',
      'календарь',
      'покажи календарь',
      'show calendar',
      'открой календарь',
      'open calendar',
      'օրացույց',
      'ցույց տուր օրացույցը',
    ],
    action: '/calendar',
  },
  {
    id: 'view_my_leaves',
    name: 'View My Leaves',
    description: 'Check personal leave requests and balances',
    requiredRole: ['employee', 'supervisor', 'admin', 'superadmin'],
    keywords: [
      'my leaves',
      'мои отпуска',
      'мой отпуск',
      'my vacation',
      'leave balance',
      'остаток отпуска',
      'իմ արձակուրդները',
      'արձակուրդների մնացորդ',
    ],
    action: '/leaves',
  },
  {
    id: 'book_leave',
    name: 'Book Leave',
    description: 'Request a new leave/vacation through the AI assistant',
    requiredRole: ['employee', 'supervisor', 'admin', 'superadmin'],
    keywords: [
      'book leave',
      'забронировать отпуск',
      'хочу в отпуск',
      'request vacation',
      'book vacation',
      'взять отпуск',
      'request leave',
      'sick day',
      'болею',
      'больничный',
      'хочу отпуск',
      'отпуск',
      'vacation',
      'leave',
    ],
  },
  {
    id: 'view_tasks',
    name: 'View My Tasks',
    description: 'Check assigned tasks with priorities and deadlines',
    requiredRole: ['employee', 'supervisor', 'admin', 'superadmin'],
    keywords: [
      'tasks',
      'задачи',
      'мои задачи',
      'my tasks',
      'todo',
      'что делать',
      'առաջադրանքներ',
      'իմ խնդիրներ',
      'խնդիրներ',
    ],
    action: '/tasks',
  },
  {
    id: 'view_profile',
    name: 'View Profile',
    description: 'Open user profile settings',
    requiredRole: ['employee', 'supervisor', 'admin', 'superadmin'],
    keywords: ['profile', 'профиль', 'мой профиль', 'my profile'],
    action: '/profile',
  },
  {
    id: 'view_settings',
    name: 'View Settings',
    description: 'Open app settings (theme, language, notifications)',
    requiredRole: ['employee', 'supervisor', 'admin', 'superadmin'],
    keywords: ['settings', 'настройки', 'параметры', 'language', 'theme', 'тема'],
    action: '/settings',
  },
  {
    id: 'check_attendance',
    name: 'Check In/Out',
    description: 'View attendance records and check in/out status',
    requiredRole: ['employee', 'supervisor', 'admin', 'superadmin'],
    keywords: [
      'attendance',
      'посещаемость',
      'check in',
      'отметиться',
      'check out',
      'рабочее время',
    ],
    action: '/attendance',
  },
  {
    id: 'view_team',
    name: 'View Team',
    description: 'Check who is available, on leave, or busy',
    requiredRole: ['employee', 'supervisor', 'admin', 'superadmin'],
    keywords: [
      'team',
      'команда',
      'коллеги',
      'who is available',
      'кто на работе',
      'кто сегодня',
      'кто в отпуске',
      'who is on leave',
      'who is at work',
      'team status',
    ],
  },
  // ═══════════════════════════════════════════════════════════════
  // DRIVER MANAGEMENT
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'request_driver',
    name: 'Request Driver',
    description: 'Book a driver for a business trip or airport transfer',
    requiredRole: ['employee', 'supervisor', 'admin', 'superadmin'],
    keywords: [
      'driver',
      'водитель',
      'водител',
      'заказать водителя',
      'закажи водителя',
      'book driver',
      'трансфер',
      'airport transfer',
      'поездка',
      'drive me',
      'need a car',
    ],
    action: '/drivers',
  },
  {
    id: 'check_driver_availability',
    name: 'Check Driver Availability',
    description: 'Check if a driver is available at a specific time',
    requiredRole: ['employee', 'supervisor', 'admin', 'superadmin'],
    keywords: [
      'driver available',
      'водитель свободен',
      'driver availability',
      'когда водитель',
      'driver schedule',
      'расписание водителя',
      'занятость водителя',
    ],
    action: '/drivers',
  },
  {
    id: 'view_driver_calendar',
    name: 'View Driver Calendar',
    description: 'View driver calendar and schedule (requires access permission)',
    requiredRole: ['employee', 'supervisor', 'admin', 'superadmin'],
    keywords: [
      'driver calendar',
      'календарь водителя',
      'driver schedule',
      'расписание',
      'view availability',
      'посмотреть занятость',
    ],
    action: '/drivers',
  },
  {
    id: 'my_driver_requests',
    name: 'My Driver Requests',
    description: 'View status of your driver booking requests',
    requiredRole: ['employee', 'supervisor', 'admin', 'superadmin'],
    keywords: [
      'my driver requests',
      'мои заявки на водителя',
      'driver booking status',
      'статус заявки',
    ],
    action: '/drivers',
  },
  {
    id: 'driver_access_request',
    name: 'Request Driver Calendar Access',
    description: 'Request permission to view a driver calendar',
    requiredRole: ['employee', 'supervisor', 'admin', 'superadmin'],
    keywords: [
      'driver access',
      'доступ к водителю',
      'calendar permission',
      'разрешение на календарь',
    ],
    action: '/drivers',
  },
  {
    id: 'view_dashboard',
    name: 'Dashboard',
    description: 'Open the main dashboard with overview widgets',
    requiredRole: ['employee', 'supervisor', 'admin', 'superadmin'],
    keywords: ['dashboard', 'дашборд', 'главная', 'home', 'обзор', 'overview'],
    action: '/dashboard',
  },
  {
    id: 'open_chat',
    name: 'Team Chat',
    description: 'Open the team messaging / chat page',
    requiredRole: ['employee', 'supervisor', 'admin', 'superadmin'],
    keywords: ['chat', 'чат', 'сообщения', 'messages', 'написать', 'мессенджер', 'messenger'],
    action: '/chat',
  },

  // ═══════════════════════════════════════════════════════════════
  // SUPERVISOR CAPABILITIES
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'approve_leaves',
    name: 'Approve Leave Requests',
    description: 'Review and approve/reject team leave requests',
    requiredRole: ['supervisor', 'admin', 'superadmin'],
    keywords: [
      'approve leaves',
      'approve leave requests',
      'одобрить отпуска',
      'review requests',
      'проверить заявки',
      'pending approvals',
      'ожидающие одобрения',
      'утвердить отпуск',
    ],
    action: '/approvals',
  },
  {
    id: 'view_team_attendance',
    name: 'View Team Attendance',
    description: 'Monitor team attendance, late arrivals, and work hours',
    requiredRole: ['supervisor', 'admin', 'superadmin'],
    keywords: [
      'team attendance',
      'посещаемость команды',
      'who is late',
      'кто опоздал',
      'team status',
    ],
    action: '/attendance',
  },

  // ═══════════════════════════════════════════════════════════════
  // ADMIN CAPABILITIES
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'manage_employees',
    name: 'Manage Employees',
    description: 'Add, edit, or remove employees in the organization',
    requiredRole: ['admin', 'superadmin'],
    keywords: [
      'employees',
      'сотрудники',
      'add employee',
      'добавить сотрудника',
      'manage team',
      'управление персоналом',
    ],
    action: '/employees',
  },
  {
    id: 'view_analytics',
    name: 'View Analytics',
    description: 'Access HR analytics — leave trends, attendance patterns, team metrics',
    requiredRole: ['admin', 'superadmin'],
    keywords: ['analytics', 'аналитика', 'reports', 'отчеты', 'статистика', 'statistics', 'trends'],
    action: '/analytics',
  },
  {
    id: 'approve_join_requests',
    name: 'Approve Join Requests',
    description: 'Review requests from people wanting to join the organization',
    requiredRole: ['admin', 'superadmin'],
    keywords: [
      'join requests',
      'заявки на присоединение',
      'new employees',
      'новые сотрудники',
      'join organization',
    ],
    action: '/join-requests',
  },
  {
    id: 'organization_settings',
    name: 'Organization Settings',
    description: 'Configure organization settings, departments, work schedule',
    requiredRole: ['admin', 'superadmin'],
    keywords: [
      'org settings',
      'organization settings',
      'настройки организации',
      'configure org',
      'конфигурация',
      'org config',
    ],
    action: '/settings',
  },
  {
    id: 'view_reports',
    name: 'View Reports',
    description: 'Generate and export leave/attendance reports',
    requiredRole: ['admin', 'superadmin'],
    keywords: ['reports', 'отчеты', 'download report', 'скачать отчет', 'export', 'экспорт'],
    action: '/reports',
  },

  // ═══════════════════════════════════════════════════════════════
  // SUPERADMIN CAPABILITIES
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'manage_organizations',
    name: 'Manage Organizations',
    description: 'Create and manage all organizations on the platform',
    requiredRole: ['superadmin'],
    keywords: ['organizations', 'организации', 'all orgs', 'все организации', 'create org'],
    action: '/superadmin/organizations',
  },
  {
    id: 'approve_org_requests',
    name: 'Approve Organization Requests',
    description: 'Review new organization creation requests',
    requiredRole: ['superadmin'],
    keywords: ['org requests', 'заявки организаций', 'organization requests', 'новые организации'],
    action: '/org-requests',
  },
  {
    id: 'security_monitoring',
    name: 'Security Monitoring',
    description: 'Monitor security alerts, suspicious logins, brute-force attempts',
    requiredRole: ['superadmin'],
    keywords: [
      'security',
      'безопасность',
      'alerts',
      'оповещения',
      'suspicious',
      'подозрительная активность',
    ],
    action: '/superadmin/security',
  },
  {
    id: 'stripe_dashboard',
    name: 'Stripe Dashboard',
    description: 'View payment and subscription data across all organizations',
    requiredRole: ['superadmin'],
    keywords: ['stripe', 'payments', 'платежи', 'subscriptions', 'подписки', 'billing', 'оплата'],
    action: '/superadmin/stripe-dashboard',
  },
  {
    id: 'manage_subscriptions',
    name: 'Manage Subscriptions',
    description: 'Manage organization subscriptions and plans (Starter, Professional, Enterprise)',
    requiredRole: ['superadmin'],
    keywords: ['subscriptions', 'подписки', 'plans', 'тарифы', 'upgrade', 'downgrade'],
    action: '/superadmin/subscriptions',
  },
  {
    id: 'maintenance_broadcasts',
    name: 'Send Broadcast Announcements',
    description: 'Send maintenance/announcement broadcasts to all organization users',
    requiredRole: ['superadmin'],
    keywords: [
      'broadcast',
      'рассылка',
      'announcement',
      'объявление',
      'maintenance',
      'обслуживание',
      'уведомление',
    ],
    action: '/superadmin/broadcasts',
  },

  // ═══════════════════════════════════════════════════════════════
  // HELP DESK & TICKETS
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'view_tickets',
    name: 'View Tickets',
    description: 'View and manage help desk tickets and support requests',
    requiredRole: ['employee', 'supervisor', 'admin', 'superadmin'],
    keywords: [
      'tickets',
      'тиkеты',
      'заявки',
      'поддержка',
      'support',
      'help desk',
      'տտիկետներ',
      'տիկետներ',
      'ticket stats',
      'статистика тикетов',
      'ticket status',
    ],
    action: '/help',
  },
  {
    id: 'create_ticket',
    name: 'Create Ticket',
    description: 'Create a new support ticket for IT or HR issues',
    requiredRole: ['employee', 'supervisor', 'admin', 'superadmin'],
    keywords: [
      'create ticket',
      'create a ticket',
      'создать заявку',
      'открыть тикет',
      'new ticket',
      'новая заявка',
      'տիկետներտիկետներ',
    ],
  },
  {
    id: 'view_sla',
    name: 'View SLA',
    description: 'Check SLA agreements and compliance for tickets',
    requiredRole: ['admin', 'superadmin'],
    keywords: ['sla', 'slaտիկետներ', 'соглашение об уровне', 'service level'],
    action: '/help',
  },

  // ═══════════════════════════════════════════════════════════════
  // EVENTS & BIRTHDAYS
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'view_events',
    name: 'View Events',
    description: 'View and manage company events, celebrations, and activities',
    requiredRole: ['employee', 'supervisor', 'admin', 'superadmin'],
    keywords: ['events', 'события', 'мероприятия', 'event', 'տիկետներ', 'տիկետներ'],
    action: '/admin/events',
  },
  {
    id: 'create_event',
    name: 'Create Event',
    description: 'Create a new company event or celebration',
    requiredRole: ['admin', 'superadmin'],
    keywords: [
      'create event',
      'создать событие',
      'новое мероприятие',
      'new event',
      'տիկետներտիկետներ',
    ],
  },
  {
    id: 'view_birthdays',
    name: 'View Birthdays',
    description: 'Check upcoming employee birthdays and celebrations',
    requiredRole: ['employee', 'supervisor', 'admin', 'superadmin'],
    keywords: ['birthdays', 'дни рождения', 'день рождения', 'birthday', 'տիկետներ', 'տիկետներ'],
    action: '/dashboard',
  },

  // ═══════════════════════════════════════════════════════════════
  // AUTOMATION
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'view_automation',
    name: 'View Automation',
    description: 'View and manage automated workflows and rules',
    requiredRole: ['admin', 'superadmin'],
    keywords: ['automation', 'автоматизация', 'workflows', 'рабочие процессы', 'տիկետներ'],
    action: '/superadmin/automation',
  },
  {
    id: 'create_automation',
    name: 'Create Automation',
    description: 'Create new automated rules and workflows',
    requiredRole: ['admin', 'superadmin'],
    keywords: [
      'create automation',
      'создать автоматизацию',
      'new workflow',
      'новый рабочий процесс',
      'տիկետներտիկետներ',
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // AI SITE EDITOR
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'ai_site_editor',
    name: 'AI Site Editor',
    description: 'Use AI to edit and customize the site appearance',
    requiredRole: ['admin', 'superadmin'],
    keywords: [
      'site editor',
      'редактор сайта',
      'ai editor',
      'տիկետներ տիկետներ',
      'տիկետներտիկետներ',
    ],
    action: '/ai-site-editor',
  },

  // ═══════════════════════════════════════════════════════════════
  // CORPORATE
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'view_corporate',
    name: 'View Corporate Info',
    description: 'View corporate policies, documents, and announcements',
    requiredRole: ['employee', 'supervisor', 'admin', 'superadmin'],
    keywords: [
      'corporate',
      'корпоративный',
      'policies',
      'политики',
      'company info',
      'информация о компании',
      'տիկետներ',
    ],
    action: '/dashboard',
  },

  // ═══════════════════════════════════════════════════════════════
  // APPROVALS
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'view_approvals',
    name: 'View Approvals',
    description: 'View all pending approvals for leaves, tasks, and requests',
    requiredRole: ['supervisor', 'admin', 'superadmin'],
    keywords: [
      'approvals',
      'одобрения',
      'pending approvals',
      'ожидающие одобрения',
      'approve',
      'одобрить',
      'տիկետներ',
    ],
    action: '/approvals',
  },
];

/**
 * Get capabilities available to a specific role
 */
export function getCapabilitiesForRole(role: UserRole): AICapability[] {
  return AI_CAPABILITIES.filter((cap) => cap.requiredRole.includes(role));
}

/**
 * Detect intent from user message and return matching capability
 * Prioritizes longer/more specific keyword matches over generic ones
 */
export function detectIntent(message: string, userRole: UserRole): AICapability | null {
  const normalizedMessage = message.toLowerCase().trim();
  const availableCapabilities = getCapabilitiesForRole(userRole);

  let bestMatch: AICapability | null = null;
  let bestKeywordLength = 0;

  for (const capability of availableCapabilities) {
    for (const keyword of capability.keywords) {
      const lowerKeyword = keyword.toLowerCase();
      if (normalizedMessage.includes(lowerKeyword)) {
        // Prioritize longer keywords (more specific matches)
        if (lowerKeyword.length > bestKeywordLength) {
          bestMatch = capability;
          bestKeywordLength = lowerKeyword.length;
        }
      }
    }
  }

  return bestMatch;
}

/**
 * Build comprehensive AI system prompt with deep ShieldOffice knowledge
 */
export function buildRoleBasedPrompt(userContext: UserContext, fullContext?: any): string {
  const capabilities = getCapabilitiesForRole(userContext.role);

  let prompt = `You are **Shield HR AI** — the intelligent assistant built into the ShieldOffice HR platform. You are an expert on every feature, policy, and capability of this system. Users trust you for accurate, thoughtful, and helpful answers.

═══════════════════════════════════════════════════════════════
PERSONALITY & COMMUNICATION STYLE
═══════════════════════════════════════════════════════════════

- You are warm, professional, and approachable — like a brilliant HR colleague
- Use clear, structured answers. Use bullet points, bold text, and emojis for readability
- Be **proactive**: if you notice something important (low balance, conflicts, upcoming deadline), mention it
- Be **concise** but thorough — don't ramble, but don't omit important details
- Use appropriate emojis (🎯📊📅✅⚠️💡👥🏖️) to make responses visual and engaging
- ALWAYS respond in the SAME LANGUAGE as the user's message:
  - Russian → ответ на русском
  - English → reply in English
  - Armenian → պատասխան հայերեն
- Address the user by their first name when appropriate
- When you don't have enough data to answer precisely, say so honestly and suggest where to find it

═══════════════════════════════════════════════════════════════
CURRENT USER
═══════════════════════════════════════════════════════════════

👤 Name: ${userContext.name}
🔑 Role: ${userContext.role.toUpperCase()}
📧 Email: ${userContext.email}
🏢 Department: ${userContext.department || 'Not specified'}
💼 Position: ${userContext.position || 'Not specified'}

AVAILABLE CAPABILITIES FOR THIS USER:
${capabilities.map((cap) => `• ${cap.name} — ${cap.description}`).join('\n')}

`;

  // ── Role-specific deep knowledge ─────────────────────────────
  switch (userContext.role) {
    case 'superadmin':
      prompt += `
═══════════════════════════════════════════════════════════════
🔴 SUPERADMIN MODE — FULL PLATFORM ACCESS
═══════════════════════════════════════════════════════════════

You are speaking to the **platform owner**. Full system access. You can:

🏗️ **Organization Management**
- Create, edit, delete organizations
- View all organizations on the platform
- Manage org admins and settings
- Approve/reject org creation requests from new users

👥 **User Management (Cross-org)**
- View all users across all organizations
- Change user roles (employee → supervisor → admin)
- Transfer users between organizations
- Deactivate accounts

🔒 **Security Center**
- Monitor login attempts, suspicious activity
- View brute-force attack logs
- Security alerts with severity levels
- IP-based threat detection

💳 **Stripe & Billing**
- Subscription plans: Starter ($29/m), Professional ($79/m), Enterprise ($199/m)
- View MRR, active subscriptions, revenue charts
- Manage trials, upgrades, downgrades
- Payment history for each organization

📢 **Broadcasts & Maintenance**
- Send system-wide announcements
- Maintenance banners (appear for all users)
- Notification types: maintenance 🔧, warnings ⚠️, security 🔒, important 🎉, critical 🚨

📊 **Platform Analytics**
- Cross-org metrics, growth trends
- User engagement, feature usage

⚠️ SECURITY: Be careful with destructive actions. Always confirm before deletion.
`;
      break;

    case 'admin':
      prompt += `
═══════════════════════════════════════════════════════════════
🟠 ADMIN MODE — ORGANIZATION MANAGEMENT
═══════════════════════════════════════════════════════════════

You are speaking to an **organization admin**. Full org-level access:

👥 **Employee Management**
- Add new employees (invite by email)
- Edit employee profiles, departments, positions
- Assign supervisors to employees
- Set employee types: Staff vs Contractor (contractors get командировочные/travel expenses)
- Manage join requests from new users

📋 **Leave Management (org-wide)**
- View ALL employee leaves in the organization
- Approve/reject any leave request
- Edit or cancel any leave (even approved ones)
- Leave types: Paid 🏖️ (20d), Sick 🤒 (10d), Family 👨‍👩‍👧 (5d), Unpaid 💼 (30d), Doctor 🏥
- Leave balances reset annually

⏰ **Attendance & Time Tracking**
- View real-time attendance for all employees
- Late arrival tracking (after 09:00)
- Work hours calculation per employee
- Check-in/check-out history

📊 **Analytics & Reports**
- Leave usage trends, department breakdowns
- Attendance statistics, late patterns
- Exportable reports (PDF, Excel-compatible)

✅ **Task Management**
- Create and assign tasks to any employee
- Set priorities (Low, Medium, High, Urgent)
- Track task completion, deadlines
- View task distribution across team

💬 **Team Chat (Messenger)**
- Organization-wide messaging system
- Direct messages and group channels
- System notification channel "System Announcements"

SCOPE: Actions limited to YOUR organization only.
`;
      break;

    case 'supervisor':
      prompt += `
═══════════════════════════════════════════════════════════════
🟡 SUPERVISOR MODE — TEAM MANAGEMENT
═══════════════════════════════════════════════════════════════

You manage your direct reports:

👥 **Team Oversight**
- View your direct reports' profiles, status, availability
- See who is at work, on leave, or absent today
- Monitor team presence: 🟢 Available, 📅 In Meeting, 📞 In Call, 🏠 Out of Office, ⛔ Busy

📋 **Leave Approvals**
- Approve/reject leave requests from your team members
- View team leave calendar to avoid conflicts
- Check leave balances before approving

⏰ **Attendance Monitoring**
- View team attendance and late arrivals
- Track work hours for your reports

✅ **Task Assignment**
- Assign tasks to your team
- Track progress and deadlines
- Set priorities for your team's work

SCOPE: You can manage ONLY employees assigned to you as supervisor.
`;
      break;

    case 'employee':
      prompt += `
═══════════════════════════════════════════════════════════════
🟢 EMPLOYEE MODE — SELF SERVICE
═══════════════════════════════════════════════════════════════

You can help with personal data and self-service:

📋 **Leave Management**
- View leave balances: Paid (20d/year), Sick (10d), Family (5d), Unpaid (30d), Doctor
- Book new leave requests (goes to admin/supervisor for approval)
- View pending, approved, and rejected requests
- Cancel own pending requests

⏰ **Attendance**
- View own check-in/check-out history
- See if checked in today and total worked hours
- Late arrival tracking

✅ **Tasks**
- View assigned tasks, priorities, and deadlines
- Track task status updates

👥 **Team Info**
- View team calendar — see who is on leave
- Check colleague availability
- View team members in your department

👤 **Profile**
- View and update profile information
- Change presence status

SCOPE: You can ONLY access your own data. Cannot view other employees' details beyond basic availability.
`;
      break;
  }

  // ── Platform-wide knowledge (all roles) ──────────────────────
  prompt += `

═══════════════════════════════════════════════════════════════
🏢 SHIELDOFFICE PLATFORM — COMPLETE FEATURE KNOWLEDGE
═══════════════════════════════════════════════════════════════

Shield HR is a comprehensive HR management platform with these core modules:

📊 **Dashboard** (/dashboard)
- Overview cards: employees count, on leave today, pending requests, attendance rate
- Quick action buttons for common tasks
- Recent activity feed
- Productivity widgets (Pomodoro timer, Focus Mode, break reminders)

📅 **Calendar** (/calendar)
- Visual team leave calendar (month view)
- Color-coded leave types
- Click to view leave details
- See team coverage at a glance

🏖️ **Leave Management** (/leaves)
- Leave types: Paid Leave 🏖️, Sick Leave 🤒, Family Leave 👨‍👩‍👧, Unpaid Leave 💼, Doctor Visit 🏥
- Default annual balances: Paid=20d, Sick=10d, Family=5d, Unpaid=30d
- Approval workflow: Employee submits → Supervisor/Admin approves/rejects
- Status tracking: Pending ⏳ → Approved ✅ / Rejected ❌

⏰ **Attendance** (/attendance)
- Real-time check-in/check-out tracking
- Work hours calculation, late arrival monitoring
- Attendance reports and statistics
- Face recognition support (optional)

🚗 **Driver Management** (/drivers) — NEW
- Book drivers for business trips, airport transfers, client meetings
- Check driver availability in real-time
- View driver calendars (with permission)
- Trip request workflow:
  1. Employee requests driver (from, to, purpose, time)
  2. Driver receives notification
  3. Driver approves or declines with reason
  4. Employee gets confirmation
- Driver calendar access:
  • Employees can request access to view driver schedules
  • Drivers grant "Full Access" (see all trip details) or "Busy/Free Only"
  • Access can be time-limited
- AI Assistant integration:
  • Ask: "Show me available drivers for tomorrow"
  • Ask: "Is driver Arman free at 2 PM?"
  • Ask: "Book a driver to Zvartnots Airport"
  • Get instant availability and booking confirmation

💬 **Team Chat** (/chat)
- Clock in/out system (work day: 09:00-18:00)
- Late arrival detection (after 09:00 = flagged late)
- Daily work hours calculation
- Attendance history and statistics

✅ **Tasks** (/tasks)
- Task creation with title, description, priority, deadline
- Priority levels: Low, Medium, High, Urgent
- Status flow: Open → In Progress → Completed
- Assigned by supervisor/admin, tracked by assignee

👥 **Employees** (/employees) — Admin only
- Employee directory with search and filters
- Departments, positions, employee types
- Contractor vs Staff distinction (contractors may get travel expense tracking)
- Supervisor assignment per employee

📊 **Analytics** (/analytics) — Admin+
- Leave usage trends by department
- Attendance rate metrics
- Monthly/quarterly comparisons
- Team performance overview

📈 **Reports** (/reports) — Admin+
- Downloadable reports
- Leave summary, attendance summary
- Filterable by date range, department, employee

💬 **Team Chat** (/chat)
- Real-time messaging between team members
- Organization-wide channels
- "System Announcements" channel for broadcasts
- File sharing, emoji reactions

🔔 **Notifications**
- Real-time push notifications
- Leave request status updates
- Task assignments and deadlines
- Security alerts (superadmin)
- 3-note chime sound for new notifications

⚙️ **Settings** (/settings)
- Theme: Light / Dark mode
- Language: English 🇬🇧, Russian 🇷🇺, Armenian 🇦🇲
- Notification preferences
- Organization config (admin)

👤 **Profile** (/profile)
- Personal info, avatar, contact details
- Presence status: 🟢 Available, 📅 In Meeting, 📞 In Call, 🏠 Out of Office, ⛔ Busy
- Password change, security settings

🎯 **Productivity Tools** (in navbar dropdown)
- Pomodoro Timer: 25min focus / 5min break cycles
- Focus Mode: mark yourself as busy, silence notifications
- Quick Stats widget: shows today's metrics at a glance
- Team Presence: see who's online, in meeting, etc.
- Break Reminders: configurable interval reminders
- Keyboard Shortcuts: ⌘T=new task, ⌘L=request leave, ⌘A=attendance, ⌘/=shortcuts modal

📢 **Broadcasts** — Superadmin only
- Send announcements to all org users
- Maintenance banners across the app
- Category types with emojis: maintenance 🔧, warning ⚠️, security 🔒, important 🎉, critical 🚨

💳 **Subscription Plans**
- Starter ($29/mo): Basic features, 14-day free trial
- Professional ($79/mo): AI assistant, advanced analytics
- Enterprise ($199/mo): Full platform, priority support

🎫 **Help Desk & Tickets** (/help)
- Create and manage support tickets
- Ticket categories: IT, HR, Facilities, General
- Priority levels: Low, Medium, High, Urgent, Critical
- Status tracking: Open → In Progress → Resolved → Closed
- SLA monitoring with response time targets
- Ticket assignment and escalation workflows
- Knowledge base for common issues

📅 **Events & Celebrations** (/admin/events)
- Company events, team building, celebrations
- Event creation with date, time, location, description
- RSVP tracking and attendance management
- Recurring events support
- Event notifications and reminders

🎂 **Birthdays & Anniversaries**
- Automatic employee birthday tracking
- Upcoming birthdays dashboard widget
- Birthday notifications and celebrations
- Work anniversary tracking
- Customizable birthday messages

🤖 **Automation & Workflows** (/superadmin/automation)
- Automated rule creation and management
- Trigger-based workflows (e.g., auto-approve leaves under 3 days)
- Scheduled tasks and reminders
- Custom automation rules per organization
- Workflow templates for common HR processes

🏢 **Corporate Info & Policies**
- Company policies and documentation
- Employee handbook access
- Corporate announcements
- Policy acknowledgment tracking
- Document version control

📋 **Approvals Center** (/approvals)
- Centralized approval dashboard for supervisors/admins
- Pending leave requests with employee context
- Bulk approval/rejection capabilities
- Approval history and audit trail
- Delegation support when supervisor is absent

🎨 **AI Site Editor** (/ai-site-editor)
- AI-powered site customization
- Theme and layout adjustments
- Branding configuration
- Custom CSS and styling options

═══════════════════════════════════════════════════════════════
HR POLICIES & RULES
═══════════════════════════════════════════════════════════════

• Work day: 09:00 – 18:00 (1 hour lunch)
• Late arrival: check-in after 09:00 is marked as late
• Leave requests must be submitted in advance (except sick leave)
• Sick leave: can be submitted same-day with reason
• All leave requests go through approval workflow
• Employees cannot edit/delete approved leaves (only pending)
• Admins can edit/delete any leave regardless of status
• Leave balance resets at the beginning of each calendar year
• When requesting leave, system checks for department conflicts
• If >30% of department is on leave, alternative dates are recommended

${fullContext ? `\nSYSTEM CONTEXT:\n${JSON.stringify(fullContext, null, 2)}` : ''}
`;

  return prompt;
}

/**
 * Check if user has permission for a specific action
 */
export function hasPermission(userRole: UserRole, requiredRoles: UserRole[]): boolean {
  return requiredRoles.includes(userRole);
}

/**
 * Get available actions/suggestions based on role — trilingual with emojis
 */
export function getRoleSuggestions(role: UserRole): string[] {
  const allSuggestions: Record<UserRole, string[]> = {
    employee: [
      '📋 Сколько дней отпуска осталось?',
      '📅 Кто сегодня в отпуске?',
      '🤒 Хочу взять больничный',
      '✅ Мои задачи на сегодня',
      '💬 Открой чат',
      '📊 Покажи мою посещаемость',
    ],
    supervisor: [
      '👥 Кто из команды сегодня на работе?',
      '📋 Ожидающие заявки на отпуск',
      '⏰ Кто опоздал сегодня?',
      '✅ Создать задачу для команды',
      '📅 Покажи календарь команды',
      '📊 Статистика команды',
    ],
    admin: [
      '📊 Показать аналитику',
      '👥 Список всех сотрудников',
      '📋 Заявки на присоединение',
      '📈 Отчет по отпускам',
      '✅ Назначить задачу',
      '⏰ Посещаемость за сегодня',
    ],
    superadmin: [
      '🏢 Все организации',
      '🔒 Проверить безопасность',
      '💳 Stripe подписки',
      '📢 Отправить объявление',
      '📊 Статистика платформы',
      '👥 Все пользователи',
    ],
  };

  return allSuggestions[role] || allSuggestions.employee;
}
