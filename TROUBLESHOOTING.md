# 🔧 Руководство по устранению проблем

## Как проверить, что всё работает?

### 1. Проверка логов браузера (F12)
```
1. Откройте приложение
2. Нажмите F12 (Developer Tools)
3. Перейдите на вкладку Console
4. Проверьте наличие ошибок (красный текст)
```

### 2. Проверка Network запросов
```
1. F12 → вкладка Network
2. Обновите страницу
3. Проверьте запросы:
   - Красные (Failed) = проблема
   - Зелёные (200 OK) = всё работает
```

### 3. Проверка данных в localStorage
```javascript
// Откройте Console (F12) и выполните:
localStorage.getItem('hr-auth-storage')
// Должен показать объект с user, token, isAuthenticated
```

## Частые проблемы и решения

### ❌ Проблема: Пустой список (сотрудники, задачи, отпуска)

**Причины:**
1. Отсутствует `organizationId` в сессии пользователя
2. Пользователь не принадлежит к организации

**Решение:**
```javascript
// 1. Проверьте сессию в Console:
const storage = JSON.parse(localStorage.getItem('hr-auth-storage'));
console.log('User data:', storage.state.user);
// Должно быть поле organizationId

// 2. Если organizationId отсутствует - перелогиньтесь
```

**Если не помогло:**
- Проверьте файл: `Desktop/office/src/app/api/auth/login/route.ts`
- Убедитесь, что строки 66 и 98 содержат `organizationId: result.organizationId`

---

### ❌ Проблема: Выпадающий список не открывается

**Причины:**
1. Z-index проблема (список под модальным окном)
2. Overflow hidden на родительском контейнере

**Решение:**
- Проверьте файл: `Desktop/office/src/components/ui/select.tsx`
- Строка 72 должна содержать: `z-[9999]`

---

### ❌ Проблема: "No employees found" в списке

**Причины:**
1. Пользователи в другой организации
2. `getAllUsers` не получает правильный `requesterId`

**Диагностика:**
```javascript
// В Console проверьте:
const user = JSON.parse(localStorage.getItem('hr-auth-storage')).state.user;
console.log('User ID:', user.id);
console.log('Organization ID:', user.organizationId);
```

**Решение:**
- Убедитесь, что `organizationId` присутствует в сессии
- Перелогиньтесь для обновления сессии

---

### ❌ Проблема: Задачи не загружаются

**Проверка в Convex:**
1. Откройте Convex Dashboard: https://dashboard.convex.dev
2. Перейдите в Functions → tasks
3. Проверьте, что функции принимают `requesterId`

**Файлы для проверки:**
- `Desktop/office/convex/tasks.ts` (строки 254, 215, 174)
- Должны содержать проверку `isSuperadmin`

---

## Быстрая диагностика для супер-админа

### Скрипт для проверки всех систем:
```javascript
// Вставьте в Console (F12):
(async function diagnose() {
  console.log('🔍 === ДИАГНОСТИКА СИСТЕМЫ === 🔍\n');
  
  // 1. Проверка авторизации
  const auth = JSON.parse(localStorage.getItem('hr-auth-storage') || '{}');
  console.log('✅ Авторизация:', auth.state?.isAuthenticated ? 'ДА' : '❌ НЕТ');
  console.log('👤 Пользователь:', auth.state?.user?.name || 'не найден');
  console.log('📧 Email:', auth.state?.user?.email || 'не найден');
  console.log('🏢 Organization ID:', auth.state?.user?.organizationId || '❌ ОТСУТСТВУЕТ');
  console.log('🎭 Роль:', auth.state?.user?.role || 'не найдена');
  
  // 2. Проверка Network
  console.log('\n📡 Проверка API:');
  console.log('Откройте вкладку Network и проверьте запросы');
  
  // 3. Проверка ошибок
  console.log('\n🐛 Ошибки в Console:');
  console.log('Проверьте выше - красный текст = проблема');
  
  console.log('\n✅ Диагностика завершена');
})();
```

---

## Как исправить файл, который "исчез"?

### Вариант 1: Восстановить из Git
```bash
# Показать список удалённых файлов
git log --diff-filter=D --summary

# Восстановить конкретный файл
git checkout HEAD~1 -- путь/к/файлу

# Или восстановить из конкретного коммита
git checkout <commit-hash> -- путь/к/файлу
```

### Вариант 2: Проверить историю изменений
```bash
# Показать последние изменения файла
git log -- путь/к/файлу

# Показать содержимое файла в конкретном коммите
git show <commit-hash>:путь/к/файлу
```

### Вариант 3: Использовать IDE
В VS Code / Antigravity:
1. Откройте Source Control (Ctrl+Shift+G)
2. Кликните правой кнопкой на файл
3. Выберите "Open File History"
4. Выберите нужную версию и восстановите

---

## Проверка целостности проекта

### Убедитесь, что все ключевые файлы на месте:
```bash
# Выполните в Terminal:
cd Desktop/office

# Проверка основных файлов
ls -la src/app/api/auth/login/route.ts
ls -la src/app/api/auth/face-login/route.ts
ls -la convex/tasks.ts
ls -la convex/users.ts
ls -la src/components/tasks/TasksClient.tsx
ls -la src/components/leaves/LeaveRequestModal.tsx
```

---

## Мониторинг в реальном времени

### Используйте Convex Dashboard
1. Откройте: https://dashboard.convex.dev
2. Выберите ваш проект
3. Перейдите в Logs
4. Отслеживайте запросы в реальном времени

### Добавьте логирование в код
```typescript
// Пример в любой функции:
console.log('[DEBUG] User:', user);
console.log('[DEBUG] Organization ID:', organizationId);
```

---

## Контакты для помощи

Если проблема не решается:
1. Опишите проблему подробно
2. Приложите скриншот Console (F12)
3. Приложите скриншот Network вкладки
4. Укажите, что делали до появления проблемы

---

## Чеклист перед деплоем

- [ ] Все тесты пройдены
- [ ] Нет ошибок в Console
- [ ] `organizationId` передаётся во всех API routes
- [ ] Супер-админ видит все данные
- [ ] Обычные пользователи видят только свою организацию
- [ ] Git коммиты сделаны с понятными сообщениями

---

*Последнее обновление: 2026-03-03*
