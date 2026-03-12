const fs = require('fs');
const en = JSON.parse(fs.readFileSync('src/i18n/locales/en.json', 'utf8'));
console.log('Has events:', !!en.events);
console.log('events keys:', en.events ? Object.keys(en.events).slice(0, 10) : 'none');
console.log('nav.events:', en.nav?.events);
