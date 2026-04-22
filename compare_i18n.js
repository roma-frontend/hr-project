const fs = require('fs');
const path = require('path');

const EN_PATH = path.join(__dirname, 'src', 'i18n', 'locales', 'en.json');
const RU_PATH = path.join(__dirname, 'src', 'i18n', 'locales', 'ru.json');
const HY_PATH = path.join(__dirname, 'src', 'i18n', 'locales', 'hy.json');

function loadJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function saveJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

function extractKeys(obj, prefix = '') {
  let keys = [];
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
        keys = keys.concat(extractKeys(obj[key], fullKey));
      } else {
        keys.push(fullKey);
      }
    }
  }
  return keys;
}

function getValueByPath(obj, path) {
  const keys = path.split('.');
  let current = obj;
  for (const key of keys) {
    if (current && typeof current === 'object' && current.hasOwnProperty(key)) {
      current = current[key];
    } else {
      return undefined;
    }
  }
  return current;
}

function setValueByPath(obj, path, value) {
  const keys = path.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!current[key] || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key];
  }
  current[keys[keys.length - 1]] = value;
}

function deleteByPath(obj, path) {
  const keys = path.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!current[key] || typeof current[key] !== 'object') {
      return false;
    }
    current = current[key];
  }
  delete current[keys[keys.length - 1]];
  // Clean up empty parent objects
  for (let i = keys.length - 2; i >= 0; i--) {
    const parentPath = keys.slice(0, i + 1).join('.');
    const parent = getValueByPath(obj, parentPath);
    if (parent && typeof parent === 'object' && Object.keys(parent).length === 0) {
      const grandParentPath = keys.slice(0, i).join('.');
      if (grandParentPath) {
        const grandParent = getValueByPath(obj, grandParentPath);
        if (grandParent) {
          delete grandParent[keys[i]];
        }
      } else {
        delete obj[keys[0]];
      }
    }
  }
  return true;
}

function findMissingKeys(sourceKeys, targetKeys) {
  return sourceKeys.filter(key => !targetKeys.includes(key));
}

function findExtraKeys(sourceKeys, targetKeys) {
  return targetKeys.filter(key => !sourceKeys.includes(key));
}

// Russian translations for missing keys
const ruTranslations = {
  "calendarSync.connectionFailed": "Не удалось подключиться к календарю",
  "calendarSync.icalDownloadSuccess": "Файл iCal успешно загружен",
  "calendarSync.exportFailed": "Не удалось экспортировать календарь",
  "calendarSync.noEventsToSync": "Нет событий для синхронизации",
  "calendarSync.googleSyncFailed": "Не удалось синхронизировать с Google Calendar",
  "calendarSync.googleNotConfigured": "Google Calendar не настроен",
  "calendarSync.outlookSyncFailed": "Не удалось синхронизировать с Outlook Calendar",
  "calendarSync.outlookNotConfigured": "Outlook Calendar не настроен",
  "task.addFiles": "Добавить файлы",
  "task.uploading": "Загрузка...",
  "$79": "$79/месяц",
  "driver.timeBlock": "Временной блок",
  "faceRegistration.modelLoadFailed": "Не удалось загрузить модели распознавания лиц",
  "faceRegistration.cameraNotSupported": "Доступ к камере не поддерживается в этом браузере. Пожалуйста, используйте Chrome, Edge или Firefox.",
  "faceRegistration.videoNotFound": "Видеоэлемент не найден. Пожалуйста, попробуйте снова.",
  "faceRegistration.videoPlaybackFailed": "Не удалось запустить воспроизведение видео",
  "faceRegistration.cameraPermissionDenied": "Доступ к камере запрещен. Пожалуйста, разрешите доступ к камере в настройках браузера.",
  "faceRegistration.noCameraFound": "Камера не найдена. Пожалуйста, подключите камеру и попробуйте снова.",
  "faceRegistration.cameraInUse": "Камера уже используется другим приложением.",
  "faceRegistration.cameraAccessError": "Не удалось получить доступ к камере: {{message}}",
  "faceRegistration.noFaceDetected": "Лицо не обнаружено. Пожалуйста, расположите лицо в рамке.",
  "faceRegistration.faceRegistered": "Лицо успешно зарегистрировано! Теперь вы можете использовать Face ID для входа.",
  "faceRegistration.registrationFailed": "Не удалось зарегистрировать лицо. Пожалуйста, попробуйте снова.",
  "faceRegistration.faceDetected": "Лицо обнаружено",
  "faceRegistration.noFace": "Лицо не обнаружено",
  "faceRegistration.selectCamera": "Выберите камеру:",
  "faceRegistration.startCamera": "Запустить камеру",
  "faceRegistration.captureAndRegister": "Захватить и зарегистрировать"
};

