# 🔍 Диагностика проблемы с редиректом на /dashboard

## Проблема:
При обновлении страницы на `/drivers`, `/calendar`, `/leaves` и т.д. пользователя перекидывает на `/dashboard`.

## Возможные причины:

### 1. Middleware redirect
**Файл:** `src/middleware.ts`

Middleware проверяет авторизацию и может перенаправлять пользователя.

**Проверка:**
1. Откройте консоль браузера (F12)
2. Обновите страницу
3. Найдите логи `[Middleware]`

**Что искать:**
```
[Middleware] Path: /calendar, isAuth: false, isProtected: true, hasToken: true
```

Если видите такой лог, значит middleware **неправильно определяет тип роута**.

---

### 2. NextAuth redirect callback
**Файл:** `src/app/api/auth/[...nextauth]/route.ts`

Callback `redirect` может перенаправлять пользователя.

**Проверка:**
Проверьте логи NextAuth в консоли сервера.

---

### 3. Компоненты страниц
Некоторые страницы могут делать redirect при определенных условиях.

**Проверка:**
1. Откройте консоль браузера
2. Введите: `window.performance.getEntriesByType('navigation')[0]`
3. Проверьте `type: "reload"` или `"navigate"`

---

## 🔧 Решение

### Шаг 1: Добавьте RedirectDebug компонент

Вставьте в `src/app/(dashboard)/layout.tsx` или `src/app/(dashboard)/page.tsx`:

```tsx
import RedirectDebug from "@/components/RedirectDebug";

// В конце компонента:
<RedirectDebug />
```

### Шаг 2: Проверьте логи

1. Откройте консоль (F12)
2. Перейдите на `/drivers` или `/calendar`
3. Обновите страницу (F5)
4. Скопируйте логи

### Шаг 3: Проверьте middleware

Откройте консоль сервера (где запущен `npm run dev`) и найдите:

```
[Middleware] Path: /ваша_страница, isAuth: ..., isProtected: ...
```

---

## 📋 Checklist

- [ ] Проверить логи браузера
- [ ] Проверить логи сервера
- [ ] Проверить RedirectDebug вывод
- [ ] Проверить cookie `hr-auth-token` (должна быть)
- [ ] Проверить cookie `next-auth.session-token` (должна быть)

---

## 🐛 Если проблема в middleware

Middleware **не должен трогать** запросы на защищенные роуты если пользователь авторизован.

**Проверьте:**
```typescript
// Эта часть должна ПРОПУСКАТЬ запрос, а не редиректить
if (isProtectedRoute && !token && !nextAuthToken) {
  // Редирект на login ТОЛЬКО если нет токена
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('from', pathname);
  return NextResponse.redirect(loginUrl);
}

// Если токен есть — пропускаем!
return NextResponse.next();
```

---

## 🎯 Ожидаемое поведение

1. Пользователь на `/drivers`
2. Обновляет страницу (F5)
3. Middleware видит токен
4. Middleware пропускает запрос (`NextResponse.next()`)
5. Страница загружается

**НЕ должно быть:**
- Redirect на `/dashboard`
- Redirect на `/login`

---

**Версия:** 1.0.0  
**Дата:** 2026-03-12  
**Статус:** 🔄 Диагностика
