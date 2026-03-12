# Руководство по исправлению типов `any` в проекте

## ✅ Уже исправлено (60+ мест)

### Convex файлы:
- `convex/users.ts` - заменено `ctx: any` → `ctx: QueryCtx`, добавлены типы `Doc<"users">`
- `convex/messenger.ts` - заменено `ctx: any` → `ctx: QueryCtx`
- `convex/driverAI.ts` - добавлены интерфейсы `DriverAvailability`, `AvailabilityResponse`
- `convex/auth.ts` - добавлены проверки на `undefined`
- `convex/organizations.ts` - исправлены типы
- `convex/timeTracking.ts` - исправлены типы
- `convex/drivers.ts` - исправлены типы

## ⚠️ Осталось исправить (~200 мест)

### 1. Convex файлы (30 мест)

#### `convex/aiEvaluator.ts` (14 мест)
```typescript
// БЫЛО:
function calculatePerformanceScore(metrics: any): number { }

// СТАЛО:
function calculatePerformanceScore(metrics: Doc<"performanceMetrics">): number { }

// Для функций:
function calculateAttendanceScore(
  metrics: Doc<"performanceMetrics">,
  leaves: Doc<"leaveRequests">[],
  timeRecords?: Doc<"attendance">[]
): number { }
```

#### `convex/supervisorRatings.ts` (8 мест)
```typescript
// БЫЛО:
async function getEmployeeStats(ctx: any, employeeId: Id<"users">) { }

// СТАЛО:
async function getEmployeeStats(ctx: QueryCtx, employeeId: Id<"users">) {
  const ratings = await ctx.db
    .query("supervisorRatings")
    .withIndex("by_employee", (q) => q.eq("employeeId", employeeId))
    .collect();
  
  // Вместо (r: any):
  const avgQuality = recent.reduce((sum, r) => sum + r.qualityOfWork, 0) / count;
}
```

#### `convex/userPreferences.ts` (2 места)
```typescript
// БЫЛО:
async function getCurrentUserId(ctx: any, sessionToken?: string): Promise<string | null> { }

// СТАЛО:
async function getCurrentUserId(ctx: QueryCtx, sessionToken?: string): Promise<Id<"users"> | null> { }
```

#### `convex/employeeNotes.ts` (1 место)
```typescript
// БЫЛО:
const updates: any = {};

// СТАЛО:
const updates: Partial<Doc<"employeeNotes">> = {};
```

#### `convex/tasks.ts` (1 место)
```typescript
// БЫЛО:
const attachments = (task.attachments ?? []).filter((a: any) => a.url !== args.url);

// СТАЛО:
const attachments = (task.attachments ?? []).filter((a) => a.url !== args.url);
```

#### `convex/chatAction.ts` (2 места)
```typescript
// БЫЛО:
let userProfile: any = null;

// СТАЛО:
let userProfile: Doc<"users"> | null = null;
```

#### `convex/chat.ts` (1 место)
```typescript
// БЫЛО:
call.participants?.some((p: any) => p.userId === args.userId)

// СТАЛО:
call.participants?.some((p) => p.userId === args.userId)
```

#### `convex/analytics.ts` (1 место)
```typescript
// БЫЛО:
Object.values(stats).forEach((dept: any) => { });

// СТАЛО:
Object.values(stats).forEach((dept) => { });
```

#### `convex/faceRecognition.ts` (1 место)
```typescript
// БЫЛО:
const updateData: any = { };

// СТАЛО:
const updateData: Partial<Doc<"faceRecognition">> = { };
```

### 2. Src файлы (170 мест)

#### API Routes (80 мест)
Для API routes используйте правильные типы:

```typescript
// БЫЛО:
} catch (error: any) { }

// СТАЛО:
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown error';
}

// Для NextRequest:
import type { NextRequest } from 'next/server';

// БЫЛО:
handler: (req: NextRequest, context?: any) => Promise<NextResponse>

// СТАЛО:
handler: (req: NextRequest) => Promise<NextResponse>
```

