# Plan: устранение unbounded `.collect()` в Convex

**Статус:** DRAFT / не начато. Контекст потерян, этот документ — source of truth.
**Baseline на момент составления:** `npx tsc --noEmit` = 0 ошибок, clean.
**Ветка:** текущая (создадим отдельную при старте).
**Дата:** 2026-05-12.

---

## 0. Как возобновить работу

Скинь мне этот файл с сообщением типа «продолжаем по этому плану с шага N». Я:

1. Перечитаю файл → пойму контекст без расследования.
2. Запущу `npx tsc --noEmit` → проверю, что baseline всё ещё 0.
3. Продолжу с указанного шага, отмечая прогресс по чек-листу в конце файла.

---

## 1. Почему исходная формулировка была неправильная

**Исходная задача:** «Миграция `.collect()` → `paginate()` по 375 местам».

**Что обнаружено при разведке (12 мая 2026):**

- `convex/pagination.ts` — собственный хелпер, но **никем не используется**. Ни один файл в `src/` не импортирует `usePaginatedQuery`, `encodeCursor`, `decodeCursor`.
- В проекте **ноль** вызовов `.paginate(...)` и `paginationOptsValidator`.
- Ручной анализ `convex/tasks.ts` (14 collects) показал: **0 из 14** реально подходят под `paginate()`. Потому что:
  - `TasksClient.tsx` — Kanban с `@dnd-kit`. Для drag-and-drop между колонками нужны ВСЕ задачи одновременно. Пагинация ломает UX.
  - То же самое: `Calendar`, `Analytics charts`, `Reports` — UX требует полного набора.

**Вывод:** слепая миграция `.collect() → paginate()` по всем 375 местам = поломка большой части UI + недели впустую потраченной работы.

**Правильная цель:** **«Устранение unbounded collect() с добавлением `.take(N)` cap + рефакторинг scan-then-filter паттернов»**. Real paginate — только там, где UX это поддерживает (linear scrollable lists).

---

## 2. Категории `.collect()` (классификатор)

| #     | Категория                                 | Признаки                                                                                                                                                                                   | Что делать                                                                                       |
| ----- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| **L** | Legit bounded                             | `.withIndex(key, q => q.eq(k, singleId)).collect()` — один ключ, ограниченный набор; внутри мутации-cascade (delete children by parentId); aggregation/count; небольшая справочная таблица | **ничего не делать**                                                                             |
| **U** | Unbounded list for UI где UX требует всех | `.query('tasks').order().collect()` — Kanban, Calendar, chart, full report                                                                                                                 | `.take(N)` cap + опц. warning «данные усечены» в UI                                              |
| **S** | Scan-then-filter (антипаттерн)            | `ctx.db.query('X').collect()` потом `.filter(...)` в памяти — грузит всю таблицу ради одного подмножества                                                                                  | **Рефакторить** — добавить индекс и использовать `withIndex`, либо `Promise.all` по известным id |
| **M** | Mutation / internal / cron                | `.collect()` внутри `mutation`/`internalMutation`/`action` — нет UI-контракта                                                                                                              | `.take(N)` cap для безопасности                                                                  |
| **P** | True paginate candidate                   | длинный линейный скролл (notifications feed, audit log, chat messages beyond viewport)                                                                                                     | `paginationOptsValidator` + `.paginate(opts)` на беке, `usePaginatedQuery` на фронте             |

**Ожидаемое распределение (гипотеза) из 375:**

- L (legit): ~150-200
- U (cap): ~100-120
- S (refactor): ~30-50
- M (cap): ~30-40
- P (real paginate): ~5-10

Сначала проверим гипотезу на реальных данных скриптом-классификатором (шаг 4.1).

---

## 3. Правила/рецепты

### 3.1. Constant для cap

Создать `convex/lib/limits.ts`:

```ts
// Default cap for bounded reads that must fit in one Convex function invocation.
// Convex hard limit: 16384 documents per query. Use 2000 as a sane default
// that covers 99% of orgs while keeping memory predictable.
export const DEFAULT_LIST_CAP = 2000;
export const SMALL_LIST_CAP = 500; // for per-user/per-task subsets
export const XLARGE_LIST_CAP = 8000; // use sparingly, only for admin reports
```

