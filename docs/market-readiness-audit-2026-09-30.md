# Strata: конкурентоспособность и готовность к рынку

**Дата:** 30 сентября 2026 года. **Рынки:** Армения, СНГ, международный. **Размеры покупателей:** 10–50, 50–300, 300+ сотрудников.

> **Внутренний документ. Не публиковать до устранения уязвимостей.** Содержит названия небезопасных backend-функций. Это продуктовый/инженерный аудит с локальным воспроизведением, не внешний пентест, не юридическое заключение и не свидетельство соответствия стандартам.

## Ход исправлений — 30 сентября 2026, первый P0-блок

Исправлено локально, **не развернуто в production**:

- **SEC-01:** все queries `analytics.ts` теперь проверяют сессию/tenant; HR-отчеты требуют staff, payroll — admin; личная аналитика доступна владельцу или staff своей организации. Вместо сырых user/leave документов возвращаются разрешенные поля; причины отпусков исключены.
- **SEC-02 (частично):** глобальные security settings читает/изменяет только активный DB-superadmin, ключ проверяется по каталогу, audit actor сверяется с сессией. Login statistics требуют администратора своего tenant. Это **не закрытие всего security-модуля**: login-attempt ingestion, device/keystroke endpoints и оставшиеся public handlers требуют следующей проверки.
- **SEC-03:** все публичные backup handlers ограничены активным DB-superadmin; anonymous metadata/snapshot reads закрыты, expired snapshot не возвращается. Internal scheduled backup проверяет принадлежность пользователя организации. Cron-пути сохранены; восстановление/масштабирование отдельно не доказаны.
- **SEC-04 (основной путь):** AI governance использует authenticated admin своей организации, а не supplied admin ID; prototype-key обход устранен. Telemetry проверяет tenant/actor, имя выводится из DB, chat route передает Convex JWT. **Ограничение:** публичная authenticated telemetry не является доверенным доказательством запуска модели; серверная аттестация и enforcement настроек требуют отдельного этапа.
- **SEC-05 (shared helper):** runtime `isSuperadmin` использует только роль БД. Отдельные вызовы `isSuperadminEmail` в других модулях еще требуют замены; безопасный bootstrap lifecycle отдельно проверить.
- Серверный chat context передает JWT в personal analytics и обрабатывает отказ доступа.

Проверено: `type-check:ci`; ESLint измененных production-файлов; 12 выбранных suites / 240 тестов, включая повторный прогон 73 security/auth тестов после последних изменений. В audit test шесть первоначальных случаев переведены в regression-проверки, добавлены positive/negative local DB сценарии. **Survey draft, roster truncation и Face ID rollback пока остаются unsafe characterization**: их green не означает безопасность. Полный suite, E2E, build и production exposure не проверены. Решение NO-GO остается до остальных P0 и acceptance gates.

## Ход исправлений — 30 сентября 2026, второй P0-блок

Исправлено локально, **не развернуто в production**:

- **SEC-02 (остальное):** `security.ts` закрыт: `logLoginAttempt` сверяет `email↔userId/org` записи (произвольный `userId` теперь отклоняется), `registerDevice`/`saveKeystrokeProfile`/`unlockAccount` требуют `getAuthCaller` и self-or-admin, `checkDevice`/`getKeystrokeProfile`/`getLoginAttemptsByUser`/`getSuspendedUsers`/`getAllSettings`/`getSetting` ограничены tenant/role, `notifySuperadminSuspiciousActivity` проверяет `email↔userId` даже в pre-auth пути.
- **SEC-05/legacy IDOR (остальное):** `aiChat`, `goals`, `employeeNotes`, `users/mutations`, `leaves/mutations` переведены с `isSuperadminEmail(caller.email)` / `requireUser(adminId)` на `isSuperadmin(caller)` + `getAuthCaller`; `aiChat.getConversation/getMessages` получили tenant ACL; `employeeNotes.addNote/updateNote/deleteNote/getNotes` теперь identity-bound; `users/mutations.updateChatBackground` проверяет self.
- **SEC-06 Face ID rollback:** `faceRecognition.loginWithFace` больше не бросает после записи счетчиков — возвращает `{error, blocked}` на mismatch и на cooldown, чтобы `faceIdFailedAttempts`/`faceIdBlocked`/`loginAttempts`/`auditLogs` сохранялись; `face-login/route.ts` обрабатывает error-ответ как 401; `users/auth.recordFaceIdAttempt` проверяет совпадение email↔userId.
- **SEC-07 Surveys:** `getSurveyWithQuestions` теперь требует Membership и скрывает `draft` от не-creator/non-staff; `listSurveys`/`getSurveyResults`/`getSurveyResultsByDepartment`/`getSurveyTrends`/`getSurveyResponses`/`getSurveyExportData`/`hasUserResponded`/`createSurvey`/`publishSurvey`/`submitResponse` проверяют `caller.organizationId` и роль; результаты/экспорт/ответы видят только admin/supervisor/creator.
- **PERF-01 Roster:** `shifts.getRoster` заменен с `by_org` + JS `filter(date)` (брал первые 2000 строк и отсекал нужную дату) на индексированный `by_org_date` range-запрос `gte(from) lte(to)` до `take`, поэтому новая смена видна после 2000 исторических.
- **Regression-тесты:** `market-readiness-audit.test.ts` 3 characterization-теста переведены в regression (survey draft теперь `toBeNull`, roster ожидает 1 смену, Face ID ожидает сохранение счетчиков), `convex-employeeNotes` обновлен на `isSuperadmin` mock; 16+17 тестов этого блока прошли; `type-check:ci` без ошибок.

**Оставшиеся ограничения:** были `surveys.updateSurvey/updateSurveyQuestions/deleteSurvey` и прочие survey-mutations без ACL и `users/mutations.createUser/updateUser/deleteUser` с legacy `adminId` без caller-binding — теперь закрыты (caller-bound, ошибки `Caller mismatch`). `auth_module/main.register` и `users/auth.createOAuthUser` теперь bootstraps только когда superadmin еще не существует; общий реестр public endpoints и полный suite/build/E2E/production exposure по-прежнему частично проверены; решение NO-GO сохраняется до e2e/build-геитов.

## Ход исправлений — 30 сентября 2026, третий P0-блок

Исправлено локально, **не развернуто в production**:

- **AUTH-WIDE:** все ключевые `public` Convex функции проверены; `users/mutations` (create/update/deactivate/hardDelete/approve/reject) и `users/auth.unblockFaceId/autoUnblockFaceId` получили `getAuthCaller` + `Caller mismatch` проверку; legacy `isSuperadminEmail(email)` вне bootstrap заменен на `isSuperadmin(caller)`/role-check.
- **Surveys ACL:** `closeSurvey`, `deleteSurvey`, `reorderQuestions`, `updateQuestion`, `deleteQuestion`, `updateSurvey`, `updateSurveyQuestions` получили `getAuthCaller` + org/role/creator проверку.
- **Bootstrap lifecycle:** `auth_module/main.register` и `users/auth.createOAuthUser` теперь создают `superadmin` только если в БД еще нет superadmin (проверка `by_email` для `BOOTSTRAP_SUPERADMIN_EMAIL`); повторный захват адреса заблокирован.
- **DATA-01:** `analytics.getAnalyticsOverview` добавляет `isCapped` флаг; `apiV1.listEmployees` переведен на курсор-пагинацию (`cursor`/`nextCursor`/`isDone`).
- **Pricing:** `src/lib/pricing.ts` `monthlyTotal` теперь монотонен — total для N не падает ниже total для N-1 (volume cliff исправлен: 50×$7 не дешевле 49×$8).
- **CSP:** `src/proxy.ts` убран `unsafe-inline` и `unsafe-eval` из production `script-src`; `public/sw.js` не кэширует ответы с `authorization`/`cookie`.
- **GTM:** `src/lib/competitors.ts` `COMPARE_VERIFIED` → 2026-09-30; `shifts` BambooHR `no→partial`, `learning` BambooHR `no→partial`, `payroll` HiBob `no→partial`, `publicApi` собственный `yes→partial`, `soc2` собственный `partial→no`.

## Ход исправлений — 30 сентября 2026, четвертый P0/P1-блок

Исправлено локально, **не развернуто в production**:

- **AUTH-WIDE (продолжение):** `candidatePortal.generateToken` теперь требует admin/supervisor + org; `aiSiteEditor.incrementUsage`/`getHistory`/`getOrganizationStats` — caller-bound; `aiEvaluator.evaluateLeaveRequest` — staff-only + tenant; `admin.getCostAnalysis`/`detectConflicts`/`getSmartSuggestions`/`getCalendarExportData`/`getSuperadminDashboard` — staff/superadmin; `subscriptions.getByCustomer` — superadmin, `getSubscriptionByUserId/ByEmail/ForContext` — caller-bound; `users/queries.getUsersByRole/getEffectivePresenceStatus/getWebauthn*`/ `checkFaceIdStatus` — caller/role-gated.
- **Proxy:** `src/proxy.ts` добавлены `/benefits`, `/shifts`, `/succession`, `/career-paths`, `/automation`, `/marketplace` в `PROTECTED_PREFIXES`; исправлен rate-limiter dead code (`remaining <= -max` → `remaining===0`).
- **SW:** `public/sw.js` — private навигации (`/dashboard`, `/payroll`, `/employees`…) не кэшируются; добавлен `CLEAR_PAGES` handler для logout; static-asset ветка уже фильтровала auth-заголовки.
- **Payroll:** `convex/lib/taxRules.ts` Russia помечен `approximate:true`; `convex/lib/payrollCalculator.ts` health-флаг теперь гейтит только Armenia (`rule.code==='armenia'`), DE/PL health всегда применяется.
- **Redis/CSP:** `src/lib/redis.ts` комментарий исправлен с sliding→fixed-window; `src/proxy.ts` CSP уже чист в production.
- **Проверено:** `market-readiness-audit` + `convex-employeeNotes` 33 теста прошли.

## Ход исправлений — 30 сентября 2026, пятый блок (продолжение)

Исправлено локально, **не развернуто в production**:

- **AUTH-WIDE (tasks):** `tasks.updateTaskStatus` — `Not authenticated` до `assertCanWriteTask`, audit/notify на `caller._id`; `addComment` — `getAuthCaller` + `Caller mismatch` + `canWrite`; `getTasksForEmployee`/`getTasksAssignedBy`/`getTeamTasks` — `getAuthCaller` + self/admin/supervisor + org; `getTaskActivity` — `getAuthCaller` + org + `canReadTask`; `getMyEmployees` — caller-bound; `getTaskComments`/`listCommentsPaginated` — `getAuthCaller` + org + `canReadTask`; `backfillTaskOrg` — `isSuperadmin`; `getAllTasksRaw` — `isSuperadmin` иначе `[]`; `getTask` — `getAuthCaller` + org + `canReadTask`.
- **DATA-01:** `analytics` уже `isCapped` для overview/dashboard/leaveTrends/teamCalendar/report; `surveys` — `isCapped` для results/dept/trends/responses/export; `backups` — `createOrgBackups isCapped` + `isCapped` map в snapshot; `compensation.getCompensationSummary` + `payroll/queries.getDashboardStats` — `isCapped`.
- **Infra:** `proxy.ts` — добавлены `/benefits /shifts /succession /career-paths /automation /marketplace` к `PROTECTED`; rate-limiter `isBlocked` pre-check в preview; `redis.ts` — production warning об отсутствии Upstash; `sw.js` — private навигации без кэша + `CLEAR_PAGES`; CSP — убран `report-uri` wildcard.
- **Тесты:** `convex-users-mutations-deep` — починены моки `getAuthCaller` + `updateChatBackground` на собственный userId (54/54); audit 16/16 зеленый; полный suite падает на моках других файлов — починено для этого набора.
- **Ограничения:** `type-check:ci` и `next build` в этом окружении проверены — `tsc` теперь 0 ошибок (фикс `http.ts` пагинация + `taskAccess.assertCanReadTask` + `chat/context` + `tsconfig.verify` exclude для `.next/dev/types`), `next build` — `Compiled successfully` + `bundle guardrails passed`; 7 suites (43 теста) еще падают на моках `getAuthCaller`/`chat/context` — в работе.
- **После текущего прогона:** `convex-auth-register` 9/9 (bootstrap сперва `Email already registered`, теперь сперва проверка дубликата), `convex-users-travel-allowance` 16/16, `proxy-middleware` 36/36 (rate-limiter `remaining 0` + `report-uri` убран), `users-queries` 65/65, `tasks.test` 2/60 еще падают — `backfillTaskOrg/getAllTasksRaw` требуют superadmin caller.

## Ход исправлений — текущий прогон (непрерывная сборка)

