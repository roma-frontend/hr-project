const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, 'src', 'i18n', 'locales');
const files = {
  en: path.join(localesDir, 'en.json'),
  ru: path.join(localesDir, 'ru.json'),
  hy: path.join(localesDir, 'hy.json')
};

const translations = {
  en: {
    serviceBroadcast: {
      icons: {
        information: "Information",
        warning: "Warning",
        maintenance: "Maintenance",
        urgent: "Urgent",
        announcement: "Announcement",
        security: "Security",
        broadcast: "Broadcast",
        update: "Update"
      },
      duration: {
        "30min": "30 min",
        "1hour": "1 hour",
        "2hours": "2 hours",
        "3hours": "3 hours",
        "4hours": "4 hours",
        "unknown": "Unknown"
      },
      steps: {
        audience: "Audience",
        message: "Message",
        schedule: "Schedule",
        send: "Send"
      },
      errors: {
        fillTitleAndMessage: "Fill in the title and message",
        specifyStartTime: "Specify the maintenance start time",
        userNotLoaded: "User not loaded",
        sendingError: "Error sending"
      },
      scheduledMessage: {
        startsAt: "⏰ Maintenance will start at:",
        duration: "⏱️ Estimated duration:"
      },
      audience: {
        title: "Who will receive the message?",
        subtitle: "Select the target audience for the broadcast",
        allOrgs: "📢 All organizations",
        orgsCount: "organizations",
        specificOrg: "🏢 Specific organization",
        specificOrgSubtitle: "Select one organization",
        employees: "employees",
        activeUsersWillReceive: "active users will receive the message"
      },
      message: {
        title: "Message content",
        subtitle: "Write the title and message text",
        iconLabel: "Message icon",
        titleLabel: "Title",
        titlePlaceholder: "e.g., Planned system maintenance",
        contentLabel: "Message",
        contentPlaceholder: "Enter the message text that all users will receive...",
        infoText: "All active users will receive this in the \"System Announcements\" channel",
        characters: "characters"
      },
      schedule: {
        title: "Maintenance schedule",
        subtitle: "Schedule automatic activation of maintenance mode",
        scheduleMaintenance: "Schedule maintenance",
        scheduleDescription: "Send message now, but activate maintenance mode at a specific time",
        startTime: "Maintenance start time",
        estimatedDuration: "Estimated duration",
        willStartAt: "⏰ Maintenance will start:"
      },
      review: {
        title: "Review and send",
        subtitle: "Make sure everything is correct before sending",
        noTitle: "No title",
        noContent: "No content",
        scheduleLabel: "Maintenance:",
        organization: "organization",
        organizations: "organizations",
        allOrgsDescription: "All active users from all organizations",
        activeUsers: "Active users"
      },
      buttons: {
        back: "Back",
        next: "Next",
        sending: "Sending...",
        sendAndSchedule: "Send and schedule",
        sendToAll: "Send to all"
      },
      success: {
        withSchedule: "Message sent! Maintenance will automatically activate at the scheduled time.",
        withoutSchedule: "Message successfully sent to all users!"
      }
    }
  },
  ru: {
    serviceBroadcast: {
      icons: {
        information: "Информация",
        warning: "Предупреждение",
        maintenance: "Обслуживание",
        urgent: "Срочно",
        announcement: "Объявление",
        security: "Безопасность",
        broadcast: "Рассылка",
        update: "Обновление"
      },
      duration: {
        "30min": "30 мин",
        "1hour": "1 час",
        "2hours": "2 часа",
        "3hours": "3 часа",
        "4hours": "4 часа",
        "unknown": "Неизвестно"
      },
      steps: {
        audience: "Аудитория",
        message: "Сообщение",
        schedule: "Расписание",
        send: "Отправка"
      },
      errors: {
        fillTitleAndMessage: "Заполните заголовок и сообщение",
        specifyStartTime: "Укажите время начала обслуживания",
        userNotLoaded: "Пользователь не загружен",
        sendingError: "Ошибка при отправке"
      },
      scheduledMessage: {
        startsAt: "⏰ Техническое обслуживание начнётся в:",
        duration: "⏱️ Примерная длительность:"
      },
      audience: {
        title: "Кто получит сообщение?",
        subtitle: "Выберите целевую аудиторию для рассылки",
        allOrgs: "📢 Все организации",
        orgsCount: "организаций",
        specificOrg: "🏢 Конкретная организация",
        specificOrgSubtitle: "Выберите одну организацию",
        employees: "сотрудников",
        activeUsersWillReceive: "активных пользователей получат сообщение"
      },
      message: {
        title: "Содержание сообщения",
        subtitle: "Напишите заголовок и текст сообщения",
        iconLabel: "Иконка сообщения",
        titleLabel: "Заголовок",
        titlePlaceholder: "Например: Плановое обслуживание системы",
        contentLabel: "Сообщение",
        contentPlaceholder: "Введите текст сообщения, которое получат все пользователи...",
        infoText: "Все активные пользователи получат это в канале \"System Announcements\"",
        characters: "символов"
      },
      schedule: {
        title: "Расписание обслуживания",
        subtitle: "Запланируйте автоматическое включение режима обслуживания",
        scheduleMaintenance: "Запланировать техническое обслуживание",
        scheduleDescription: "Отправить сообщение сейчас, а режим обслуживания включить в определённое время",
        startTime: "Время начала обслуживания",
        estimatedDuration: "Примерная длительность",
        willStartAt: "⏰ Обслуживание начнётся:"
      },
      review: {
        title: "Проверьте и отправьте",
        subtitle: "Убедитесь, что всё верно перед отправкой",
        noTitle: "Без заголовка",
        noContent: "Без содержания",
        scheduleLabel: "Обслуживание:",
        organization: "организация",
        organizations: "организации",
        allOrgsDescription: "Все активные пользователи всех организаций",
        activeUsers: "Активные пользователи"
      },
      buttons: {
        back: "Назад",
        next: "Далее",
        sending: "Отправка...",
        sendAndSchedule: "Отправить и запланировать",
        sendToAll: "Отправить всем"
      },
      success: {
        withSchedule: "Сообщение отправлено! Техническое обслуживание автоматически включится в указанное время.",
        withoutSchedule: "Сообщение успешно отправлено всем пользователям!"
      }
    }
  },
  hy: {
    serviceBroadcast: {
      icons: {
        information: "Տեղեկատվություն",
        warning: "Զգուշացում",
        maintenance: "Սպասարկում",
        urgent: "Անհետաձգելի",
        announcement: "Հայտարարություն",
        security: "Անվտանգություն",
        broadcast: "Հեռարձակում",
        update: "Թարմացում"
      },
      duration: {
        "30min": "30 րոպե",
        "1hour": "1 ժամ",
        "2hours": "2 ժամ",
        "3hours": "3 ժամ",
        "4hours": "4 ժամ",
        "unknown": "Անհայտ"
      },
      steps: {
        audience: "Լսարան",
        message: "Հաղորդագրություն",
        schedule: "Ժամանակացույց",
        send: "Ուղարկել"
      },
      errors: {
        fillTitleAndMessage: "Լրացրեք վերնագիրը և հաղորդագրությունը",
        specifyStartTime: "Նշեք սպասարկման մեկնարկի ժամը",
        userNotLoaded: "Օգտատերը բեռնված չէ",
        sendingError: "Սխալ ուղարկելիս"
      },
      scheduledMessage: {
        startsAt: "⏰ Սպասարկումը կսկսվի՝",
        duration: "⏱️ Մոտավոր տևողությունը՝"
      },
      audience: {
        title: "Ո՞վ կստանա հաղորդագրությունը:",
        subtitle: "Ընտրեք թիրախային լսարանը հեռարձակման համար",
        allOrgs: "📢 Բոլոր կազմակերպությունները",
        orgsCount: "կազմակերպություններ",
        specificOrg: "🏢 Կոնկրետ կազմակերպություն",
        specificOrgSubtitle: "Ընտրեք մեկ կազմակերպություն",
        employees: "աշխատակիցներ",
        activeUsersWillReceive: "ակտիվ օգտատերերը կստանան հաղորդագրությունը"
      },
      message: {
        title: "Հաղորդագրության բովանդակություն",
        subtitle: "Գրեք վերնագիրը և հաղորդագրության տեքստը",
        iconLabel: "Հաղորդագրության պատկերակ",
        titleLabel: "Վերնագիր",
        titlePlaceholder: "Օրինակ՝ Պլանային համակարգի սպասարկում",
        contentLabel: "Հաղորդագրություն",
        contentPlaceholder: "Մուտքագրեք հաղորդագրության տեքստը, որը կստանան բոլոր օգտատերերը...",
        infoText: "Բոլոր ակտիվ օգտատերերը կստանան սա \"System Announcements\" ալիքում",
        characters: "նիշեր"
      },
      schedule: {
        title: "Սպասարկման ժամանակացույց",
        subtitle: "Պլանավորեք սպասարկման ռեժիմի ավտոմատ ակտիվացումը",
        scheduleMaintenance: "Պլանավորել տեխնիկական սպասարկում",
        scheduleDescription: "Ուղարկել հաղորդագրությունը հիմա, բայց ակտիվացնել սպասարկման ռեժիմը կոնկրետ ժամանակ",
        startTime: "Սպասարկման մեկնարկի ժամ",
        estimatedDuration: "Մոտավոր տևողություն",
        willStartAt: "⏰ Սպասարկումը կսկսվի՝"
      },
      review: {
        title: "Ստուգեք և ուղարկեք",
        subtitle: "Համոզվեք, որ ամեն ինչ ճիշտ է ուղարկելուց առաջ",
        noTitle: "Առանց վերնագրի",
        noContent: "Առանց բովանդակության",
        scheduleLabel: "Սպասարկում՝",
        organization: "կազմակերպություն",
        organizations: "կազմակերպություններ",
        allOrgsDescription: "Բոլոր ակտիվ օգտատերերը բոլոր կազմակերպություններից",
        activeUsers: "Ակտիվ օգտատերեր"
      },
      buttons: {
        back: "Հետ",
        next: "Հաջորդ",
        sending: "Ուղարկում...",
        sendAndSchedule: "Ուղարկել և պլանավորել",
        sendToAll: "Ուղարկել բոլորին"
      },
      success: {
        withSchedule: "Հաղորդագրությունն ուղարկված է: Սպասարկումը ավտոմատ կերպով կակտիվանա նշված ժամանակ:",
        withoutSchedule: "Հաղորդագրությունը հաջողությամբ ուղարկվեց բոլոր օգտատերերին:"
      }
    }
  }
};

Object.keys(files).forEach(lang => {
  console.log(`Processing ${lang}...`);
  const data = JSON.parse(fs.readFileSync(files[lang], 'utf8'));
  
  // Merge the new translations
  data.serviceBroadcast = translations[lang].serviceBroadcast;
  
  // Write back
  fs.writeFileSync(files[lang], JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`✓ ${lang} updated`);
});

console.log('\nAll files updated successfully!');