### 3.2. Рецепт U (cap для UI-list)

До:

```ts
const tasks = await ctx.db.query('tasks').order('desc').collect();
```

После:

```ts
import { DEFAULT_LIST_CAP } from './lib/limits';
const tasks = await ctx.db.query('tasks').order('desc').take(DEFAULT_LIST_CAP);
// TODO: if tasks.length === DEFAULT_LIST_CAP, UI should show "showing first N records" badge
```

Фронт **НЕ трогаем** — контракт `query → T[]` сохраняется. Zero UI churn.

### 3.3. Рецепт S (scan-then-filter)

До:

```ts
const allTasks = await ctx.db.query('tasks').collect();
const teamTasks = allTasks.filter((t) => employeeIds.includes(t.assignedTo));
```

После (если есть индекс `by_assigned_to`):

```ts
const teamTasks = (
  await Promise.all(
    employeeIds.map((id) =>
      ctx.db
        .query('tasks')
        .withIndex('by_assigned_to', (q) => q.eq('assignedTo', id))
        .take(SMALL_LIST_CAP),
    ),
  )
).flat();
```

Если индекса нет — добавить в `schema/*.ts` с миграцией типа `npx convex dev` подхватит автоматически.

### 3.4. Рецепт M (mutation cap)

До:

```ts
// Inside mutation
const comments = await ctx.db
  .query('taskComments')
  .withIndex('by_task', (q) => q.eq('taskId', taskId))
  .collect();
for (const c of comments) await ctx.db.delete(c._id);
```

После:

```ts
const comments = await ctx.db
  .query('taskComments')
  .withIndex('by_task', (q) => q.eq('taskId', taskId))
  .take(SMALL_LIST_CAP);
for (const c of comments) await ctx.db.delete(c._id);
// NOTE: if a task has >500 comments, cascade delete is partial. Acceptable for MVP.
```

### 3.5. Рецепт P (real paginate)

Только там, где UI — linear feed (notifications list, audit log page, chat history).

Backend:

```ts
import { paginationOptsValidator } from 'convex/server';
export const listNotifications = query({
  args: { userId: v.id('users'), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { userId, paginationOpts }) => {
    return await ctx.db
      .query('notifications')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .order('desc')
      .paginate(paginationOpts);
  },
});
```

Фронт:

```tsx
const { results, status, loadMore } = usePaginatedQuery(
  api.notifications.listNotifications,
  { userId },
  { initialNumItems: 20 },
);
```

---

## 4. План по шагам

### 4.1. Шаг 1: классификатор (2-3ч) ⏳

Написать `scripts/classify-collects.mjs`, который:

1. Грепает все `.collect()` в `convex/**/*.ts`.
2. Для каждого вызова смотрит контекст (±10 строк):
   - Наличие `.withIndex(` в цепочке → **L кандидат**.
   - Наличие `.order('desc')` без `withIndex` → **U кандидат** (большой list).
   - Наличие `.filter(` или `allX.filter(` на следующих строках → **S кандидат**.
   - Внутри `mutation({` или `internalMutation({` или `action({` → **M кандидат**.
   - Имя функции содержит `paginate|Paginate|feed|Feed|history|History|log|Log` → **P кандидат**.
3. Выводит CSV: `file,line,function,collectSnippet,category,confidence`.

**Deliverable:** `docs/collect-classification.csv` — ручная верификация по 20 выборкам.

### 4.2. Шаг 2: создать `convex/lib/limits.ts` (5 мин)

Файл как в §3.1.

### 4.3. Шаг 3: pilot — `convex/tasks.ts` (1-2ч)

Применить категории (ручная разметка уже сделана в §3 — 8 legit / 2 S / 4 U / 0 P):

