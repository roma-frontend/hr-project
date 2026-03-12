import { TourStep } from "./OnboardingTour";

export const loginTourSteps: TourStep[] = [
  {
    target: "#login-card",
    title: "👋 Добро пожаловать!",
    description: "Давайте быстро покажем вам все возможности входа в систему!",
    placement: "center",
    highlight: false,
  },
  {
    target: "#biometric-login",
    title: "🔐 Быстрый вход",
    description: "Используйте отпечаток пальца или Face ID для мгновенного доступа",
    placement: "bottom",
    highlight: true,
  },
  {
    target: "#email-login-form",
    title: "📧 Умный ввод Email",
    description: "Начните вводить email - система автоматически проверит его и предложит исправления опечаток!",
    placement: "right",
    highlight: true,
  },
  {
    target: "#email-login-form input[type='email'], #email-login-form input[id='email']",
    title: "✨ Автопроверка Email",
    description: "Если введете 'gmial.com', система предложит исправить на 'gmail.com'. Зеленая галочка = корректный email!",
    placement: "bottom",
    highlight: true,
  },
  {
    target: "#email-login-form div:has(input[type='password'])",
    title: "🔒 Безопасный пароль",
    description: "Нажмите на иконку глаза, чтобы показать/скрыть пароль. Все ваши данные защищены!",
    placement: "bottom",
    highlight: true,
  },
  {
    target: "#join-team-link",
    title: "👥 Присоединиться к команде",
    description: "Уже есть организация? Запросите доступ у администратора",
    placement: "left",
    highlight: true,
  },
  {
    target: "#create-org-link",
    title: "🏢 Создать организацию",
    description: "Создайте свою организацию и пригласите сотрудников",
    placement: "right",
    highlight: true,
  },
  {
    target: "#login-card",
    title: "🎉 Всё готово!",
    description: "Выберите удобный способ входа и начните работу! Приятного использования! 🚀",
    placement: "center",
    highlight: false,
  },
];
