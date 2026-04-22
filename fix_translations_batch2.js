const fs = require('fs');
const en = JSON.parse(fs.readFileSync('src/i18n/locales/en.json', 'utf-8'));
const ru = JSON.parse(fs.readFileSync('src/i18n/locales/ru.json', 'utf-8'));
const hy = JSON.parse(fs.readFileSync('src/i18n/locales/hy.json', 'utf-8'));

function setNested(obj, path, value) {
  const keys = path.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) current[keys[i]] = {};
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
}

function deepSet(obj, path, value) {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    Object.entries(value).forEach(([k, v]) => {
      deepSet(obj, path + '.' + k, v);
    });
  } else {
    setNested(obj, path, value);
  }
}

// ── superadmin.createOrg keys ──
const createOrgKeys = {
  timezoneUTC: 'UTC',
  timezoneET: 'Eastern Time',
  timezoneCT: 'Central Time',
  timezonePT: 'Pacific Time',
  timezoneGMT: 'London',
  timezoneCET: 'Paris',
  timezoneJST: 'Tokyo',
  timezoneAMT: 'Yerevan'
};
Object.entries(createOrgKeys).forEach(([k,v]) => { setNested(en, 'superadmin.createOrg.'+k, v); });

const createOrgKeysRu = {
  timezoneUTC: 'UTC',
  timezoneET: 'Восточное время',
  timezoneCT: 'Центральное время',
  timezonePT: 'Тихоокеанское время',
  timezoneGMT: 'Лондон',
  timezoneCET: 'Париж',
  timezoneJST: 'Токио',
  timezoneAMT: 'Ереван'
};
Object.entries(createOrgKeysRu).forEach(([k,v]) => { setNested(ru, 'superadmin.createOrg.'+k, v); });

const createOrgKeysHy = {
  timezoneUTC: 'UTC',
  timezoneET: 'Արևելյան ժամանակ',
  timezoneCT: 'Կենտրոնական ժամանակ',
  timezonePT: 'Խաղաղօվկիանոսյան ժամանակ',
  timezoneGMT: 'Լոնդոն',
  timezoneCET: 'Փարիզ',
  timezoneJST: 'Տոկիո',
  timezoneAMT: 'Երևան'
};
Object.entries(createOrgKeysHy).forEach(([k,v]) => { setNested(hy, 'superadmin.createOrg.'+k, v); });

// ── stripeDashboard keys ──
const stripeDashboardKeys = {
  failedToFetchData: 'Failed to fetch data',
  dataUpdated: 'Data updated successfully',
  dataUpdateFailed: 'Failed to update data',
  errorLoadingData: 'Error Loading Data',
  tryAgain: 'Try Again'
};
Object.entries(stripeDashboardKeys).forEach(([k,v]) => { setNested(en, 'stripeDashboard.'+k, v); });

const stripeDashboardKeysRu = {
  failedToFetchData: 'Не удалось загрузить данные',
  dataUpdated: 'Данные обновлены',
  dataUpdateFailed: 'Ошибка при обновлении данных',
  errorLoadingData: 'Ошибка загрузки данных',
  tryAgain: 'Попробовать снова'
};
Object.entries(stripeDashboardKeysRu).forEach(([k,v]) => { setNested(ru, 'stripeDashboard.'+k, v); });

const stripeDashboardKeysHy = {
  failedToFetchData: 'Չհաջողվեց բեռնել տվյալները',
  dataUpdated: 'Տվյալները թարմացված են',
  dataUpdateFailed: 'Սխալ տվյալների թարմացման ժամանակ',
  errorLoadingData: 'Սխալ տվյալների բեռնման ժամանակ',
  tryAgain: 'Փորձել կրկին'
};
Object.entries(stripeDashboardKeysHy).forEach(([k,v]) => { setNested(hy, 'stripeDashboard.'+k, v); });