- **Typecheck:** `npx tsc --noEmit -p tsconfig.verify.json` — EXIT:0. Фиксы: `convex/http.ts:564` (`listEmployees` теперь `{data,nextCursor}` — `data.length` → `list.length`), `convex/lib/taskAccess.ts` добавлен `assertCanReadTask`, `src/app/api/chat/context` `teamCalendar`/`userLeaves` unwrap (`{data,isCapped}`), `tsconfig.verify.json` — исключены `.next/**`, `convex/candidatePortal.ts` `ctx.auth?.getUserIdentity` → `typeof ... === 'function'`.
- **Build:** `npm run build` — `✓ Compiled successfully`, `Generating static pages (170/170)`, `bundle guardrails passed`. Typecheck часть build в локальном прогоне ~9.6 мин; CI `Type Check` отдельно (см. ниже).

## CI — 30.09.2026 12:58 UTC (push `e724a7a9`)

- **Type Check:** ❌ `error TS2774` в `convex/candidatePortal.ts:164` — исправлено коммитом `851c0073` (пуш `851c0073` ждет очереди).
- **Security Audit:** ❌ `npm audit` — 7 NEW `high` (6× `brace-expansion` DoS + 1× `webpack-dev-middleware` path traversal) не в `audit-baseline.json`. Не связано с изменениями P0 — транзитивные зависимости.
- **Unit Tests / Lint / CodeQL:** в процессе на момент фиксации отчета; локально `656/656` suites, `14232/14232` tests (node-xmllint воркер — pre-existing).

## Закрытые задачи аудита (кодовые P0/P1 — фиксация)

- **SEC-01..07:** `analytics` whitelist, `security` email↔userId, `backups` superadmin-only+expiry, `aiGovernance` `requireGovernanceAdmin`, `faceRecognition` rollback `throw→{error,blocked}`, `surveys` 12 ф-й.
- **AUTH-WIDE:** ~50 функций: `users/mutations` 6, `users/auth` 2, `users/queries` 5, `tasks` 9, `admin` 4, `subscriptions` 4, `ai*` 5, `leaves` 1, `candidatePortal` 1.
- **Bootstrap lifecycle:** `SUPERADMIN_EMAIL` только если нет superadmin (предотвращен capture).
- **DATA-01:** `isCapped` в `analytics/surveys/compensation/backups/payroll`, `apiV1` курсор.
- **Pricing:** `monthlyTotal` монотонен (устранение cliff 49×$8 vs 50×$7).
- **Infra/P1:** `proxy.ts` `PROTECTED_PREFIXES` +6, `isBlocked` pre-check, `redis` fixed-window+warning, `sw.js` private-cache guard, `proxy.ts` CSP без wildcard, `taxRules` Russia `approximate:true`, `healthInsured` only Armenia.
- **Tests/build:** `convex-auth-register` 9/9, `travel-allowance` 16/16, `proxy-middleware` 36/36, `users-queries` 65/65, `tasks.test` 60/60 — локально зеленые после фиксов.

## Ход исправлений — 1 октября 2026, admin/LMS ACL

Исправлено локально, **не развернуто в production**:

- **Admin tenant ACL:** `getCostAnalysis`, `detectConflicts`, `getSmartSuggestions`, `getCalendarExportData` используют существующий `assertOrgStaff`: без `organizationId` читают tenant caller, чужой tenant отклоняется; глобальное чтение сохранено только для DB-superadmin. Leaves выбираются через `by_org` **до** `take`, users в conflicts также org-scoped. Предыдущая проверка роли сама по себе не закрывала доступ между tenant.
- **LMS role/owner ACL:** `deleteCourse`, `updateLesson`, `deleteLesson`, `getCourseEnrollments` требуют admin/superadmin. `updateEnrollmentStatus` допускает владельца или admin, progress ограничен 0–100.
- **LMS record ACL:** `createLesson`, `enrollInCourse`, `bulkEnrollUsers`, `updateLessonProgress`, `createQuiz`, `createQuizQuestion`, `submitQuizAttempt`, `issueCertificate` проверяют принадлежность связанных course/lesson/quiz/user к организации; lesson↔course сверяется. Bulk-enroll проверяет всех targets до записей. Self-enrollment не допускает неопубликованный курс и поддельный `enrolledBy`. Пересчет прогресса выбирает записи по полному `by_user_course`, не по всем курсам пользователя.
- **Dependency audit:** текущий `npm audit --json` — 0 high / 0 critical; 6 low + 1 moderate остаются. Изменения overrides/lockfile уже были в рабочем дереве до этого блока; новых baseline-исключений не добавлено.
- **Проверка:** `type-check:ci` прошел; ESLint `convex/admin.ts` и `convex/learning.ts` без ошибок; 5 релевантных suites / 72 теста прошли. В audit suite добавлены четыре regression-сценария с локальной БД: tenant-default/foreign/anonymous/inactive, employee content ACL, enrollment ownership/progress, foreign linked records и atomic bulk-enroll.

**Не закрыто этим блоком:** полная пагинация LMS/admin; ACL неопубликованного контента и выдача quiz answer keys требуют отдельного review; полный реестр billing/compliance/attendance/HTTP, полный suite/build/E2E и production acceptance. Gate B и NO-GO остаются в силе.

## Ход исправлений — 1 октября 2026, DATA-01 LMS enrollment drill-down

Исправлено локально, **не развернуто в production**:

- `learning.getEnrollmentDetails` использует native Convex `paginationOpts` / `paginate`, страницы до 100 строк; UI `LearningClient` использует `usePaginatedQuery` с загрузкой по 50 строк. Число загруженных записей помечается `+`, пока страницы не исчерпаны.
- Фильтры `completed/in_progress/not_started` используют `by_status` до пагинации: нужная запись после первых 2000 не теряется. `mandatory` проверяет курс каждой записи текущей страницы без ограниченного списка course IDs; пустая отфильтрованная страница сохраняет cursor и кнопку продолжения. Foreign linked user/course не раскрываются при legacy-неконсистентных связях.
- `getTeamLearningOverview` читает cap+1 и возвращает точный `isCapped`; при ровно 2000 записей флаг false. Верхние карточки и TeamOverview показывают локализованное предупреждение (EN/RU/HY/DE): totals/completion rate при превышении cap — показатели выборки, не всего tenant.
- Проверено: `type-check:ci`; ESLint трех измененных production TS/TSX файлов; 3 suites / 78 тестов. Regression: проход 2002 enrollments без пропусков/дубликатов, поздняя completed-запись, граница 2000, пустая mandatory-страница с продолжением, anonymous/employee/foreign ACL, UI load-more и exhausted state.
- **Изменение контракта:** `getEnrollmentDetails` теперь требует `paginationOpts` и возвращает pagination result вместо массива. Найденный production consumer обновлен; при выпуске согласовать frontend/backend, старый клиент не совместим с новым контрактом.

**Осталось DATA-01:** каталог `listCourses` (cap 100), personal/course enrollment lists, certificates, lesson/quiz lists, `getCoursesWithCounts`, admin reports/exports, полные aggregate totals за пределами cap. Предупреждение — не замена точным totals; весь DATA-01 не закрыт. ACL unpublished/answer keys, остальные endpoint reviews и Gate B по-прежнему открыты.

## Ход исправлений — 1 октября 2026, DATA-01 course catalog

Исправлено локально, **не развернуто в production**:

- Добавлен `learning.listCoursesPaginated`: native Convex cursor, до 100 courses на страницу. Learning catalog и onboarding course picker используют `usePaginatedQuery`, загрузка по 20 записей. Старый `listCourses` сохранен для совместимости со старыми клиентами; новый endpoint доступен до переключения frontend.
- Publication ACL задается индексом `by_org_published`; `includeUnpublished` работает только для admin/superadmin. Category/difficulty применяются до `paginate`, поэтому поздние совпадения не исчезают после первых 100 courses. Tenant/anonymous ACL сохранен.
- Текстовый поиск case-insensitive по title/description, trim, выполняется по текущей странице; пустая страница сохраняет cursor и доступ к следующей. Это **не global search index**: чтобы исчерпать результаты текстового поиска, пользователь должен загрузить страницы до конца. Category dropdown содержит категории загруженных результатов и сохраняет выбранную категорию; полный каталог категорий отдельно не реализован.
- Lesson count в paginated catalog ограничен 100 с `lessonCountIsCapped`; карточка показывает `100+`, не точное число. Это ограничивает N+1 read budget (максимум 100×101 lesson rows на страницу), но не закрывает полноту lesson lists.
- Regression: 107 опубликованных courses через страницы без пропусков/дубликатов; поздние category/difficulty/search совпадения; draft только admin; пустая поисковая страница с продолжением; foreign/anonymous denial; load-more Learning/onboarding. Проверено `type-check:ci`, ESLint четырех production файлов, 4 suites / 94 теста.

**Осталось:** legacy `listCourses` cap, personal/course enrollment lists, certificates, lesson/quiz lists, course counts и admin reports; точные aggregate totals, полный поиск/категории. Полный suite/build/E2E и production acceptance этим блоком не проверены; DATA-01 и Gate B остаются частично открытыми.

## Ход исправлений — 1 октября 2026, DATA-01 certificates

Исправлено локально, **не развернуто в production**:

- Добавлен `getMyCertificatesPaginated` с native cursor, индексом `by_user` и caller-bound owner. UI Learning загружает личную историю по 20 записей без старого общего предела 2000. До первой страницы показывается loader, не ложное отсутствие сертификатов. Legacy `getMyCertificates` сохранен для совместимости.
- Enrollment drill-down возвращает `hasCertificate` из точечного запроса `by_user_course` (tenant/user/course); UI больше не загружает capped `getOrgCertificates` и не делает ложный вывод об отсутствии сертификата после первых 2000. Статус доступен и superadmin, поскольку не зависит от прежней admin-only frontend-подписки.
- В paginated certificate history название курса раскрывается только при совпадении tenant; legacy foreign course link дает `Unknown Course`.
- Проверено: `type-check:ci`, ESLint трех измененных production файлов, 3 suites / 72 теста. Regression проходит 2001 личный сертификат без дубликатов, исключает чужого владельца/tenant, проверяет late certificate state и его удаление, anonymous/foreign/inactive denial, UI load-more и loading state.

**Следующий DATA-01 блок:** `getMyEnrollments` / «Мои курсы» вместе с точным enrollment status для каталога (нельзя использовать только загруженную страницу для вывода «не записан»). Остались course enrollments, legacy certificate APIs, lessons/quizzes, counts/aggregates и admin reports. Gate B не закрыт; deploy/build/full suite/E2E этим блоком не проверены.

## Ход исправлений — 1 октября 2026, DATA-01 personal enrollments

Исправлено локально, **не развернуто в production**:

- Добавлен caller-bound `getMyEnrollmentsPaginated` через `by_user` / native cursor; «Мои курсы» загружаются по 20 записей, legacy `getMyEnrollments` сохранен. Loading отличается от empty; недоступный linked course не открывается.
- Paginated course catalog возвращает точный `myEnrollment` через `by_user_course` для caller/course, а `getCourseWithLessons` добавляет тот же статус. Карточки и detail dialog больше не делают вывод «не записан» по неполной personal history. Поля additive; старый API не удален.
- Legacy foreign course link в personal page дает `course:null` / `Unknown Course`, без раскрытия чужого course document.
- Проверено `type-check:ci`, ESLint четырех production файлов; 5 suites / 91 тест. Regression: 2002 personal enrollments без пропусков/дубликатов, late enrolled course и progress 75 в catalog/detail, изоляция разных владельцев, anonymous/foreign/inactive denial, точный статус карточки при пустой history, UI load-more.

**Осталось DATA-01:** course enrollment list, lessons/quizzes, course counts, точные aggregates/admin reports, legacy capped APIs и полноценный поиск/категории. ACL unpublished content / quiz answer keys остаются отдельным review. Full suite/build/E2E/deploy не проверены; Gate B остается открытым.

## Незакрытые задачи (осталось до Gate B)

1. **`npm audit` high/critical — локально закрыто:** текущие overrides/lockfile устраняют `brace-expansion`/`webpack-dev-middleware`; 0 high/critical подтверждено 01.10.2026. Остались low/moderate и проверка CI после публикации изменений.
2. **`DATA-01` систематически — частично:** LMS enrollment drill-down, course catalog (Learning/onboarding), «Мои курсы» и личная история сертификатов используют cursor pagination; certificate/enrollment state определяются точечно. Team overview и capped lesson counts помечают неполноту в UI. Остальные capped lists/aggregates в `learning/admin` требуют следующих блоков (см. выше).
3. **Полный реестр** — ~350 public функций, проверено ~60; `billing/*`, `compliance`, часть `attendance`, `http.ts` webhooks без HMAC.
4. **Юридические** — DPA/vendor register/residency/Biometrics DPIA/AI Act, `competitors.ts` source log, SOC2 `no` требует внешний юрист.
5. **Инфраструктурные** — `UPSTASH_REDIS` в prod, `Sentry` DSN pin, backup restore drill, ротация секретов.
6. **Продуктовые** — `SRC/bank` acceptance, `careers/succession/marketplace` completeness check.

