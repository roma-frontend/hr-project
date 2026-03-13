# ✅ Исправление редиректа на /dashboard при обновлении страницы

## 🐛 Проблема:
При обновлении страницы на `/drivers`, `/calendar`, `/leaves` и т.д. пользователя перекидывало на `/dashboard`.

## 🔍 Причина:
В `middleware.ts` была логика:

```typescript
// Если пользователь уже авторизован и заходит на auth routes
if (isAuthRoute && (token || nextAuthToken)) {
  // ...
  // Иначе редиректим на dashboard
  return NextResponse.redirect(new URL('/dashboard', request.url));
}
```

Это означало, что **даже если пользователь просто обновил страницу**, middleware перенаправлял его на `/dashboard`.

## ✅ Решение:
Изменена логика в `src/middleware.ts`:

**БЫЛО:**
```typescript
if (isAuthRoute && (token || nextAuthToken)) {
  const from = url.searchParams.get('from');
  
  if (from && from.startsWith('/')) {
    return NextResponse.redirect(new URL(from, request.url));
  }
  
  // ❌ Всегда редирект на dashboard
  return NextResponse.redirect(new URL('/dashboard', request.url));
}
```

**СТАЛО:**
```typescript
if (isAuthRoute && (token || nextAuthToken)) {
  const from = url.searchParams.get('from');
  
  // ✅ Редирект только если есть валидный 'from' параметр
  if (from && from.startsWith('/') && !from.startsWith('/login') && !from.startsWith('/register')) {
    return NextResponse.redirect(new URL(from, request.url));
  }
  
  // ✅ Иначе просто пропускаем запрос (обновление страницы)
  console.log(`[Middleware] Auth user on auth route, allowing: ${pathname}`);
  return NextResponse.next();
}
```

## 📋 Что изменилось:

1. **Убран редирект на /dashboard по умолчанию**
2. **Добавлена проверка** чтобы не редиректить обратно на login/register
3. **Добавлен лог** для отладки
4. **Используется `NextResponse.next()`** вместо `redirect()` для обновления страницы

## 🧪 Тестирование:

1. Откройте `/drivers`
2. Обновите страницу (F5)
3. **Ожидаемый результат:** Остаётесь на `/drivers`
4. **Было:** Перекидывало на `/dashboard`

Повторите для:
- `/calendar`
- `/leaves`
- `/attendance`
- `/tasks`
- `/analytics`

## 📁 Изменённые файлы:

| Файл | Изменения |
|------|-----------|
| `src/middleware.ts` | ✏️ Убран редирект на /dashboard |
| `src/components/RedirectDebug.tsx` | 🔥 Debug компонент (опционально) |
| `REDIRECT_DEBUG.md` | 🔥 Документация по диагностике |

---

**Версия:** 1.0.1  
**Дата:** 2026-03-12  
**Статус:** ✅ ИСПРАВЛЕНО