// ── stripe keys ──
const stripePageKeys = {
  accessDenied: 'Access Denied',
  accessDeniedDesc: 'You do not have permission to access this page.',
  restrictedAccess: 'This page is restricted to super administrators only.',
  dashboard: 'Stripe Dashboard',
  realTimeAnalytics: 'Real-time analytics and subscription management',
  backToDashboard: 'Back to Dashboard',
  refresh: 'Refresh',
  totalSubscriptions: 'Total Subscriptions',
  monthlyRevenue: 'Monthly Revenue',
  growthRate: 'Growth Rate',
  trialEndingSoon: 'Trial Ending Soon',
  within7Days: 'Within 7 days',
  last30Days: 'Last 30 days',
  status: {
    active: 'Active',
    trialing: 'Trialing',
    canceled: 'Canceled',
    pastDue: 'Past Due',
    incomplete: 'Incomplete',
    succeeded: 'Succeeded',
    failed: 'Failed'
  },
  metrics: {
    active: 'active',
    trialing: 'trialing',
    last30Days: 'Last 30 days'
  },
  revenue: {
    total: 'Total Revenue',
    totalDesc: 'Total received from all subscriptions'
  },
  transactions: {
    recent: 'Recent Transactions',
    recentDesc: 'Last {{count}} payments from Stripe',
    empty: 'No transactions'
  },
  subscriptions: {
    active: 'Active Subscriptions',
    activeCount: 'active subscriptions',
    empty: 'No active subscriptions',
    byStatus: 'All Subscriptions by Status'
  },
  table: {
    client: 'Client',
    amount: 'Amount',
    status: 'Status',
    description: 'Description',
    date: 'Date',
    plan: 'Plan',
    amountPerMonth: 'Amount/Month',
    periodEnds: 'Period Ends'
  },
  dataStudio: {
    title: 'Data Studio'
  }
};
deepSet(en, 'stripe', stripePageKeys);

const stripePageKeysRu = {
  accessDenied: 'Доступ запрещён',
  accessDeniedDesc: 'У вас нет разрешения на доступ к этой странице.',
  restrictedAccess: 'Эта страница доступна только супер-администраторам.',
  dashboard: 'Панель Stripe',
  realTimeAnalytics: 'Аналитика в реальном времени и управление подписками',
  backToDashboard: 'Вернуться на панель',
  refresh: 'Обновить',
  totalSubscriptions: 'Всего подписок',
  monthlyRevenue: 'Ежемесячный доход',
  growthRate: 'Темп роста',
  trialEndingSoon: 'Пробный период заканчивается',
  within7Days: 'В течение 7 дней',
  last30Days: 'Последние 30 дней',
  status: {
    active: 'Активна',
    trialing: 'Пробный',
    canceled: 'Отменена',
    pastDue: 'Просрочена',
    incomplete: 'Неполная',
    succeeded: 'Успешно',
    failed: 'Ошибка'
  },
  metrics: {
    active: 'активных',
    trialing: 'пробных',
    last30Days: 'Последние 30 дней'
  },
  revenue: {
    total: 'Общий доход',
    totalDesc: 'Всего получено от всех подписок'
  },
  transactions: {
    recent: 'Последние транзакции',
    recentDesc: 'Последние {{count}} платежей из Stripe',
    empty: 'Нет транзакций'
  },
  subscriptions: {
    active: 'Активные подписки',
    activeCount: 'активных подписок',
    empty: 'Нет активных подписок',
    byStatus: 'Все подписки по статусу'
  },
  table: {
    client: 'Клиент',
    amount: 'Сумма',
    status: 'Статус',
    description: 'Описание',
    date: 'Дата',
    plan: 'План',
    amountPerMonth: 'Сумма/мес',
    periodEnds: 'Период заканчивается'
  },
  dataStudio: {
    title: 'Студия данных'
  }
};
deepSet(ru, 'stripe', stripePageKeysRu);

const stripePageKeysHy = {
  accessDenied: 'Մուտքը արգելված է',
  accessDeniedDesc: 'Դուք չունեք այս էջ մուտք գործելու թույլտվություն:',
  restrictedAccess: 'Այս էջը հասանելի է միայն սուպեր ադմինիստրատորներին:',
  dashboard: 'Stripe վահանակ',
  realTimeAnalytics: 'Իրական ժամանակի վերլուծություն և բաժանորդագրությունների կառավարում',
  backToDashboard: 'Վերադառնալ վահանակ',
  refresh: 'Թարմացնել',
  totalSubscriptions: 'Ընդհանուր բաժանորդագրություններ',
  monthlyRevenue: 'Ամսական եկամուտ',
  growthRate: 'Աճի տեմպ',
  trialEndingSoon: 'Փորձնական ժամկետը ավարտվում է',
  within7Days: '7 օրվա ընթացքում',
  last30Days: 'Վերջին 30 օրը',
  status: {
    active: 'Ակտիվ',
    trialing: 'Փորձնական',
    canceled: 'Չեղարկված',
    pastDue: 'Ժամկետանց',
    incomplete: 'Անավարտ',
    succeeded: 'Հաջողված',
    failed: 'Սխալ'
  },
  metrics: {
    active: 'ակտիվ',
    trialing: 'փորձնական',
    last30Days: 'Վերջին 30 օրը'
  },
  revenue: {
    total: 'Ընդհանուր եկամուտ',
    totalDesc: 'Ընդհանուր ստացված բոլոր բաժանորդագրություններից'
  },
  transactions: {
    recent: 'Վերջին գործարքները',
    recentDesc: 'Վերջին {{count}} վճարումները Stripe-ից',
    empty: 'Գործարքներ չկան'
  },
  subscriptions: {
    active: 'Ակտիվ բաժանորդագրություններ',
    activeCount: 'ակտիվ բաժանորդագրություններ',
    empty: 'Ակտիվ բաժանորդագրություններ չկան',
    byStatus: 'Բոլոր բաժանորդագրությունները ըստ կարգավիճակի'
  },
  table: {
    client: 'Հաճախորդ',
    amount: 'Գումար',
    status: 'Կարգավիճակ',
    description: 'Նկարագրություն',
    date: 'Ամսաթիվ',
    plan: 'Պլան',
    amountPerMonth: 'Գումար/ամիս',
    periodEnds: 'Ժամկետի ավարտ'
  },
  dataStudio: {
    title: 'Տվյալների ստուդիա'
  }
};
deepSet(hy, 'stripe', stripePageKeysHy);

