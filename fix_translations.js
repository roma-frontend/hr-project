const fs = require('fs');
const path = require('path');

// Read all translation files
const enPath = path.join(__dirname, 'src', 'i18n', 'locales', 'en.json');
const ruPath = path.join(__dirname, 'src', 'i18n', 'locales', 'ru.json');
const hyPath = path.join(__dirname, 'src', 'i18n', 'locales', 'hy.json');

const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const ru = JSON.parse(fs.readFileSync(ruPath, 'utf8'));
const hy = JSON.parse(fs.readFileSync(hyPath, 'utf8'));

// Function to get nested value
function getNested(obj, path) {
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
}

// Function to set nested value
function setNested(obj, path, value) {
  const keys = path.split('.');
  const lastKey = keys.pop();
  const target = keys.reduce((o, key) => {
    if (!o[key]) o[key] = {};
    return o[key];
  }, obj);
  target[lastKey] = value;
}

// Armenian translations for missing keys
const hyTranslations = {
  'common.inactive': 'Ոչ ակտիվ',
  'common.noPosition': 'Պաշտոն չկա',
  'common.viewProfile': 'Դիտել պրոֆիլը',
  'common.edit': 'Խմբագրել',
  'common.loadMore': 'Բեռնել ևս',
  'common.view': 'Դիտել',
  'common.breakdown': 'Վերլուծություն',
  'common.deleting': 'Ջնջվում է...',
  'common.delete': 'Ջնջել',
  'attendance.thisMonthsAttendance': 'Այս ամսվա ներկայությունը',
  'attendance.daysWorked': 'Աշխատած օրեր',
  'attendance.totalHours': 'Ընդհանուր ժամեր',
  'attendance.punctuality': 'Ժամանակավայրություն',
  'attendance.lateDays': 'Ուշացած օրեր',
  'attendance.lateArrivals': 'Ուշացումներ',
  'attendance.earlyLeaves': 'Վաղ հեռացումներ',
  'employees.total': 'Ընդհանուր',
  'employees.addEmployee': 'Ավելացնել աշխատակից',
  'employees.infoBannerTitle': 'Աշխատակիցների կառավարում',
  'employees.infoBannerDesc': 'Ավելացրեք, խմբագրեք և կառավարեք ձեր կազմակերպության աշխատակիցներին',
  'employees.allRoles': 'Բոլոր դերերը',
  'employees.allTypes': 'Բոլոր տեսակները',
  'employees.allStatuses': 'Բոլոր կարգավիճակները',
  'employees.filter_all': 'Բոլորը',
  'employees.filter_active': 'Ակտիվ',
  'employees.filter_inactive': 'Ոչ ակտիվ',
  'employees.noPosition': 'Պաշտոն չկա',
  'employees.noSupervisor': 'Վերադաս չկա',
  'employees.noFound': 'Աշխատակիցներ չեն գտնվել',
  'employees.deactivated': 'Ապաակտիվացված',
  'employees.deactivateFailed': 'Չհաջողվեց ապաակտիվացնել աշխատակցին',
  'employees.deactivate': 'Ապաակտիվացնել',
  'employees.deactivateTitle': 'Ապաակտիվացնել աշխատակցին',
  'employees.deactivateDesc': 'Վստա՞հ եք, որ ցանկանում եք ապաակտիվացնել այս աշխատակցին: Նա կկորցնի համակարգ մուտք գործելու հնարավորությունը:',
  'employees.deactivatedBadge': 'Ապաակտիվացված',
  'employees.enterDetails': 'Մուտքագրեք աշխատակցի տվյալները',
  'employees.organization': 'Կազմակերպություն',
  'employees.position': 'Պաշտոն',
  'employees.contractorHint': 'Կապալառուները ունեն համակարգի սահմանափակ մուտք',
  'employees.department': 'Բաժին',
  'employees.role': 'Դեր',
  'employees.employeeType': 'Աշխատակցի տեսակ',
  'employees.staff': 'Անձնակազմ',
  'employees.contractor': 'Կապալառու',
  'employees.travelAllowance': 'Ճանապարհածախս',
  'employees.adding': 'Ավելացվում է...',
  'employees.confirmDelete': 'Հաստատեք ջնջումը',
  'employees.deleteWarning': 'Վստա՞հ եք, որ ցանկանում եք ջնջել այս աշխատակցին: Այս գործողությունը հնարավոր չեղարկել:',
  'employees.teamOverview': 'Թիմի ակնարկ',
  'employees.newMembers': 'Նոր անդամներ',
  'employees.active': 'Ակտիվ',
  'employees.inactive': 'Ոչ ակտիվ',
  'employees.supervisors': 'Վերադասներ',
  'employees.contractors': 'Կապալառուներ',
  'employees.teamHealthGood': 'Թիմը առողջ է',
  'employees.backToEmployees': 'Հետ աշխատակիցներին',
  'placeholders.select': 'Ընտրել...',
  'presence.available': 'Հասանելի',
  'presence.inMeeting': 'Հանդիպման մեջ',
  'presence.inCall': 'Զանգի մեջ',
  'presence.outOfOffice': 'Դուրս է գրասենյակից',
  'presence.busy': 'Զբաղված',
  'employeeProfile.aiScore': 'AI գնահատական',
  'employeeProfile.cancelRating': 'Չեղարկել գնահատականը',
  'employeeProfile.ratePerformance': 'Գնահատել կատարողականը',
  'employeeProfile.email': 'Էլ. փոստ',
  'employeeProfile.phone': 'Հեռախոս',
  'employeeProfile.department': 'Բաժին',
  'employeeProfile.joined': 'Միացել է',
  'employeeProfile.latestPerformanceRating': 'Վերջին կատարողականի գնահատականը',
  'employeeProfile.ratingHistory': 'Գնահատականների պատմություն',
  'employeeProfile.noRatingYet': 'Գնահատական դեռ չկա',
  'employeeProfile.addFirstRating': 'Ավելացնել առաջին գնահատականը',
  'employeeProfile.leaveBalances': 'Արձակուրդների մնացորդներ',
  'employeeProfile.paidLeave': 'Վճարովի արձակուրդ',
  'employeeProfile.sickLeave': 'Հիվանդության արձակուրդ',
  'employeeProfile.familyLeave': 'Ընտանեկան արձակուրդ',
  'employeeProfile.performance': 'Կատարողական',
  'employeeProfile.attendance': 'Ներկայություն',
  'employeeProfile.behavior': 'Վարքագիծ',
  'employeeProfile.leaveHistory': 'Արձակուրդների պատմություն',
  'employeeProfile.biography': 'Կենսագրություն',
  'employeeProfile.skills': 'Հմտություններ',
  'employeeProfile.languages': 'Լեզուներ',
  'employeeProfile.documents': 'Փաստաթղթեր'
};

