# 👑 Руководство для Супер-Админа

## Ваши привилегии

Как супер-админ (`romangulanyan@gmail.com`), вы имеете:

✅ **Полный доступ ко всем организациям**
✅ **Просмотр всех пользователей, задач, отпусков**
✅ **Создание и управление организациями**
✅ **Управление подписками и лимитами**
✅ **Доступ ко всем данным на платформе**

---

## Быстрый доступ к функциям

### 1. Управление организациями
**URL:** `/superadmin/organizations`

**Возможности:**
- Создать новую организацию
- Редактировать существующие
- Изменить план (Free/Pro/Enterprise)
- Изменить лимит сотрудников
- Деактивировать организацию

### 2. Управление подписками
**URL:** `/superadmin/subscriptions`

**Возможности:**
- Просмотр всех подписок
- Изменение планов
- Просмотр платёжной информации через Stripe

### 3. Stripe Dashboard
**URL:** `/superadmin/stripe-dashboard`

**Возможности:**
- Просмотр транзакций
- Графики роста
- Экспорт в PDF/Excel

---

## Проверка системы

### Скрипт быстрой проверки
Откройте Console (F12) и выполните:

```javascript
(async function superadminCheck() {
  console.log('👑 === ПРОВЕРКА СУПЕР-АДМИНА === 👑\n');
  
  const auth = JSON.parse(localStorage.getItem('hr-auth-storage') || '{}');
  const user = auth.state?.user;
  
  console.log('📧 Email:', user?.email);
  console.log('🎭 Роль:', user?.role);
  console.log('🏢 Organization ID:', user?.organizationId || 'Не привязан к организации');
  
  const isSuperadmin = user?.email === 'romangulanyan@gmail.com';
  console.log('\n✅ Статус супер-админа:', isSuperadmin ? 'ПОДТВЕРЖДЁН ✓' : '❌ НЕ ПОДТВЕРЖДЁН');
  
  if (!isSuperadmin) {
    console.error('⚠️ ВНИМАНИЕ: Вы не являетесь супер-админом!');
    console.log('Ожидаемый email: romangulanyan@gmail.com');
    console.log('Ваш email:', user?.email);
  }
  
  console.log('\n✅ Проверка завершена');
})();
```

---

## Что делать при обращении админа

### Шаг 1: Соберите информацию
Попросите админа предоставить:
1. **Email** его аккаунта
2. **Название организации**
3. **Скриншот проблемы**
4. **Скриншот Console (F12)**

### Шаг 2: Проверьте в Convex
1. Откройте: https://dashboard.convex.dev
2. Перейдите в Data → users
3. Найдите пользователя по email
4. Проверьте:
   - `organizationId` - должен быть заполнен
   - `role` - должна быть правильная роль
   - `isActive` - должно быть `true`
   - `isApproved` - должно быть `true`

### Шаг 3: Проверьте организацию
1. Data → organizations
2. Найдите организацию по ID
3. Проверьте:
   - `isActive` - должно быть `true`
   - `plan` - должен быть активный план
   - `employeeLimit` - не превышен ли лимит

### Шаг 4: Исправьте проблему

#### Проблема: Пользователь не видит сотрудников
**Причина:** Отсутствует `organizationId` в сессии

**Решение:**
```javascript
// В Convex Data → users найдите пользователя
// Убедитесь, что поле organizationId заполнено
// Попросите пользователя перелогиниться
```

#### Проблема: Превышен лимит сотрудников
**Причина:** План не позволяет добавить больше сотрудников

**Решение:**
1. Перейдите в `/superadmin/organizations`
2. Найдите организацию
3. Нажмите "Edit"
4. Увеличьте `Employee Limit` или измените `Plan`

#### Проблема: Задачи не загружаются
**Причина:** Нет `organizationId` или ошибка в запросе

**Решение:**
1. Проверьте Console пользователя на ошибки
2. Убедитесь, что `organizationId` присутствует в сессии
3. Проверьте Convex Logs на ошибки

---

## Как добавить нового админа организации

### Вариант 1: Через интерфейс (когда будет готов)
1. Перейдите в `/superadmin/organizations`
2. Выберите организацию
3. Нажмите "Add Admin"
4. Заполните форму

### Вариант 2: Через Convex Dashboard
1. Откройте: https://dashboard.convex.dev
2. Data → users
3. Создайте нового пользователя:
```json
{
  "organizationId": "<ID организации>",
  "name": "Имя Админа",
  "email": "admin@example.com",
  "passwordHash": "<хеш пароля>",
  "role": "admin",
  "employeeType": "staff",
  "department": "Management",
  "position": "Administrator",
  "isActive": true,
  "isApproved": true,
  "approvedAt": <текущая timestamp>,
  "travelAllowance": 20000,
  "paidLeaveBalance": 24,
  "sickLeaveBalance": 10,
  "familyLeaveBalance": 5,
  "createdAt": <текущая timestamp>
}
```

---

## Мониторинг платформы

### Ключевые метрики для отслеживания

1. **Количество организаций:**
   - Data → organizations → Count

2. **Количество пользователей:**
   - Data → users → Count

3. **Активные подписки:**
   - Data → subscriptions → Filter by status: "active"

4. **Задачи в системе:**
   - Data → tasks → Count

5. **Заявки на отпуск:**
   - Data → leaves → Count

### Автоматические отчёты
Используйте Stripe Dashboard для:
- Ежемесячный доход
- Графики роста
- Списки клиентов

---

## Backup и восстановление

### Как сделать backup данных

#### Вариант 1: Export из Convex
1. Convex Dashboard → Data
2. Выберите таблицу (users, organizations, tasks, etc.)
3. Export to JSON

#### Вариант 2: Через код
```bash
# Создайте скрипт backup
cd Desktop/office
node scripts/backup-data.js
```

### Восстановление данных
```bash
# Из backup файла
node scripts/restore-data.js --file=backup-2026-03-03.json
```

---

## Безопасность

### Ваш аккаунт защищён:
✅ Face ID блокировка после 3 неудачных попыток
✅ Логирование всех действий (Audit Logs)
✅ Доступ только с проверенного email

### Рекомендации:
- Используйте двухфакторную аутентификацию для email
- Регулярно проверяйте Audit Logs
- Не передавайте пароль третьим лицам

---

## Полезные ссылки

- **Convex Dashboard:** https://dashboard.convex.dev
- **Stripe Dashboard:** https://dashboard.stripe.com
- **GitHub Repo:** https://github.com/roma-frontend/hr-project
- **Vercel Dashboard:** https://vercel.com/dashboard

---

## Поддержка

Если возникли вопросы:
1. Проверьте TROUBLESHOOTING.md
2. Проверьте Convex Logs
3. Проверьте Console браузера (F12)

---

*Вы - единственный супер-админ. Используйте свои полномочия разумно!* 👑
