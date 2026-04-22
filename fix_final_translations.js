const fs = require('fs');
const path = require('path');

const enPath = path.join(__dirname, 'src', 'i18n', 'locales', 'en.json');
const ruPath = path.join(__dirname, 'src', 'i18n', 'locales', 'ru.json');
const hyPath = path.join(__dirname, 'src', 'i18n', 'locales', 'hy.json');

const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const ru = JSON.parse(fs.readFileSync(ruPath, 'utf8'));
const hy = JSON.parse(fs.readFileSync(hyPath, 'utf8'));

function setNested(obj, path, value) {
  const keys = path.split('.');
  const lastKey = keys.pop();
  const target = keys.reduce((o, key) => {
    if (!o[key]) o[key] = {};
    return o[key];
  }, obj);
  target[lastKey] = value;
}

// Russian translations for remaining items
const ruTranslations = {
  'driver.timeValidation.en': '🇬🇧 Время начала должно быть раньше времени окончания',
  'labels.email': 'Электронная почта',
  'employeeInfo.email': 'Электронная почта',
  'contact.email': 'Электронная почта',
  'impersonate.email': 'Электронная почта:',
  'departments.hr': 'Отдел кадров',
  'departments.it': 'ИТ',
  'dashboard.kpi': 'КПЭ',
  'statistics.kpi': 'КПЭ',
  'admin.webhooks': 'Вебхуки',
  'stripe.mrr': 'Ежемесячный доход',
  'stripeDashboard.mrr': 'Ежемесячный доход',
  'driversWizard.suv': 'Внедорожник'
};

// Armenian translations for remaining items
const hyTranslations = {
  'driver.timeValidation.en': '🇬🇧 Սկսման ժամանակը պետք է ավելի վաղ լինի, քան ավարտը',
  'labels.email': 'Էլեկտրոնային փոստ',
  'employeeInfo.email': 'Էլեկտրոնային փոստ',
  'contact.email': 'Էլեկտրոնային փոստ',
  'impersonate.email': 'Էլեկտրոնային փոստ:',
  'departments.hr': 'Մարդկային ռեսուրսներ',
  'departments.it': 'ՏՏ',
  'dashboard.kpi': 'ՀՑՑ',
  'statistics.kpi': 'ՀՑՑ',
  'admin.webhooks': 'Վեբխուկներ',
  'stripe.mrr': 'Ամսական եկամուտ',
  'stripeDashboard.mrr': 'Ամսական եկամուտ',
  'driversWizard.suv': 'Ջիպ'
};

let addedRu = 0;
let addedHy = 0;

for (const [key, value] of Object.entries(ruTranslations)) {
  setNested(ru, key, value);
  addedRu++;
}

for (const [key, value] of Object.entries(hyTranslations)) {
  setNested(hy, key, value);
  addedHy++;
}

fs.writeFileSync(ruPath, JSON.stringify(ru, null, 2) + '\n', 'utf8');
fs.writeFileSync(hyPath, JSON.stringify(hy, null, 2) + '\n', 'utf8');

console.log(`✅ Complete!`);
console.log(`Added ${addedRu} Russian translations`);
console.log(`Added ${addedHy} Armenian translations`);