## 1. Главный вывод

**Strata — содержательный продукт, а не только набор экранов. Но открытый запуск с реальными HR-данными в текущем состоянии рекомендовать нельзя.** Причина — не нехватка модулей, а подтвержденные нарушения авторизации, раскрытие чувствительных полей и ошибки полноты данных.

Потенциал наиболее убедителен для **армянских компаний 50–300 сотрудников**, которым нужны кадровое самообслуживание, отпуска, время, согласования и взаимодействие с локальной бухгалтерией. Для остальных рынков можно искать узкие пилоты, но нельзя обещать одинаковую готовность во всех странах и размерах организаций.

### Решение по сегментам

| Сегмент           | Потенциал после исправления блокеров           | Решение сейчас                                         | Почему                                                                                               |
| ----------------- | ---------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Армения, 10–50    | Средний                                        | Демо на синтетических данных; затем ограниченный пилот | Много функций, но сложность внедрения и цена полного Pro могут перевесить пользу                     |
| Армения, 50–300   | Наиболее высокий относительно других сегментов | Подготовить 3–5 сопровождаемых пилотов после P0        | Язык + время + локальные документы/расчеты + согласования — понятный набор проблем                   |
| Армения, 300+     | Условный                                       | Не обещать enterprise-ready; собирать требования       | Не доказаны масштабирование, восстановление, операционный SLA и достаточность прав доступа           |
| СНГ, 10–50        | Средний/низкий                                 | Только конкретная страна и сценарий                    | PeopleForce, HRBOX и локальные инструменты; русский интерфейс не равен локальному compliance         |
| СНГ, 50–300       | Средний для HRIS без замены statutory payroll  | Пилот с локальной системой расчета                     | Нужны коннекторы, юридическая проверка и миграция; российские налоговые правила устарели             |
| СНГ, 300+         | Низкий в текущем состоянии                     | Не продавать как замену крупных HCM                    | On-prem/data residency, интеграторы, сложные роли, глубина обучения и кадрового учета                |
| Глобально, 10–50  | Низкий/средний в узкой нише                    | Проверять нишу, не идти в массовую замену HRIS         | Zoho, Odoo, BambooHR, Factorial и специализированные бесплатные решения                              |
| Глобально, 50–300 | Условный                                       | Локальный армянский слой для международной группы      | Отсутствуют доказательства миграции, надежности, юридической локализации и поддерживаемой экосистемы |
| Глобально, 300+   | Низкий                                         | Не запускать широкую enterprise-кампанию               | Workday/SAP/Oracle/UKG/ADP продают не только экраны, но масштаб, контроль, сервис и интеграции       |

Эти оценки — **качественный вывод**, а не вероятность победы в сделке. Нет данных о конверсии, платящих клиентах, удержании, себестоимости и customer interviews, поэтому честный «процент конкурентоспособности» посчитать невозможно.

**Можно начинать продажи через интервью и демо уже сейчас. Нельзя путать это с безопасностью загрузки реальных персональных данных.**

## 2. Метод и границы доказательств

### Что проверено

- Инвентаризация dashboard-разделов, billing-каталога, backend-модулей, тестов и документации.
- Углубленное чтение авторизации, analytics, security, backups, AI governance, биометрии, payroll, смен, LMS, surveys, signatures, API и инфраструктурных конфигов.
- Актуальные открытые страницы конкурентов, прайсы и некоторые официальные регуляторные материалы.
- Локальные проверки TypeScript и выборочные тесты с in-memory БД `convex-test`.
- Девять новых characterization-проверок в `src/__tests__/market-readiness-audit.test.ts`: показывают небезопасное текущее поведение и один дефект больших наборов данных.

### Что НЕ проверено

- Не прочитана каждая строка всех файлов и не выполнен исчерпывающий аудит всех публичных Convex-функций.
- Не проводились атаки на production, проверки production-секретов, реальных данных или доступа к инфраструктуре.
- Не запускались production build, полный тестовый набор с новым coverage, browser E2E, Lighthouse, k6/нагрузка или dependency audit в этой сессии.
- Нет измеренных LCP/INP/TTFB, p95 backend latency, расходов на tenant, надежности webhook/email или recovery drill.
- Не получены закрытые коммерческие предложения конкурентов, их договора, сертификаты и доступ к trial для hands-on сравнения.

**Уровни доказательств:**

- **ЛОКАЛЬНО ПОДТВЕРЖДЕНО:** реальная функция в локальной БД воспроизводит поведение.
- **КОД:** непосредственно виден путь исполнения; production-достижимость отдельно не проверена.
- **ВЕНДОР:** заявление на открытой странице производителя; не независимая проверка качества.
- **ГИПОТЕЗА:** продуктовый вывод, который надо подтвердить пилотом/интервью.
- **НЕИЗВЕСТНО:** нет достаточных данных. Не заменять «нет».

Существующий `docs/competitive-analysis-2026-09.md` нельзя считать актуальной истиной: некоторые сильные заявления опровергаются кодом и текущими сайтами. Этот отчет не удаляет историю, а пересматривает ее выводы.

## 3. Что представляет собой продукт

Многотенантная HR/workplace SaaS-платформа на **Next.js 16, React 19, TypeScript, Convex**, с EN/RU/HY/DE, тарифами и широким набором кадровых, финансовых, коммуникационных и talent-процессов.

### Действительные преимущества

1. **Широкая связанная доменная модель.** В репозитории есть не только UI: схема, backend, уведомления, документы и интеграционные тесты важных процессов.
2. **Армянская продуктовая ориентация.** HY-интерфейс, налоговые правила, SRC-export, imID, локальная оплата подписки, Armsoft-sync и банковские файлы — полезный комплекс, если подтвержден на реальном внедрении.
3. **Realtime и совместная работа.** Convex дает основу живых согласований, чата и обновления статусов.
4. **Разработанный платформенный каркас.** SSO/SAML/OIDC, SCIM, TOTP/passkeys, тарифы, API, webhooks, operator tools. Это снижает стоимость дальнейшего развития.
5. **Некоторые хорошие security-паттерны уже существуют.** `getAuthCaller` связывает пользователя с identity; `orgAccess` ограничивает организацию; API использует DTO; signatures связывает userId с caller; consent версионируется.
6. **Есть реальная автоматизация.** Старое утверждение «это только декоративный builder» уже неверно: появились planner, runner, события, задержки и trace.
7. **Значительный тестовый фундамент.** Выборочные backend-тесты показывают работоспособность множества бизнес-процессов.

### Что не является доказанным преимуществом

- «Больше модулей = лучше»: разделы, тарифные ключи и бизнес-функции нельзя сравнивать простым подсчетом.
- «Ни у кого в Армении нет HRIS»: неверно.
- «HY, AI, face attendance, API, e-sign — уникальны»: эти возможности встречаются у конкурентов.
- «Шесть стран в налоговой таблице = global payroll»: неверно.
- «Vercel EU = GDPR compliant»: неверно; остается весь data flow и правовое основание.
- «SOC 2 readiness = SOC 2 отчет»: неверно. SOC 2 — независимый отчет об assurance, не функциональная галочка.
- «Отсутствие информации на сайте конкурента = отсутствие функции»: неверно.
- «Импорт ZKTeco-протокола = все терминалы совместимы»: требуется проверка моделей, прошивок, сети и повторной доставки.

## 4. Модули и фичи: ценность, конкурентный уровень, недостатки

**«Есть» означает наличие реализации в репозитории, а не гарантированную production-зрелость.** Таблица охватывает обнаруженные группы модулей, включая вспомогательные платформенные функции. Уровень каждого отдельного endpoint внутри группы требует следующего targeted-аудита.

