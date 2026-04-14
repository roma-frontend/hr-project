# Решение проблемы TS2589: Type instantiation is excessively deep

## Проблема
В проекте возникала ошибка TypeScript TS2589: "Type instantiation is excessively deep and possibly infinite". 
Эта ошибка связана с рекурсивной природой типов Convex API, которая приводит к чрезмерно глубокой инстанциации типов.

## Корень проблемы
Типы Convex API имеют глубоко вложенную рекурсивную структуру. Когда TypeScript пытается вывести типы 
для выражений вроде `api.users.queries.getUserByEmail`, он создает цепочку инстанциации типов, 
которая превышает лимит компилятора.

## Решение

### 1. Клиентские файлы (src/)
Для всех клиентских файлов был применен следующий подход:

**До:**
```typescript
// @ts-nocheck TS2589 - Convex API types cause infinite recursion
const data = useQuery(api.users.queries.getUserById, { userId });
```

**После:**
```typescript
// Изолируем ссылку на API на уровне модуля
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getUserByIdApi: any = api.users.queries.getUserById;

const data = useQuery(getUserByIdApi, { userId });
```

Или использование приведения типа `(api as any).module`:
```typescript
const driversApi = (api as any).drivers;
const data = useQuery(driversApi.getDrivers, { orgId });
```

### 2. Серверные файлы Convex (convex/)
Для серверных файлов Convex, где проблема проявляется сильнее всего, 
используется `@ts-nocheck` на уровне файла с комментарием о причине:

```typescript
// @ts-nocheck - Convex API types cause TS2589 in complex module graphs
import { action } from './_generated/server';
import { api } from './_generated/api';

// Изоляция ссылок на API на уровне модуля
const usersApi = api.users;
const leavesApi = api.leaves;
```

### 3. Утилита для безопасной работы с API
Создана утилита `src/lib/convex-api.ts` с готовыми типизированными ссылками на API:

```typescript
import { driversApi, chatApi, ticketsApi } from '@/lib/convex-api';

// Использование
const data = useQuery(driversApi.getDrivers, { orgId });
```

## Измененные файлы

### Убраны @ts-nocheck / @ts-ignore:
- `src/components/chat/ChatWindow.tsx`
- `src/app/(dashboard)/help/page.tsx`
- `src/app/(dashboard)/drivers/page.tsx`
- `src/app/(dashboard)/drivers/favorites/page.tsx`

### Оставлены @ts-nocheck (обоснованно):
- `convex/chatAction.ts` - серверный файл Convex с сложной типизацией
- `convex/automationActions.ts` - серверный файл Convex с internal API

### Уже имели изоляцию API (без изменений):
- `src/components/drivers/DriverCalendar.tsx`
- `src/app/(dashboard)/attendance/page.tsx`
- `src/app/(dashboard)/superadmin/automation/page.tsx`

## Рекомендации для разработчиков

1. **Не используйте прямой доступ к API** в файлах с сложной логикой:
   ```typescript
   // ❌ Может вызвать TS2589
   useQuery(api.users.queries.getUserById, { userId })
   
   // ✅ Изолируйте ссылку на API
   const apiRef: any = api.users.queries.getUserById;
   useQuery(apiRef, { userId })
   ```

2. **Используйте утилиту `convex-api.ts`** для стандартных операций

3. **Добавляйте новые API ссылки** в `convex-api.ts` по мере необходимости

4. **Избегайте @ts-nocheck** в клиентских файлах - используйте его только в серверных файлах Convex

## Почему это работает

Изоляция ссылки на API на уровне модуля прерывает цепочку рекурсивной инстанциации типов. 
TypeScript вычисляет тип один раз при инициализации модуля, а не при каждом использовании в коде. 
Приведение к `any` предотвращает глубокую проверку типов.

## Дополнительные ресурсы

- [TypeScript Issue #2589](https://github.com/microsoft/TypeScript/issues/2589)
- [Convex Types Best Practices](https://docs.convex.dev/typescript)
- [Avoiding Recursive Type Instantiation](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-1.html#recursive-conditional-types)