// Russian placeholder fixes
const ruFixes = {
  'landingExtra.hero.eyebrow': 'Премиум HR платформа',
  'landingExtra.hero.title': 'Управляйте отпусками с помощью AI',
  'landingExtra.features.title': 'Все возможности в одном месте',
  'landingExtra.stats.stat1': '10,000+ сотрудников',
  'responseSLA.avgScore': 'Средний балл'
};

console.log('Adding missing Armenian translations...');
let addedHy = 0;
for (const [key, value] of Object.entries(hyTranslations)) {
  setNested(hy, key, value);
  addedHy++;
}

console.log('Fixing Russian placeholders...');
let fixedRu = 0;
for (const [key, value] of Object.entries(ruFixes)) {
  setNested(ru, key, value);
  fixedRu++;
}

// Write updated files
fs.writeFileSync(hyPath, JSON.stringify(hy, null, 2) + '\n', 'utf8');
fs.writeFileSync(ruPath, JSON.stringify(ru, null, 2) + '\n', 'utf8');

console.log(`\n✅ Complete!`);
console.log(`Added ${addedHy} Armenian translations`);
console.log(`Fixed ${fixedRu} Russian placeholders`);
console.log('\nFiles updated:');
console.log('- src/i18n/locales/hy.json');
console.log('- src/i18n/locales/ru.json');