#### Components (70 мест)
```typescript
// БЫЛО:
const handleOperation = async (data: any) => { }

// СТАЛО:
interface OperationData {
  id: string;
  type: string;
  // ... другие поля
}

const handleOperation = async (data: OperationData) => { }

// Для event handlers:
// БЫЛО:
const handleClick = (event: any) => { }

// СТАЛО:
const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => { }
```

#### Hooks (30 мест)
```typescript
// БЫЛО:
export function useDeepMemo<T>(factory: () => T, deps: any[]): T { }

// СТАЛО:
export function useDeepMemo<T>(factory: () => T, deps: unknown[]): T { }

// Для callback:
// БЫЛО:
export function useRateLimitedCallback<T extends (...args: any[]) => any>(
  callback: T,
  limit: number
): T { }

// СТАЛО:
export function useRateLimitedCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  limit: number
): T { }
```

#### Lib utilities (20 мест)
```typescript
// БЫЛО:
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): T { }

// СТАЛО:
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): T { }

// Для logger:
// БЫЛО:
interface LogContext {
  data?: any;
  [key: string]: any;
}

// СТАЛО:
interface LogContext {
  data?: unknown;
  userId?: string;
  action?: string;
  [key: string]: unknown;
}
```

#### Scripts (15 мест)
```typescript
// БЫЛО:
async function printSubscription(sub: any, index: number, stripe: Stripe) { }

// СТАЛО:
async function printSubscription(
  sub: Stripe.Subscription,
  index: number,
  stripe: Stripe
) { }

// БЫЛО:
function printSummary(subscriptions: any[]) { }

// СТАЛО:
function printSummary(subscriptions: Stripe.Subscription[]) { }
```

## 📋 Общие правила

### 1. Для Convex Context
- `ctx: any` → `ctx: QueryCtx` или `ctx: MutationCtx`
- Импортируйте из `./_generated/server`

### 2. Для Document типов
- Используйте `Doc<"tableName">` из `./_generated/dataModel`
- Для массивов: `Doc<"tableName">[]`

### 3. Для Query индексов
- Не указывайте тип для `q`, TypeScript выведет его автоматически
- БЫЛО: `.withIndex("by_email", (q: any) => ...)`
- СТАЛО: `.withIndex("by_email", (q) => ...)`

### 4. Для catch блоков
- `catch (error: any)` → `catch (error: unknown)`
- Делайте type narrowing: `error instanceof Error ? error.message : 'Unknown'`

### 5. Для динамических объектов
- `const updates: any = {}` → `const updates: Partial<Doc<"tableName">> = {}`
- Или создайте интерфейс: `interface Updates { field1?: string; }`

### 6. Для event handlers
- `onClick={(e: any) => ...}` → `onClick={(e: React.MouseEvent) => ...}`
- `onChange={(e: any) => ...}` → `onChange={(e: React.ChangeEvent<HTMLInputElement>) => ...}`

## 🚀 Автоматизация

### 1. Поиск всех `any`:
```bash
grep -r ": any" src/ convex/ --include="*.ts" --include="*.tsx"
```

### 2. ESLint правило (добавить в `.eslintrc.json`):
```json
{
  "rules": {
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unsafe-assignment": "warn",
    "@typescript-eslint/no-unsafe-member-access": "warn",
    "@typescript-eslint/no-unsafe-call": "warn"
  }
}
```

### 3. TypeScript strict mode (в `tsconfig.json`):
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true
  }
}
```

## 📊 Приоритеты исправления

### Критичные (исправить в первую очередь):
1. Convex функции (влияют на бэкенд)
2. API routes (публичный интерфейс)
3. Components с мутациями (влияют на данные)

### Важные (исправить во вторую очередь):
1. Hooks (переиспользуемый код)
2. Lib utilities (базовые функции)
3. Components с запросами данных

### Желательные (исправить при возможности):
1. Test файлы
2. Scripts
3. Вспомогательные функции