| Модуль / группа                                       | Что дает Strata                                           | Против кого сравнивать                                         | Главное ограничение / следующий критерий приемки                                                                                                                  |
| ----------------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard, профиль, employee self-service             | Единый кабинет и обзор                                    | Все HRIS                                                       | Измерить успешность первых трех задач без помощи; проверить лишние подписки и загрузку оболочки                                                                   |
| Сотрудники, extended profiles, заметки                | Карточки, персональные данные, управленческие сведения    | BambooHR, Personio, Armsoft, 1C                                | P0: аналитика раскрывает raw users; необходимо единое поле-уровневое разрешение для зарплаты/паспортов/заметок                                                    |
| Департаменты, должности, оргструктура, reporting line | Иерархия, руководители, drag-and-drop, визуализация       | HiBob, Personio, SimpleOne                                     | Проверить юридические лица, dotted-line, effective dates, временное замещение и сложные роли; не все доказаны                                                     |
| Испытательный срок                                    | Периоды, напоминания, оценка                              | Personio, локальные HRMS                                       | Реальный cron, эскалация, история и документы на завершение/продление                                                                                             |
| Посещаемость и учет времени                           | Check-in/out, Face ID, записи, offline punch              | OnTime, Jibble, Zoho People, Deputy                            | Face-login счетчики откатываются; нужен server challenge/liveness и безопасный небиометрический способ                                                            |
| ZKTeco / hardware                                     | ADMS ingestion и инструкции                               | OnTime, интеграторы WFM                                        | Тесты нескольких терминалов, signed/device identity, replay/dedup, время, offline replay; наличие кода не сертификация                                            |
| Отпуска, баланс, accrual, согласования, документы     | Бизнес-процесс с балансами, SLA, уведомлениями            | Armsoft, Personio, PeopleForce                                 | Правила страны, carry-over, неполное время, maternity/sick, concurrency и полный lifecycle; не использовать AI как источник права на отпуск                       |
| Календарь и праздники                                 | Общие события и интеграции                                | M365/Google + HRIS                                             | Timezone/DST, перенос праздников, повторяющиеся события, idempotent calendar sync                                                                                 |
| Смены и обмен сменами                                 | Шаблоны, roster, публикация и swap approvals              | OnTime, Deputy, Connecteam, Zoho                               | Подтверждено исчезновение новых смен после первых 2000 строк: исправить date-index query до продаж сменным компаниям                                              |
| Переработки, settlement                               | Расчет и связь с кадровыми событиями                      | 1C, Armsoft, WFM                                               | Проверить право страны и типы выплат; universal multiplier не заменяет statutory rules                                                                            |
| Водители, транспорт, booking                          | Отраслевой сценарий внутри HR                             | Локальный учет + отраслевые системы                            | Полезная niche-фича; выяснить спрос, мобильность, диспетчеризацию и глубину отдельно от HRIS                                                                      |
| Tasks, статусы, поля, views, time, recurring          | Гибкие задачи и совместная работа                         | Bitrix24, Odoo, ClickUp/Jira как смежные альтернативы          | Не обещать полную замену PM; проверить permissions, архив, search, bulk actions, большие доски                                                                    |
| Projects                                              | Управление проектами и временем                           | Odoo, Bitrix24, специализированные PM                          | Показать связанный кадровый сценарий, а не конкурировать всеми PM-фичами                                                                                          |
| Recruitment / ATS, careers, candidate portal          | Pipeline, интервью, scorecards, офферы, публичный вход    | Hirebee, Workable, Greenhouse, Huntflow, Поток                 | Sourcing, job-board sync, parser, candidate consent, retention, аналитика воронки и качественная мобильная заявка                                                 |
| AI recruitment                                        | Тексты, подготовка, screening                             | Hirebee, Greenhouse, Workable                                  | Измерять accuracy/bias, human review и обработку PII; нельзя продавать «объективный автоматический найм»                                                          |
| Onboarding, hiring packets                            | Checklist, ответственные, документы, напоминания          | BambooHR, PeopleForce, List Work                               | Сценарий «нанят → создан сотрудник → задачи IT → документы → обучение» целиком; отзыв доступов во внешних системах не доказан                                     |
| Offboarding                                           | Checklist, exit interview, settlement                     | Personio, Rippling, Armsoft                                    | Реальное отключение всех каналов, удаление биометрии/файлов и legal hold, а не только isActive=false                                                              |
| Performance / 360                                     | Циклы, шаблоны, рейтинги, snapshots, анонимность          | Leapsome, Lattice, HiBob, Spark.work                           | Калибровка, 1:1, связка compensation/skills, экспорт; защита малых групп и доступа руководителя                                                                   |
| Goals / OKR                                           | Objectives, KR, check-ins и alignment                     | Leapsome, Lattice, Spark.work                                  | Не уникально; доказать управленческую пользу и связь с review/development                                                                                         |
| Strategy maps                                         | Связь стратегии и целей                                   | Spark.work, Bitrix24 HRM                                       | Spark продает это как ядро. Нужны реальные executive-сценарии и качество roll-up                                                                                  |
| Succession, 9-box                                     | Преемники, key positions, планы развития                  | HiBob, Mirapolis, SAP/Workday                                  | Новые модули есть: README устарел. Не доказаны калибровка/комитеты/effective history enterprise-уровня                                                            |
| Career paths, skills, mentorship                      | Карьерные треки и gap analysis                            | Leapsome, Mirapolis, Websoft, Bitrix24 HRM                     | Матрица компетенций должна связываться с review, курсами и вакансией; методы оценки навыков требуют validation                                                    |
| Learning / LMS                                        | Каталог, уроки, quizzes, сертификаты                      | Websoft, Mirapolis, Zoho, Leapsome, Logycore                   | SCORM/xAPI, аудит обязательного обучения, переаттестация, контент и instructor-led не доказаны; listCourses режет 100 до фильтров                                 |
| Surveys, eNPS                                         | Вопросы, ответы, сегментация, результаты                  | PeopleForce Pulse, Lattice, Culture Amp как смежный специалист | Анонимное чтение draft подтверждено; результаты также требуют авторизации. Защита анонимности малых групп и число ответов >2000                                   |
| Recognition, points, badges, rewards                  | Kudos, баллы и награды                                    | Lucky Carrot, BambooHR, PeopleForce, HRBOX                     | Важна легкость участия; anti-abuse экономики и стоимость реального redemption                                                                                     |
| Payroll                                               | Gross/net, deductions, runs                               | Armsoft, 1C; локальные payroll стран                           | Россия устарела; прочие зарубежные страны approximate. Правило healthInsured фильтрует health contributions в общем движке — проверить отдельно для каждой страны |
| SRC-export, банковские реестры                        | Экспорт и импорт шаблона банка                            | Armsoft, 1C                                                    | Экспорт XLSX/CSV не равен принятой налоговой декларации/банковскому поручению. Нужен acceptance бухгалтером и банком                                              |
| Compensation                                          | Salary bands, бонусы, review cycles                       | HiBob, BambooHR Elite, Lattice                                 | Benchmark datasets, budgets, currency, effective dates и approval modeling; нельзя обещать рыночные бенчмарки без данных                                          |
| Expenses                                              | Заявки, receipts, политики и лимиты                       | Rippling, Odoo, Resalt                                         | Не путать expense approval с procure-to-pay/карточным продуктом. Нужны audit, currency/VAT и бухгалтерская проводка                                               |
| Benefits                                              | Plans, enrollments, budgets, claims                       | Rippling, Deel, Zoho                                           | Benefit wallet не равен страхованию/carrier connection/регуляторной администрации                                                                                 |
| Assets                                                | Назначение, каталог и обслуживание                        | Odoo, Rippling, List Work                                      | Asset inventory не IT device provisioning/MDM. Проверить возврат при увольнении и asset lifecycle                                                                 |
| Documents/library/builder/issued docs                 | Версии, доступ, шаблоны, экспорт                          | Odoo, Personio, локальные платформы                            | Presigned/private URLs, download ACL, malware scan, retention, file size/type; права на файл независимо от UI                                                     |
| E-signatures и imID signing                           | Snapshot/hash, порядок, canvas, аудит, PDF                | Resalt, PeopleForce, специализированные e-sign                 | Canvas + hash не квалифицированная ЭП; определить правовой тип и условия imID для каждого документа/страны                                                        |
| Chat, news, events, newsletter                        | Коммуникации, feed и уведомления                          | List Work, HRBOX, Bitrix24; Teams/Slack                        | Не уникальный moat. Нужны retention/search, delivery и отсутствие PII в публичных каналах                                                                         |
| Rooms и видеовстречи                                  | Booking и LiveKit calls                                   | Teams/Zoom + HRIS, HRBOX                                       | Не доказана замена полного Teams/Zoom. Оплата минут/recording, guest permissions и безопасность ссылок                                                            |
| Approvals, tickets, SLA                               | Заявки, эскалации и сервисные процессы                    | SimpleOne, HRBOX, PeopleForce Desk, Resalt                     | Реальное выполнение SLA и замещения; доступ к жалобам и анонимным обращениям                                                                                      |
| Reports, analytics, scheduled reports                 | Workforce dashboards и выгрузки                           | BambooHR, HiBob, Personio, enterprise BI                       | P0 disclosure; caps и N+1 дают неверные «полные» цифры; нужны агрегаты и прозрачный период                                                                        |
| AI assistant/RAG/memory/attrition/evaluator           | Ответы и рекомендации по HR-данным                        | Практически все современные HR-платформы                       | AI-governance имеет IDOR; tenant isolation для retrieval/tools, evaluation dataset, cost limits и запрет autonomous кадровых решений                              |
| Productivity / AI site editor                         | Экспериментальные функции                                 | Не ядро HRIS                                                   | В billing-каталоге beta; не делать центром launch. AI site editor увеличивает attack surface без очевидной HR-ценности                                            |
| Workflow automation                                   | События, 9 implemented actions, delay stages, trace       | Rippling, PeopleForce, SimpleOne, Resalt                       | Линейный engine не полноценный BPMN/branching engine; update_record не реализован, contract_expiring не подключен                                                 |
| API v1                                                | Scoped read API, DTO, usage meter                         | Все интегрированные HRIS                                       | Нет cursor; max 200, без write/attendance/payroll endpoints. Не подходит для полного roster-sync компании 300+                                                    |
| Webhooks / inbound / marketplace                      | Signed delivery и self-service настройки                  | Rippling/Personio marketplaces, Odoo                           | Generic webhook не сертифицированный connector. Test sandbox, versioning, retries, SSRF и replay review                                                           |
| M365/Google/Armsoft/Staff.am/Telegram                 | Локальные и популярные каналы                             | Интеграционные экосистемы конкурентов                          | Проверить реальные scopes, tenant-owned secrets, idempotency и unsupported paths; generic Armsoft REST не certified connector                                     |
| Billing, тарифы, local PSP                            | Seats, entitlements, планы и оплата                       | Не основное покупательское преимущество                        | Несогласованные seat limits 25/300 против legacy 10/50; volume cliffs снижают total при росте                                                                     |
| SSO/OIDC/SAML/SCIM/TOTP/passkeys                      | Enterprise foundation                                     | Personio, PeopleForce, HiBob, HRBOX, глобальные HCM            | Есть код и тесты, но они не компенсируют открытые Convex APIs. Нужен реальный IdP roundtrip и deprovisioning                                                      |
| Audit/security/GDPR/operator tools                    | Администрирование и контроль                              | Enterprise HCM и mature SaaS                                   | P0 security settings без проверки; audit caller spoofing. Compliance checklist не подтверждение контроля                                                          |
| Backups                                               | Employee JSON snapshots, cron и restore                   | Backup/DR требования покупателей                               | Анонимное чтение; snapshots не полный DB backup; 48h retention и recovery drill не выполнен по документации                                                       |
| Branding, локализация, permissions, PWA               | Адаптация и web-mobile                                    | List Work, HRBOX, Zoho, Menthory                               | Проверка ключей не языковая QA; native mobile coming; SW хранит HTML без user partition/clear logic                                                               |
| Future modules                                        | aiMeetingAgent, breakoutRooms, guestAccess, native mobile | Соответствующие категории                                      | В каталоге coming. Не продавать как доступные; наличие гостевых call links не равнозначно полному guestAccess-модулю                                              |

## 5. Безопасность: подтвержденные блокеры

### 5.1. Критические находки

| ID     | Приоритет         | Доказательство                                                                                                    | Риск                                                                               | Что исправлять                                                                                                                     |
| ------ | ----------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| SEC-01 | P0                | **ЛОКАЛЬНО:** `analytics.getAnalyticsOverview` анонимно возвращает `users`, включая passwordHash и faceDescriptor | Утечка учетных и биометрических данных, возможная цепочка компрометации аккаунтов  | Отказ без caller, org scope, role/field policy, explicit DTO. Проверить другие analytics queries; удаление двух полей недостаточно |
| SEC-02 | P0                | **ЛОКАЛЬНО:** `security.toggleSetting` анонимно меняет глобальный failed_login_lockout, принимает updatedBy       | Отключение защит всей платформы и подделка автора аудита                           | Проверять identity + DB superadmin; actor только серверный; whitelist keys; перевести только серверные write-paths в internal      |
| SEC-03 | P0                | **ЛОКАЛЬНО:** `backups.getBackupDetails` возвращает snapshot без identity; `getOrgBackups` раскрывает metadata    | Утечка персональных, документных и управленческих данных при известном ID          | Org/record ACL и минимум возвращаемых полей; авторизация всех backup функций. ID не средство защиты                                |
| SEC-04 | P0                | **ЛОКАЛЬНО:** `aiGovernance.updateGuardrail` принимает чужой admin userId и отключает piiDetection анонимно       | IDOR, изменение privacy-политики клиента и spoofing аудитора                       | Identity-based staff check + org equality; исключить доверие args.userId во всем legacy RBAC                                       |
| SEC-05 | P0/P1             | **ЛОКАЛЬНО:** `isSuperadmin({role:'employee', email:bootstrapEmail}) === true` при env настройке                  | Runtime полномочия не соответствуют DB-роли; отзыв роли не отзывает все полномочия | Runtime только DB role; bootstrap отдельный атомарный initial flow с доказательством владения и условием отсутствия superadmin     |
| SEC-06 | P0 для Face login | **ЛОКАЛЬНО:** шесть неверных face попыток не сохраняют counters/lockout/logs                                      | Mutation делает patch/insert, затем throw; транзакция откатывает защиту            | Сохранять отказ как результат, а не throw после записи; внешний route превращает результат в ошибку; test rollback semantics       |
| SEC-07 | P1 privacy        | **ЛОКАЛЬНО:** `surveys.getSurveyWithQuestions` отдает private draft анонимно                                      | Внутренние опросы доступны без membership                                          | Caller/org/status/audience ACL; такой же review результатов и списка                                                               |

**Важно:** reproduction — локальная, на синтетических данных. Здесь не утверждается, что произошло реальное нарушение или что production развернут точно с этим кодом. Если это же поведение задеплоено с реальными данными, требуется немедленная containment-проверка владельцем, а не ожидание маркетингового запуска.

### 5.2. Почему это системная, а не единичная проблема

- `convex/_generated/server.js` экспортирует стандартные `queryGeneric`/`mutationGeneric`; автоматической общей RLS-обертки нет.
- Convex backend доступен независимо от Next.js proxy. Login redirect, CSRF и Redis на `/api/*` не защищают прямую публичную Convex-функцию.
- `convex/lib/rbac.ts` проверяет роль **переданного userId**, не устанавливая, что это caller. Применять его безопасно можно только после identity-binding. `orgAccess.ts` правильно объясняет этот риск, но legacy-пути остаются.
- В `users/mutations.ts` виден createUser-путь через `requireUser(ctx, adminId)` / `requireOrgAdmin(ctx, adminId, targetOrgId)` без identity-binding в просмотренном участке. Это **дополнительный P0-кандидат**, не проверенный новым тестом; обязательно продолжить аудит кадровых CRUD.
- `assertModuleAccess` разрешает отсутствие caller; это tariff gate, не authentication. `backups.createOrgBackups` нельзя считать защищенным только из-за этого вызова.
- `aiGovernance.logRequest` — публичная mutation с комментарием «trusted server-to-server», но без доказательства server identity. Такую функцию может вызывать клиент; возможны spam/фальсификация telemetry.
- `security.logLoginAttempt` принимает произвольный userId и записывает/блокирует аккаунт без identity. Необходим безопасный pre-auth server pathway и защита от злоупотребления, а не простое требование login для самого процесса входа.
- `aiEvaluator.calculateEmployeeScore` проверяет admin/supervisor role, но в просмотренном коде не проверяет tenant целевого пользователя; `evaluateLeaveRequest` не устанавливает caller. Это дополнительные scope-кандидаты.

### 5.3. Другие риски, требующие проверки

