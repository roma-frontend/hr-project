const fs = require('fs');

function getAllKeys(obj, parentKey = '') {
    let keys = new Set();
    if (typeof obj === 'object' && obj !== null) {
        for (const k in obj) {
            const fullKey = parentKey ? `${parentKey}.${k}` : k;
            keys.add(fullKey);
            const subKeys = getAllKeys(obj[k], fullKey);
            subKeys.forEach(k => keys.add(k));
        }
    }
    return keys;
}

function getValue(obj, key) {
    const parts = key.split('.');
    let current = obj;
    for (const part of parts) {
        if (typeof current === 'object' && current !== null && part in current) {
            current = current[part];
        } else {
            return undefined;
        }
    }
    return current;
}

const enData = JSON.parse(fs.readFileSync('src/i18n/locales/en.json', 'utf-8'));
const ruData = JSON.parse(fs.readFileSync('src/i18n/locales/ru.json', 'utf-8'));
const hyData = JSON.parse(fs.readFileSync('src/i18n/locales/hy.json', 'utf-8'));

const enKeys = getAllKeys(enData);
const ruKeys = getAllKeys(ruData);
const hyKeys = getAllKeys(hyData);

const missingInRu = [...enKeys].filter(k => !ruKeys.has(k));
const missingInHy = [...enKeys].filter(k => !hyKeys.has(k));

function isUntranslated(enVal, targetVal) {
    if (enVal === undefined || targetVal === undefined) return false;
    if (typeof enVal !== 'string' || typeof targetVal !== 'string') return false;
    return enVal.trim().toLowerCase() === targetVal.trim().toLowerCase();
}

const untranslatedRu = [];
const untranslatedHy = [];

for (const key of enKeys) {
    if (ruKeys.has(key)) {
        const enVal = getValue(enData, key);
        const ruVal = getValue(ruData, key);
        if (isUntranslated(enVal, ruVal)) {
            untranslatedRu.push({ key, val: enVal });
        }
    }
    if (hyKeys.has(key)) {
        const enVal = getValue(enData, key);
        const hyVal = getValue(hyData, key);
        if (isUntranslated(enVal, hyVal)) {
            untranslatedHy.push({ key, val: enVal });
        }
    }
}

console.log('=== MISSING IN RU ===');
missingInRu.sort().forEach(key => {
    const val = getValue(enData, key);
    console.log(`${key}: ${typeof val === 'string' ? val : JSON.stringify(val)}`);
});

console.log('\n=== MISSING IN HY ===');
missingInHy.sort().forEach(key => {
    const val = getValue(enData, key);
    console.log(`${key}: ${typeof val === 'string' ? val : JSON.stringify(val)}`);
});

console.log('\n=== UNTRANSLATED IN RU (Same as English) ===');
untranslatedRu.forEach(({ key, val }) => {
    console.log(`${key}: ${val}`);
});

console.log('\n=== UNTRANSLATED IN HY (Same as English) ===');
untranslatedHy.forEach(({ key, val }) => {
    console.log(`${key}: ${val}`);
});
