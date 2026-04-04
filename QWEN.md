## Qwen Added Memories

- В проекте HR Office единый лоадер — ShieldLoader. Все loading states должны использовать только его (никаких других спиннеров). Компонент находится в @/components/ui/ShieldLoader.
- Рекомендации по улучшению HR Office проекта: 1) globals.css ~40KB — разбить на модули/CSS Modules; 2) Добавить Permissions-Policy заголовки; 3) OG image — заменить icon-192x192 на полноценный 1200x630; 4) Добавить breadcrumb навигацию; 5) Настроить staleTime/cacheTime в React Query глобально; 6) Добавить Service Worker/PWA для offline; 7) Уменьшить next.config.js (сейчас 12KB); 8) Добавить aria-\* аудит / axe-core для accessibility; 9) Добавить Suspense с loading.tsx на route groups; 10) CSRF_SECRET — обработка при отсутствии переменной
