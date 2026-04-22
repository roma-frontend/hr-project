const fs = require('fs');
const path = require('path');

// Read all translation files
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

// Russian translations for security settings (currently in English)
const ruSecurityTranslations = {
  'settingsAdvancedSecurity.twoFactorDesc': 'Добавьте дополнительный уровень безопасности к вашему аккаунту',
  'settingsAdvancedSecurity.enable2faDesc': 'Требовать код подтверждения в дополнение к паролю',
  'settingsAdvancedSecurity.choose2fa': 'Выберите метод 2FA:',
  'settingsAdvancedSecurity.smsSms': 'SMS сообщение',
  'settingsAdvancedSecurity.emailCode': 'Код по Email',
  'settingsAdvancedSecurity.authenticatorApp': 'Приложение аутентификации (Google, Microsoft)',
  'driver.timeValidation.en': '🇬🇧 Start time must be earlier than end time'
};

// Armenian translations for security settings (already done, but let's verify)
const hySecurityTranslations = {
  'settingsAdvancedSecurity.twoFactorDesc': 'Ավելացրեք անվտանգության լրացուցիչ շերտ ձեր հաշվին',
  'settingsAdvancedSecurity.enable2faDesc': 'Պահանջեք ստուգման կոդ գաղտնաբառից բացի',
  'settingsAdvancedSecurity.choose2fa': 'Ընտրեք 2FA մեթոդ:',
  'settingsAdvancedSecurity.smsSms': 'SMS տեքստային հաղորդագրություն',
  'settingsAdvancedSecurity.emailCode': 'Email կոդ',
  'settingsAdvancedSecurity.authenticatorApp': 'Authenticator հավելված (Google, Microsoft)'
};

// Apply Russian translations
let addedRu = 0;
for (const [key, value] of Object.entries(ruSecurityTranslations)) {
  setNested(ru, key, value);
  addedRu++;
}

// Apply Armenian translations
let addedHy = 0;
for (const [key, value] of Object.entries(hySecurityTranslations)) {
  setNested(hy, key, value);
  addedHy++;
}

// Write updated files
fs.writeFileSync(ruPath, JSON.stringify(ru, null, 2) + '\n', 'utf8');
fs.writeFileSync(hyPath, JSON.stringify(hy, null, 2) + '\n', 'utf8');

console.log(`✅ Complete!`);
console.log(`Added ${addedRu} Russian translations`);
console.log(`Added ${addedHy} Armenian translations`);
console.log('\nFiles updated:');
console.log('- src/i18n/locales/ru.json');
console.log('- src/i18n/locales/hy.json');
