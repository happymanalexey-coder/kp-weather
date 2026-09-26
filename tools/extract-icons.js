// Извлекает дефолтные SVG-иконки из app.js и материализует их в файлы
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8").split("\n");

// Секции app.js с определениями (1-indexed): 66-114 (хелперы + WIC), 895 (TG_ICON), 900-909 (BADGE_FALLBACK + ICONS)
const sec1 = src.slice(65, 114).join("\n");
const sec2 = src[894];
const sec3 = src.slice(899, 910).join("\n");
const code = sec1 + "\n" + sec2 + "\n" + sec3 + "\nmodule.exports = { WIC, ICONS, WG_DEFS };";
const m = new module.constructor();
m._compile(code, "extract.js");
const { WIC, ICONS } = m.exports;

const outRoot = path.join(__dirname, "icons-default");
fs.mkdirSync(path.join(outRoot, "weather"), { recursive: true });
fs.mkdirSync(path.join(outRoot, "ui"), { recursive: true });

const manifest = {};
for (const [slot, svg] of Object.entries(WIC)) {
  const uiOnly = !ICONS.hasOwnProperty(slot) || ICONS[slot] === svg;
  fs.writeFileSync(path.join(outRoot, "weather", slot + ".svg"), svg + "\n");
  manifest[slot] = "weather/" + slot + ".svg";
}
for (const [slot, svg] of Object.entries(ICONS)) {
  if (WIC.hasOwnProperty(slot)) continue; // погодные уже записаны
  fs.writeFileSync(path.join(outRoot, "ui", slot + ".svg"), svg + "\n");
}
console.log("weather:", Object.keys(WIC).join(", "));
console.log("ui-only:", Object.keys(ICONS).filter(k => !WIC.hasOwnProperty(k)).join(", "));
