/**
 * Generates the end-user guide (.docx) for the integration tabs — Single
 * Sign-On, SAML SSO, Webhooks, SCIM, API — plus the new local-payments and
 * SOC 2 evidence features.
 *
 * Run: node scripts/generate-user-guide.mjs
 * Output: <Desktop>/Strata-Integration-User-Guide-<date>.docx
 *
 * Uses the `docx` package already in the dependency tree (the e-signature PDF
 * export pulls it in), so nothing new is installed.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

const BRAND = '1F4E79';
const LIGHT = 'EAF1F8';
const CODE_BG = 'F2F2F2';
const TIP_BG = 'E8F5E9';

// ── Helpers ──────────────────────────────────────────────────────────────────

const p = (text, opts = {}) =>
  new Paragraph({
    spacing: { after: 160 },
    children: [new TextRun({ text, size: 22, ...(opts.run ?? {}) })],
    ...(opts.para ?? {}),
  });

const h1 = (text) => new Paragraph({ text, heading: HeadingLevel.HEADING_1, spacing: { before: 320, after: 160 } });
const h2 = (text) => new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 260, after: 140 } });
const h3 = (text) => new Paragraph({ text, heading: HeadingLevel.HEADING_3, spacing: { before: 200, after: 120 } });

const bullet = (text, bold = false) =>
  new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 80 },
    children: [new TextRun({ text, size: 22, bold })],
  });

/** `like this` — inline code look inside a normal sentence. */
const runs = (parts) =>
  new Paragraph({
    spacing: { after: 160 },
    children: parts.map(([text, code]) =>
      new TextRun({ text, size: 22, font: code ? 'Consolas' : undefined, shading: code ? { type: ShadingType.CLEAR, fill: CODE_BG } : undefined }),
    ),
  });

/** A full-width monospace block. */
const codeBlock = (lines) =>
  lines.map(
    (line) =>
      new Paragraph({
        spacing: { after: 20 },
        shading: { type: ShadingType.CLEAR, fill: CODE_BG },
        children: [new TextRun({ text: line, size: 19, font: 'Consolas' })],
      }),
  );

/** Callout box (tip / warning). */
function callout(kind, title, text) {
  const fill = kind === 'tip' ? TIP_BG : 'FCE8E6';
  return [
    new Paragraph({
      spacing: { before: 120, after: 0 },
      shading: { type: ShadingType.CLEAR, fill },
      border: {
        left: { style: BorderStyle.SINGLE, size: 24, color: kind === 'tip' ? '2E7D32' : 'C62828' },
      },
      children: [new TextRun({ text: title, bold: true, size: 22 })],
    }),
    new Paragraph({
      spacing: { after: 200 },
      shading: { type: ShadingType.CLEAR, fill },
      border: {
        left: { style: BorderStyle.SINGLE, size: 24, color: kind === 'tip' ? '2E7D32' : 'C62828' },
      },
      children: [new TextRun({ text, size: 21 })],
    }),
  ];
}

/** Two-column key/value table. */
function kvTable(rows, headLeft, headRight) {
  const cell = (text, { bold = false, fill, width } = {}) =>
    new TableCell({
      width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
      shading: fill ? { type: ShadingType.CLEAR, fill } : undefined,
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [new Paragraph({ children: [new TextRun({ text, size: 21, bold })] })],
    });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          cell(headLeft, { bold: true, fill: LIGHT, width: 32 }),
          cell(headRight, { bold: true, fill: LIGHT, width: 68 }),
        ],
      }),
      ...rows.map(([k, v]) => new TableRow({ children: [cell(k, { bold: true }), cell(v)] })),
    ],
  });
}

const spacer = () => new Paragraph({ spacing: { after: 120 }, children: [] });

// ── Document ─────────────────────────────────────────────────────────────────