| Функция                                               | Line (прибл.) | Категория | Действие                                                           |
| ----------------------------------------------------- | ------------- | --------- | ------------------------------------------------------------------ |
| `enrichTasksWithUserData` — `allComments`             | 22            | **S**     | Refactor: grep `taskComments` по tasks через Promise.all+withIndex |
| `deleteTask` cascade                                  | 207           | **M**     | `.take(SMALL_LIST_CAP)`                                            |
| `getTasksForEmployee`                                 | 278           | **U**     | `.take(DEFAULT_LIST_CAP)`                                          |
| `getTasksAssignedBy`                                  | 299           | **U**     | `.take(DEFAULT_LIST_CAP)`                                          |
| `getAllTasks`                                         | 330           | **U**     | `.take(DEFAULT_LIST_CAP)`                                          |
| `getTeamTasks` — allTasks                             | 359           | **S**     | Refactor: Promise.all по employeeIds                               |
| `getTeamTasks` — employees                            | 355           | **L**     | оставить                                                           |
| `getMyEmployees`                                      | 370           | **L**     | оставить (по supervisorId — bounded)                               |
| `getUsersForAssignment` — `.query('users').collect()` | 380           | **S**     | Scope by organizationId from the start (сейчас всё и потом фильтр) |
| `getSupervisors` — supervisors                        | 411           | **L**     | оставить                                                           |
| `getSupervisors` — admins                             | 415           | **L**     | оставить                                                           |
| `getTaskComments`                                     | 525           | **L**     | оставить                                                           |
| `getAllTasksRaw`                                      | 545           | **L**     | оставить (migration-only)                                          |
| `getTask` comments                                    | 570           | **L**     | оставить                                                           |

**Verify:** `npx tsc --noEmit` = 0; `npm run lint` = 0 warnings в изменённых файлах.

### 4.4. Шаг 4: пройти по приоритету файлов (25-35ч)

Порядок — по числу `.collect()` в файле (больше → раньше):

**Hi-priority (≥15 collects, ~6 файлов, ~120 мест):**

1. `convex/backups.ts` — 26
2. `convex/recruitment.ts` — 21
3. `convex/surveys.ts` — 20
4. `convex/goals.ts` — 18
5. `convex/learning.ts` — 16
6. `convex/onboarding.ts` — 16
7. `convex/performance.ts` — 15

**Mid-priority (7-14 collects, ~13 файлов, ~110 мест):**

- `tasks.ts` (pilot, уже), `analytics.ts` (11), `expenses.ts` (10), `signatures.ts` (10), `admin.ts` (9), `compliance.ts` (9), `events.ts` (9), `payroll/queries.ts` (9), `timeTracking.ts` (8), `auth_module/main.ts` (7), `chat/mutations.ts` (7), `compensation.ts` (7), `tickets.ts` (7)

**Low-priority (2-6 collects, ~35 файлов, ~130 мест):**

- всё остальное из списка в §5.

**Ритм:** не больше 3-4 файлов за присест. После каждого файла:

1. `npx tsc --noEmit` → 0 ошибок.
2. Рекомендованный быстрый прогон: `npm run lint -- --quiet convex/<file>.ts`.
3. Мелкий commit: `refactor(convex): cap unbounded collect() in <file>`.

### 4.5. Шаг 5: true-paginate проход (2-3ч)

Найти кандидаты P — обычно в:

- `convex/notifications.ts` — UI feed уведомлений
- `convex/chat/mutations.ts`/`chat/queries.ts` — история чата
- `convex/compliance.ts`, `convex/security.ts` — audit log
- `convex/messenger/messages.ts` — messenger history

Мигрировать их на `paginationOptsValidator` + обновить фронт на `usePaginatedQuery`. **Это единственные места, где трогаем UI**. Примерно 5-10 call-sites.

### 4.6. Шаг 6: финал (30 мин)

1. Удалить `convex/pagination.ts` (если никто так и не импортирует — проверить `grep -r "pagination" src/ convex/`).
2. Полный прогон:
   ```powershell
   npx tsc --noEmit
   npm run lint
   npm run test
   npm run build
   ```
3. Коммит: `chore: remove unused convex/pagination.ts helper`.

---

## 5. Полный список файлов по приоритету (из grep на 12 мая)

