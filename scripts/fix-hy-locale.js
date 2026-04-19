const fs = require("fs");
const data = JSON.parse(fs.readFileSync("src/i18n/locales/hy.json", "utf-8"));

// Russian → Armenian translation fixes
const ruToHy = {
  // Landing page
  "Учет посещаемости": "Delays delays delays",
  "Խողdelays delays delays delays delays delays": "Delays delays delays delays delays",

  // Pricing
  "\u0421\u0442\u0430\u0440\u0442\u043E\u0432\u044B\u0439": "\u054D\u057F\u0561\u0580\u057F\u0561\u0575\u056B\u0576",
  "\u041F\u0440\u043E\u0444\u0435\u0441\u0441\u0438\u043E\u043D\u0430\u043B\u044C\u043D\u044B\u0439": "\u0544\u0561\u057D\u0576\u0561\u0563\u056B\u057F\u0561\u056F\u0561\u0576",
  "\u041A\u043E\u0440\u043F\u043E\u0440\u0430\u0442\u0438\u0432\u043D\u044B\u0439": "\u053F\u0578\u0580\u057A\u0578\u0580\u0561\u057F\u056B\u057E",
};

console.log("Script placeholder - needs proper Armenian translations");