// ── ui keys ──
const uiKeys = {
  accessDenied: 'Access Denied',
  onlySuperadminCanAccess: 'Only super administrators can access this page.',
  yourEmail: 'Your email:',
  role: 'Role:'
};
Object.entries(uiKeys).forEach(([k,v]) => { setNested(en, 'ui.'+k, v); });

const uiKeysRu = {
  accessDenied: 'Доступ запрещён',
  onlySuperadminCanAccess: 'Только супер-администраторы могут получить доступ к этой странице.',
  yourEmail: 'Ваш email:',
  role: 'Роль:'
};
Object.entries(uiKeysRu).forEach(([k,v]) => { setNested(ru, 'ui.'+k, v); });

const uiKeysHy = {
  accessDenied: 'Մուտքը արգելված է',
  onlySuperadminCanAccess: 'Միայն սուպեր ադմինիստրատորները կարող են մուտք գործել այս էջ:',
  yourEmail: 'Ձեր էլ. փոստը:',
  role: 'Դեր:'
};
Object.entries(uiKeysHy).forEach(([k,v]) => { setNested(hy, 'ui.'+k, v); });

// ── toasts keys ──
const toastsKeys = {
  userIdNotFound: 'User ID not found',
  pleaseFillAllFields: 'Please fill in all required fields'
};
Object.entries(toastsKeys).forEach(([k,v]) => { setNested(en, 'toasts.'+k, v); });

const toastsKeysRu = {
  userIdNotFound: 'ID пользователя не найден',
  pleaseFillAllFields: 'Пожалуйста, заполните все обязательные поля'
};
Object.entries(toastsKeysRu).forEach(([k,v]) => { setNested(ru, 'toasts.'+k, v); });

const toastsKeysHy = {
  userIdNotFound: 'Օգտատերի ID-ն չի գտնվել',
  pleaseFillAllFields: 'Խնդրում ենք լրացնել բոլոր պարտադիր դաշտերը'
};
Object.entries(toastsKeysHy).forEach(([k,v]) => { setNested(hy, 'toasts.'+k, v); });

// ── orgRequests keys ──
setNested(en, 'orgRequests.createFailed', 'Failed to create organization');
setNested(ru, 'orgRequests.createFailed', 'Не удалось создать организацию');
setNested(hy, 'orgRequests.createFailed', 'Չհաջողվեց ստեղծել կազմակերպությունը');

// ── placeholders keys ──
const placeholdersKeys = {
  acmeCorp: 'Acme Corp',
  acmeInc: 'acme-inc',
  enterYourEmail: 'admin@company.com',
  unitedStates: 'United States',
  technologyHealthcare: 'Technology, Healthcare, Finance...'
};
Object.entries(placeholdersKeys).forEach(([k,v]) => { setNested(en, 'placeholders.'+k, v); });

const placeholdersKeysRu = {
  acmeCorp: 'Acme Corp',
  acmeInc: 'acme-inc',
  enterYourEmail: 'admin@company.com',
  unitedStates: 'Соединённые Штаты',
  technologyHealthcare: 'Технологии, здравоохранение, финансы...'
};
Object.entries(placeholdersKeysRu).forEach(([k,v]) => { setNested(ru, 'placeholders.'+k, v); });

const placeholdersKeysHy = {
  acmeCorp: 'Acme Corp',
  acmeInc: 'acme-inc',
  enterYourEmail: 'admin@company.com',
  unitedStates: 'Միացյալ Նահանգներ',
  technologyHealthcare: 'Տեխնոլոգիաներ, առողջապահություն, ֆինանսներ...'
};
Object.entries(placeholdersKeysHy).forEach(([k,v]) => { setNested(hy, 'placeholders.'+k, v); });