```
26 convex\backups.ts
21 convex\recruitment.ts
20 convex\surveys.ts
18 convex\goals.ts
16 convex\learning.ts
16 convex\onboarding.ts
15 convex\performance.ts
14 convex\tasks.ts                  ← PILOT
11 convex\analytics.ts
10 convex\expenses.ts
10 convex\signatures.ts
 9 convex\admin.ts
 9 convex\compliance.ts
 9 convex\events.ts
 9 convex\payroll\queries.ts
 8 convex\timeTracking.ts
 7 convex\auth_module\main.ts
 7 convex\chat\mutations.ts
 7 convex\compensation.ts
 7 convex\tickets.ts
 6 convex\aiChat.ts
 6 convex\documents.ts
 6 convex\offboarding.ts
 6 convex\payroll\mutations.ts
 6 convex\security.ts
 6 convex\sla.ts
 5 convex\aiEvaluator.ts
 5 convex\corporate.ts
 5 convex\productivity.ts
 5 convex\recognition.ts
 4 convex\careers.ts
 4 convex\drivers\driver_operations.ts
 4 convex\organizationJoinRequests.ts
 4 convex\positions.ts
 4 convex\users\mutations.ts
 3 convex\automation.ts
 3 convex\birthdays.ts
 3 convex\departments.ts
 3 convex\driverAI.ts
 3 convex\drivers\requests_mutations.ts
 3 convex\employeeProfiles.ts
 3 convex\organizationRequests.ts
 3 convex\supervisorRatings.ts
 2 convex\drivers\recurring_trips.ts
 2 convex\drivers\requests_queries.ts
 2 convex\employeeNotes.ts
 2 convex\leaves\mutations.ts
 2 convex\messenger\messages.ts
 2 convex\notifications.ts
 2 convex\superadmin\emergency.ts
 2 convex\users\admin.ts
 2 convex\users\auth.ts
 1 convex\aiChatMutations.ts
 1 convex\aiSiteEditor.ts
 1 convex\messenger\conversations.ts
 1 convex\migrations.ts
 1 convex\sharepointSync.ts
 1 convex\subscriptions.ts
 1 convex\subscriptions_admin.ts
 1 convex\userPreferences.ts
────
60 файлов, 375 collect() всего
```

---

## 6. Чек-лист прогресса (обновляй после каждого шага)

- [ ] 4.1. Классификатор написан + CSV с разметкой
- [ ] 4.2. `convex/lib/limits.ts` создан
- [ ] 4.3. Pilot `tasks.ts` смигрирован, build зелёный
- [ ] 4.4a. Hi-priority: `backups.ts`
- [ ] 4.4a. Hi-priority: `recruitment.ts`
- [ ] 4.4a. Hi-priority: `surveys.ts`
- [ ] 4.4a. Hi-priority: `goals.ts`
- [ ] 4.4a. Hi-priority: `learning.ts`
- [ ] 4.4a. Hi-priority: `onboarding.ts`
- [ ] 4.4a. Hi-priority: `performance.ts`
- [ ] 4.4b. Mid-priority (13 файлов)
- [ ] 4.4c. Low-priority (35 файлов)
- [ ] 4.5. True-paginate proход (notifications/chat/audit)
- [ ] 4.6. Удалить `convex/pagination.ts`, финальный build + test

---

## 7. Ограничения и решения

**Ограничение:** Convex функция может читать максимум 16384 документа за один вызов. `DEFAULT_LIST_CAP = 2000` гарантирует запас.

**Вопрос без ответа (решим по месту):** нужна ли UI-индикация «показано первые N записей» в каждом экране? Для pilot-а решим НЕТ — чтобы не ломать UI. Если кто-то жалуется — добавим badge задним числом. Прагматично.

**Риск:** если у какого-то тенанта уже >2000 записей в одной таблице, они увидят «обрезку». Смотри таблицу объёмов в prod до финала; если есть такой тенант — `DEFAULT_LIST_CAP = 4000` + предупреждение в UI для admin-view.

**Вне скоупа этого плана (следующие пункты техдолга):**

- Унификация auth
- RSC-миграция 62 страниц
- i18n dynamic namespaces
- Split `users` таблицы
- RBAC через `ctx.auth.getUserIdentity()`
- Типизация `chatMessages.reactions`
