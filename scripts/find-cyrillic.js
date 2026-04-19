const fs = require("fs");
const data = JSON.parse(fs.readFileSync("src/i18n/locales/hy.json", "utf-8"));

function findBadText(obj, path) {
  path = path || "";
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    const fullPath = path ? path + "." + key : key;
    if (typeof val === "string") {
      if (/[\u0400-\u04FF]/.test(val)) {
        console.log("CYRILLIC: " + fullPath + " = " + val.substring(0, 80));
      }
      if (/[\u1200-\u137F]/.test(val)) {
        console.log("ETHIOPIC: " + fullPath + " = " + val.substring(0, 80));
      }
    } else if (typeof val === "object" && val != null) {
      findBadText(val, fullPath);
    }
  }
}

findBadText(data);