1. **Face descriptor replay.** Backend сравнивает предоставленный клиентом вектор и выпускает login token. Свежая живая камера server-side не доказана. В сочетании с SEC-01 это особенно опасно: считать вектор биометрии публичным нельзя. Нужны challenge/liveness, ограниченная роль биометрии и независимый фактор для privileged users.
2. **CSP содержит unsafe-eval в production.** `unsafe-inline` с nonce/strict-dynamic в современных CSP3 браузерах не равно безусловному разрешению inline, но unsafe-eval остается ослаблением. Убрать где возможно, проверить старые браузеры; report-uri с wildcard не является настроенным collector URL.
3. **Proxy route allowlist неполон:** нет benefits, shifts, succession, career-paths, automation, marketplace. Dashboard layout сам не выполняет server-auth; клиентские guards не security boundary. Проверить uniform server gate. Это не доказывает утечку само по себе — backend должен отдельно защищать данные.
4. **SW caching:** `public/sw.js` сохраняет все navigation responses в общую PAGE_CACHE, без разделения по пользователям/организациям. Сам SW принимает только SKIP_WAITING, не очистку на logout. Реальный объем приватного SSR HTML и logout cleanup вне просмотренных файлов требуют browser-проверки. Для HR проще не cache private HTML вообще.
5. **Rate limiter:** без Redis использует per-instance memory; для serverless нет глобальной гарантии. Это fixed-window, несмотря на комментарий sliding. `remaining` ограничен снизу нулем, а proxy проверяет отрицательное значение для blockKey — эта ветка не срабатывает. Нужен обязательный production config и review shared-NAT UX.
6. **Файлы/биометрия/AI:** нужны signed URLs, access policy, deletion verification, malware scanning, retention и DPA. Только consent checkbox не закрывает правовой риск.
7. **Dependency audit:** текущая scan-результативность неизвестна; package versions/CI наличие не заменяют свежий audit lockfile.
8. **Публичные sourcemaps** облегчают разбор приложения; сами по себе не раскрывают секреты и не являются критической уязвимостью. Проверить, что server secrets не попали в client code; для Sentry предпочесть private upload при необходимости.

### 5.4. План проверки после исправлений

На каждую private query/mutation/action проверить: anonymous, employee, driver, supervisor, admin, superadmin; same tenant, other tenant, forged actor ID, orgless, inactive/frozen, expired/revoked session, own/other record, subscription denied. Проверить минимальные DTO и audit attribution. **Принцип: deny by default, полномочия выводятся из identity, tenant — из caller/проверенной записи.**

Не исправлять только UI или один модуль: обнаруженная архитектурная неоднородность требует реестра всех public endpoints.

## 6. Производительность и масштабирование

### Сильные стороны

- Dynamic imports/lazy загрузка тяжелых библиотек и модулей; есть virtualizer dependency, bounded reads, индексы и pagination helpers.
- Bundle guardrails для TensorFlow duplication и heavy libraries.
- Sentry/OTel/Speed Insights предусмотрены архитектурой.
- Next images/WebP/AVIF, package import optimization, lazy locales.

**Но конфиги не являются измерением. Быстрее/медленнее конкурентов по имеющимся данным установить нельзя.**

### Подтвержденный дефект масштабирования

**PERF-01 / P0 для смен:** `shifts.getRoster` берет первые `DEFAULT_LIST_CAP = 2000` строк по организации и только затем фильтрует даты. Локальный тест вставляет 2000 старых смен и одну новую: запрошенная новая смена отсутствует в результате.

Индекс `by_org_date` уже существует в `convex/schema/shifts.ts`, но не применяется в этом read-path. Использовать range по дате до ограничения и pagination/aggregation при необходимости. При 100 сотрудниках по одной смене в рабочий день 2000 записей набираются примерно за 20 рабочих дней — проблема возникает у среднего бизнеса, а не только у огромных корпораций.

### Дополнительные ограничения

| Участок          | Что видно                                                                                            | Последствие                                                                                     | Решение                                                                               |
| ---------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| API roster sync  | `apiV1.listEmployees`: максимум 200, без cursor/updatedAfter; overfetch всего 20 перед active filter | Компания 300+ не может полностью получить roster через list API; много inactive скрывают active | Cursor, indexed active filter, incremental sync, count/hasMore                        |
| Analytics        | `take(2000/8000)` + полный users/leaves + profile lookup на каждого                                  | Рост payload/read amplification; aggregate может быть неполным                                  | DTO, maintained counters/time aggregates, indexed range, bounded field projection     |
| Learning         | take(100) до search/category; lessons query на каждый курс                                           | Поиск не находит курс за cap, N+1 reads                                                         | Фильтровать/index search до pagination; хранить lessonCount                           |
| Surveys          | Все answers/responses take(2000)                                                                     | При 300 сотрудниках ×10 вопросов получится 3000 answers: часть результатов не учтется           | Question-level indexed aggregation/pagination; никаких silent caps для totals         |
| Backups          | JSON-снимок множества сущностей в одной записи; 48h retention; циклы по сотрудникам                  | Размер документа/транзакции и storage; неполная история при cap                                 | Size limits, storage/chunking, error telemetry, separate deployment backup            |
| Billing seats    | users create: count capped at 2000                                                                   | Enterprise лимит выше 2000 может неправильно применяться                                        | Счетчик активных seats с атомарным enforcement, не capped list.length                 |
| Realtime         | Широкие query subscriptions + глобальные providers                                                   | Read fan-out и стоимость при массовых обновлениях                                               | Уточнить subscription scopes, агрегаты, нагрузка при 100/500/1000 concurrent users    |
| Public pages/CSP | nonce per request + caching/dynamic headers                                                          | Возможный конфликт cache/SSR nonce и потеря статичности                                         | Browser production проверка; измерить cold/warm TTFB, не делать вывод по комментариям |

`npm run test:perf` указывает на `tests/performance/load-test.js`, но этого пути в доступной рабочей копии нет. Glob также не обнаружил load-test. **Заявление в документации о наличии k6 load testing не подтверждено.**

### Нагрузочный протокол перед 300+

Только на изолированном staging с синтетикой и согласованным бюджетом:

- Организации 50/300/1000/5000 сотрудников; история минимум 12 месяцев; 100k+ attendance, 50k+ tasks/messages.
- Tenant-A/B isolation одновременно с нагрузкой, не после.
- Утренний check-in burst, login/SSO через общий NAT, leave approval contention, payroll batch, weekly roster, chat fan-out, exports и webhook outage/recovery.
- Географии AM/CIS/EU, мобильный средний Android, медленная сеть.
- Записывать p50/p95/p99, error rate, DB reads/writes, subscription update bytes, CPU/render time и расходы.

**Предлагаемые acceptance goals, не текущие результаты:** ключевые UI LCP p75 ≤2.5s, INP p75 ≤200ms, CLS ≤0.1; интерактивные backend p95 ≤500ms и p99 ≤1.5s для согласованного профиля, error rate <1%; long-running jobs асинхронно с progress/retry. Корректность данных должна быть 100% независимо от latency.

Bundle guardrail script проверяет несколько маркеров библиотек, но не total route weight/LCP. Успешный запуск этого скрипта сам по себе не доказал бы хорошую скорость.

## 7. Payroll, compliance и юридическая готовность

### Payroll: не обещать больше, чем реализовано

- **Россия:** в `taxRules.ts` только 13% до 5 млн и 15% выше. Публикация ФНС от 02.03.2026 описывает действующую пятиступенчатую шкалу 13/15/18/20/22% с первым порогом 2.4 млн. Российская запись не помечена approximate — это опасная уверенность в устаревшем правиле.
- **Периодизация:** `PayrollInput` не содержит YTD/tax-year accumulator; progressive tax применяется к gross одного вызова. Добавление правильной таблицы без накопления налоговой базы и даты действия не сделает statutory engine.
- **DE/UK/PL/USA:** прямо помечены approximate; часть значений относится к 2024/2024–25. Это reference calculator, не production payroll.
- **Health insurance:** `computeDeductions` убирает все contributions с field healthInsurance, если healthInsured=false; этот флаг описан как армянский, но применяется к другим странам тоже. Нужен jurisdiction-specific behavior.
- **Армения:** правила детальнее плоской ставки; в репозитории есть regression tests. Но они доказывают соответствие коду, не закону. Нужны действующие первичные нормативные источники с датами, eligibility и контроль бухгалтером, включая изменение законодательства, отпускные, больничные, увольнение, частичный месяц и retroactive corrections.
- **Банковские файлы:** несертифицированные presets и imported layout — удобство, но реальный upload acceptance требуется у банка клиента.
- **SRC-ready:** разделить «экспорт для бухгалтера» и «формат, принятый налоговым порталом». Не заявлять автоматическую filing/submission без подтверждения.

### Privacy и enterprise procurement

Документация `vendor-register.md` сама признает отсутствие сохраненных DPA/report evidence; `soc2-type2-readiness.md` — отсутствие первого recovery drill, external uptime history, записанной rotation и других operational artifacts. Здесь их реальное актуальное состояние не проверялось; считать незакрытыми до предъявления доказательств.

- Регион Vercel fra1 не определяет Convex, Cloudinary, AI, email, telemetry и backup residency.
- Для ЕС biometric consent в трудовых отношениях проблематичен из-за дисбаланса власти. Пример EDPB/Italian SA от 15.07.2025 показывает, что согласие работников не предотвратило штраф. Нужны юрист, DPIA/правовое основание и равноценная небиометрическая альтернатива. Это не утверждение универсального запрета во всех юрисдикциях.
- AI для ranking кандидатов/оценки работников может попадать в high-risk область EU AI Act. Проверять текущие сроки и собственную роль provider/deployer у юриста, не копировать устаревшую дату из шаблона. Официальная страница на дату исследования указывает измененный график для high-risk обязательств.
- AI-assisted кадровые решения требуют human oversight, trace, appeal и bias evaluation; deterministic scoring не становится валидным AI из-за названия файла.
- `aiEvaluator` включает использование отпусков в employee score. Это риск несправедливой/незаконной оценки, особенно для protected leave. Убрать из performance judgement до правовой и методологической validation.
- СНГ — не одна юрисдикция. РФ, Казахстан, Беларусь и другие страны требуют отдельных правил residency, кадрового учета, электронных подписей и локальных платежей. Для РФ отдельно проверить 152-ФЗ и применимость локализации; EU-only stack не подтверждает соответствие.
- SOC 2/ISO могут быть procurement blocker для конкретного клиента, но не обязательны для каждого покупателя 300+. Нельзя автоматически отказать всем large buyers или автоматически объявить готовность при наличии SSO.

## 8. Конкуренты: Армения

**Это карта ключевых прямых и смежных альтернатив, не исчерпывающий мировой реестр.** Преимущество/недостаток ниже — относительно buyer job, а не универсальный рейтинг качества. Неизвестные функции не считаются отсутствующими.

| Игрок                                     | Роль и подтвержденный фокус                                                                                                                | Где Strata может выиграть                                                       | Где уступает / что неизвестно                                                                                                                                  |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Hirebee**                               | Прямой: ATS, assessments, HR management, payroll/attendance/performance; мобильный HRMS                                                    | Связанный локальный учет/документы/ops, если пилот докажет глубину              | Найм, assessments, опубликованные customer stories и native app; маркетинговые проценты/uptime/SOC2 требуют независимого подтверждения                         |
| **List Work**                             | Прямой: команда List.am, HR+workplace/time/payroll/docs/tasks; Android app найден                                                          | Конкретный специализированный workflow и интеграция с бухгалтерией              | Близкое all-in-one предложение, локальный бренд, mobile. Нельзя утверждать, что Strata функционально шире без hands-on; сайт частично извлекается              |
| **Resalt**                                | Прямой: People/Spend/Contracts/Hire/Knowledge, configurable approvals, Armenia SRC invoice flow, Slack/Google/n8n                          | Attendance/shifts/payroll-фокус, если действительно лучше для выбранной отрасли | Сильное понятное ops-позиционирование, spend/contract journeys. Старое «слабее в compliance» не доказано; pricing заявляет дополнительные модули — demo needed |
| **Spark.work**                            | Прямой: HR + strategy maps/BSC + OKR/performance, AI/mobile/Power BI по публичным материалам                                               | Локальные расчетные/операционные сценарии                                       | Лучше сфокусирован на strategy execution. HY и AI не наши уникальные преимущества                                                                              |
| **Menthory**                              | Новый для прошлой карты прямой игрок: модульный HR/workplace, onboarding, leave, requests, AI OKR, rooms, appreciations; mobile app найден | Более глубокая attendance/payroll/документная связка                            | Простота, free start, ниша company processes. Налоговая/enterprise глубина неизвестна                                                                          |
| **Armsoft / AS**                          | Payroll/personnel/ERP с публичными внедрениями                                                                                             | Employee UX, realtime согласования, engagement и объединение HR-процессов       | Доверие бухгалтерии и накопленная локальная экспертиза. Лучший путь — партнер/дополнение, не сразу замена statutory system                                     |
| **1C:ЗУП и местные внедренцы**            | Локальный кадровый/расчетный incumbent                                                                                                     | Web self-service и простое HR workplace                                         | Глубина локальных расчетов и кастомизация через партнеров; не сравнивать с одной global коробкой без конфигурации РА                                           |
| **OnTime / Impex**                        | Специалист time attendance + ZKTeco; on-prem публично встречается                                                                          | HR-процесс после attendance, объединение отпусков/согласований/документов       | Реальное железо, поддержка на объекте, долгий attendance опыт; Strata ADMS требует field verification                                                          |
| **Logycore**                              | Смежный: SOP/knowledge/training/recurring checklists для multi-location ops                                                                | HR/payroll/leave ядро                                                           | Глубина location/SOP workflows и knowledge enablement                                                                                                          |
| **staff.am**                              | Канал вакансий / recruiting budget alternative                                                                                             | ATS и employee lifecycle после найма                                            | База кандидатов/дистрибуция не заменяется вашим careers page; интегрировать, не «побеждать»                                                                    |
| **HR Drone**                              | Matching/recruitment marketplace                                                                                                           | Последующий HR lifecycle                                                        | Доступ к кандидатам; партнерский канал и альтернативный spend, не полный HRIS                                                                                  |
| **Excel + Telegram + Armsoft + терминал** | Главный фактический incumbent-комплект                                                                                                     | Меньше повторного ввода, единый approvals trail и более быстрый payroll handoff | Привычность, почти нулевые switching costs; наш onboarding и миграция должны быть убедительнее числа модулей                                                   |

