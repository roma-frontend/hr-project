const fs = require('fs');
const path = require('path');

// Load translation files
const ruPath = path.join(__dirname, 'public/locales/ru/translation.json');
const enPath = path.join(__dirname, 'public/locales/en/translation.json');

const ru = JSON.parse(fs.readFileSync(ruPath, 'utf8'));
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));

// Find duplicates
const duplicates = {};

function findDuplicates(obj, prefix = '') {
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null) {
      findDuplicates(value, fullKey);
    } else {
      if (!duplicates[value]) {
        duplicates[value] = [];
      }
      duplicates[value].push(fullKey);
    }
  }
}

findDuplicates(ru);

// Filter only actual duplicates
const actualDuplicates = {};
for (const [value, keys] of Object.entries(duplicates)) {
  if (keys.length > 1) {
    actualDuplicates[value] = keys;
  }
}

console.log('\n\n🔴 DUPLICATE TRANSLATION VALUES:\n');
Object.keys(actualDuplicates).forEach(key => {
  console.log(`  ${key}:`);
  actualDuplicates[key].forEach(variant => {
    console.log(`    - ${variant}`);
  });
});

// Find common translation keys that should be unified
const commonKeys = {
  'loading': ['loading', 'common.loading', 'superadmin.loading'],
  'cancel': ['cancel', 'common.cancel', 'actions.cancel'],
  'save': ['save', 'common.save', 'actions.save'],
  'delete': ['delete', 'common.delete', 'actions.delete'],
  'edit': ['edit', 'common.edit', 'actions.edit'],
  'create': ['create', 'common.create', 'actions.create'],
  'submit': ['submit', 'common.submit', 'actions.submit'],
  'search': ['search', 'common.search'],
  'filter': ['filter', 'common.filter'],
  'back': ['back', 'common.back'],
  'next': ['next', 'common.next'],
  'previous': ['previous', 'common.previous'],
  'active': ['active', 'common.active', 'status.active', 'attendance.active'],
  'status': ['status', 'common.status', 'superadmin.status'],
  'description': ['description', 'common.description'],
  'reason': ['reason', 'common.reason', 'superadmin.reason'],
  'email': ['email', 'common.email', 'auth.email'],
  'organization': ['organization', 'common.organization', 'superadmin.organization'],
  'user': ['user', 'common.user', 'superadmin.user'],
  'departments': ['departments', 'common.departments'],
  'transparent': ['transparent', 'common.transparent'],
  'destructive': ['destructive', 'common.destructive'],
  'checkedIn': ['checkedIn', 'status.checkedIn', 'attendance.checkedIn'],
  'checkedOut': ['checkedOut', 'status.checkedOut', 'attendance.checkedOut'],
  'professional': ['professional', 'superadmin.professional', 'plan.professional'],
  'enterprise': ['enterprise', 'superadmin.enterprise', 'plan.enterprise'],
  'starter': ['starter', 'superadmin.starter', 'plan.starter'],
};

console.log('\n\n🔵 KEYS THAT POTENTIALLY NEED UNIFICATION:\n');
Object.keys(commonKeys).forEach(baseKey => {
  const variants = commonKeys[baseKey];
  const found = [];
  variants.forEach(variant => {
    const [section, key] = variant.split('.');
    if (ru[section] && ru[section][key]) {
      found.push(variant);
    }
  });
  if (found.length > 1) {
    console.log(`  ${baseKey}:`);
    found.forEach(f => console.log(`    ✓ ${f}`));
  }
});

// Save analysis
fs.writeFileSync('translation-analysis.json', JSON.stringify({ duplicates, commonKeys }, null, 2));
console.log('\n\n💾 Analysis saved to translation-analysis.json');