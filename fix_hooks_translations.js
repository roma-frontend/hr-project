const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, 'src', 'i18n', 'locales');
const files = {
  en: path.join(localesDir, 'en.json'),
  ru: path.join(localesDir, 'ru.json'),
  hy: path.join(localesDir, 'hy.json')
};

const updates = {
  en: {
    users: {
      fetchOrgUsersFailed: "Failed to fetch org users",
      fetchMyEmployeesFailed: "Failed to fetch my employees",
      fetchUserFailed: "Failed to fetch user",
      suspendFailed: "Failed to suspend user",
      unsuspendFailed: "Failed to unsuspend user"
    },
    productivity: {
      fetchTodayStatsFailed: "Failed to fetch today stats",
      fetchTodayTasksFailed: "Failed to fetch today tasks",
      fetchTeamPresenceFailed: "Failed to fetch team presence",
      fetchActivePomodoroFailed: "Failed to fetch active pomodoro",
      startPomodoroFailed: "Failed to start pomodoro session",
      startPomodoroSuccess: "Pomodoro session started",
      completePomodoroFailed: "Failed to complete pomodoro session",
      completePomodoroSuccess: "Pomodoro session completed",
      interruptPomodoroFailed: "Failed to interrupt pomodoro session",
      interruptPomodoroSuccess: "Pomodoro session interrupted",
      updatePresenceFailed: "Failed to update presence",
      updatePresenceStatusFailed: "Failed to update presence status",
      updateTaskStatusFailed: "Failed to update task status"
    },
    approvals: {
      fetchPendingApprovalsFailed: "Failed to fetch pending approvals",
      approveUserFailed: "Failed to approve user",
      rejectUserFailed: "Failed to reject user"
    }
  },
  ru: {
    users: {
      fetchOrgUsersFailed: "Не удалось загрузить пользователей организации",
      fetchMyEmployeesFailed: "Не удалось загрузить моих сотрудников",
      fetchUserFailed: "Не удалось загрузить пользователя",
      suspendFailed: "Не удалось заблокировать пользователя",
      unsuspendFailed: "Не удалось разблокировать пользователя"
    },
    productivity: {
      fetchTodayStatsFailed: "Не удалось загрузить статистику за сегодня",
      fetchTodayTasksFailed: "Не удалось загрузить задачи на сегодня",
      fetchTeamPresenceFailed: "Не удалось загрузить присутствие команды",
      fetchActivePomodoroFailed: "Не удалось загрузить активную сессию помодоро",
      startPomodoroFailed: "Не удалось запустить сессию помодоро",
      startPomodoroSuccess: "Сессия помодоро запущена",
      completePomodoroFailed: "Не удалось завершить сессию помодоро",
      completePomodoroSuccess: "Сессия помодоро завершена",
      interruptPomodoroFailed: "Не удалось прервать сессию помодоро",
      interruptPomodoroSuccess: "Сессия помодоро прервана",
      updatePresenceFailed: "Не удалось обновить присутствие",
      updatePresenceStatusFailed: "Не удалось обновить статус присутствия",
      updateTaskStatusFailed: "Не удалось обновить статус задачи"
    },
    approvals: {
      fetchPendingApprovalsFailed: "Не удалось загрузить ожидающие подтверждения",
      approveUserFailed: "Не удалось подтвердить пользователя",
      rejectUserFailed: "Не удалось отклонить пользователя"
    }
  },
  hy: {
    users: {
      fetchOrgUsersFailed: "Չհաջողվեց բեռնել կազմակերպության օգտատերերին",
      fetchMyEmployeesFailed: "Չհաջողվեց բեռնել իմ աշխատակիցներին",
      fetchUserFailed: "Չհաջողվեց բեռնել օգտատիրոջը",
      suspendFailed: "Չհաջողվեց կասեցնել օգտատիրոջը",
      unsuspendFailed: "Չհաջողվեց վերականգնել օգտատիրոջը"
    },
    productivity: {
      fetchTodayStatsFailed: "Չհաջողվեց բեռնել այսօրվա վիճակագրությունը",
      fetchTodayTasksFailed: "Չհաջողվեց բեռնել այսօրվա խնդիրները",
      fetchTeamPresenceFailed: "Չհաջողվեց բեռնել թիմի ներկայությունը",
      fetchActivePomodoroFailed: "Չհաջողվեց բեռնել ակտիվ պոմոդորո նիստը",
      startPomodoroFailed: "Չհաջողվեց սկսել պոմոդորո նիստը",
      startPomodoroSuccess: "Պոմոդորո նիստը սկսվեց",
      completePomodoroFailed: "Չհաջողվեց ավարտել պոմոդորո նիստը",
      completePomodoroSuccess: "Պոմոդորո նիստն ավարտվեց",
      interruptPomodoroFailed: "Չհաջողվեց ընդհատել պոմոդորո նիստը",
      interruptPomodoroSuccess: "Պոմոդորո նիստն ընդհատվեց",
      updatePresenceFailed: "Չհաջողվեց թարմացնել ներկայությունը",
      updatePresenceStatusFailed: "Չհաջողվեց թարմացնել ներկայության կարգավիճակը",
      updateTaskStatusFailed: "Չհաջողվեց թարմացնել խնդրի կարգավիճակը"
    },
    approvals: {
      fetchPendingApprovalsFailed: "Չհաջողվեց բեռնել սպասվող հաստատումները",
      approveUserFailed: "Չհաջողվեց հաստատել օգտատիրոջը",
      rejectUserFailed: "Չհաջողվեց մերժել օգտատիրոջը"
    }
  }
};

Object.keys(files).forEach(lang => {
  console.log(`Processing ${lang}...`);
  const data = JSON.parse(fs.readFileSync(files[lang], 'utf8'));
  
  // Merge the new translations
  data.users = { ...data.users, ...updates[lang].users };
  data.productivity = updates[lang].productivity;
  data.approvals = updates[lang].approvals;
  
  // Write back
  fs.writeFileSync(files[lang], JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`✓ ${lang} updated`);
});

console.log('\nAll files updated successfully!');