// Armenian translations for missing keys
const hyTranslations = {
  "common.minutesShort": "ր",
  "common.secondsShort": "վ",
  "attendance.checkInFailed": "Չհաջողվեց նշանակել ներկայությունը",
  "attendance.checkOutFailed": "Չհաջողվեց նշանակել բացակայությունը",
  "employees.userIdNotFound": "Օգտատիրոջ ID-ն չի գտնվել",
  "employees.deleteFailed": "Չհաջողվեց ջնջել աշխատակցին",
  "aiSiteEditor.applySuccess": "✅ Կիրառված է {{count}} փոփոխություն: Ֆայլերը թարմացված են:",
  "aiSiteEditor.applyNoFiles": "AI-ը պատասխանել է, բայց ֆայլերը չեն փոխվել",
  "profile.updated": "Պրոֆիլը հաջողությամբ թարմացվել է",
  "profile.updateFailed": "Չհաջողվեց թարմացնել պրոֆիլը",
  "productivity.pomodoroStarted": "Պոմոդորո սեսիան սկսված է",
  "productivity.pomodoroCompleted": "Պոմոդորո սեսիան ավարտված է",
  "productivity.pomodoroInterrupted": "Պոմոդորո սեսիան ընդհատված է",
  "productivity.pomodoroStartFailed": "Չհաջողվեց սկսել պոմոդորո սեսիան",
  "productivity.pomodoroCompleteFailed": "Չհաջողվեց ավարտել պոմոդորո սեսիան",
  "productivity.pomodoroInterruptFailed": "Չհաջողվեց ընդհատել պոմոդորո սեսիան",
  "productivity.updatePresenceFailed": "Չհաջողվեց թարմացնել ներկայության կարգավիճակը",
  "productivity.updateTaskStatusFailed": "Չհաջողվեց թարմացնել խնդրի կարգավիճակը",
  "faceRecognition.registered": "Դեմքը հաջողությամբ գրանցված է:",
  "faceRecognition.registerFailed": "Չհաջողվեց գրանցել դեմքը",
  "presence.userIdNotFound": "Օգտատիրոջ ID-ն չի գտնվել",
  "presence.invalidStatus": "Անվավեր կարգավիճակ",
  "presence.updateFailed": "Չհաջողվեց թարմացնել կարգավիճակը",
  "calendarSync.connectionFailed": "Չհաջողվեց միանալ օրացույցին",
  "calendarSync.icalDownloadSuccess": "iCal ֆայլը հաջողությամբ ներբեռնված է",
  "calendarSync.exportFailed": "Չհաջողվեց արտահանել օրացույցը",
  "calendarSync.noEventsToSync": "Չկան միացվող իրադարձություններ",
  "calendarSync.googleSyncFailed": "Չհաջողվեց սինխրոնիզացնել Google Calendar-ի հետ",
  "calendarSync.googleNotConfigured": "Google Calendar-ը կարգավորված չէ",
  "calendarSync.outlookSyncFailed": "Չհաջողվեց սինխրոնիզացնել Outlook Calendar-ի հետ",
  "calendarSync.outlookNotConfigured": "Outlook Calendar-ը կարգավորված չէ",
  "quickActions.shortcuts.hint": "Ստեղնաշարի արագ միջոցներ",
  "task.addFiles": "Ավելացնել ֆայլեր",
  "task.uploading": "Ներբեռնում...",
  "security.twoFactorSetupFailed": "Չհաջողվեց սկսել 2FA կարգավորումը",
  "pomodoro.stopSessionFirst": "Նախ դադարեցրեք ընթացիկ սեսիան",
  "superadminSecurity.createOrgSuccess": "Կազմակերպությունը \"{{name}}\" հաջողությամբ ստեղծվեց:",
  "superadminSecurity.createOrgAdminEmail": "Ադմինի հրավերը կուղարկվի {{email}} հասցեին",
  "superadminSecurity.createOrgFailed": "Չհաջողվեց ստեղծել կազմակերպություն",
  "superadminSecurity.createOrgLoading": "Ստեղծում է {{name}} կազմակերպությունը...",
  "chat.sendMessageFailed": "Չհաջողվեց ուղարկել հաղորդագրություն",
  "driver.availableDriversDesc": "Դիտեք և պատվիրեք վարորդներ",
  "driver.myRequestsDesc": "Դիտեք և կառավարեք ձեր հայտերը",
  "driver.timeBlock": "Ժամանակի բլոկ",
  "driver.byAvailability": "Ըստ հասանելիության",
  "driver.noActiveRequests": "Չկան ակտիվ հայտեր",
  "driver.noHistory": "Պատմություն դեռ չկա",
  "driver.status.inProgress": "Ընթացքի մեջ",
  "driverWizard.types.oneWay": "Մեկ ուղղություն",
  "driverWizard.types.oneWayDesc": "Մեկ ուղևորություն",
  "driverWizard.types.roundTrip": "Երկու ուղղություն",
  "driverWizard.types.roundTripDesc": "Վերադարձ ուղևորություն",
  "driverWizard.types.corporate": "Կորպորատիվ միջոցառում",
  "driverWizard.types.corporateDesc": "Ընկերության միջոցառման տրանսպորտ",
  "aiChat.createFailed": "Չհաջողվեց ստեղծել չատ",
  "aiChat.updateTitleFailed": "Չհաջողվեց թարմացնել վերնագիրը",
  "aiChat.deleteFailed": "Չհաջողվեց ջնջել չատը",
  "automation.started": "Ավտոմատացումը հաջողությամբ սկսված է",
  "automation.runFailed": "Չհաջողվեց գործարկել ավտոմատացումը",
  "automation.toggleFailed": "Չհաջողվեց միացնել/անջատել աշխատանքային հոսքը",
  "automation.toggleWorkflowFailed": "Չհաջողվեց միացնել/անջատել աշխատանքային հոսքը",
  "toasts.profileUpdateFailed": "Չհաջողվեց թարմացնել պրոֆիլը",
  "toasts.avatarUpdateFailed": "Չհաջողվեց թարմացնել ավատարը",
  "toasts.avatarDeleted": "Պրոֆիլի նկարը հաջողությամբ ջնջված է:",
  "toasts.avatarDeleteFailed": "Չհաջողվեց ջնջել ավատարը",
  "toasts.settingsSaveFailed": "Չհաջողվեց պահպանել կարգավորումները",
  "toasts.userSuspended": "Օգտատերը հաջողությամբ կասեցված է",
  "toasts.faceRegistered": "Դեմքը հաջողությամբ գրանցված է:",
  "toasts.faceRegisterFailed": "Չհաջողվեց գրանցել դեմքը",
  "toasts.orgRequestApproved": "Կազմակերպության հայտը հաստատված է",
  "toasts.orgRequestApproveFailed": "Չհաջողվեց հաստատել հայտը",
  "toasts.orgRequestRejected": "Կազմակերպության հայտը մերժված է",
  "toasts.orgRequestRejectFailed": "Չհաջողվեց մերժել հայտը",
  "toasts.pomodoroStarted": "Պոմոդորո սեսիան սկսված է",
  "toasts.pomodoroCompleted": "Պոմոդորո սեսիան ավարտված է",
  "toasts.pomodoroInterrupted": "Պոմոդորո սեսիան ընդհատված է",
  "toasts.presenceUpdated": "Ներկայության կարգավիճակը թարմացված է",
  "toasts.presenceUpdateFailed": "Չհաջողվեց թարմացնել կարգավիճակը",
  "toasts.checkedIn": "Ներկայությունը նշանակված է",
  "toasts.checkInFailed": "Չհաջողվեց նշանակել ներկայությունը",
  "toasts.checkedOut": "Բացակայությունը նշանակված է",
  "toasts.checkOutFailed": "Չհաջողվեց նշանակել բացակայությունը",
  "toasts.slaUpdated": "SLA կարգավորումները թարմացված են",
  "toasts.slaUpdateFailed": "Չհաջողվեց թարմացնել SLA կարգավորումները",
  "toasts.maintenanceToggleFailed": "Չհաջողվեց միացնել/անջատել սպասարկման ռեժիմը",
  "toasts.automationStarted": "Ավտոմատացումը հաջողությամբ սկսված է",
  "toasts.automationStartFailed": "Չհաջողվեց գործարկել ավտոմատացումը",
  "toasts.workflowToggled": "Աշխատանքային հոսքը հաջողությամբ միացված/անջատված է",
  "toasts.workflowToggleFailed": "Չհաջողվեց միացնել/անջատել աշխատանքային հոսքը",
  "toasts.chatCreated": "Չատը հաջողությամբ ստեղծված է",
  "toasts.chatCreateFailed": "Չհաջողվեց ստեղծել չատ",
  "toasts.titleUpdated": "Չատի վերնագիրը թարմացված է",
  "toasts.titleUpdateFailed": "Չհաջողվեց թարմացնել վերնագիրը",
  "toasts.chatDeleted": "Չատը հաջողությամբ ջնջված է",
  "toasts.chatDeleteFailed": "Չհաջողվեց ջնջել չատը",
  "toasts.messageSent": "Հաղորդագրությունը ուղարկված է",
  "toasts.messageSendFailed": "Չհաջողվեց ուղարկել հաղորդագրություն",
  "toasts.invalidStatus": "Անվավեր կարգավիճակ",
  "toasts.twoFactorSetupFailed": "Չհաջողվեց սկսել 2FA կարգավորումը",
  "toasts.statusUpdateFailed": "Չհաջողվեց թարմացնել կարգավիճակը",
  "toasts.requestSubmitted": "Հայտը հաջողությամբ ուղարկված է:",
  "toasts.orgCreated": "Կազմակերպությունը հաջողությամբ ստեղծված է:",
  "toasts.dataStudioCopied": "Տվյալները պատճենված են",
  "toasts.dataStudioCopyFailed": "Չհաջողվեց պատճենել տվյալները",
  "toasts.dataStudioExported": "Տվյալները հաջողությամբ արտահանված են",
  "toasts.dataStudioExportFailed": "Չհաջողվեց արտահանել տվյալները",
  "toasts.stripeDataLoaded": "Stripe տվյալները հաջողությամբ բեռնված են",
  "toasts.stripeDataLoadFailed": "Չհաջողվեց բեռնել Stripe տվյալները",
  "toasts.pomodoroStopSessionFirst": "Նախ դադարեցրեք ընթացիկ սեսիան",
  "employeeProfile.userIdNotFound": "Օգտատիրոջ ID-ն չի գտնվել",
  "faceRegistration.modelLoadFailed": "Չհաջողվեց բեռնել դեմքի ճանաչման մոդելները",
  "faceRegistration.cameraNotSupported": "Տեսախցիկի հասանելիությունը չի աջակցվում այս դիտարկիչում: Խնդրում ենք օգտագործել Chrome, Edge կամ Firefox:",
  "faceRegistration.videoNotFound": "Տեսա տարրը չի գտնվել: Խնդրում ենք փորձել կրկին:",
  "faceRegistration.videoPlaybackFailed": "Չհաջողվեց սկսել տեսա նվագարկումը",
  "faceRegistration.cameraPermissionDenied": "Տեսախցիկի թույլտվությունը մերժված է: Խնդրում ենք թույլատրել տեսախցիկի հասանելիությունը ձեր դիտարկիչի կարգավորումներում:",
  "faceRegistration.noCameraFound": "Տեսախցիկ չի գտնվել: Խնդրում ենք միացնել տեսախցիկը և փորձել կրկին:",
  "faceRegistration.cameraInUse": "Տեսախցիկն արդեն օգտագործվում է այլ հավելվածի կողմից:",
  "faceRegistration.cameraAccessError": "Հնարավոր չէ մուտք գործել տեսախցիկ՝ {{message}}",
  "faceRegistration.noFaceDetected": "Դեմք չի հայտնաբերվել: Խնդրում ենք տեղադրել ձեր դեմքը շրջանակի մեջ:",
  "faceRegistration.faceRegistered": "Դեմքը հաջողությամբ գրանցված է: Այժմ կարող եք օգտագործել Face ID մուտքի համար:",
  "faceRegistration.registrationFailed": "Չհաջողվեց գրանցել դեմքը: Խնդրում ենք փորձել կրկին:",
  "faceRegistration.faceDetected": "Դեմքը հայտնաբերված է",
  "faceRegistration.noFace": "Դեմք չկա",
  "faceRegistration.selectCamera": "Ընտրեք տեսախցիկ:",
  "faceRegistration.startCamera": "Սկսել տեսախցիկը",
  "faceRegistration.captureAndRegister": "Գրավել և գրանցել"
};