const children = [
  // Cover
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 1600, after: 200 },
    children: [new TextRun({ text: 'Strata', bold: true, size: 72, color: BRAND })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
    children: [new TextRun({ text: 'Руководство пользователя: интеграции и новые функции', size: 40, color: '444444' })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 100 },
    children: [new TextRun({ text: 'Single Sign-On · SAML SSO · Webhooks · SCIM · API', size: 26, color: '666666' })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 100 },
    children: [new TextRun({ text: 'Платежи Idram / ArCa · Автоматизация SOC 2', size: 26, color: '666666' })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 600 },
    children: [new TextRun({ text: new Date().toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' }), size: 22, color: '999999' })],
  }),
  new Paragraph({ children: [], pageBreakBefore: false }),

  // TOC-ish overview
  h1('Содержание'),
  ...[
    '1. Раздел «Настройки» — вкладки интеграций (обзор)',
    '2. Single Sign-On (OIDC) — вход через корпоративного провайдера',
    '3. SAML SSO — федерация Enterprise-уровня',
    '4. Webhooks — исходящие уведомления о событиях',
    '5. SCIM — автоматическое управление сотрудниками из IdP',
    '6. API — ключи только для чтения для интеграций  (НОВОЕ)',
    '7. Локальные платежи Idram / ArCa  (НОВОЕ)',
    '8. Автоматизация SOC 2  (НОВОЕ, для владельца платформы)',
    '9. Устранение неполадок',
  ].map((t) => bullet(t)),

  h1('1. Раздел «Настройки» — вкладки интеграций'),
  p('Все инструменты интеграции собраны в одном месте: Настройки (Settings) → вкладка «Интеграции». Вкладки видны администраторам организации и суперадмину:'),
  kvTable(
    [
      ['Single Sign-On', 'Вход через корпоративного провайдера по протоколу OIDC (Google Workspace, Azure AD и др.)'],
      ['SAML SSO', 'Федерация входа SAML 2.0 — стандарт для enterprise-провайдеров (Okta, Azure AD, OneLogin)'],
      ['Webhooks', 'Исходящие уведомления: Strata сама сообщает вашему сервису о событиях'],
      ['SCIM', 'Автоматическое создание/обновление/деактивация сотрудников из вашего IdP'],
      ['API', 'Ключи для чтения данных организации внешними системами — НОВОЕ'],
    ],
    'Вкладка',
    'Назначение',
  ),
  spacer(),

  h1('2. Single Sign-On (OIDC)'),
  h3('Что это даёт'),
  p('Сотрудники входят по корпоративной учётной записи — без отдельного пароля Strata. Новый сотрудник, заведённый в Azure AD или Google Workspace, может войти в Strata сразу, а уволенный теряет доступ вместе с корпоративным аккаунтом.'),
  h3('Как настроить'),
  ...[
    'Откройте Настройки → Single Sign-On.',
    'Скопируйте Redirect URI и зарегистрируйте приложение у провайдера (Azure AD → App registrations → Redirect URI).',
    'Вернитесь в Strata и введите Client ID и Client Secret от провайдера.',
    'Нажмите «Проверить подключение» (Verify) — система проверит конфигурацию до того, как ею начнут пользоваться сотрудники.',
    'Включите переключатель SSO.',
  ],
  ...callout('tip', 'Подсказка.', 'Не выключайте обычный вход (email + пароль), пока SSO не проверен хотя бы одним реальным входом. Иначе можно остаться без доступа к настройкам.'),
  h3('Полезно знать'),
  ...[
    'Вход по SSO безопасен против подделки: используется OIDC с PKCE, а state-параметр одноразовый.',
    'Первый вход по SSO создаёт сотрудника автоматически (см. раздел SCIM — он делает это ещё и заранее).',
  ],

  h1('3. SAML SSO'),
  h3('Чем отличается от OIDC-SSO'),
  p('Это тот же единый вход, но по протоколу SAML 2.0. Нужен, если ваша компания использует Okta, OneLogin или корпоративный ADFS — они исторически работают через SAML.'),
  h3('Как настроить'),
  ...[
    'Настройки → SAML SSO.',
    'Скачайте Metadata XML от вашего IdP (или скопируйте URL метаданных).',
    'Загрузите метаданные в Strata и скопируйте обратно значения ACS URL и Entity ID в панель IdP.',
    'Назначьте приложение сотрудникам в IdP и включите SAML в Strata.',
  ],
  ...callout('warning', 'Важно.', 'SAML-сертификат закрепляется при настройке. Если IdP обновит сертификат (это бывает раз в несколько лет), вход прекратится до обновления метаданных в Strata — система предупредит об этом в журнале.'),
  ...[
    'Поддерживается автосоздание пользователя при первом SSO-входе (JIT-провижининг), и оно записывается в журнал аудита.',
    'Один провайдер SAML на организацию — это осознанное ограничение для простоты аудита.',
  ].map((t) => bullet(t)),

  h1('4. Webhooks'),
  h3('Что это даёт'),
  p('Вместо того чтобы опрашивать Strata по расписанию, ваш сервис получает события сам: «сотрудник создан», «отпуск одобрен» и т.д. Экономит запросы и даёт мгновенную реакцию.'),
  h3('Как настроить'),
  ...[
    'Настройки → Webhooks → «Добавить endpoint».',
    'Укажите HTTPS-адрес вашего сервиса и выберите события для доставки.',
    'Скопируйте показанный signing secret — он нужен для проверки подписи на вашей стороне.',
    'Нажмите «Отправить тест» — Strata доставит тестовое событие, и вы увидите его в журнале доставок.',
  ],
  h3('Проверка подписи на вашей стороне'),
  p('Каждое событие подписано: заголовок содержит HMAC-SHA256 от тела запроса с вашим secret. Проверка обязательна — иначе любой, кто узнает адрес, сможет присылать вам поддельные события.'),
  ...codeBlock([
    "import crypto from 'node:crypto';",
    '',
    'const expected = crypto',
    "  .createHmac('sha256', WEBHOOK_SECRET)",
    '  .update(rawBody)',
    "  .digest('hex');",
    '',
    "const ok = crypto.timingSafeEqual(",
    '  Buffer.from(expected),',
    '  Buffer.from(req.headers["x-signature"] ?? ""),',
    ');',
    'if (!ok) return res.status(401).end();',
  ]),
  spacer(),
  ...callout('tip', 'Надёжность.', 'Дубликаты нормальны: при недоступности вашего сервиса Strata повторяет доставку с экспоненциальной задержкой. Делайте обработчик идемпотентным по id события.'),
  h3('Журнал доставок'),
  p('Для каждого endpoint видны последние доставки: статус, код ответа, время и тело. Если сервис отвечал ошибкой, повтор будет виден здесь же.'),

  h1('5. SCIM'),
  h3('Что это даёт'),
  p('Полная синхронизация сотрудников с IdP: создали человека в Azure AD — он появился в Strata; уволили — доступ отключился сам. Ручное заведение сотрудников становится не нужным.'),
  h3('Как настроить'),
  ...[
    'Настройки → SCIM → «Создать токен».',
    'Скопируйте токен — он показывается один раз и хранится только в виде хеша.',
    'В Azure AD (Enterprise Applications → Provisioning) укажите Tenant URL и токен.',
    'Назначьте пользователей/группы на приложение и запустите Provisioning.',
    'Кнопка «Проверить подключение» в Strata показывает, сколько сотрудников видно через токен.',
  ],
  ...callout('warning', 'Важно про роли.', 'SCIM не может создать суперадмина. Роль «admin» из IdP присваивается только если токену явно выдано право allowAdminRole, иначе новые пользователи получают роль «employee». Это защита от того, чтобы каталог IdP мог повысить себе привилегии.'),
  h3('Полезно знать'),
  bullet('Токен можно отключить или удалить в любой момент — интеграция прекратится без изменения данных.'),
  bullet('SCIM-пользователи связаны с SSO-входом по подтверждённому email — это одна и та же учётная запись.'),

  h1('6. API — ключи только для чтения (НОВОЕ)'),
  h3('Что это даёт'),
  p('Внешние системы (Armsoft, ваша BI-панель, скрипты выгрузки) читают данные организации напрямую: сотрудники, отделы, должности, отпуска. Запись наружу не даётся — только чтение, только в пределах вашей организации.'),
  h3('Как создать ключ'),
  ...[
    'Настройки → API → «Создать ключ».',
    'Введите название (например, «Armsoft payroll sync») и отметьте права (scopes):',
  ],
  kvTable(
    [
      ['employees:read', 'Сотрудники, структура, остатки отпусков'],
      ['departments:read', 'Подразделения'],
      ['positions:read', 'Должности и подчинённость'],
      ['leaves:read', 'Заявления на отпуск и статусы'],
      ['(без scope)', '/me — проверка ключа и лимитов'],
    ],
    'Право',
    'Что разрешает',
  ),
  spacer(),
  runs([
    ['Нажмите «Создать» — ключ показывается ', false],
    ['один раз', true],
    ['. Сохраните его сразу: на стороне Strata хранится только хеш, восстановить невозможно (только отозвать и создать новый).', false],
  ]),
  h3('Базовый URL и первый запрос'),
  p('Базовый URL показывается на той же вкладке (хост .convex.site — именно его, не .convex.cloud). Пример:'),
  ...codeBlock([
    'curl -H "Authorization: Bearer strata_ВАШ_КЛЮЧ" \\',
    '  https://<deployment>.convex.site/api/v1/me',
    '',
    'curl -H "Authorization: Bearer strata_ВАШ_КЛЮЧ" \\',
    '  "https://<deployment>.convex.site/api/v1/employees?activeOnly=true&limit=100"',
  ]),
  h3('Ограничения и лимиты'),
  ...[
    'Лимит вызовов — месячный, по тарифу организации (параметр apiCalls; по умолчанию на Enterprise 100 000/мес).',
    'Каждый ответ содержит заголовки X-API-Usage и X-API-Limit — по ним удобно строить обход лимита заранее.',
    'Ключ можно временно отключить (Switch) или отозвать (корзина) — отзыв фиксируется в журнале аудита.',
    'Список кодов ответа и все параметры — в документации docs/public-api.md в репозитории.',
  ].map((t) => bullet(t)),
  ...callout('warning', 'Безопасность.', 'Ключ видит только свою организацию. Данные содержат только рабочие поля: ни паролей, ни токенов сессий, ни 2FA-кодов, ни биометрии. Тем не менее храните ключ как пароль — в секрет-менеджере, не в коде.'),

  h1('7. Локальные платежи Idram / ArCa (НОВОЕ)'),
  p('Эти функции предназначены для двух разных ролей: администратор организации оплачивает тариф, а владелец платформы (суперадмин) подключает платёжные провайдеры.'),

  h3('7.1. Оплата тарифа локально (админ организации)'),
  ...[
    'В открывшемся окне апгрейда под кнопками тарифов появился блок «Pay locally / Оплатить локально».',
    'Кнопка Idram ведёт на платёжную страницу Idram (EDP-форма).',
    'Кнопки банков (Ameriabank, Ardshinbank, FastBank) ведут на hosted-страницу банка (ArCa).',
    'После оплаты вы вернётесь на страницу результата; тариф активируется автоматически, когда банк подтвердит платёж сервером — обычно секунды.',
  ],
  ...callout('tip', 'Честный статус.', 'Страница возврата специально не пишет «оплачено» до подтверждения от банка. Если тариф не активировался за минуту — в поддержку, номер заказа показан на странице результата.'),

  h3('7.2. Подключение провайдеров (суперадмин)'),
  p('Новая страница: Суперадмин → Local Payments. Для каждого провайдера (Idram, Ameriabank, Ardshinbank, FastBank):'),
  kvTable(
    [
      ['Merchant / shop ID', 'Идентификатор мерчанта из личного кабинета PSP'],
      ['Webhook secret', 'Секрет подписи вебхука; хранится только на сервере, показывается как «Secret set»'],
      ['Endpoint override', 'Адрес платёжного API (sandbox/production); для Idram есть значение по умолчанию'],
      ['Success/Fail path', 'Куда вернуть клиента после оплаты'],
      ['Webhook URL', 'Готовый адрес для вставки в кабинет банка — кнопка «копировать»'],
    ],
    'Поле',
    'Что ввести',
  ),
  spacer(),
  p('Ниже на странице — журнал локальных платежей: все заказы, новые сверху. Строка «pending» без вебхука — платёж, который банк не подтвердил; его видно сразу, а не по жалобе клиента.'),
  ...callout('warning', 'Перед приёмом реальных денег.', 'Сверьте названия полей и схему подписи с вашим подписанным merchant-спецификациям: контракт в коде конфигурируемый, но названия полей у каждого банка свои.'),

  h1('8. Автоматизация SOC 2 (НОВОЕ, для владельца платформы)'),
  p('Раньше сбор доказательств для аудита SOC 2 был ручным. Теперь одна команда собирает снимок состояния 10 контролов в датированный отчёт:'),
  ...codeBlock(['npm run soc2:evidence']),
  h3('Что происходит'),
  ...[
    'Скрипт читает только файлы репозитория: CI-конфиг, пороги покрытия, .env.example, схемы безопасности, cron-реестр. Без сети, без базы, без секретов.',
    'На выходе — reports/soc2-evidence-<дата>.md: таблица статусов по контролям (TSC CC6.1, CC8.1…), свидетельства по каждой, и отдельный чек-лист из 10 ручных контролов (политика безопасности, тест восстановления и т.п.), которые автоматизировать нельзя.',
    'Ключ --strict делает скрипт CI-гейтом: любая контрол-регрессия валит сборку.',
  ],
  ...callout('tip', 'Каденция.', 'Type II требует, чтобы контролы работали непрерывно 3–12 месяцев. Запускайте раз в месяц и храните все отчёты — ценность именно в серии, а не в одном снимке.'),
  p('Полная карта контролов и план наблюдения — в docs/soc2-type2-readiness.md (раздел 7.1).'),

  h1('9. Устранение неполадок'),
  kvTable(
    [
      ['401 Invalid API key', 'Ключ неверен, отозван или отключён. Создайте новый в Настройки → API'],
      ['402 Payment required (API)', 'Модуль apiAccess не включён в вашем тарифе — обратитесь к владельцу платформы'],
      ['403 lacks the "..." scope', 'Ключу не хватает права: создайте ключ заново с нужным scope'],
      ['429 limit reached', 'Месячный лимит API исчерпан; заголовок X-API-Limit покажет значение'],
      ['SSO: imid/sso ошибки в URL после логина', 'Смотрите текст ошибки в адресной строке; чаще всего — неверный Redirect URI у провайдера'],
      ['SAML внезапно перестал работать', 'IdP сменил сертификат — загрузите свежие метаданные в Настройки → SAML'],
      ['Webhook не приходит', 'Проверьте журнал доставок и что адрес HTTPS и доступен из интернета; повтор включается автоматически'],
      ['Тариф не активировался после Idram', 'Подождите минуту; если нет — сообщите поддержку номер заказа со страницы результата'],
      ['Скрипт SOC 2 упал в --strict', 'Какая-то контрол-регрессия: откройте отчёт, раздел с ✗, и исправьте конфигурацию'],
    ],
    'Ситуация',
    'Что делать',
  ),
  spacer(),

  new Paragraph({
    spacing: { before: 300 },
    children: [new TextRun({ text: `Strata · версия ${pkg.version ?? '0.1.0'} · документ сгенерирован автоматически (scripts/generate-user-guide.mjs)`, size: 18, color: '999999', italics: true })],
  }),
];

const doc = new Document({
  styles: {
    default: {
      heading1: { run: { size: 32, bold: true, color: BRAND } },
      heading2: { run: { size: 26, bold: true, color: BRAND } },
      heading3: { run: { size: 23, bold: true, color: '333333' } },
    },
  },
  sections: [{ properties: {}, children }],
});

const fileName = `Strata-Integration-User-Guide-${new Date().toISOString().slice(0, 10)}.docx`;
const desktop = join(homedir(), 'Desktop');
const buffer = await Packer.toBuffer(doc);
writeFileSync(join(desktop, fileName), buffer);
console.log(`✓ Guide written: ${join(desktop, fileName)}`);