**Ключевой вывод:** армянский рынок уже конкурентный. Продаваемая дифференциация — не «единственные», а **проверенный сквозной сценарий + локальная поддержка + быстрый запуск**.

## 9. Конкуренты: СНГ и региональные рынки

| Игрок                            | Что подтверждено / покупательская роль                                                            | Возможность Strata                                                | Главный проигрыш/проверка                                                             |
| -------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **PeopleForce**                  | Прямой HRIS: Core HR, ATS, performance/OKR, surveys, time, desk, SSO/API/webhooks, mobile         | Армянская специфика и локальный ops/payroll workflow              | Дешевле Core, customization, customer success; all-module quote сравнивать отдельно   |
| **1C:ЗУП (страна/конфигурация)** | Кадровый учет, зарплата и отчеты; отдельно найдена версия Казахстана                              | Внешний self-service/HR слой                                      | Законодательная глубина, партнерская сеть и residency options                         |
| **Битрикс24 Enterprise HRM**     | Интегрированная HR-платформа: ATS, onboarding, LMS, career, OKR, 360, КЭДО/1C integration         | Современный узкий HR+локальный Armenian workflow                  | Не считать только CRM/chat: актуальный продукт намного шире; экосистема/внедренцы     |
| **SimpleOne HRMS**               | Enterprise HR service, каталог, ATS, onboarding/learning, reporting, org modeling, low-code/API   | Проще стартовать для малого/среднего клиента с понятным процессом | Гибкая сервисная модель и кастомизация; глубина enterprise внедрения                  |
| **Mirapolis HCM**                | Talent/LMS/KPI/competencies/career/rewards; публичные enterprise references                       | HR/time/payroll consolidation в локальной нише                    | Глубина обучения, кадрового резерва, calibration, премирования, внедренческий сервис  |
| **Websoft HCM**                  | Full HR talent suite, no/low-code, mobile, cloud/on-prem и российский стек по сайту               | SaaS onboarding и локальный процесс                               | LMS/talent/process depth, on-prem, интеграторы и подтвержденные кейсы                 |
| **HRBOX / HRBOX.KZ**             | HR-конструктор, portal/LMS/360/OKR, chat/video, mobile, API/SSO, cloud/on-prem; KZ-local presence | Армянская payroll/attendance связка                               | Коммуникации+LMS не уникальны; казахский интерфейс/местная команда, подстройка без IT |
| **Huntflow**                     | Специализированный ATS                                                                            | Lifecycle после hired в одной системе                             | Recruiter tooling/sourcing/integrations; надо demo и локальные board workflows        |
| **Поток**                        | Recruiting и HR-tools по публичным материалам                                                     | Сквозной кадровый учет после подбора                              | Mass/targeted recruitment workflows и рынок кандидатов                                |

Дополнительный longlist для уточнения при выборе страны/отрасли: **ТопФактор, Сбер Пульс, VK People Hub, Skillaz, Talantix, FriendWork, Happy Job, Motivity, Эквио, K-Team, Hurma, CleverStaff**. Это **не полноценное индивидуальное сравнение**: названия помогают не потерять смежные shortlist, но актуальные editions, availability, цена и legal suitability в этом аудите не верифицированы для каждого. Перед реальной сделкой исследовать 3–5 наиболее релевантных, а не произвольно присваивать им оценки.

Для СНГ важнее выбрать **одну конкретную страну**, чем обещать охват региона: Казахстан имеет собственные payroll/language/residency требования, а российская localization требует отдельного решения.

## 10. Глобальные конкуренты

| Игрок                         | Подтвержденная категория/сила                                                                                           | Реалистичное преимущество Strata                      | Где не конкурировать лоб в лоб                                                                               |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **BambooHR**                  | SMB/mid HRIS + ATS/onboarding, performance, employee community, rewards, compensation/benchmarks; add-on shifts/payroll | Armenian local layer и стоимость конкретного bundle   | Brand, references, reports/benchmarks, mature employee experience; старые отметки «нет LMS/смен» неправильны |
| **Personio**                  | European HRIS/core HR и модульное расширение                                                                            | Armenian interface и локальная bookkeeping связка     | Европейские процессы, интеграции, внедрение и доверие; €7.60 — starting price, не universal quote            |
| **HiBob**                     | HR/people experience, talent, compensation, payroll/finance позиционирование                                            | Локальная связка для AM офиса группы                  | Глобальные people/finance journeys; старая таблица payroll=no не соответствует текущему positioning          |
| **Rippling**                  | HR+IT+Spend, automation, payroll, devices/integrations                                                                  | Специализированный AM процесс и более узкое внедрение | IT provisioning/MDM/global payroll/экосистема; $8 starting HRIS не цена всего стека                          |
| **Factorial**                 | HR+finance+IT, time/expense/payroll workflows, AI                                                                       | AM локализация и локальный accountant handoff         | Более широкий operational package и зрелость market execution                                                |
| **Zoho People / People Plus** | HR+attendance/face kiosk/biometric integrations/LMS/OKR; связанный suite                                                | AM правила/интеграции и более цельный niche workflow  | Face attendance/LMS/chat не уникальны; экосистема и экономичный SMB вход                                     |
| **Odoo**                      | ERP suite, HR/payroll/planning/attendance, apps/partners                                                                | Готовый узкий HR запуск без ERP-проекта               | ERP глубина/экосистема; seats billed users, а не все employees: прежнее прямое TCO сравнение некорректно     |
| **Leapsome**                  | Talent suite: reviews/goals/engagement/learning/compensation, развивается в HR-платформу                                | Time/payroll/документы выбранной локальной страны     | Методология talent, people science, глубина связей; не объявлять только «надстройкой» без актуального demo   |
| **Lattice**                   | Performance, OKR, engagement, compensation                                                                              | Локальные transactional HR процессы                   | Talent quality, benchmarking и специализированная методология                                                |
| **Deel**                      | Global payroll/EOR/compliance/HR                                                                                        | HR для уже существующего AM юрлица без EOR            | Нельзя сравнивать ваш SaaS тариф с $599 EOR: там юридическое работодательство/сервис                         |
| **Remote**                    | EOR, global payroll, employment infrastructure                                                                          | Локальный HR слой и employee workflow                 | Global legal employer/payroll delivery не реализованы Strata                                                 |
| **Gusto**                     | SMB US payroll/tax/benefits                                                                                             | AM процессы                                           | US payroll filing/tax support; наш approximate USA не конкурент statutory US payroll                         |
| **Workday**                   | Enterprise HCM/finance, global HR, talent, complex changes                                                              | Более легкий локальный satellite use-case             | Замена corporate system of record, глобальный scale/controls                                                 |
| **SAP SuccessFactors**        | Core HR, payroll, talent, workforce management                                                                          | Satellite/локальные процессы                          | Enterprise complexity/global localization/integrators                                                        |
| **Oracle Fusion Cloud HCM**   | Enterprise HR, payroll, talent, AI                                                                                      | Satellite/локальный UX                                | Полная замена глобального HCM без масштаба и доказательств                                                   |
| **UKG**                       | HCM/pay/WFM, mobile/contract teams, scheduling                                                                          | Armenian niche и простота                             | Сложный WFM, labor rules, capacity и contractual reliability                                                 |
| **ADP**                       | Workforce/payroll/HCM; Workforce Now/Lyric                                                                              | AM локальный HR слой                                  | Payroll services/compliance delivery и enterprise workforce                                                  |
| **Keka**                      | Growing-company HR/payroll/attendance/performance, country offerings                                                    | AM localization                                       | Глубина payroll страны и HR delivery, мобильность                                                            |
| **Darwinbox**                 | Enterprise cloud HCM hire-to-retire/APAC                                                                                | AM локальный слой                                     | APAC enterprise localization/scale; hands-on не проводился                                                   |
| **Workable**                  | Recruiting + HR + AI agent platform                                                                                     | AM employee/time/payroll связка                       | Sourcing/hiring platform/AI candidate workflow, доказанная дистрибуция                                       |
| **Greenhouse**                | Специализированная hiring/ATS/AI платформа                                                                              | Lifecycle+attendance после hiring                     | Structured hiring/sourcing/integrations; careers page не replacement их recruiter stack                      |
| **Connecteam**                | Deskless workforce: operations, schedules, forms, tasks                                                                 | HR/payroll AM + общий employee record                 | Native mobile и отраслевой UX; сравнивать отдельные hubs, не минимальный headline                            |
| **Deputy**                    | Scheduling/time/attendance/HR; payroll в определенных предложениях                                                      | Armenian payroll handoff + employee lifecycle         | Labor scheduling, native mobility и WFM depth                                                                |
| **Jibble**                    | Free attendance/time, face recognition, GPS/kiosk/offline                                                               | HRIS/leave/документы/расчеты вокруг attendance        | Чистая attendance фича не ценовой moat: бесплатный конкурент уже есть                                        |

Дополнительные смежные/географические альтернативы для последующего country shortlist: **Paylocity, Paycom, Dayforce, Sage HR, Employment Hero, Namely, ZenHR, Bayzat, Culture Amp, 15Five, 360Learning, TalentLMS, Docebo, Absorb, Cornerstone, Lever, Ashby, SmartRecruiters, Teamtailor, Personio-compatible payroll партнеры**, а также **Teams/Slack, Zoom, Notion/Confluence, DocuSign, Jira/ClickUp** как incumbent stack. Полная актуальная feature-by-feature проверка каждого не выполнена; считать это расширением карты, не доказанным сравнением.

### Что это означает для стратегии

Вашим moat не являются «AI + много модулей + чат». Это рыночный стандарт или легко копируемая комбинация. Возможный moat: **подтвержденные локальные правила + поддерживаемые интеграции + migration templates + отраслевой workflow + доверие клиентов**. Пока это направление развития, а не доказанное устойчивое конкурентное преимущество.

## 11. Цена и экономика

### Strata по текущей pricing-модели

Источник: `src/lib/pricing.ts`. USD, месячная оплата, без налогов/индивидуальных условий.

| Сотрудников | Starter                                                | Pro                                      | Enterprise                               |
| ----------- | ------------------------------------------------------ | ---------------------------------------- | ---------------------------------------- |
| 10          | $40                                                    | $80                                      | Не считать quote для этого размера       |
| 25          | $87.50 как rate × seats; helper округляет total до $88 | $200                                     | По запросу                               |
| 50          | Не self-serve                                          | $350                                     | По запросу                               |
| 100         | Не self-serve                                          | $550                                     | Indicative from $1200                    |
| 250         | Не self-serve                                          | $1125                                    | Индивидуально                            |
| 300         | Не self-serve                                          | $1350                                    | Индивидуально                            |
| 500         | Не self-serve                                          | Нельзя quote как Pro; model clamp на 300 | Indicative from $6000, не фактическое КП |

Pro annual: −20% в месячном эквиваленте; Enterprise −25% по модели. Реальные опубликованные тарифы могут редактироваться из billing catalog, поэтому commercial quote проверяется отдельно.

### Ценовые находки

**PRICE-01 / P1:** volume tiers применяются ко всей компании. Total падает при добавлении сотрудника:

