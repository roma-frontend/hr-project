const fs = require('fs');
const path = require('path');

function deepMerge(target, source) {
  let output = Object.assign({}, target);
  if (typeof source === 'object' && source !== null) {
    Object.keys(source).forEach(key => {
      if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
        output[key] = deepMerge(target[key] || {}, source[key]);
      } else {
        output[key] = source[key];
      }
    });
  }
  return output;
}

function countLeafKeys(obj, prefix = '') {
  let count = 0;
  let keys = [];
  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      const subResult = countLeafKeys(obj[key], fullKey);
      count += subResult.count;
      keys = keys.concat(subResult.keys);
    } else {
      count++;
      keys.push(fullKey);
    }
  }
  return { count, keys };
}

const localesDir = path.join(__dirname, 'src', 'i18n', 'locales');
const files = ['en.json', 'ru.json', 'hy.json'];

console.log('Starting translation merge...\n');

const newTranslationsEN = {
  employee: {
    editModal: {
      department: {
        engineering: "Engineering",
        finance: "Finance",
        marketing: "Marketing",
        operations: "Operations",
        sales: "Sales",
        design: "Design",
        management: "Management",
        legal: "Legal"
      },
      sections: {
        personalInfo: "Personal Information",
        personalInfoDesc: "Basic details about the employee",
        workDetails: "Work Details",
        workDetailsDesc: "Department and position information",
        reviewChanges: "Review Changes",
        reviewChangesDesc: "Confirm the details before saving",
        previous: "Previous"
      },
      leaveBalance: {
        paid: "Paid",
        sick: "Sick",
        family: "Family"
      },
      placeholders: {
        phone: "+374 XX XXX XXX",
        position: "e.g. Engineer",
        email: "john.smith@company.com",
        phoneArmenia: "+374 91 123456"
      }
    }
  },
  chat: {
    type: {
      group: "Group",
      defaultName: "Chat"
    },
    errors: {
      unknownError: "Unknown error",
      failedFetchConversations: "Failed to fetch conversations",
      failedFetchOrgUsers: "Failed to fetch org users",
      failedAddMember: "Failed to add member"
    },
    notifications: {
      newMessage: "New message"
    },
    channels: {
      systemAnnouncements: "System Announcements"
    },
    fallbacks: {
      unknown: "Unknown",
      unnamedGroup: "Unnamed Group"
    },
    placeholders: {
      replyInThread: "Reply in thread..."
    }
  },
  auth: {
    validation: {
      passwordMin8: "Password must be at least 8 characters",
      slugRequired: "Organization slug is required",
      planNotSelected: "Plan not selected"
    },
    buttons: {
      submitRequest: "Submit Request",
      submittingRequest: "Submitting request..."
    },
    touchId: "Touch ID"
  },
  events: {
    create: {
      creating: "Creating...",
      createEvent: "Create Event",
      placeholders: {
        eventName: "e.g., Annual IT Conference 2025",
        description: "Brief description of the event...",
        projectCode: "e.g., MKTG-001, ENG-002",
        briefDesc: "Brief description..."
      },
      labels: {
        description: "Description",
        notifyDaysBefore: "Notify Days Before"
      }
    },
    conflicts: {
      checkForLeave: "Check for this leave request"
    },
    calendar: {
      googleCalendar: "Google Calendar",
      allDay: "All day"
    }
  },
  productivity: {
    breakReminder: {
      title: "Time for a Break! ☕",
      message: "You've been working for a while. Take a short break to stay productive."
    },
    focusMode: {
      indicator: "Focus Mode Active"
    }
  },
  loading: {
    faceRecognition: "Loading face recognition...",
    map: "Loading map..."
  },
  ui: {
    dialog: {
      close: "Close"
    },
    wizard: {
      selectPlaceholder: "Select..."
    }
  },
  attendance: {
    detailModal: {
      checkIn: "Check In",
      checkOut: "Check Out",
      stillWorking: "Still working..."
    }
  },
  ai: {
    chatWidget: {
      title: "Shield HR AI",
      openFullscreen: "Open full screen chat"
    },
    recommendations: {
      analyzing: "Analyzing your data...",
      attendancePatterns: "Attendance Patterns"
    }
  },
  security: {
    monitor: {
      title: "Security Monitor",
      live: "Live",
      threatLevel: "Threat Level",
      blockedIPs: "Blocked IPs",
      rateLimitHits: "Rate Limit Hits",
      failedLogins: "Failed Logins",
      lastIncident: "Last Incident"
    }
  },
  errorBoundary: {
    oops: "Oops! Something went wrong",
    errorDetails: "Error Details:",
    contactSupport: "If the problem persists, please contact support.",
    componentStack: "Component Stack Trace",
    tryAgain: "Try Again",
    somethingWentWrong: "Something went wrong"
  },
  sla: {
    dashboard: {
      avgResponseTime: "Avg Response Time",
      target: "Target: {targetHours}h",
      withinTarget: "Within target",
      aboveTarget: "Above target",
      compliance: "SLA Compliance",
      trend: "{trend}% vs last week",
      pendingRequests: "Pending Requests",
      needsAttention: "Needs attention",
      alerts: "Alerts",
      warnings: "Warnings",
      critical: "Critical",
      actionRequired: "Action required",
      breakdown: "SLA Performance Breakdown",
      breakdownDesc: "Response time distribution for the last 30 days",
      onTime: "On Time",
      breached: "Breached",
      pending: "Pending",
      configuration: "SLA Configuration",
      configTarget: "Target response time: {slaConfig.targetResponseTimeHours}h",
      support247: "24/7"
    },
    responseTime: {
      target: "Target: 95%",
      targetHours: "Target: {stats.targetResponseTimeHours}h",
      chartTitle: "Response time and compliance rate over time",
      chartSubtitle: "On-time vs breached requests by day"
    }
  },
  smartSuggestions: {
    highImpact: "High Impact",
    mediumImpact: "Medium Impact",
    lowImpact: "Low Impact"
  },
  subscription: {
    upgradeModal: {
      unlockFeatures: "Unlock advanced features for your team by upgrading to a higher plan."
    }
  },
  dashboard: {
    banners: {
      welcomeTeam: "Welcome to the team! We are excited to have you here."
    }
  },
  settings: {
    security: {
      registeredFace: "Registered face",
      twoFactorPlaceholder: "000000"
    }
  },
  superadmin: {
    wizard: {
      placeholderZero: "0"
    },
    globalSearch: {
      keyboardHint: "Press Enter to navigate, Esc to close..."
    }
  },
  api: {
    errors: {
      unauthorized: "Unauthorized",
      internalError: "Internal server error",
      invalidAction: "Invalid action",
      notAuthenticated: "Not authenticated",
      invalidToken: "Invalid token",
      failedCreateConversation: "Failed to create conversation",
      tooManyAttempts: "Too many attempts. Please try again later.",
      invalidExpiredToken: "Invalid or expired token"
    }
  },
  aiAssistant: {
    commands: {
      viewCalendar: "View Calendar",
      viewCalendarDesc: "Open and view the team calendar with all approved leaves",
      viewMyLeaves: "View My Leaves",
      viewMyTasks: "View My Tasks",
      viewProfile: "View Profile",
      viewProfileDesc: "Open user profile settings",
      viewSettings: "View Settings",
      viewSettingsDesc: "Open app settings (theme, language, notifications)",
      viewAttendance: "View attendance records and check in/out status",
      viewTeam: "View Team",
      viewDriverCalendar: "View Driver Calendar",
      viewDriverCalendarDesc: "View driver calendar and schedule (requires access permission)",
      viewDriverRequests: "View status of your driver booking requests",
      dashboard: "Dashboard",
      dashboardDesc: "Open the main dashboard with overview widgets",
      openChat: "Open the team messaging / chat page",
      viewTeamAttendance: "View Team Attendance",
      manageEmployees: "Add, edit, or remove employees in the organization",
      viewAnalytics: "View Analytics",
      viewReports: "View Reports",
      manageOrganizations: "Create and manage all organizations on the platform",
      viewPaymentData: "View payment and subscription data across all organizations",
      departmentNotSpecified: "Department: Not specified",
      positionNotSpecified: "Position: Not specified",
      fullAccess: "Full Access",
      busyFreeOnly: "Busy/Free Only",
      showAvailableDrivers: "Show me available drivers for tomorrow"
    }
  },
  checkout: {
    success: {
      verifying: "Verifying...",
      invalidSession: "Invalid Session",
      invalidSessionDesc: "We couldn't verify your payment session."
    }
  },
  orgManagement: {
    edit: {
      ownOrgOnly: "You can only manage your own organization"
    }
  },
  stripe: {
    dataStudio: {
      pleaseLogin: "Please log in",
      title: "Stripe Support Studio",
      searchPlaceholder: "Search...",
      dataUpdated: "Data updated",
      updateError: "Error updating data",
      noExportData: "No data to export",
      dataExported: "Data exported",
      loadError: "Error loading data"
    },
    webhook: {
      newSubscription: "New Subscription"
    }
  },
  impersonate: {
    exit: "Exit"
  },
  emergency: {
    create: "Create"
  },
  forgotPassword: {
    email: {
      resetPassword: "Reset your password"
    }
  },
  opengraph: {
    title: "HR Office - All-in-One HR Management Platform"
  },
  sidebar: {
    badges: {
      chat: "CHAT",
      help: "HELP",
      sup: "SUP",
      urg: "URG",
      sec: "SEC",
      ai: "AI"
    },
    browserTitle: "Shield HR"
  },
  landing: {
    hero: {
      companies: ["Acme Corp", "GlobalTech", "NovaSoft", "Meridian Co.", "Apex Industries"]
    },
    pricing: {
      custom: "Custom"
    }
  },
  serviceBroadcast: {
    dialog: {
      title: "Service Broadcast",
      titlePlaceholder: "e.g., Planned system maintenance",
      messagePlaceholder: "Enter the message text that all users will receive...",
      infoText: "All active users will receive this in the \"System Announcements\" channel"
    },
    manager: {
      editingSoon: "Editing announcements soon"
    }
  },
  password: {
    copyPassword: "Copy password"
  },
  selectSize: {
    title: "Select size"
  },
  createOrg: {
    timezones: {
      eastern: "Eastern Time",
      central: "Central Time",
      pacific: "Pacific Time",
      london: "London",
      paris: "Paris",
      tokyo: "Tokyo",
      yerevan: "Yerevan"
    }
  },
  plans: {
    starter: "Starter",
    professional: "Professional",
    enterprise: "Enterprise"
  },
  authActions: {
    errors: {
      emailExists: "An account with this email already exists. Please login instead.",
      failedCreateUser: "Failed to create user",
      profileNotCreated: "User profile was not created. Please contact support.",
      authFailed: "Authentication failed",
      userNotFound: "User profile not found. Please contact support.",
      allFieldsRequired: "All fields required",
      passwordMin8Chars: "Password must be at least 8 characters",
      emailPasswordRequired: "Email and password required",
      notAuthenticated: "Not authenticated",
      invalidToken: "Invalid token",
      unauthorized: "Unauthorized"
    }
  },
  profileActions: {
    errors: {
      notAuthenticatedNoToken: "Not authenticated - no token",
      invalidToken: "Invalid token",
      unauthorizedUserIdMismatch: "Unauthorized - user ID mismatch"
    }
  },
  cloudinaryActions: {
    errors: {
      uploadFailed: "Upload failed",
      credentialsNotConfigured: "Cloudinary credentials not configured",
      invalidTaskAttachmentUrl: "Invalid task attachment URL",
      invalidTaskAttachmentUrlMissingFilename: "Invalid task attachment URL: missing filename"
    }
  },
  serverLib: {
    errors: {
      onlySuperadmin: "Only the superadmin can perform this action",
      onlyOrgAdmin: "Only org admins can perform this action",
      invalidOrgSlug: "Invalid organization slug",
      inviteNotFound: "Invite not found",
      inviteNoOrg: "Invite has no organization"
    }
  }
};