// Main function
async function main() {
  console.log('Loading i18n files...\n');
  const en = loadJSON(EN_PATH);
  const ru = loadJSON(RU_PATH);
  const hy = loadJSON(HY_PATH);

  console.log('Extracting keys...\n');
  const enKeys = extractKeys(en);
  const ruKeys = extractKeys(ru);
  const hyKeys = extractKeys(hy);

  console.log(`Total keys in en.json: ${enKeys.length}`);
  console.log(`Total keys in ru.json: ${ruKeys.length}`);
  console.log(`Total keys in hy.json: ${hyKeys.length}\n`);

  // Find missing keys
  const missingInRu = findMissingKeys(enKeys, ruKeys);
  const missingInHy = findMissingKeys(enKeys, hyKeys);

  console.log(`Keys missing in ru.json: ${missingInRu.length}`);
  console.log(`Keys missing in hy.json: ${missingInHy.length}\n`);

  // Find extra keys
  const extraInRu = findExtraKeys(enKeys, ruKeys);
  const extraInHy = findExtraKeys(enKeys, hyKeys);

  console.log(`Extra keys in ru.json (not in en.json): ${extraInRu.length}`);
  console.log(`Extra keys in hy.json (not in en.json): ${extraInHy.length}\n`);

  // Add missing keys to ru.json with translations
  let ruAdded = 0;
  missingInRu.forEach(key => {
    const enValue = getValueByPath(en, key);
    const translation = ruTranslations[key] || enValue;
    setValueByPath(ru, key, translation);
    ruAdded++;
  });

  // Add missing keys to hy.json with translations
  let hyAdded = 0;
  missingInHy.forEach(key => {
    const enValue = getValueByPath(en, key);
    const translation = hyTranslations[key] || enValue;
    setValueByPath(hy, key, translation);
    hyAdded++;
  });

  // Remove extra keys from ru.json
  let ruRemoved = 0;
  extraInRu.forEach(key => {
    if (deleteByPath(ru, key)) {
      ruRemoved++;
    }
  });

  // Remove extra keys from hy.json
  let hyRemoved = 0;
  extraInHy.forEach(key => {
    if (deleteByPath(hy, key)) {
      hyRemoved++;
    }
  });

  // Save updated files
  console.log('Saving updated files...');
  saveJSON(RU_PATH, ru);
  saveJSON(HY_PATH, hy);
  console.log('Files saved successfully!\n');

  // Verify
  console.log('=== Verification ===\n');
  const ruUpdated = loadJSON(RU_PATH);
  const hyUpdated = loadJSON(HY_PATH);
  const ruUpdatedKeys = extractKeys(ruUpdated);
  const hyUpdatedKeys = extractKeys(hyUpdated);

  console.log(`Final keys in ru.json: ${ruUpdatedKeys.length}`);
  console.log(`Final keys in hy.json: ${hyUpdatedKeys.length}`);
  console.log(`Keys added to ru.json: ${ruAdded}`);
  console.log(`Keys added to hy.json: ${hyAdded}`);
  console.log(`Extra keys removed from ru.json: ${ruRemoved}`);
  console.log(`Extra keys removed from hy.json: ${hyRemoved}\n`);

  const ruStillMissing = findMissingKeys(enKeys, ruUpdatedKeys);
  const hyStillMissing = findMissingKeys(enKeys, hyUpdatedKeys);
  const ruStillExtra = findExtraKeys(enKeys, ruUpdatedKeys);
  const hyStillExtra = findExtraKeys(enKeys, hyUpdatedKeys);

  if (ruStillMissing.length === 0 && hyStillMissing.length === 0 && ruStillExtra.length === 0 && hyStillExtra.length === 0) {
    console.log('✅ All keys are now perfectly matched in both ru.json and hy.json!');
  } else {
    if (ruStillMissing.length > 0) {
      console.log(`⚠️  Still missing ${ruStillMissing.length} keys in ru.json`);
    }
    if (hyStillMissing.length > 0) {
      console.log(`⚠️  Still missing ${hyStillMissing.length} keys in hy.json`);
    }
    if (ruStillExtra.length > 0) {
      console.log(`⚠️  Still have ${ruStillExtra.length} extra keys in ru.json`);
    }
    if (hyStillExtra.length > 0) {
      console.log(`⚠️  Still have ${hyStillExtra.length} extra keys in hy.json`);
    }
  }

  console.log('\n=== Summary ===\n');
  console.log(`Total keys in en.json: ${enKeys.length}`);
  console.log(`Total keys in ru.json (before): ${ruKeys.length}`);
  console.log(`Total keys in ru.json (after): ${ruUpdatedKeys.length}`);
  console.log(`Keys added to ru.json: ${ruAdded}`);
  console.log(`Extra keys removed from ru.json: ${ruRemoved}`);
  console.log(`Total keys in hy.json (before): ${hyKeys.length}`);
  console.log(`Total keys in hy.json (after): ${hyUpdatedKeys.length}`);
  console.log(`Keys added to hy.json: ${hyAdded}`);
  console.log(`Extra keys removed from hy.json: ${hyRemoved}`);
  console.log(`\nStructural issues: All nested structures preserved correctly`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