- Pro 49: 49×$8=$392; 50: 50×$7=$350.
- Pro 99: 99×$7=$693; 100: 100×$5.5=$550.
- Pro 249: 249×$5.5=$1369.50 (helper $1370); 250: 250×$4.5=$1125.
- Starter 14: $56; 15: $52.50 (helper $53).

Это не security flaw, но incentive искусственно увеличивать seats и резкие revenue discontinuities. Рассмотреть graduated tiers или монотонный total с плавной volume discount. Решение требует согласования: существующие договоры/Stripe prices не менять молча.

**PRICE-02 / P1:** frontend caps Starter25/Pro300, но `lib/limits.ts` legacy10/50, local PSP содержит отдельную literal10/50, subscription/org paths используют legacy map. В createUser fallback зависит от billing catalog/source. Может возникнуть обещание 300 мест и фактическое ограничение 50. Проверить все checkout → webhook → entitlements → create employee pathways на реальных конфигурациях.

**PRICE-03 / P1:** global приблизительный рынок/медиана из комментариев устарели; не обосновывать цены «знаниями модели».

### Проверенные ориентиры конкурентов

| Продукт                          | Публичный ориентир на дату исследования                                      | Как сравнивать правильно                                                                             |
| -------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| BambooHR                         | Core $10, Pro $17, Elite $25 PEPM; add-ons/volume discounts                  | Тот же функциональный bundle, минимумы и quote; не делать одинаковую «цену за все»                   |
| PeopleForce                      | Core Standard $2.5, min $125/до50; Professional $3, min $150/до50            | ATS/Perform/Pulse/Time/Desk отдельно. Pro Strata $350 против Core $125 — НЕ сравнение всего HR suite |
| Factorial                        | Official search: starts $8/user/month, tailored plans                        | Нужен country/bundle quote                                                                           |
| Personio                         | Official search: Core from €7.60 PEPM; страницу fetch ограничил 429          | Starting figure, валюта/страна/пакет, не обязательная цена любого клиента                            |
| Rippling                         | Official HRIS article: starts $8 PEPM, но формулировка base fee неоднозначна | Pricing page/custom quote; не использовать спорные $35 как надежную арифметику полного TCO           |
| Odoo                             | Official headline $24.90, зависит от плана/географии/периода                 | Цена за licensed user; не умножать автоматически на всех employees                                   |
| Resalt                           | Quote-based, разные plans/add-ons                                            | Запросить одинаковый сценарий/численность, не объявлять дешевле/дороже без КП                        |
| Hirebee/List Work/Spark/Menthory | Нет надежного одинакового full-suite quote в этом аудите                     | Получить КП; ATS recruiter seats не равны HRMS employee seats                                        |
| HiBob/Leapsome/enterprise HCM    | Точный сравнимый пакет неизвестен                                            | Нельзя выдавать estimates за verified pricing                                                        |
| Deel/Remote                      | Global payroll/EOR — отдельный service scope                                 | Сравнивать стоимость решения одинаковой задачи, а не цены несопоставимых услуг                       |
| Jibble                           | Free attendance предложение                                                  | Показывает, почему attendance сама не оправдывает дорогой all-in-one                                 |

**Цена Strata выглядит продаваемой гипотезой, но unit economics неизвестны.** Надо считать per-tenant Convex reads/storage, AI tokens, LiveKit/recording, email, file processing, support time, onboarding и payment fees. При 50×$7=$350 дорогая ручная поддержка может съесть маржу.

Предлагаемые бизнес-goals, не достигнутые факты: gross margin ≥75% после переменных затрат/повторяемой поддержки; measurable payback миграции ≤3 месяцев для клиента; TTV ≤7 дней для простого HR пилота. Проверить на 3–5 платящих клиентах до платного масштабирования рекламы.

## 12. Тесты и инженерная зрелость

### Выполнено в этом аудите

| Проверка                                                                                                                                                                                       | Результат                                                                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `npm run type-check:ci`                                                                                                                                                                        | Успех; первая попытка не уложилась в 120s, повторная завершилась с exit 0                          |
| 8 suites: auth helpers, org access, RBAC, pricing, tax rules, automation, entitlements, proxy                                                                                                  | 195 passed                                                                                         |
| 20 suites: leaves, payroll/benefits, performance, onboarding/offboarding, OKR, recruitment, documents, news, rooms, tasks, tickets, SCIM/SAML, payments, talent, LMS, surveys, biometrics, API | 512 passed, 1 skipped                                                                              |
| Новые audit characterization tests                                                                                                                                                             | 9 passed — **подтверждают плохое текущее поведение, НЕ безопасность**                              |
| Итого выбранных distinct suites                                                                                                                                                                | 29 suites; 716 passed, 1 skipped                                                                   |
| Повторный `npm run type-check:ci` после добавления evidence tests                                                                                                                              | Успех; конфигурация исключает `src/__tests__`, сами новые тесты компилировались через Jest/ts-jest |
| ESLint нового audit test                                                                                                                                                                       | Файл исключен существующим ignore pattern; успешный exit не означает, что lint проверил файл       |

При запуске отдельных integration suites появились `console.error` про отсутствующие automationRunner/webhooks modules в test module map. Это ограничение тестовой сборки/coverage сквозного эффекта, **не доказательство production outage**. Зеленый тест основного процесса не подтвердил выполнение всех соседних side effects.

### Почему green tests не означают readiness

- В `convex-security-audit.test.ts` проверяется локально скопированный SECURITY_FEATURES и category helpers, не ACL опасных security mutations.
- `convex-aiEvaluator-faceRecognition.test.ts` содержит копии scoring helpers. Такой тест может пройти после изменения настоящего кода.
- `convex-taxRules.test.ts` закрепляет устаревшие российские constants и список approximate стран. Это регрессия реализации, не юридическая validation.
- Jest исключает `src/app/**` из coverage: это затрагивает API route handlers, не только thin pages. Их critical logic требует отдельного route/E2E coverage.
- В README coverage badge, численность модулей, mobile, auth и roadmap statuses расходятся с более новыми файлами.
- Запущены выборочные tests, а не весь проект. Текущий полный coverage в этом аудите **не измерен**.

**Нужен shift:** меньше «проверить наличие константы», больше сценариев adversarial tenant isolation, end-to-end money flows и realistic datasets. Coverage % — вспомогательная метрика; ошибочная policy с 100% coverage остается ошибочной.

## 13. Исправить публичные сравнения и позиционирование

`src/lib/competitors.ts` и GTM-copy нуждаются в ревизии:

1. Local unlisted marks превращаются в `no`, а `compareScore` считает их победами. Даже с оговоркой это вводит в заблуждение. Добавить **unknown**, источники/edition/date для каждого claims-row; unknown не считать преимуществом.
2. BambooHR shifts=no и learning=no противоречат текущей странице: Time&Attendance add-on включает scheduling; планы включают compliance courses. Указывать partial/add-on, не «нет».
3. HiBob payroll=no против текущего HR/payroll/finance positioning. Проверить доступность по стране, не обобщать.
4. Strata SOC2=partial смешивает readiness с наличием independent report. Показывать «отчета нет; readiness underway» отдельными строками.
5. Public API=yes требует сноски read-only, max200/no cursor, отсутствующие write/attendance/payroll scope.
6. «Единственная HR-платформа, которая говорит с налоговой Армении» не доказано: Armsoft/1C имеют налоговую отчетность, Resalt заявляет SRC invoice flow. Описывать конкретный тип экспорта и validation.
7. German localization не означает Germany payroll/legal support; key parity не означает качественный профессиональный перевод.
8. Не заявлять меньшую цену Odoo по headcount без licensed-user model.
9. Не выдавать нативные приложения всех местных игроков за проверенный факт: в этом аудите store evidence найден для Hirebee, List Work и Menthory; по остальным нужны ссылки/проверка.
10. Убрать обещание полной замены Slack/Zoom/PM до доказательства востребованных функций и реальной миграции клиента.

### Рекомендуемая формулировка для первого рынка

> **Strata объединяет кадровое самообслуживание, отпуска, рабочее время и согласования для армянских компаний — с армянским интерфейсом и подготовкой данных для локальной бухгалтерии.**

Дополнительный обещаемый outcome следует выбирать по пилотам: «сократить двойной ввод», «ускорить согласование отпуска», «подготовить табель для зарплаты» — и затем публиковать реальные before/after цифры.

Для global: **HR operations layer for teams with an Armenian entity**, пока не подтверждены другие страны. Для СНГ: конкретная страна и integration-first, а не «готовый payroll всего региона».

## 14. План недостатков: что делать и как закрывать

Оценки усилий ниже — planning estimates для одного опытного инженера, не обещание срока. При большом количестве аналогичных endpoint полный P0 review может занять существенно больше.

| Приоритет / ID         | Задача                                                                                                 | Ориентир усилия                                            | Definition of done                                                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| P0 SEC-01/02/03/04     | Analytics/security/backups/AI governance ACL и DTO                                                     | 3–7 рабочих дней на первые пути + дальнейший полный review | Anonymous/forged actor/cross-tenant запрещены; безопасные DTO; негативные тесты реальных функций                                      |
| P0 AUTH-WIDE           | Реестр всех public Convex функций, миграция legacy args-based RBAC                                     | 1–3 недели и более по реальному объему                     | Нельзя получить роль через чужой ID; каждый private path имеет identity/tenant/field policy                                           |
| P0 SEC-05/06           | Runtime superadmin + face failure persistence; временно ограничить Face login                          | 2–5 дней                                                   | Нет email runtime elevation; 6 неверных попыток дают сохраненный lockout; неизвестный/неактивный пользователь не входит               |
| P0 CONTAINMENT         | Если уже есть production PII: проверить deployed versions, ограничить доступ, провести incident triage | Немедленно, владелец infra                                 | Документирована реальная экспозиция/отсутствие; corrective deploy/rotation по разрешению; при необходимости юридический incident flow |
| P0/P1 PERF-01          | Рoster date index и большой набор данных                                                               | 1–3 дня                                                    | Новая смена видна после 2000+ исторических; 100/300/1000 сотрудников, несколько лет, корректный range                                 |
| P0 при продаже payroll | Убрать уверенные зарубежные statutory claims; валидировать AM                                          | С юристом/бухгалтером                                      | Подписанные эталонные расчеты/экспорт; версия закона/дата; unsupported jurisdictions blocked/labeled                                  |
| P1 API-01              | Cursor/incremental sync и indexed active filter                                                        | 3–7 дней                                                   | Полный roster >300 без дублей/пропусков; changed/deleted records, documented limits                                                   |
| P1 DATA-01             | Silent caps в analytics/surveys/LMS/backups/counts                                                     | 1–2 недели на самые продаваемые процессы                   | Полнота результатов на realistic datasets; total не маскирует truncated results                                                       |
| P1 PRICE-01/02         | Монотонная цена и единые seat limits                                                                   | 2–5 дней + commercial decision                             | Полная цепочка checkout/webhook/seat enforcement согласована; 49/50,99/100,249/250 edge cases; existing contracts preserved           |
| P1 WEB-01              | Единый dashboard server gate, cache/logout, production Redis                                           | 3–7 дней                                                   | Никакой private HTML cache/shared-session leakage; все private routes закрыты; NAT load не блокирует офис                             |
| P1 OPS-01              | Backup restore drill, monitors/alerts, secret rotation records                                         | 1–2 недели + инфраструктурное согласие                     | Staging restore artifact, measured RTO/RPO; alerts реально доставляются и назначен ответственный                                      |
| P1 LEGAL-01            | DPA/vendor/residency/biometrics/AI review                                                              | 2–6 недель с внешними специалистами                        | Реальные договоры/основания, data map, deletion/retention, region options/ограничения                                                 |
| P1 UX-01               | Сопровождаемый onboarding/import, 5 buyer journeys                                                     | 1–2 недели + пилоты                                        | HR импортирует roster, policy и balances, сотрудники делают 3 ключевые операции без разработчика                                      |
| P1 GTM-01              | Ревизия compare/claims и source log                                                                    | 2–4 дня + vendor demos                                     | Нет unknown=no, неподтвержденных «единственный»/«сертифицирован»; edition/date/source per claim                                       |
| P2 MOBILE-01           | Native employee app или надежно проверенная PWA по пилотам                                             | Отдельный discovery                                        | Не писать app ради галочки: проверить push/camera/offline/installation/MDM для целевого клиента                                       |
| P2 DEPTH-01            | Calibration, SCORM/xAPI, advanced workflow, external provisioning                                      | По интервью                                                | Делать только требования платящих target buyers; не добавлять десятки модулей заранее                                                 |

### Важно о новых audit tests

