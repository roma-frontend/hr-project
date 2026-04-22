const fs = require('fs');
const path = require('path');

const en = JSON.parse(fs.readFileSync('src/i18n/locales/en.json', 'utf8'));
const ru = JSON.parse(fs.readFileSync('src/i18n/locales/ru.json', 'utf8'));
const hy = JSON.parse(fs.readFileSync('src/i18n/locales/hy.json', 'utf8'));

function getKeys(obj, prefix = '') {
  let keys = [];
  for (const key in obj) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      keys = keys.concat(getKeys(obj[key], newKey));
    } else {
      keys.push(newKey);
    }
  }
  return keys;
}

const enKeys = new Set(getKeys(en));
const ruKeys = new Set(getKeys(ru));
const hyKeys = new Set(getKeys(hy));

const missingInRu = [...enKeys].filter(k => !ruKeys.has(k)).sort();
const missingInHy = [...enKeys].filter(k => !hyKeys.has(k)).sort();
const missingInEnFromRu = [...ruKeys].filter(k => !enKeys.has(k)).sort();
const missingInEnFromHy = [...hyKeys].filter(k => !enKeys.has(k)).sort();
const missingInRuFromHy = [...hyKeys].filter(k => !ruKeys.has(k)).sort();
const missingInHyFromRu = [...ruKeys].filter(k => !hyKeys.has(k)).sort();

function getPlaceholders(obj, prefix = '') {
  let placeholders = [];
  for (const key in obj) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      placeholders = placeholders.concat(getPlaceholders(obj[key], newKey));
    } else {
      const val = obj[key];
      if (val === '' || val === null || val === undefined || val === 'TODO' || val === key) {
        placeholders.push(newKey);
      }
    }
  }
  return placeholders;
}

const ruPlaceholders = getPlaceholders(ru);
const hyPlaceholders = getPlaceholders(hy);

console.log('--- Key Counts ---');
console.log(`en: ${enKeys.size}`);
console.log(`ru: ${ruKeys.size}`);
console.log(`hy: ${hyKeys.size}`);

console.log('\n--- Missing in ru (compared to en) ---');
console.log(missingInRu.length > 0 ? missingInRu.join('\n') : 'None');

console.log('\n--- Missing in hy (compared to en) ---');
console.log(missingInHy.length > 0 ? missingInHy.join('\n') : 'None');

console.log('\n--- Missing in en (compared to ru) ---');
console.log(missingInEnFromRu.length > 0 ? missingInEnFromRu.join('\n') : 'None');

console.log('\n--- Missing in en (compared to hy) ---');
console.log(missingInEnFromHy.length > 0 ? missingInEnFromHy.join('\n') : 'None');

console.log('\n--- Missing in ru (compared to hy) ---');
console.log(missingInRuFromHy.length > 0 ? missingInRuFromHy.join('\n') : 'None');

console.log('\n--- Missing in hy (compared to ru) ---');
console.log(missingInHyFromRu.length > 0 ? missingInHyFromRu.join('\n') : 'None');

console.log('\n--- Placeholders/Empty in ru ---');
console.log(ruPlaceholders.length > 0 ? ruPlaceholders.join('\n') : 'None');

console.log('\n--- Placeholders/Empty in hy ---');
console.log(hyPlaceholders.length > 0 ? hyPlaceholders.join('\n') : 'None');