const newTranslationsRU = {
  employee: {
    editModal: {
      department: {
        engineering: "Инженерия",
        finance: "Финансы",
        marketing: "Маркетинг",
        operations: "Операции",
        sales: "Продажи",
        design: "Дизайн",
        management: "Менеджмент",
        legal: "Юридический отдел"
      },
      sections: {
        personalInfo: "Личная информация",
        personalInfoDesc: "Основные данные о сотруднике",
        workDetails: "Рабочие данные",
        workDetailsDesc: "Информация об отделе и должности",
        reviewChanges: "Проверка изменений",
        reviewChangesDesc: "Подтвердите данные перед сохранением",
        previous: "Назад"
      },
      leaveBalance: {
        paid: "Оплачиваемый",
        sick: "Больничный",
        family: "Семейный"
      },
      placeholders: {
        phone: "+374 XX XXX XXX",
        position: "напр. Инженер",
        email: "ivan.petrov@company.com",
        phoneArmenia: "+374 91 123456"
      }
    }
  },
  chat: {
    type: {
      group: "Группа",
      defaultName: "Чат"
    },
    errors: {
      unknownError: "Неизвестная ошибка",
      failedFetchConversations: "Не удалось загрузить диалоги",
      failedFetchOrgUsers: "Не удалось загрузить пользователей организации",
      failedAddMember: "Не удалось добавить участника"
    },
    notifications: {
      newMessage: "Новое сообщение"
    },
    channels: {
      systemAnnouncements: "Системные объявления"
    },
    fallbacks: {
      unknown: "Неизвестно",
      unnamedGroup: "Безымянная группа"
    },
    placeholders: {
      replyInThread: "Ответить в ветке..."
    }
  },
  auth: {
    validation: {
      passwordMin8: "Пароль должен содержать минимум 8 символов",
      slugRequired: "Slug организации обязателен",
      planNotSelected: "Тариф не выбран"
    },
    buttons: {
      submitRequest: "Отправить запрос",
      submittingRequest: "Отправка запроса..."
    },
    touchId: "Touch ID"
  },
  events: {
    create: {
      creating: "Создание...",
      createEvent: "Создать мероприятие",
      placeholders: {
        eventName: "напр., Ежегодная IT-конференция 2025",
        description: "Краткое описание мероприятия...",
        projectCode: "напр., MKTG-001, ENG-002",
        briefDesc: "Краткое описание..."
      },
      labels: {
        description: "Описание",
        notifyDaysBefore: "Уведомить за (дней)"
      }
    },
    conflicts: {
      checkForLeave: "Проверить этот запрос на отпуск"
    },
    calendar: {
      googleCalendar: "Google Calendar",
      allDay: "Весь день"
    }
  },
  productivity: {
    breakReminder: {
      title: "Время для перерыва! ☕",
      message: "Вы работаете уже какое-то время. Сделайте короткий перерыв, чтобы оставаться продуктивным."
    },
    focusMode: {
      indicator: "Режим фокусировки активен"
    }
  },
  loading: {
    faceRecognition: "Загрузка распознавания лиц...",
    map: "Загрузка карты..."
  },
  ui: {
    dialog: {
      close: "Закрыть"
    },
    wizard: {
      selectPlaceholder: "Выберите..."
    }
  },
  attendance: {
    detailModal: {
      checkIn: "Отметиться",
      checkOut: "Выйти",
      stillWorking: "Ещё работает..."
    }
  },
  ai: {
    chatWidget: {
      title: "Shield HR AI",
      openFullscreen: "Открыть полноэкранный чат"
    },
    recommendations: {
      analyzing: "Анализ ваших данных...",
      attendancePatterns: "Паттерны посещаемости"
    }
  },
  security: {
    monitor: {
      title: "Монитор безопасности",
      live: "В реальном времени",
      threatLevel: "Уровень угрозы",
      blockedIPs: "Заблокированные IP",
      rateLimitHits: "Превышения лимита",
      failedLogins: "Неудачные входы",
      lastIncident: "Последний инцидент"
    }
  },
  errorBoundary: {
    oops: "Упс! Что-то пошло не так",
    errorDetails: "Детали ошибки:",
    contactSupport: "Если проблема не исчезнет, обратитесь в поддержку.",
    componentStack: "Трассировка стека компонентов",
    tryAgain: "Попробовать снова",
    somethingWentWrong: "Что-то пошло не так"
  },
  sla: {
    dashboard: {
      avgResponseTime: "Среднее время ответа",
      target: "Цель: {targetHours}ч",
      withinTarget: "В пределах цели",
      aboveTarget: "Выше цели",
      compliance: "Соответствие SLA",
      trend: "{trend}% по сравнению с прошлой неделей",
      pendingRequests: "Ожидающие запросы",
      needsAttention: "Требует внимания",
      alerts: "Оповещения",
      warnings: "Предупреждения",
      critical: "Критические",
      actionRequired: "Требуются действия",
      breakdown: "Детализация производительности SLA",
      breakdownDesc: "Распределение времени ответа за последние 30 дней",
      onTime: "В срок",
      breached: "Просрочено",
      pending: "В ожидании",
      configuration: "Настройка SLA",
      configTarget: "Целевое время ответа: {slaConfig.targetResponseTimeHours}ч",
      support247: "24/7"
    },
    responseTime: {
      target: "Цель: 95%",
      targetHours: "Цель: {stats.targetResponseTimeHours}ч",
      chartTitle: "Время ответа и уровень соответствия",
      chartSubtitle: "Своевременные и просроченные запросы по дням"
    }
  },
  smartSuggestions: {
    highImpact: "Высокое влияние",
    mediumImpact: "Среднее влияние",
    lowImpact: "Низкое влияние"
  },
  subscription: {
    upgradeModal: {
      unlockFeatures: "Разблокируйте расширенные функции для вашей команды, перейдя на более высокий тариф."
    }
  },
  dashboard: {
    banners: {
      welcomeTeam: "Добро пожаловать в команду! Мы рады, что вы с нами."
    }
  },
  settings: {
    security: {
      registeredFace: "Зарегистрированное лицо",
      twoFactorPlaceholder: "000000"
    }
  },
  superadmin: {
    wizard: {
      placeholderZero: "0"
    },
    globalSearch: {
      keyboardHint: "Нажмите Enter для перехода, Esc для закрытия..."
    }
  },
  api: {
    errors: {
      unauthorized: "Не авторизован",
      internalError: "Внутренняя ошибка сервера",
      invalidAction: "Неверное действие",
      notAuthenticated: "Не аутентифицирован",
      invalidToken: "Неверный токен",
      failedCreateConversation: "Не удалось создать диалог",
      tooManyAttempts: "Слишком много попыток. Попробуйте позже.",
      invalidExpiredToken: "Неверный или просроченный токен"
    }
  },
  aiAssistant: {
    commands: {
      viewCalendar: "Посмотреть календарь",
      viewCalendarDesc: "Открыть и просмотреть командный календарь со всеми одобренными отпусками",
      viewMyLeaves: "Мои отпуска",
      viewMyTasks: "Мои задачи",
      viewProfile: "Мой профиль",
      viewProfileDesc: "Открыть настройки профиля пользователя",
      viewSettings: "Настройки",
      viewSettingsDesc: "Открыть настройки приложения (тема, язык, уведомления)",
      viewAttendance: "Просмотреть записи посещаемости и статус отметок",
      viewTeam: "Команда",
      viewDriverCalendar: "Календарь водителя",
      viewDriverCalendarDesc: "Просмотр календаря и расписания водителя (требуется доступ)",
      viewDriverRequests: "Просмотр статуса ваших запросов на бронирование водителя",
      dashboard: "Главная панель",
      dashboardDesc: "Открыть главную панель с обзорными виджетами",
      openChat: "Открыть командный чат",
      viewTeamAttendance: "Посещаемость команды",
      manageEmployees: "Добавить, изменить или удалить сотрудников организации",
      viewAnalytics: "Аналитика",
      viewReports: "Отчёты",
      manageOrganizations: "Создание и управление всеми организациями на платформе",
      viewPaymentData: "Просмотр данных об оплате и подписках всех организаций",
      departmentNotSpecified: "Отдел: Не указан",
      positionNotSpecified: "Должность: Не указана",
      fullAccess: "Полный доступ",
      busyFreeOnly: "Только занят/свободен",
      showAvailableDrivers: "Покажи доступных водителей на завтра"
    }
  },
  checkout: {
    success: {
      verifying: "Проверка...",
      invalidSession: "Неверная сессия",
      invalidSessionDesc: "Не удалось проверить вашу платёжную сессию."
    }
  },
  orgManagement: {
    edit: {
      ownOrgOnly: "Вы можете управлять только своей организацией"
    }
  },
  stripe: {
    dataStudio: {
      pleaseLogin: "Пожалуйста, войдите",
      title: "Stripe Support Studio",
      searchPlaceholder: "Поиск...",
      dataUpdated: "Данные обновлены",
      updateError: "Ошибка обновления данных",
      noExportData: "Нет данных для экспорта",
      dataExported: "Данные экспортированы",
      loadError: "Ошибка загрузки данных"
    },
    webhook: {
      newSubscription: "Новая подписка"
    }
  },
  impersonate: {
    exit: "Выйти"
  },
  emergency: {
    create: "Создать"
  },
  forgotPassword: {
    email: {
      resetPassword: "Сбросить пароль"
    }
  },
  opengraph: {
    title: "HR Office - Универсальная платформа управления персоналом"
  },
  sidebar: {
    badges: {
      chat: "ЧАТ",
      help: "ПОМОЩЬ",
      sup: "СА",
      urg: "СРОЧ",
      sec: "БЕЗОП",
      ai: "ИИ"
    },
    browserTitle: "Shield HR"
  },
  landing: {
    hero: {
      companies: ["Acme Corp", "GlobalTech", "NovaSoft", "Meridian Co.", "Apex Industries"]
    },
    pricing: {
      custom: "Индивидуально"
    }
  },
  serviceBroadcast: {
    dialog: {
      title: "Системное оповещение",
      titlePlaceholder: "напр., Плановое обслуживание системы",
      messagePlaceholder: "Введите текст сообщения, которое получат все пользователи...",
      infoText: "Все активные пользователи получат это в канале \"Системные объявления\""
    },
    manager: {
      editingSoon: "Редактирование объявлений скоро"
    }
  },
  password: {
    copyPassword: "Скопировать пароль"
  },
  selectSize: {
    title: "Выберите размер"
  },
  createOrg: {
    timezones: {
      eastern: "Восточное время",
      central: "Центральное время",
      pacific: "Тихоокеанское время",
      london: "Лондон",
      paris: "Париж",
      tokyo: "Токио",
      yerevan: "Ереван"
    }
  },
  plans: {
    starter: "Стартовый",
    professional: "Профессиональный",
    enterprise: "Корпоративный"
  },
  authActions: {
    errors: {
      emailExists: "Аккаунт с таким email уже существует. Пожалуйста, войдите.",
      failedCreateUser: "Не удалось создать пользователя",
      profileNotCreated: "Профиль пользователя не был создан. Обратитесь в поддержку.",
      authFailed: "Ошибка аутентификации",
      userNotFound: "Профиль пользователя не найден. Обратитесь в поддержку.",
      allFieldsRequired: "Все поля обязательны",
      passwordMin8Chars: "Пароль должен содержать минимум 8 символов",
      emailPasswordRequired: "Email и пароль обязательны",
      notAuthenticated: "Не аутентифицирован",
      invalidToken: "Неверный токен",
      unauthorized: "Не авторизован"
    }
  },
  profileActions: {
    errors: {
      notAuthenticatedNoToken: "Не аутентифицирован - нет токена",
      invalidToken: "Неверный токен",
      unauthorizedUserIdMismatch: "Не авторизован - несовпадение ID пользователя"
    }
  },
  cloudinaryActions: {
    errors: {
      uploadFailed: "Загрузка не удалась",
      credentialsNotConfigured: "Учётные данные Cloudinary не настроены",
      invalidTaskAttachmentUrl: "Неверный URL вложения задачи",
      invalidTaskAttachmentUrlMissingFilename: "Неверный URL вложения задачи: отсутствует имя файла"
    }
  },
  serverLib: {
    errors: {
      onlySuperadmin: "Только суперадмин может выполнить это действие",
      onlyOrgAdmin: "Только админы организации могут выполнить это действие",
      invalidOrgSlug: "Неверный slug организации",
      inviteNotFound: "Приглашение не найдено",
      inviteNoOrg: "Приглашение не привязано к организации"
    }
  }
};