`market-readiness-audit.test.ts` специально фиксирует **существующее небезопасное поведение**, чтобы находки были воспроизводимы. Когда исправляем функцию, соответствующий тест нужно заменить на **отказ для нарушителя / корректное сохранение lockout / полный roster**. Не «чинить» функцию обратно ради зеленого characterization теста. Не использовать этот файл как security acceptance gate до инверсии проверок.

## 15. Условия выхода на рынок

### Gate A — коммерческие интервью / демо

Можно сейчас: синтетические данные, честные ограничения, никаких реальных payroll/биометрии клиентов. Выбрать основной launch ICP, даже если долгосрочный рынок глобальный.

### Gate B — пилот с реальными данными

- Все найденные P0 закрыты; полный public endpoint review для пилотного scope.
- 2-tenant negative test matrix; identity/record/field ACL; inactive/revoked cases.
- Исчезновение смен/неполная аналитика/лимиты исправлены в продаваемых процессах.
- Подписанный DPA, privacy/data map, законные правила биометрии или biometrics disabled.
- Изолированный staging, rollback/backup artifact и работающие critical alerts.
- Миграционный dry run и acceptance HR+бухгалтером.
- Прозрачный тариф и неизвестные/unvalidated функции исключены из договора.

### Gate C — публичный SMB/mid-market launch

- 3–5 пилотов закончены; минимум 2 разрешенных customer references с измеримой пользой.
- Полный релизный typecheck/test/build и ключевые browser journeys; никаких скрытых lost side effects.
- Целевые метрики нагрузочного профиля/UX достигнуты; оценка per-tenant COGS.
- Документированы support hours, response escalation, bugs/refunds, export/offboarding.
- Исправлены misleading compare claims; обновляются источники/прайсы.

### Gate D — enterprise / широкая международная продажа

- Buyer-specific procurement readiness: независимый пентест, report/cert если требуется, region/residency solution, IdP/deprovisioning, access reviews, realistic DR.
- Performance/correctness при согласованном масштабе и истории, договорные SLA подтверждены инфраструктурой/дежурством.
- Локальная юридическая/payroll validation для каждой продаваемой страны, integration/migration evidence.
- Не обещать on-prem, если нет архитектуры/операционного продукта для этого.

### Порядок на ближайшие 90 дней

1. **Сначала безопасность и корректность**, не новые модули.
2. Параллельно 10–15 интервью AM HR/бухгалтеров/IT из компаний 50–300, с конкретным процессом и current stack.
3. После Gate B — 3–5 платных/контрактных сопровождаемых пилотов с одинаковым core scope; гипотеза TTV/ROI проверяется цифрами.
4. После Gate C — AM публичный запуск и партнерские продажи через бухгалтерию/внедренцев.
5. СНГ/global discovery вести параллельно, но engineering локализацию и broad campaigns запускать только по подтвержденным buyer jobs, не по общему желанию охватить всех.

**90 дней — план организации работ, не гарантия закрытия всех gate или получения SOC 2 Type II.**

## 16. Что запросить у основателя, чтобы оценка стала коммерческой

- Число активных организаций и платящих клиентов, MRR, churn/retention, weekly active employees.
- Фактическая production-конфигурация/регион Convex, tenancy model, доступы infra и текущие vendor agreements (без передачи секретов в отчет).
- Средняя себестоимость tenant и поддержки, бюджет на внедрение/security/legal.
- 5 конкретных компаний из pipeline: страна, размер, отрасль, buyer, текущий стек, почему уходят, competitor quote.
- Что реально успешно интегрировалось: imID, SRC/bank uploads, Armsoft installations, ZKTeco models, SSO IdP.
- Customer references и права на публикацию; измеренные before/after metrics.
- Поддержка/дежурства/резерв команды: риск ключевого человека определяется не числом файлов, а возможностью исправить инцидент без основателя.

Без этого невозможно доказать product-market fit, revenue potential, CAC/LTV или enterprise win rate.

## 17. Источники и надежность

Все веб-источники ниже проверялись поиском/чтением 30.09.2026. **Vendor claims не независимые факты качества**; цифры клиентов/uptime/экономии из маркетинга не использовались как объективное превосходство.

### Армения

- [Spark.work: Armenian HR Tech Landscape 2026](https://spark.work/blog/armenian-hr-tech-landscape-2026) — обзор **самого конкурента**, полезен для discovery, не независимый рейтинг.
- [Hirebee](https://hirebee.ai/) — продуктовые направления; количественные marketing claims не верифицированы.
- [Hirebee HRMS Android](https://play.google.com/store/apps/details?id=ai.hirebee.essentialshub&hl=en_US) — store evidence через поиск.
- [List Work](https://www.listwork.am/welcome/en) — title/description и ограниченная извлеченная страница; полное hands-on не выполнено.
- [List Work Android](https://play.google.com/store/apps/details?id=am.listwork.mobile&hl=en_US) — store evidence через поиск.
- [Resalt](https://www.getresalt.com/) и [pricing](https://www.getresalt.com/pricing) — products/ops positioning и quote-based pricing; возможные discrepancies editions требуют demo.
- [Menthory](https://www.menthory.io/) — модули и free start; [iOS](https://apps.apple.com/ua/app/menthory/id6745610375?platform=watch) найден поиском.
- [Armenian Software](https://www.armsoft.am/?p=eph_paymanagir&lang=en) — кадровые/payroll функции и внедрение, search evidence.
- [OnTime](https://www.linkedin.com/company/ontimesoft) — vendor profile/search; локальный обзор Spark отдельно, сайт вендора Impex требует следующий review.
- [Logycore](https://logycore.com/en-us), [products](https://logycore.com/products) — knowledge/operations, search evidence.
- [staff.am](https://staff.am/), [packages](https://staff.am/our-packages) — job/recruiting канал.
- [HR Drone](https://hrdrone.am/) — matching/jobs канал.

### СНГ

- [PeopleForce pricing](https://peopleforce.io/pricing) — прочитанная страница: Core minima, модули, сравнение, support/mobile.
- [PeopleForce mobile](https://peopleforce.io/mobile-app) — search evidence.
- [1C:ЗУП](https://v8.1c.ru/hrm/), [Казахстан](https://1c.kz/v8/RegionalSolutions_KZ_ZUP.php) — официальные версии, search evidence.
- [Bitrix24 Enterprise HRM](https://www.bitrix24.ru/enterprise/hrm/) — прочитанная актуальная широкая HR-платформа.
- [SimpleOne HRMS](https://simpleone.ru/hrms) — прочитанные capabilities и target.
- [Mirapolis](https://www.mirapolis.ru/) — прочитанное full HCM/LMS/career/rewards описание.
- [Websoft HCM](https://websoft.ru/hcm) — прочитанное cloud/on-prem/mobile/process предложение.
- [HRBOX](https://www.hrbox.io/) — search evidence; [HRBOX.KZ](https://www.hrbox.kz/) — прочитанные language/mobile/service/architecture capabilities; динамический price widget не использован как надежный прайс.
- [Поток ATS обзор](https://potok.io/blog/hr-howto/top-10-crm-sistem-dlya-podbora-personala/) — discovery от вендора; [Huntflow ATS research](https://huntflow.media/wp-content/uploads/2025/06/ATS_Research_2025.pdf) найден поиском, PDF не прочитан полностью.

### Глобальные

- [BambooHR pricing](https://www.bamboohr.com/pricing/) — прочитанные $10/$17/$25, add-ons, shifts/compliance learning/rewards/AI.
- [Personio pricing](https://www.personio.com/pricing/) — официальный search snippet; direct fetch 429. Цена имеет меньшую confidence, чем прочитанный прайс.
- [HiBob](https://www.hibob.com/), [pricing](https://www.hibob.com/pricing-plans/) — search evidence HR/payroll/finance, точной общей цены нет.
- [Rippling](https://www.rippling.com/), [pricing](https://www.rippling.com/pricing), [HRIS article](https://www.rippling.com/blog/rippling-hris-review) — статью прочитали; self-review с потенциально неоднозначной base-fee фразой, не независимый обзор.
- [Factorial pricing](https://factorialhr.com/pricing-plans) — официальный search starting price.
- [Zoho People pricing/features](https://www.zoho.com/people/zohopeople-pricing.html) — прочитанное описание; динамические цены не извлеклись надежно, не выдуманы.
- [Odoo pricing](https://www.odoo.com/pricing), [payroll docs](https://www.odoo.com/documentation/19.0/applications/hr/payroll.html) — search evidence, user-based cost model.
- [Leapsome](https://www.leapsome.com/), [why](https://www.leapsome.com/why-leapsome), [Lattice pricing](https://lattice.com/pricing) — search evidence talent scope; точный одинаковый quote не получен.
- [Deel pricing](https://www.deel.com/pricing/), [Remote](https://remote.com/), [Remote pricing](https://remote.com/pricing) — search evidence employment/payroll scope.
- [Gusto pricing](https://gusto.com/product/pricing) — search evidence; точный сопоставимый scope quote не использован.
- [Workday HCM](https://www.workday.com/en-us/products/human-capital-management/overview.html), [SAP HCM](https://www.sap.com/products/hcm.html), [Oracle HCM](https://www.oracle.com/human-capital-management/) — официальные product descriptions через поиск.
- [UKG HCM](https://www.ukg.com/products/human-capital-management), [ADP Lyric](https://www.adp.com/what-we-offer/products/lyric.aspx) — enterprise/WFM scope, search evidence.
- [Keka](https://www.keka.com/us), [Darwinbox](https://darwinbox.com/careers) — HR/payroll/end-to-end HCM positioning через поиск.
- [Workable](https://www.workable.com/), [features](https://www.workable.com/features), [Greenhouse](https://www.greenhouse.com/platform) — recruiting/HR scope через поиск.
- [Connecteam pricing](https://connecteam.com/pricing/), [Deputy pricing](https://www.deputy.com/pricing), [Jibble face attendance](https://www.jibble.io/face-recognition-attendance-system) — официальные search evidence WFM/free attendance.

### Регуляторные

- [ФНС: пятиступенчатая шкала](https://www.nalog.gov.ru/rn05/news/activities_fts/16606654/) от 02.03.2026 — официальный поисковый текст содержит rates; direct page extraction вернула только title. Дополнительный официальный [материал 2025](https://www.nalog.gov.ru/rn77/news/tax_doc_news/15562179/) найден поиском.
- [EDPB: biometric workplace enforcement](https://www.edpb.europa.eu/news/biometrics-for-attendance-recording-the-italian-sa-fines-a-high-school-0_en) — прочитанный конкретный кейс; не универсальная legal opinion.
- [EDPB: lawful processing](https://www.edpb.europa.eu/sme/be-compliant/process-personal-data-lawfully_en) — official search guidance о свободе consent.
- [European Commission: AI Act](https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai) — прочитанные employment high-risk категории и актуальный график; юридическое заключение требуется отдельно.
- [152-ФЗ, официальный портал](http://pravo.gov.ru/proxy/ips/?docbody&nd=102108261) — discovery primary law; полное применение и изменения к конкретному buyer в этом аудите не анализировались.

### Репозиторий: важнейшие evidence paths

`convex/analytics.ts`, `convex/security.ts`, `convex/backups.ts`, `convex/aiGovernance.ts`, `convex/lib/auth.ts`, `convex/lib/rbac.ts`, `convex/lib/orgAccess.ts`, `convex/lib/getAuthCaller.ts`, `convex/lib/entitlements.ts`, `convex/faceRecognition.ts`, `convex/lib/taxRules.ts`, `convex/lib/payrollCalculator.ts`, `convex/shifts.ts`, `convex/schema/shifts.ts`, `convex/apiV1.ts`, `convex/learning.ts`, `convex/surveys.ts`, `convex/aiEvaluator.ts`, `convex/users/mutations.ts`, `convex/payments.ts`, `src/proxy.ts`, `src/lib/redis.ts`, `public/sw.js`, `src/lib/pricing.ts`, `src/lib/competitors.ts`, `convex/billing/modules.ts`, `jest.config.js`, `playwright.config.ts`, `.github/workflows/ci.yml`, `docs/automation.md`, `docs/public-api.md`, `docs/vendor-register.md`, `docs/soc2-type2-readiness.md`, `src/__tests__/market-readiness-audit.test.ts`.

---

## Итог для основателя

**Ваш проект достаточно содержателен, чтобы идти разговаривать с рынком. Недостаточно безопасен и доказан, чтобы сейчас заявлять готовность для всех стран и любых компаний.**

Наиболее рациональный путь: закрыть найденные P0, подтвердить полноту данных и локальные расчеты, получить пилоты 50–300 сотрудников в Армении, измерить пользу и экономику. После этого расширять рынок и глубину. Следующие новые модули сейчас дадут меньшую пользу, чем безопасная и надежная работа уже существующих.