// ── actions.cancel ──
setNested(en, 'actions.cancel', 'Cancel');
setNested(ru, 'actions.cancel', 'Отмена');
setNested(hy, 'actions.cancel', 'Չեղարկել');

// ── superadmin.organizations form labels ──
const orgFormKeys = {
  createTitle: 'Create Organization',
  createSubtitle: 'Create a new organization and assign an admin',
  nameLabel: 'Organization Name',
  slugLabel: 'Slug',
  adminEmailLabel: 'Admin Email',
  planLabel: 'Plan',
  planStarterFree: 'Starter (Free)',
  planProfessionalPaid: 'Professional (Paid)',
  planEnterpriseCustom: 'Enterprise (Custom)',
  countryLabel: 'Country',
  timezoneLabel: 'Timezone',
  industryLabel: 'Industry',
  creating: 'Creating...',
  createOrganization: 'Create Organization'
};
Object.entries(orgFormKeys).forEach(([k,v]) => { setNested(en, 'superadmin.organizations.'+k, v); });

const orgFormKeysRu = {
  createTitle: 'Создать организацию',
  createSubtitle: 'Создайте новую организацию и назначьте администратора',
  nameLabel: 'Название организации',
  slugLabel: 'Идентификатор',
  adminEmailLabel: 'Email администратора',
  planLabel: 'План',
  planStarterFree: 'Стартовый (Бесплатно)',
  planProfessionalPaid: 'Профессиональный (Платный)',
  planEnterpriseCustom: 'Корпоративный (Индивидуальный)',
  countryLabel: 'Страна',
  timezoneLabel: 'Часовой пояс',
  industryLabel: 'Отрасль',
  creating: 'Создание...',
  createOrganization: 'Создать организацию'
};
Object.entries(orgFormKeysRu).forEach(([k,v]) => { setNested(ru, 'superadmin.organizations.'+k, v); });

const orgFormKeysHy = {
  createTitle: 'Ստեղծել կազմակերպություն',
  createSubtitle: 'Ստեղծեք նոր կազմակերպություն և նշանակեք ադմինիստրատոր',
  nameLabel: 'Կազմակերպության անվանում',
  slugLabel: 'Իդենտիֆիկատոր',
  adminEmailLabel: 'Ադմինիստրատորի էլ. փոստ',
  planLabel: 'Պլան',
  planStarterFree: 'Սկսնակ (Անվճար)',
  planProfessionalPaid: 'Պրոֆեսիոնալ (Վճարովի)',
  planEnterpriseCustom: 'Կորպորատիվ (Անհատական)',
  countryLabel: 'Երկիր',
  timezoneLabel: 'Ժամային գոտի',
  industryLabel: 'Ոլորտ',
  creating: 'Ստեղծում...',
  createOrganization: 'Ստեղծել կազմակերպություն'
};
Object.entries(orgFormKeysHy).forEach(([k,v]) => { setNested(hy, 'superadmin.organizations.'+k, v); });

// ── superadmin toast messages ──
setNested(en, 'superadmin.creatingOrg', 'Creating {{name}} organization...');
setNested(en, 'superadmin.orgCreated', 'Organization "{{name}}" created successfully!');
setNested(en, 'superadmin.adminInvitationSent', 'Admin invitation will be sent to {{email}}');
setNested(ru, 'superadmin.creatingOrg', 'Создание организации {{name}}...');
setNested(ru, 'superadmin.orgCreated', 'Организация "{{name}}" успешно создана!');
setNested(ru, 'superadmin.adminInvitationSent', 'Приглашение администратора будет отправлено на {{email}}');
setNested(hy, 'superadmin.creatingOrg', '{{name}} կազմակերպության ստեղծում...');
setNested(hy, 'superadmin.orgCreated', '"{{name}}" կազմակերպությունը հաջողությամբ ստեղծվեց:');
setNested(hy, 'superadmin.adminInvitationSent', 'Ադմինիստրատորի հրավերը կուղարկվի {{email}} հասցեով');

fs.writeFileSync('src/i18n/locales/en.json', JSON.stringify(en, null, 2));
fs.writeFileSync('src/i18n/locales/ru.json', JSON.stringify(ru, null, 2));
fs.writeFileSync('src/i18n/locales/hy.json', JSON.stringify(hy, null, 2));

console.log('Done: Added all missing keys for create-org, stripe-dashboard, and related pages');