const newTranslationsHY = {
  employee: {
    editModal: {
      department: {
        engineering: "Ինժեներական",
        finance: "Ֆինանսներ",
        marketing: "Մարքեթինգ",
        operations: "Գործառնություններ",
        sales: "Վաճառք",
        design: "Դիզայն",
        management: "Կառավարում",
        legal: "Իրավաբանական"
      },
      sections: {
        personalInfo: "Անձնական տվյալներ",
        personalInfoDesc: "Հիմնական տվյալներ աշխատակցի մասին",
        workDetails: "Աշխատանքային տվյալներ",
        workDetailsDesc: "Բաժնի և պաշտոնի մասին տեղեկատվություն",
        reviewChanges: "Ստուգել փոփոխությունները",
        reviewChangesDesc: "Հաստատեք տվյալները պահպանելուց առաջ",
        previous: "Նախորդ"
      },
      leaveBalance: {
        paid: "Վճարովի",
        sick: "Հիվանդության",
        family: "Ընտանեկան"
      },
      placeholders: {
        phone: "+374 XX XXX XXX",
        position: "օր. Ինժեներ",
        email: "john.smith@company.com",
        phoneArmenia: "+374 91 123456"
      }
    }
  },
  chat: {
    type: {
      group: "Խումբ",
      defaultName: "Չատ"
    },
    errors: {
      unknownError: "Անհայտ սխալ",
      failedFetchConversations: "Չհաջողվեց բեռնել զրույցները",
      failedFetchOrgUsers: "Չհաջողվեց բեռնել կազմակերպության օգտատերերին",
      failedAddMember: "Չհաջողվեց ավելացնել մասնակցին"
    },
    notifications: {
      newMessage: "Նոր հաղորդագրություն"
    },
    channels: {
      systemAnnouncements: "Համակարգային հայտարարություններ"
    },
    fallbacks: {
      unknown: "Անհայտ",
      unnamedGroup: "Անանուն խումբ"
    },
    placeholders: {
      replyInThread: "Պատասխանել թեմայում..."
    }
  },
  auth: {
    validation: {
      passwordMin8: "Գաղտնաբառը պետք է լինի առնվազն 8 նիշ",
      slugRequired: "Կազմակերպության slug-ը պարտադիր է",
      planNotSelected: "Տարիֆը ընտրված չէ"
    },
    buttons: {
      submitRequest: "Ուղարկել հայտը",
      submittingRequest: "Հայտի ուղարկում..."
    },
    touchId: "Touch ID"
  },
  events: {
    create: {
      creating: "Ստեղծում...",
      createEvent: "Ստեղծել միջոցառում",
      placeholders: {
        eventName: "օր. Տարեկան IT կոնֆերանս 2025",
        description: "Միջոցառման համառոտ նկարագրություն...",
        projectCode: "օր. MKTG-001, ENG-002",
        briefDesc: "Համառոտ նկարագրություն..."
      },
      labels: {
        description: "Նկարագրություն",
        notifyDaysBefore: "Ծանուցել վաղապես (օրեր)"
      }
    },
    conflicts: {
      checkForLeave: "Ստուգել այս արձակուրդի հայտը"
    },
    calendar: {
      googleCalendar: "Google Calendar",
      allDay: "Ամբողջ օր"
    }
  },
  productivity: {
    breakReminder: {
      title: "Ընդմիջման ժամանակ է! ☕",
      message: "Դուք արդեն որոշ ժամանակ աշխատում եք: Կատարեք կարճ ընդմիջում՝ արդյունավետ մնալու համար:"
    },
    focusMode: {
      indicator: "Ֆոկուսի ռեժիմը ակտիվ է"
    }
  },
  loading: {
    faceRecognition: "Դեմքի ճանաչման բեռնում...",
    map: "Քարտեզի բեռնում..."
  },
  ui: {
    dialog: {
      close: "Փակել"
    },
    wizard: {
      selectPlaceholder: "Ընտրեք..."
    }
  },
  attendance: {
    detailModal: {
      checkIn: "Ներկայանալ",
      checkOut: "Հեռանալ",
      stillWorking: "Դեռ աշխատում է..."
    }
  },
  ai: {
    chatWidget: {
      title: "Shield HR AI",
      openFullscreen: "Բացել լիէկրան չատը"
    },
    recommendations: {
      analyzing: "Ձեր տվյալների վերլուծություն...",
      attendancePatterns: "Ներկայության օրինաչափություններ"
    }
  },
  security: {
    monitor: {
      title: "Անվտանգության մոնիտոր",
      live: "Ուղիղ",
      threatLevel: "Սպառնալիքի մակարդակ",
      blockedIPs: "Արգելափակված IP-ներ",
      rateLimitHits: "Սահմանաչափի գերազանցումներ",
      failedLogins: "Անհաջող մուտքեր",
      lastIncident: "Վերջին միջադեպ"
    }
  },
  errorBoundary: {
    oops: "Օհո՜! Ինչ-որ բան սխալ է անցել",
    errorDetails: "Սխալի մանրամասներ:",
    contactSupport: "Եթե խնդիրը շարունակվի, խնդրում ենք կապվել աջակցության հետ:",
    componentStack: "Բաղադրիչների ստեկի հետք",
    tryAgain: "Կրկին փորձել",
    somethingWentWrong: "Ինչ-որ բան սխալ է անցել"
  },
  sla: {
    dashboard: {
      avgResponseTime: "Պատասխանի միջին ժամանակ",
      target: "Նպատակ: {targetHours}ժ",
      withinTarget: "Նպատակի սահմաններում",
      aboveTarget: "Նպատակից բարձր",
      compliance: "SLA համապատասխանություն",
      trend: "{trend}% անցյալ շաբաթվա համեմատ",
      pendingRequests: "Սպասող հայտեր",
      needsAttention: "Ուշադրություն է պահանջում",
      alerts: "Ծանուցումներ",
      warnings: "Զգուշացումներ",
      critical: "Կրիտիկական",
      actionRequired: "Գործողություն է պահանջվում",
      breakdown: "SLA կատարողականի մանրամասնում",
      breakdownDesc: "Պատասխանի ժամանակի բաշխում վերջին 30 օրվա համար",
      onTime: "Ժամանակին",
      breached: "Խախտված",
      pending: "Սպասող",
      configuration: "SLA կարգավորում",
      configTarget: "Պատասխանի նպատակային ժամանակ: {slaConfig.targetResponseTimeHours}ժ",
      support247: "24/7"
    },
    responseTime: {
      target: "Նպատակ: 95%",
      targetHours: "Նպատակ: {stats.targetResponseTimeHours}ժ",
      chartTitle: "Պատասխանի ժամանակ և համապատասխանության մակարդակ",
      chartSubtitle: "Ժամանակին և խախտված հայտեր ըստ օրերի"
    }
  },
  smartSuggestions: {
    highImpact: "Բարձր ազդեցություն",
    mediumImpact: "Միջին ազդեցություն",
    lowImpact: "Ցածր ազդեցություն"
  },
  subscription: {
    upgradeModal: {
      unlockFeatures: "Բացեք ընդլայնված հնարավորություններ ձեր թիմի համար՝ անցնելով ավելի բարձր տարիֆի:"
    }
  },
  dashboard: {
    banners: {
      welcomeTeam: "Բարի գալուստ թիմ! Մենք ուրախ ենք, որ դուք մեզ հետ եք:"
    }
  },
  settings: {
    security: {
      registeredFace: "Գրանցված դեմք",
      twoFactorPlaceholder: "000000"
    }
  },
  superadmin: {
    wizard: {
      placeholderZero: "0"
    },
    globalSearch: {
      keyboardHint: "Սեղմեք Enter՝ անցնելու համար, Esc՝ փակելու..."
    }
  },
  api: {
    errors: {
      unauthorized: "Չի թույլատրված",
      internalError: "Սերվերի ներքին սխալ",
      invalidAction: "Անվավեր գործողություն",
      notAuthenticated: "Չի աուտենտիֆիկացված",
      invalidToken: "Անվավեր թոքեն",
      failedCreateConversation: "Չհաջողվեց ստեղծել զրույց",
      tooManyAttempts: "Չափազանց շատ փորձեր: Խնդրում ենք կրկին փորձել ավելի ուշ:",
      invalidExpiredToken: "Անվավեր կամ ժամկետանց թոքեն"
    }
  },
  aiAssistant: {
    commands: {
      viewCalendar: "Դիտել օրացույցը",
      viewCalendarDesc: "Բացել և դիտել թիմի օրացույցը բոլոր հաստատված արձակուրդներով",
      viewMyLeaves: "Իմ արձակուրդները",
      viewMyTasks: "Իմ խնդիրները",
      viewProfile: "Իմ պրոֆիլը",
      viewProfileDesc: "Բացել օգտատիրոջ պրոֆիլի կարգավորումները",
      viewSettings: "Կարգավորումներ",
      viewSettingsDesc: "Բացել հավելվածի կարգավորումները (թեմա, լեզու, ծանուցումներ)",
      viewAttendance: "Դիտել ներկայության գրառումները և ներկայության կարգավիճակը",
      viewTeam: "Թիմ",
      viewDriverCalendar: "Վարորդի օրացույց",
      viewDriverCalendarDesc: "Դիտել վարորդի օրացույցը և գրաֆիկը (պահանջում է մուտքի թույլտվություն)",
      viewDriverRequests: "Դիտել վարորդի ամրագրման հայտերի կարգավիճակը",
      dashboard: "Գլխավոր վահանակ",
      dashboardDesc: "Բացել հիմնական վահանակը ակնարկային վիդջեթներով",
      openChat: "Բացել թիմային չատը",
      viewTeamAttendance: "Թիմի ներկայություն",
      manageEmployees: "Ավելացնել, խմբագրել կամ հեռացնել կազմակերպության աշխատակիցներին",
      viewAnalytics: "Վերլուծություն",
      viewReports: "Հաշվետվություններ",
      manageOrganizations: "Ստեղծել և կառավարել բոլոր կազմակերպությունները պլատֆորմում",
      viewPaymentData: "Դիտել վճարումների և բաժանորդագրությունների տվյալները բոլոր կազմակերպությունների համար",
      departmentNotSpecified: "Բաժին: Նշված չէ",
      positionNotSpecified: "Պաշտոն: Նշված չէ",
      fullAccess: "Լիարժեք մուտք",
      busyFreeOnly: "Միայն զբաղված/ազատ",
      showAvailableDrivers: "Ցույց տուր վաղվա հասանելի վարորդներին"
    }
  },
  checkout: {
    success: {
      verifying: "Ստուգում...",
      invalidSession: "Անվավեր սեսիա",
      invalidSessionDesc: "Չհաջողվեց ստուգել ձեր վճարային սեսիան:"
    }
  },
  orgManagement: {
    edit: {
      ownOrgOnly: "Դուք կարող եք կառավարել միայն ձեր սեփական կազմակերպությունը"
    }
  },
  stripe: {
    dataStudio: {
      pleaseLogin: "Խնդրում ենք մուտք գործել",
      title: "Stripe Support Studio",
      searchPlaceholder: "Փնտրել...",
      dataUpdated: "Տվյալները թարմացվել են",
      updateError: "Տվյալների թարմացման սխալ",
      noExportData: "Արտահանման տվյալներ չկան",
      dataExported: "Տվյալները արտահանվել են",
      loadError: "Տվյալների բեռնման սխալ"
    },
    webhook: {
      newSubscription: "Նոր բաժանորդագրություն"
    }
  },
  impersonate: {
    exit: "Դուրս գալ"
  },
  emergency: {
    create: "Ստեղծել"
  },
  forgotPassword: {
    email: {
      resetPassword: "Վերականգնել գաղտնաբառը"
    }
  },
  opengraph: {
    title: "HR Office - ՀՌ կառավարման համապարփակ պլատֆորմ"
  },
  sidebar: {
    badges: {
      chat: "ՉԱՏ",
      help: "ՕԳՆ",
      sup: "ՍԱ",
      urg: "ՇՏԱՊ",
      sec: "ԱՆՎ",
      ai: "ԻԲ"
    },
    browserTitle: "Shield HR"
  },
  landing: {
    hero: {
      companies: ["Acme Corp", "GlobalTech", "NovaSoft", "Meridian Co.", "Apex Industries"]
    },
    pricing: {
      custom: "Անհատական"
    }
  },
  serviceBroadcast: {
    dialog: {
      title: "Ծառայության հեռարձակում",
      titlePlaceholder: "օր. Պլանավորված համակարգի սպասարկում",
      messagePlaceholder: "Մուտքագրեք հաղորդագրության տեքստը, որը կստանան բոլոր օգտատերերը...",
      infoText: "Բոլոր ակտիվ օգտատերերը կստանան սա \"Համակարգային հայտարարություններ\" ալիքում"
    },
    manager: {
      editingSoon: "Հայտարարությունների խմբագրումը շուտով"
    }
  },
  password: {
    copyPassword: "Պատճենել գաղտնաբառը"
  },
  selectSize: {
    title: "Ընտրել չափը"
  },
  createOrg: {
    timezones: {
      eastern: "Արևելյան ժամանակ",
      central: "Կենտրոնական ժամանակ",
      pacific: "Խաղաղօվկիանոսյան ժամանակ",
      london: "Լոնդոն",
      paris: "Փարիզ",
      tokyo: "Տոկիո",
      yerevan: "Երևան"
    }
  },
  plans: {
    starter: "Սկսնակ",
    professional: "Պրոֆեսիոնալ",
    enterprise: "Կորպորատիվ"
  },
  authActions: {
    errors: {
      emailExists: "Այս էլ. հասցեով հաշիվն արդեն գոյություն ունի: Խնդրում ենք մուտք գործել:",
      failedCreateUser: "Չհաջողվեց ստեղծել օգտատեր",
      profileNotCreated: "Օգտատիրոջ պրոֆիլը չստեղծվեց: Խնդրում ենք կապվել աջակցության հետ:",
      authFailed: "Աուտենտիֆիկացիան ձախողվեց",
      userNotFound: "Օգտատիրոջ պրոֆիլը չգտնվեց: Խնդրում ենք կապվել աջակցության հետ:",
      allFieldsRequired: "Բոլոր դաշտերը պարտադիր են",
      passwordMin8Chars: "Գաղտնաբառը պետք է լինի առնվազն 8 նիշ",
      emailPasswordRequired: "Էլ. հասցեն և գաղտնաբառը պարտադիր են",
      notAuthenticated: "Չի աուտենտիֆիկացված",
      invalidToken: "Անվավեր թոքեն",
      unauthorized: "Չի թույլատրված"
    }
  },
  profileActions: {
    errors: {
      notAuthenticatedNoToken: "Չի աուտենտիֆիկացված - թոքեն չկա",
      invalidToken: "Անվավեր թոքեն",
      unauthorizedUserIdMismatch: "Չի թույլատրված - օգտատիրոջ ID-ի անհամապատասխանություն"
    }
  },
  cloudinaryActions: {
    errors: {
      uploadFailed: "Վերբեռնումը ձախողվեց",
      credentialsNotConfigured: "Cloudinary-ի հավատարմագրերը կարգավորված չեն",
      invalidTaskAttachmentUrl: "Խնդրի կցորդի անվավեր URL",
      invalidTaskAttachmentUrlMissingFilename: "Խնդրի կցորդի անվավեր URL. բացակայում է ֆայլի անունը"
    }
  },
  serverLib: {
    errors: {
      onlySuperadmin: "Միայն սուպեր-ադմինը կարող է կատարել այս գործողությունը",
      onlyOrgAdmin: "Միայն կազմակերպության ադմինները կարող են կատարել այս գործողությունը",
      invalidOrgSlug: "Կազմակերպության անվավեր slug",
      inviteNotFound: "Հրավերը չգտնվեց",
      inviteNoOrg: "Հրավերը չի կապված կազմակերպության հետ"
    }
  }
};

files.forEach(file => {
  const filePath = path.join(localesDir, file);
  const lang = file.replace('.json', '');
  
  console.log(`\nProcessing ${file}...`);
  
  const existingData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const beforeKeys = countLeafKeys(existingData);
  
  console.log(`  Before: ${beforeKeys.count} keys`);
  
  let newTranslations = {};
  if (lang === 'en') {
    newTranslations = newTranslationsEN;
  } else if (lang === 'ru') {
    newTranslations = newTranslationsRU;
  } else if (lang === 'hy') {
    newTranslations = newTranslationsHY;
  }
  
  if (Object.keys(newTranslations).length > 0) {
    const mergedData = deepMerge(existingData, newTranslations);
    
    fs.writeFileSync(filePath, JSON.stringify(mergedData, null, 2) + '\n', 'utf8');
    
    const afterKeys = countLeafKeys(mergedData);
    const addedKeys = afterKeys.count - beforeKeys.count;
    
    console.log(`  After: ${afterKeys.count} keys`);
    console.log(`  Added: ${addedKeys} keys`);
  } else {
    console.log(`  No new translations for ${lang}`);
  }
});

console.log('\nTranslation merge completed!');