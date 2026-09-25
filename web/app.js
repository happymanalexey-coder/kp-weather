/* «Погода в горах, на море и дома» v2.3 — фронт серверной версии (hash-роутинг, без сборки).
   Данные: /api/points и /api/weather локального server.py.
   Состояние (тема, набор и порядок виджетов) — в localStorage. */

/* ---------- КОНСТАНТЫ ПРОЕКТА (все ссылки — здесь, см. README) ---------- */
const SITE_URL = "https://pogoda-pro.ru/";                    // сайт-визитка
const DONATE_URL = "https://www.tbank.ru/cf/83mAzHJg3A";      // поддержка проекта (сбор Т-Банк)
const AUTHOR_TG = "https://t.me/go_ride_bro";                 // «Написать автору» — сразу личные сообщения
const COMMUNITY_URL = "https://example.com/community";        // комьюнити (зарезервировано)
const INTAKE_API = "https://pogoda-intake.happymanalexey.workers.dev"; // приёмник точек (Cloudflare Worker) — POST {name, lat, lon}
const SBP_URL = "PENDING_SBP";                                // (резерв) разовая поддержка СБП
const HOME_LIMIT = 24;                                        // максимум виджетов на главной

/* Ближайшие вершины Mountain-Forecast (проверено: страницы существуют) */
const MF_MAP = {
  "achishkho-glavnaya": "Mount-Fisht", "belye-skaly": "Mount-Fisht",
  "bzerpinsky": "Mount-Agepsta", "keiva": "Mount-Agepsta", "khrustalny": "Mount-Agepsta",
  "kanyon-psaho": "Mount-Agepsta", "krugozor-efremova": "Mount-Agepsta",
  "kupel-beshenka": "Mount-Agepsta", "lager-holodny": "Mount-Agepsta",
  "mamdzyshkha": "Mount-Agepsta", "mendelikha": "Mount-Agepsta", "nahazo": "Mount-Agepsta",
  "goluboe": "Mount-Agepsta", "zerkalnoe": "Mount-Agepsta", "kardyvach": "Mount-Agepsta",
  "malaya-ritsa": "Mount-Agepsta", "ritsa": "Mount-Agepsta", "oshten": "Oshten",
  "pereval-aishkha": "Mount-Agepsta", "pitsunda": "Mount-Agepsta",
  "laura-pichtovy": "Mount-Agepsta", "priyut-fisht": "Mount-Fisht",
  "pseashkha-saharnaya": "Mount-Agepsta", "pshegishkhva": "Mount-Agepsta",
  "rosa-pik": "Mount-Agepsta", "rosa-dolina": "Mount-Agepsta", "sirius": "Mount-Agepsta",
  "chistaya-laba": "Mount-Agepsta", "tkhach": "Oshten", "fisht": "Mount-Fisht",
  "aibga": "Mount-Agepsta", "engelmanovy": "Mount-Agepsta",
};

// Telegram WebApp SDK грузим асинхронно: страница работает и без него
(function loadTgSdk() {
  const s = document.createElement("script");
  s.src = "https://telegram.org/js/telegram-web-app.js";
  s.onload = function () {
    try {
      if (window.Telegram && Telegram.WebApp) {
        Telegram.WebApp.ready();
        Telegram.WebApp.expand();
        applyTgColors();
      }
    } catch (e) {}
  };
  document.head.appendChild(s);
})();

/* В серверной версии weather.js не подключён — нужен свой fetchJSON */
async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}

const WMO = {
  0: ["☀️", "ясно"], 1: ["🌤", "преим. ясно"], 2: ["⛅", "переменная облачность"],
  3: ["☁️", "пасмурно"], 45: ["🌫", "туман"], 48: ["🌫", "изморозь"],
  51: ["🌦", "морось"], 53: ["🌦", "морось"], 55: ["🌦", "морось"],
  56: ["🌦", "ледяная морось"], 57: ["🌦", "ледяная морось"],
  61: ["🌧", "небольшой дождь"], 63: ["🌧", "дождь"], 65: ["🌧", "сильный дождь"],
  66: ["🌧", "ледяной дождь"], 67: ["🌧", "ледяной дождь"],
  71: ["❄️", "небольшой снег"], 73: ["❄️", "снег"], 75: ["❄️", "сильный снег"], 77: ["❄️", "снежная крупа"],
  80: ["🌦", "ливень"], 81: ["🌦", "ливень"], 82: ["🌦", "сильный ливень"],
  85: ["🌨", "снегопад"], 86: ["🌨", "снегопад"],
  95: ["⛈", "гроза"], 96: ["⛈", "гроза с градом"], 99: ["⛈", "гроза с градом"],
};
const WD = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];

let POINTS = [];

/* ---------- SVG-иконки погоды: цветной набор в духе Meteocons (открытая лицензия) ----------
   Слоты базового скина: skins/<id>/skin.js может подменить любую через { icons: { <slot>: "<svg…>" } }. */
const WCLD = "M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z";
const WMOON = "M20 14.5A8 8 0 1 1 9.5 4a9 9 0 0 0 10.5 10.5z";
const WBOLT = "M13.2 15.6 L9.9 20.3 L12 20.3 L10.8 23.4 L14.9 18.4 L12.5 18.4 L14.2 15.6 Z";
const WG_DEFS = "<defs>" +
  '<linearGradient id="wg-cld" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#c3d0e0"/></linearGradient>' +
  '<linearGradient id="wg-cld2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e2e8f0"/><stop offset="1" stop-color="#8fa3bb"/></linearGradient>' +
  '<linearGradient id="wg-sun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fde047"/><stop offset="1" stop-color="#f59e0b"/></linearGradient>' +
  '<linearGradient id="wg-moon" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fef3c7"/><stop offset="1" stop-color="#fcd34d"/></linearGradient>' +
  '<linearGradient id="wg-bolt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fde047"/><stop offset="1" stop-color="#eab308"/></linearGradient>' +
  "</defs>";
const wCloud = (fill, tx, ty, sc) => `<g transform="translate(${tx} ${ty}) scale(${sc})"><path d="${WCLD}" fill="${fill}"/></g>`;
const wSunRays = (cx, cy, r1, r2, w) => {
  let s = `<g stroke="#fbbf24" stroke-width="${w}" stroke-linecap="round">`;
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4, c = Math.cos(a), n = Math.sin(a);
    s += `<line x1="${(cx + c * r1).toFixed(2)}" y1="${(cy + n * r1).toFixed(2)}" x2="${(cx + c * r2).toFixed(2)}" y2="${(cy + n * r2).toFixed(2)}"/>`;
  }
  return s + "</g>";
};
const wDrop = (x, y, s) => `<path d="M${x} ${y}c${(-1.2 * s).toFixed(2)} ${(1.6 * s).toFixed(2)} ${(-1.8 * s).toFixed(2)} ${(2.6 * s).toFixed(2)} ${(-1.8 * s).toFixed(2)} ${(3.5 * s).toFixed(2)}a${(1.8 * s).toFixed(2)} ${(1.8 * s).toFixed(2)} 0 0 0 ${(3.6 * s).toFixed(2)} 0c0 ${(-0.9 * s).toFixed(2)} ${(-0.6 * s).toFixed(2)} ${(-1.9 * s).toFixed(2)} ${(-1.8 * s).toFixed(2)} ${(-3.5 * s).toFixed(2)}z" fill="#38bdf8"/>`;
const wFlake = (x, y, r) => {
  const hx = (r * 0.5).toFixed(2), hy = (r * 0.866).toFixed(2);
  return `<g stroke="#7dd3fc" stroke-width="1.3" stroke-linecap="round" fill="none">` +
    `<line x1="${x - r}" y1="${y}" x2="${x + r}" y2="${y}"/>` +
    `<line x1="${(x - r * 0.5).toFixed(2)}" y1="${(y - r * 0.866).toFixed(2)}" x2="${(x + r * 0.5).toFixed(2)}" y2="${(y + r * 0.866).toFixed(2)}"/>` +
    `<line x1="${(x - r * 0.5).toFixed(2)}" y1="${(y + r * 0.866).toFixed(2)}" x2="${(x + r * 0.5).toFixed(2)}" y2="${(y - r * 0.866).toFixed(2)}"/></g>`;
};
const wMoonSmall = `<g transform="translate(0.4 0.2) scale(0.6)"><path d="${WMOON}" fill="url(#wg-moon)"/></g>`;
const WIC = {
  sun: `<svg class="wic" viewBox="0 0 24 24">${WG_DEFS}<circle cx="12" cy="12" r="5" fill="url(#wg-sun)"/>${wSunRays(12, 12, 7, 9.3, 1.8)}</svg>`,
  moon: `<svg class="wic" viewBox="0 0 24 24">${WG_DEFS}<path d="${WMOON}" fill="url(#wg-moon)"/></svg>`,
  sunCloud: `<svg class="wic" viewBox="0 0 24 24">${WG_DEFS}<circle cx="8" cy="8" r="3.4" fill="url(#wg-sun)"/>${wSunRays(8, 8, 4.7, 6.2, 1.5)}${wCloud("url(#wg-cld)", 2.6, 4.4, 0.8)}</svg>`,
  moonCloud: `<svg class="wic" viewBox="0 0 24 24">${WG_DEFS}${wMoonSmall}${wCloud("url(#wg-cld)", 2.6, 4.4, 0.8)}</svg>`,
  cloud: `<svg class="wic" viewBox="0 0 24 24">${WG_DEFS}${wCloud("url(#wg-cld)", 0.5, 1, 0.96)}</svg>`,
  overcast: `<svg class="wic" viewBox="0 0 24 24">${WG_DEFS}${wCloud("url(#wg-cld2)", -1.2, -3, 0.72)}${wCloud("url(#wg-cld)", 1.4, 1.4, 0.86)}</svg>`,
  fog: `<svg class="wic" viewBox="0 0 24 24">${WG_DEFS}${wCloud("url(#wg-cld)", 0, -2.4, 0.9)}<g stroke="#94a3b8" stroke-width="2" stroke-linecap="round"><line x1="6.5" y1="19.4" x2="17.5" y2="19.4"/><line x1="8.5" y1="22" x2="15.5" y2="22"/></g></svg>`,
  drizzle: `<svg class="wic" viewBox="0 0 24 24">${WG_DEFS}${wCloud("url(#wg-cld)", 1, -2, 0.86)}${wDrop(9, 17.8, 0.7)}${wDrop(14.6, 17.8, 0.7)}</svg>`,
  rain: `<svg class="wic" viewBox="0 0 24 24">${WG_DEFS}${wCloud("url(#wg-cld)", 1, -2.2, 0.86)}${wDrop(7.6, 17.6, 0.9)}${wDrop(12, 18.6, 0.9)}${wDrop(16.4, 17.6, 0.9)}</svg>`,
  rainShowers: `<svg class="wic" viewBox="0 0 24 24">${WG_DEFS}${wCloud("url(#wg-cld)", 1, -2.2, 0.86)}${wDrop(7.4, 17.4, 1.15)}${wDrop(12, 18.6, 1.15)}${wDrop(16.6, 17.4, 1.15)}</svg>`,
  rainSnow: `<svg class="wic" viewBox="0 0 24 24">${WG_DEFS}${wCloud("url(#wg-cld)", 1, -2.2, 0.86)}${wDrop(8.4, 17.8, 0.9)}${wFlake(15, 19.8, 2)}</svg>`,
  snow: `<svg class="wic" viewBox="0 0 24 24">${WG_DEFS}${wCloud("url(#wg-cld)", 1, -2.2, 0.86)}${wFlake(6.8, 19.4, 2)}${wFlake(12, 20.6, 2)}${wFlake(17.2, 19.4, 2)}</svg>`,
  blizzard: `<svg class="wic" viewBox="0 0 24 24">${WG_DEFS}${wCloud("url(#wg-cld)", 1, -2.2, 0.86)}${wFlake(7, 19.2, 1.8)}<g stroke="#7dd3fc" stroke-width="1.6" stroke-linecap="round" fill="none"><path d="M11.5 20.6h7a2 2 0 1 0-2-2.1"/><path d="M12.5 23h4.5"/></g></svg>`,
  hail: `<svg class="wic" viewBox="0 0 24 24">${WG_DEFS}${wCloud("url(#wg-cld)", 1, -2.2, 0.86)}<g fill="#7dd3fc"><circle cx="7.5" cy="19.2" r="1.5"/><circle cx="12" cy="20.8" r="1.5"/><circle cx="16.5" cy="19.2" r="1.5"/></g></svg>`,
  thunder: `<svg class="wic" viewBox="0 0 24 24">${WG_DEFS}${wCloud("url(#wg-cld)", 1, -2.2, 0.86)}<path d="${WBOLT}" fill="url(#wg-bolt)"/></svg>`,
  thunderHail: `<svg class="wic" viewBox="0 0 24 24">${WG_DEFS}${wCloud("url(#wg-cld)", 1, -2.2, 0.86)}<g transform="translate(-2.4 -1) scale(0.88)"><path d="${WBOLT}" fill="url(#wg-bolt)"/></g><circle cx="16.6" cy="20.6" r="1.4" fill="#7dd3fc"/></svg>`,
  moonRain: `<svg class="wic" viewBox="0 0 24 24">${WG_DEFS}${wMoonSmall}${wCloud("url(#wg-cld)", 2.6, 3.6, 0.8)}${wDrop(9, 17.8, 0.8)}${wDrop(14.6, 17.8, 0.8)}</svg>`,
  moonSnow: `<svg class="wic" viewBox="0 0 24 24">${WG_DEFS}${wMoonSmall}${wCloud("url(#wg-cld)", 2.6, 3.6, 0.8)}${wFlake(9, 19.4, 1.8)}${wFlake(14.6, 20.4, 1.8)}</svg>`,
  wind: `<svg class="wic" viewBox="0 0 24 24"><g stroke="#94a3b8" stroke-width="2" stroke-linecap="round" fill="none"><path d="M3.5 8.5h9a2.8 2.8 0 1 0-2.8-3"/><path d="M3.5 12.7h13.5a2.8 2.8 0 1 1-2.8 3"/><path d="M3.5 16.9h6.5"/></g></svg>`,
};
function iconName(code, night) {
  if (code === 0 || code === 1) return night ? "moon" : "sun"; // ясно день/ночь
  if (code === 2) return night ? "moonCloud" : "sunCloud";      // переменная облачность
  if (code === 3) return "overcast";                            // пасмурно
  if (code === 45 || code === 48) return "fog";                 // туман
  if ([51, 53, 55, 56, 57].includes(code)) return "drizzle";    // морось (в т.ч. ледяная)
  if (code === 61 || code === 63) return night ? "moonRain" : "rain";
  if ([65, 80, 81, 82].includes(code)) return night ? "moonRain" : "rainShowers"; // сильный дождь/ливень
  if (code === 66 || code === 67) return "rainSnow";            // дождь со снегом
  if ([71, 73, 75].includes(code)) return night ? "moonSnow" : "snow";
  if (code === 77) return "hail";                               // снежная крупа/град
  if (code === 85 || code === 86) return "blizzard";            // снежные ливни/метель
  if (code === 95) return "thunder";                            // гроза
  if (code === 96 || code === 99) return "thunderHail";         // гроза с градом
  return "cloud";
}
function icon(code, night) { const R = (typeof ICONS !== "undefined" && ICONS) || WIC; return R[iconName(code, night)] || R.cloud; }
function wmoLabel(code) { return (WMO[code] || ["", "—"])[1]; }
/* Честное название осадков по ФАКТИЧЕСКОЙ интенсивности (мм), а не только по коду WMO:
   0.3 мм — это «небольшой дождь», а не «ливень». Гроза остаётся грозой независимо от мм. */
function precipLabel(code, mm) {
  const rain = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code);
  const snow = [71, 73, 75, 77, 85, 86].includes(code);
  if ((!rain && !snow) || mm == null) return wmoLabel(code);
  if (rain) {
    if (mm < 0.5) return "морось";
    if (mm < 2) return "небольшой дождь";
    if (mm < 6) return "дождь";
    if (mm < 12) return "сильный дождь";
    return "ливень";
  }
  if (mm < 1) return "небольшой снег";
  if (mm < 4) return "снег";
  return "снегопад";
}
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

function fmtDay(iso, i) {
  if (i === 0) return "Сегодня";
  if (i === 1) return "Завтра";
  const d = new Date(iso + "T12:00:00");
  return WD[d.getDay()] + " " + String(d.getDate()).padStart(2, "0") + "." + String(d.getMonth() + 1).padStart(2, "0");
}

/* ---------- плейсхолдеры: подсказка «скоро» вместо перехода ---------- */
const isPlaceholder = u => !u || u.includes("example.com") || u.includes("PENDING_");
function soonHint(text) {
  let t = document.getElementById("soon-toast");
  if (!t) { t = document.createElement("div"); t.id = "soon-toast"; t.className = "soon-toast"; document.body.appendChild(t); }
  t.textContent = text;
  t.classList.add("show");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove("show"), 2200);
}
function openSite() {
  if (isPlaceholder(SITE_URL)) return soonHint("Сайт-визитка скоро появится");
  window.open(SITE_URL, "_blank", "noopener");
}

/* ---------- тема (тёмная ↔ светлая), луна/солнце в шапке ---------- */
function applyTgColors() {
  try {
    if (window.Telegram && Telegram.WebApp) {
      const light = document.documentElement.dataset.theme === "light";
      Telegram.WebApp.setHeaderColor(light ? "#cfe3f5" : "#0b1220");
      Telegram.WebApp.setBackgroundColor(light ? "#eef2f7" : "#0b1220");
    }
  } catch (e) {}
}
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem("kp_theme", theme); } catch (e) {}
  applySkinTokens(); // перекладывает токены активного стиля под новую тему (+ applyTgColors внутри)
}
function toggleTheme() {
  const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
  applyTheme(next);
  const t = document.getElementById("theme-toggle");
  if (t) t.classList.remove("hint-glow");
}
function initTheme() {
  applyTheme(localStorage.getItem("kp_theme") === "light" ? "light" : "dark");
  // каждые ~50 запусков мягко подсвечиваем луну/солнце: «попробуй нажать»
  let n = 0;
  try { n = parseInt(localStorage.getItem("kp_launches") || "0", 10) + 1; } catch (e) { n = 1; }
  try { localStorage.setItem("kp_launches", String(n)); } catch (e) {}
  if (n % 50 === 0) {
    const t = document.getElementById("theme-toggle");
    if (t) t.classList.add("hint-glow");
  }
}

/* ---------- набор и порядок виджетов на главной (localStorage) ---------- */
/* Стартовые 8 карточек для нового пользователя. Состав — в одном месте, меняется здесь. */
const STARTER_POINTS = ["rosa-pik", "rosa-dolina", "achishkho-glavnaya", "aibga",
                        "ritsa", "mamdzyshkha", "fisht", "oshten"];
function homeBaseIds() {
  let ids = null;
  try { ids = JSON.parse(localStorage.getItem("kp_home_ids") || "null"); } catch (e) {}
  if (!Array.isArray(ids)) ids = STARTER_POINTS.slice(); // новый пользователь — стартовые 8
  // если ключ уже есть (даже пустой массив) — это выбор пользователя, дефолт не навязываем
  return ids.filter(id => POINTS.some(p => p.id === id));
}
function saveHomeIds(ids) {
  try { localStorage.setItem("kp_home_ids", JSON.stringify(ids)); } catch (e) {}
}
function homeIdsOrdered() {
  let ids = homeBaseIds();
  if (localStorage.getItem("kp_home_custom") === "1") return ids; // ручной порядок — как сохранён
  // иначе недавно открытые поднимаются наверх, остальные — по алфавиту
  let recent = [];
  try { recent = JSON.parse(localStorage.getItem("kp_recent") || "[]"); } catch (e) {}
  const alpha = POINTS.map(p => p.id);
  ids = ids.slice().sort((a, b) => alpha.indexOf(a) - alpha.indexOf(b));
  const rank = id => { const i = recent.indexOf(id); return i === -1 ? 999 : i; };
  return ids.sort((a, b) => rank(a) - rank(b)); // sort стабилен: недавние ↑, далее алфавит
}
function pushRecent(id) {
  let recent = [];
  try { recent = JSON.parse(localStorage.getItem("kp_recent") || "[]"); } catch (e) {}
  recent = [id, ...recent.filter(x => x !== id)].slice(0, 10);
  try { localStorage.setItem("kp_recent", JSON.stringify(recent)); } catch (e) {}
}
function libAdd(id) {
  const ids = homeBaseIds();
  if (!ids.includes(id)) {
    if (ids.length >= HOME_LIMIT) {
      soonHint(`На главной максимум ${HOME_LIMIT} виджета — уберите лишние (зажмите карточку)`);
      return;
    }
    ids.push(id); saveHomeIds(ids);
  }
  renderLibrary(document.getElementById("lib-search").value);
  renderHome();
}
function libRemove(id) {
  saveHomeIds(homeBaseIds().filter(x => x !== id));
  const lib = document.getElementById("lib-screen");
  if (lib && !lib.classList.contains("hidden")) renderLibrary(document.getElementById("lib-search").value);
  renderHome();
}

/* ---------- главный экран ---------- */
let editMode = false;

function homeActionsHtml() {
  return `
    <div class="home-actions">
      <button class="ha-btn set-btn" onclick="openSettings()"><span class="sic">${ICONS.gear}</span>Настройки</button>
    </div>`;
}

function renderHome() {
  const list = document.getElementById("points-list");
  if (!POINTS.length) return;
  const byId = Object.fromEntries(POINTS.map(p => [p.id, p]));
  const ids = homeIdsOrdered();
  list.classList.toggle("editing", editMode);
  list.innerHTML =
    (editMode ? `<div class="edit-bar">Тяни карточки, чтобы менять порядок · ✕ убирает с главной
      <button class="edit-done" onclick="exitEditMode()">Готово</button></div>` : "") +
    ids.map(id => {
      const p = byId[id];
      if (!p) return "";
      return `
      <button class="point-btn" data-id="${p.id}">
        ${badgeHtml(p)}
        <span class="p-name">${esc(p.name)}</span>
        <span class="p-ele">${p.ele != null ? p.ele + " м" : ""}</span>
        <span class="p-region">${esc(p.region)}</span>
        <span class="p-remove" data-rm="${p.id}" title="Убрать с главной">✕</span>
      </button>`;
    }).join("") + homeActionsHtml();
}

/* ---------- состояния: skeleton, ошибка сети (без технических деталей) ---------- */
const SK_HOME = `<div class="sk sk-card"></div><div class="sk sk-card"></div><div class="sk sk-card"></div><div class="sk sk-card"></div><div class="sk-spin" aria-label="Загрузка"></div>`;
const SK_POINT = `<div class="sk sk-now"></div><div class="sk sk-row"></div><div class="sk sk-row"></div><div class="sk sk-row"></div><div class="sk sk-row"></div><div class="sk sk-row"></div><div class="sk-spin" aria-label="Загрузка"></div>`;
const ERR_ICON = `<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M6.5 18a4 4 0 1 1 .42-7.98A5.5 5.5 0 0 1 17.6 8.8 4.2 4.2 0 0 1 17.5 18h-11z" opacity=".55"/><line x1="4.5" y1="4.5" x2="19.5" y2="19.5"/></svg>`;
function errHtml(retryJs) {
  return `<div class="error-box err-card"><div class="err-ico">${ERR_ICON}</div>` +
    `<div class="err-text">Не удалось загрузить данные. Проверь соединение и попробуй ещё раз.</div>` +
    `<button class="err-retry" onclick="${retryJs}">Повторить</button></div>`;
}
let homeFailed = false;
function retryLib() {
  const q = document.getElementById("lib-search");
  loadHome().then(() => renderLibrary(q ? q.value : ""));
}

async function loadHome() {
  const list = document.getElementById("points-list");
  list.innerHTML = SK_HOME;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  try {
    const r = await fetch("/api/points", { signal: ctrl.signal });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const data = await r.json();
    POINTS = data.points.slice().sort((a, b) =>
      a.name.toLowerCase().localeCompare(b.name.toLowerCase(), "ru"));
    homeFailed = false;
    renderHome();
    const hm = location.hash.match(/^#point\/(.+)$/);
    if (hm) loadPoint(hm[1]); // каталог догрузился — повторяем открытие точки с прямой ссылки
  } catch (e) {
    homeFailed = true;
    list.innerHTML = errHtml("loadHome()");
  } finally {
    clearTimeout(t);
  }
  renderPanels();
}

/* ---------- режим редактирования: long-press + drag-and-drop ---------- */
let lpTimer = null, tapStart = null, dragCtx = null, lastDragEnd = 0;

function onListPointerDown(e) {
  const card = e.target.closest(".point-btn");
  if (!card) return;
  if (e.button != null && e.button !== 0) return;
  tapStart = { x: e.clientX, y: e.clientY, card, moved: false };
  if (!editMode) lpTimer = setTimeout(enterEditMode, 500);
  window.addEventListener("pointermove", onListPointerMove);
  window.addEventListener("pointerup", onListPointerUp, { once: true });
  window.addEventListener("pointercancel", onListPointerUp, { once: true });
}
function onListPointerMove(e) {
  if (!tapStart) return;
  const dx = e.clientX - tapStart.x, dy = e.clientY - tapStart.y;
  if (Math.abs(dx) + Math.abs(dy) > 10) { tapStart.moved = true; clearTimeout(lpTimer); }
  if (editMode && !dragCtx && tapStart.moved && tapStart.card.isConnected) startDrag(e);
  if (dragCtx) { dragMove(e); e.preventDefault(); }
}
function onListPointerUp() {
  clearTimeout(lpTimer);
  window.removeEventListener("pointermove", onListPointerMove);
  if (dragCtx) endDrag();
  tapStart = null;
}
function enterEditMode() {
  if (editMode) return;
  editMode = true;
  renderHome();
}
function exitEditMode() {
  editMode = false;
  renderHome();
}
function startDrag(e) {
  const card = tapStart.card, list = card.parentElement;
  const r = card.getBoundingClientRect();
  const ph = document.createElement("div");
  ph.className = "drag-ph";
  ph.style.height = r.height + "px";
  dragCtx = { card, ph, list, offX: e.clientX - r.left, offY: e.clientY - r.top };
  card.style.width = r.width + "px";
  card.style.left = r.left + "px";
  card.style.top = r.top + "px";
  card.style.position = "fixed";
  card.style.zIndex = "60";
  card.classList.add("dragging");
  list.insertBefore(ph, card);
}
function dragMove(e) {
  const { card, ph, list, offX, offY } = dragCtx;
  card.style.left = (e.clientX - offX) + "px";
  card.style.top = (e.clientY - offY) + "px";
  const under = document.elementFromPoint(e.clientX, e.clientY);
  const target = under && under.closest ? under.closest(".point-btn") : null;
  if (target && target !== card && target.parentElement === list) {
    const tr = target.getBoundingClientRect();
    const withinRow = e.clientY > tr.top - 4 && e.clientY < tr.bottom + 4;
    const before = withinRow ? e.clientX < tr.left + tr.width / 2 : e.clientY < tr.top;
    list.insertBefore(ph, before ? target : target.nextSibling);
  }
}
function endDrag() {
  const { card, ph, list } = dragCtx;
  list.insertBefore(card, ph);
  ph.remove();
  card.style.cssText = "";
  card.classList.remove("dragging");
  dragCtx = null;
  lastDragEnd = Date.now();
  const ids = [...list.querySelectorAll(".point-btn")].map(c => c.dataset.id);
  saveHomeIds(ids);
  try { localStorage.setItem("kp_home_custom", "1"); } catch (e) {} // ручной порядок зафиксирован
}
function onListClick(e) {
  const rm = e.target.closest("[data-rm]");
  if (rm) { e.stopPropagation(); libRemove(rm.dataset.rm); return; }
  if (editMode) return; // в режиме редактирования карточки не открываются
  if (Date.now() - lastDragEnd < 300) return; // это был драг, не тап
  const card = e.target.closest(".point-btn");
  if (card) goPoint(card.dataset.id);
}
function bindHomeList() {
  const list = document.getElementById("points-list");
  list.addEventListener("pointerdown", onListPointerDown);
  list.addEventListener("click", onListClick);
  list.addEventListener("contextmenu", e => { if (editMode || e.target.closest(".point-btn")) e.preventDefault(); });
}

/* ---------- библиотека виджетов: вкладки «Все / От разработчиков / Мои» ---------- */
let libTab = "all";

function tgUserId() {
  try {
    const u = window.Telegram && Telegram.WebApp &&
      Telegram.WebApp.initDataUnsafe && Telegram.WebApp.initDataUnsafe.user;
    return u && u.id ? String(u.id) : null;
  } catch (e) { return null; }
}
function myPointIds() {
  const me = tgUserId();
  const ids = new Set();
  if (me) POINTS.forEach(p => { if (p.submitted_by != null && String(p.submitted_by) === me) ids.add(p.id); });
  try { JSON.parse(localStorage.getItem("kp_suggested") || "[]").forEach(id => ids.add(id)); } catch (e) {}
  return ids;
}

function openLibrary() { location.hash = "#library"; }
function closeLibrary() { location.hash = ""; }
function openAbout() { location.hash = "#about"; }
function closeAbout() { location.hash = ""; }
function setLibTab(tab) {
  libTab = tab;
  renderLibrary(document.getElementById("lib-search").value);
}

function libTabsHtml() {
  const mine = tgUserId() !== null; // «Мои» — только внутри Telegram
  const tab = (key, label) =>
    `<button class="lib-tab${libTab === key ? " active" : ""}" onclick="setLibTab('${key}')">${label}</button>`;
  return `<div class="lib-tabs">${tab("all", "Все")}${tab("dev", "От разработчиков")}${mine ? tab("mine", "Мои") : ""}</div>`;
}

function renderLibrary(filter) {
  const box = document.getElementById("lib-list");
  if (!box) return;
  const tabs = document.getElementById("lib-tabs-wrap");
  if (tabs) tabs.innerHTML = libTabsHtml();
  if (!POINTS.length) { // точки не загрузились (нет сети) — ошибка с кнопкой «Повторить»
    box.innerHTML = errHtml("retryLib()");
    return;
  }
  if (libTab === "mine" && tgUserId() === null) libTab = "all"; // на всякий случай
  const q = String(filter || "").trim().toLowerCase();
  const ids = homeBaseIds();
  const mine = myPointIds();
  const rows = POINTS.filter(p => {
    if (libTab === "dev" && p.verified === false) return false;
    if (libTab === "mine" && !mine.has(p.id)) return false;
    return !q || p.name.toLowerCase().includes(q) || p.region.toLowerCase().includes(q);
  }).map(p => {
    const on = ids.includes(p.id);
    return `
      <div class="lib-row">
        <div class="lib-info">
          <div class="lib-name">${esc(p.name)}${badgeHtml(p)}</div>
          <div class="lib-sub">${esc(p.region)}${p.ele != null ? " · " + p.ele + " м" : ""}</div>
        </div>
        ${on
          ? `<button class="lib-on" data-rm="${p.id}">на главной ✓</button>`
          : `<button class="lib-add" data-add="${p.id}">Добавить</button>`}
      </div>`;
  });
  const emptyText = libTab === "mine"
    ? "Пока пусто. Добавьте свою точку: ⚙ Настройки → «Добавить точку» — после модерации она появится здесь"
    : "Ничего не найдено";
  const donate = donateBtnHtml();
  box.innerHTML = (rows.length ? rows.join("") : `<div class="lib-empty">${emptyText}</div>`) + donate;
  box.querySelectorAll("[data-add]").forEach(b => b.addEventListener("click", () => libAdd(b.dataset.add)));
  box.querySelectorAll("[data-rm]").forEach(b => b.addEventListener("click", () => libRemove(b.dataset.rm)));
}

/* ---------- предложить точку: форма с валидацией ---------- */
const FB_NAME_RE = /^[А-Яа-яЁёA-Za-z0-9 \-]+$/; // кириллица/латиница/цифры/пробел/дефис — без эмодзи
const FB_BAD_WORDS = ["хуй","хуя","хуе","хуи","пизд","бляд","блят","ебан","ебал","ёбан","ебуч",
  "мудак","мудил","сукa","сука","пидор","пидар","гандон","шлюх","залуп","мандa","манда"];

function openFeedback() {
  const m = document.getElementById("fb-modal");
  if (m) m.classList.remove("hidden");
  const form = document.getElementById("fb-form");
  const sent = document.getElementById("fb-sent");
  if (form) form.classList.remove("hidden"); // всегда открываем на форме, не на «Отправлено»
  if (sent) sent.classList.add("hidden");
  fbShowError("");
}
function resetScrollX() { // анти-«залипание»: страница никогда не должна стоять со сдвигом вбок
  try { window.scrollTo({ left: 0 }); document.documentElement.scrollLeft = 0; if (document.body) document.body.scrollLeft = 0; } catch (e) {}
}
function closeFeedback() {
  const m = document.getElementById("fb-modal");
  if (m) m.classList.add("hidden");
  resetScrollX();
}
function fbShowError(text) {
  const el = document.getElementById("fb-err");
  if (!el) return;
  el.textContent = text;
  el.classList.toggle("hidden", !text);
}

/* Копирование в буфер (запасной путь для старых WebView) */
function fallbackCopy(text, done) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed"; ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); done(); }
  catch (e) { soonHint("Не удалось скопировать"); }
  ta.remove();
}

/* Возвращает {name, lat, lon} или {error} — те же правила, что на бэкенде (tools/intake_points.py) */
function validateSuggestion(nameRaw, coordsRaw) {
  const name = String(nameRaw || "").trim().replace(/\s+/g, " ");
  const coordsStr = String(coordsRaw || "").trim();
  if (!name) return { error: "Укажи название точки" };
  if (!coordsStr) return { error: "Укажи координаты, например 43.472, 40.534" };
  if (name.length < 3 || name.length > 40)
    return { error: "Название: от 3 до 40 символов" };
  if (!FB_NAME_RE.test(name))
    return { error: "Название: только буквы (рус/лат), цифры, пробел и дефис — без эмодзи" };
  const low = " " + name.toLowerCase().replace(/[^а-яa-z0-9]+/g, " ") + " ";
  if (FB_BAD_WORDS.some(w => low.includes(w)))
    return { error: "Такое название не пройдёт модерацию" };

  const m = String(coordsRaw || "").trim().match(/^(-?\d+(?:[.,]\d+)?)\s*[,\s]\s*(-?\d+(?:[.,]\d+)?)$/);
  if (!m) return { error: "Координаты: два числа через запятую, например 43.472, 40.534" };
  const lat = parseFloat(m[1].replace(",", "."));
  const lon = parseFloat(m[2].replace(",", "."));
  if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180)
    return { error: "Координаты вне диапазона: широта −90…90, долгота −180…180" };
  if (Math.abs(lat) < 0.0001 && Math.abs(lon) < 0.0001)
    return { error: "0, 0 — это точка в океане у Африки. Проверьте координаты" };

  const dup = POINTS.some(p => p.name.trim().toLowerCase() === name.toLowerCase());
  if (dup) return { error: "Такая точка уже есть в библиотеке" };

  // лимит 5 заявок в сутки — на стороне приёмника (tools/intake_points.py), здесь не дублируем
  return { name, lat: Math.round(lat * 10000) / 10000, lon: Math.round(lon * 10000) / 10000 };
}

function showFbSent() {
  const form = document.getElementById("fb-form");
  const sent = document.getElementById("fb-sent");
  if (form) form.classList.add("hidden");
  if (sent) sent.classList.remove("hidden"); // экран «Отправлено» вместо мгновенного закрытия
  const t = document.getElementById("fb-sent-text");
  if (t) t.innerHTML = "Отправлено! Точка появится в библиотеке в течение ~30 минут ⛰";
}

async function feedbackSubmit() {
  const nameEl = document.getElementById("fb-name");
  const coordsEl = document.getElementById("fb-coords");
  const r = validateSuggestion(nameEl && nameEl.value, coordsEl && coordsEl.value);
  if (r.error) { fbShowError(r.error); return; }
  // единый канал для сайта и mini-app: POST на приёмник, никаких переходов в чат бота
  if (!INTAKE_API) { fbShowError("Сервис приёма точек перезапускается — попробуйте через пару минут"); return; }
  try {
    const resp = await fetch(INTAKE_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: r.name, lat: r.lat, lon: r.lon }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) { fbShowError(data.error || "Не получилось отправить — попробуйте ещё раз"); return; }
    showFbSent();
  } catch (e) {
    fbShowError("Не получилось отправить — проверьте соединение и попробуйте ещё раз");
  }
}

/* ---------- ссылки ручной перепроверки ---------- */
function windyLink(p) { return `https://www.windy.com/?${p.lat},${p.lon},11`; }
function yrLink(p) { return `https://www.yr.no/en/search?q=${p.lat},${p.lon}`; }
function mfLink(p) { return `https://www.mountain-forecast.com/peaks/${MF_MAP[p.id] || "Mount-Fisht"}`; }
function gmapsLink(p) { return `https://maps.google.com/?q=${p.lat},${p.lon}`; }
function yamapsLink(p) { return `https://yandex.ru/maps/?pt=${p.lon},${p.lat}&z=15&l=map`; }

/* ---------- волны ---------- */
const RUMBS = ["С", "ССВ", "СВ", "ВСВ", "В", "ВЮВ", "ЮВ", "ЮЮВ", "Ю", "ЮЮЗ", "ЮЗ", "ЗЮЗ", "З", "ЗСЗ", "СЗ", "ССЗ"];
function rumb(deg) { return deg == null ? "—" : RUMBS[Math.round(deg / 22.5) % 16]; }

function waveLine(w) {
  return `${ICONS.wave} ${w.height.toFixed(1)} м · период ${Math.round(w.period)} с · направление ${rumb(w.dir)}`;
}
function wavesHtml(d, p) {
  if (!p || p.marine !== true) return ""; // блок «Волны» — только у морских точек
  if (!d.waves || !d.waves.length) return "";
  const today = d.waves[0];
  const rows = d.waves.slice(1, 6).map((w, i) =>
    `<div class="wv-row"><span>${fmtDay(w.date, i + 1)}</span><span>${waveLine(w)}</span></div>`
  ).join("");
  return `
    <div class="card waves-card">
      <h3>Волны</h3>
      <div class="wv-now">${waveLine(today)}</div>
      ${rows ? `<div class="wv-days">${rows}</div>` : ""}
    </div>`;
}

/* ---------- экран точки ---------- */
let lastPayload = null;

function windRange(cur) {
  const vals = [cur.wind, cur.metno_wind].filter(v => v != null);
  if (!vals.length) return "—";
  const mn = Math.min(...vals), mx = Math.max(...vals);
  return mn !== mx ? `от ${mn} до ${mx}  м/с` : `${mn}  м/с`;
}

async function loadPoint(id) {
  const box = document.getElementById("point-content");
  const point = POINTS.find(p => p.id === id);
  if (!point && !POINTS.length && !homeFailed) { // холодный вход по прямой ссылке: каталог ещё грузится
    box.innerHTML = SK_POINT;
    return;
  }
  document.getElementById("sticky-name").textContent = point ? point.name : "";
  const sb = document.getElementById("sticky-badge");
  if (sb) sb.innerHTML = point && point.verified !== false ? ICONS.badge : "";
  if (!point) {
    box.innerHTML = `<div class="error-box">Точка не найдена.</div>`;
    return;
  }
  box.innerHTML = SK_POINT;
  const pp = document.getElementById("point-panels");
  if (pp) pp.innerHTML = ""; // панели покажем только после загрузки — без мелькания
  let d;
  try {
    d = await Promise.race([
      fetchJSON("/api/weather?id=" + encodeURIComponent(id)),
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 10000))
    ]);
  } catch (e) {
    box.innerHTML = errHtml("loadPoint('" + id + "')");
    return;
  }
  lastPayload = d;
  checkWatchedPoint(d); // заготовка уведомлений: сравнить со снимком (без рассылки)
  pushRecent(id);
  const p = d.point;
  const cur = d.current;
  const fetched = d.fetched_at ? d.fetched_at.slice(11, 16) : "";
  const nowHLoc = d.tz_offset != null ? new Date(Date.now() + d.tz_offset * 1000).getUTCHours() : 12;
  const nowNight = nowHLoc < 6 || nowHLoc >= 21;

  const nowHtml = cur ? `
    <div class="card">
      <h3>Погода сейчас · обновлено ${fetched} местн.</h3>
      <div class="now-main">
        <div class="now-icon">${icon(cur.code, nowNight)}</div>
        <div>
          <div class="now-t">${cur.t}°</div>
          <div class="now-desc">${precipLabel(cur.code, cur.precip)} · ощущается ${cur.feels}°</div>
        </div>
      </div>
      <div class="now-grid">
        <div class="now-cell"><div class="k">Ветер</div><div class="v">${windRange(cur)}</div></div>
        <div class="now-cell"><div class="k">Осадки</div><div class="v">${(cur.precip || 0) > 0 ? cur.precip + " мм" : "нет"}</div></div>
        <div class="now-cell"><div class="k">Облачность</div><div class="v">${cur.cloud}%</div></div>
      </div>
    </div>` : "";

  const daysHtml = d.days.map((day, i) => {
    const label = fmtDay(day.date, i);
    return `
      <div class="day-block">
        <div class="day-row" onclick="toggleHours(this)">
          <div class="d-left">
            <div class="d-date"><span class="vdot ${day.verdict}"></span>${label}</div>
            <div class="d-temp"><span class="d-max">${day.t_day ?? "—"}°</span><span class="d-min"> / ${day.t_night ?? "—"}°</span></div>
            <div class="d-pr">${day.precip != null ? day.precip + " мм" : "—"}</div>
          </div>
          <div class="d-icons">${periodsHtml(d, day.date, day.code)}</div>
          <div class="d-right">${WIC.wind} ${day.wind ?? "—"}  м/с<br>${WIC.cloud} ${day.cloud ?? "—"}% <span class="chev">▾</span></div>
        </div>
        <div class="hours-wrap hidden">${hoursHtml(d, day.date)}</div>
      </div>`;
  }).join("");

  const SHOW_EXT_LINKS = false; // временно скрыты кнопки Windy / Yr.no / Mountain-Forecast
  box.innerHTML = `
    <h2 class="pt-title">${esc(p.name)} <button class="globe-btn pt-globe" onclick="toggleMapChoice()" aria-label="Показать на карте" title="Показать на карте">${ICONS.globe}</button></h2>
    <div class="pt-sub">${esc(p.region)} · ${p.lat}, ${p.lon}${p.ele != null ? " · высота " + p.ele + " м" : ""}</div>
    <div class="map-choice hidden" id="map-choice">
      <a class="link-btn" href="${gmapsLink(p)}" target="_blank" rel="noopener">Google Maps</a>
      <a class="link-btn" href="${yamapsLink(p)}" target="_blank" rel="noopener">Яндекс Карты</a>
    </div>
    ${nowHtml}
    ${wavesHtml(d, point)}
    ${SHOW_EXT_LINKS ? `<div class="links-row">
      <a class="link-btn" href="${windyLink(p)}" target="_blank" rel="noopener">Windy</a>
      <a class="link-btn" href="${yrLink(p)}" target="_blank" rel="noopener">Yr.no</a>
      <a class="link-btn" href="${mfLink(p)}" target="_blank" rel="noopener">Mountain-Forecast</a>
    </div>` : ""}
    <div class="card">
      <h3>5 дней · нажмите на день — прогноз по часам</h3>
      ${daysHtml}
    </div>
  `;
  renderPanels();
}

/* ---------- заготовка: отслеживание изменений прогноза (рассылка — позже, с сервером 24/7) ----------
   Подписка «точка + дата» хранится локально (kp_watch). При каждом открытии точки
   свежий прогноз сравнивается со снимком (kp_watch_snap): дождь появился /
   ветер вырос за порог / температура вышла за разброс. Сейчас результат только
   пишется в консоль — НЕ показывается и НЕ рассылается (см. README, план). */
function watchList() {
  try { return JSON.parse(localStorage.getItem("kp_watch") || "[]"); } catch (e) { return []; }
}
function watchSnaps() {
  try { return JSON.parse(localStorage.getItem("kp_watch_snap") || "{}"); } catch (e) { return {}; }
}
function diffForecast(prev, next) {
  /* Возвращает список изменений прогноза по дням или [] — ядро будущих уведомлений */
  const out = [];
  if (!prev || !next || !prev.days || !next.days) return out;
  const byDate = Object.fromEntries(prev.days.map(d => [d.date, d]));
  for (const nd of next.days) {
    const od = byDate[nd.date];
    if (!od) continue;
    if ((od.precip || 0) < 1 && (nd.precip || 0) >= 1)
      out.push(`${nd.date}: появились осадки (${nd.precip} мм)`);
    if ((od.wind || 0) < 10 && (nd.wind || 0) >= 10)
      out.push(`${nd.date}: ветер усилился до ${nd.wind}  м/с`);
    if (od.t_day_spread && nd.t_day != null &&
        (nd.t_day < od.t_day_spread[0] - 2 || nd.t_day > od.t_day_spread[1] + 2))
      out.push(`${nd.date}: температура ${nd.t_day}° вышла за прежний разброс ${od.t_day_spread[0]}…${od.t_day_spread[1]}°`);
  }
  return out;
}
function checkWatchedPoint(payload) {
  /* Вызывается после загрузки точки: сравнить со снимком, обновить снимок. Без рассылки. */
  const id = payload.point && payload.point.id;
  if (!id || !watchList().some(w => w.id === id)) return;
  const snaps = watchSnaps();
  const prev = snaps[id];
  if (prev) {
    const changes = diffForecast(prev, payload);
    if (changes.length) console.info("[watch] прогноз изменился:", changes); // заготовка, UI нет
  }
  snaps[id] = payload;
  try { localStorage.setItem("kp_watch_snap", JSON.stringify(snaps)); } catch (e) {}
}

function toggleMapChoice() {
  const el = document.getElementById("map-choice");
  if (el) el.classList.toggle("hidden");
}

/* «Суровость» кода погоды — для выбора типичной иконки периода при равенстве частот */
function codeRank(c) {
  if (c == null) return 0;
  if ([95, 96, 99].includes(c)) return 90;
  if ([71, 73, 75, 77, 85, 86].includes(c)) return 80;
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(c)) return 70;
  if ([51, 53, 55, 56, 57].includes(c)) return 60;
  if ([45, 48].includes(c)) return 50;
  if (c === 3) return 40;
  if (c === 2) return 30;
  if (c === 1) return 20;
  return 10;
}

/* Иконки 4 периодов суток (как в Yr.no): ночь 00–06 · утро 06–12 · день 12–18 · вечер 18–24.
   Иконка периода — типичное (самое частое) состояние из почасового; при равенстве — суровее.
   Подсказка — честное название по сумме осадков периода. */
function periodsHtml(d, date, fallbackCode) {
  const fallback = `<span class="dp-ico">${icon(fallbackCode, false)}</span>`;
  if (!d.hourly || !d.hourly.time) return fallback;
  const PERIODS = [[0, 6, true], [6, 12, false], [12, 18, false], [18, 24, true]];
  const cells = [];
  for (const [from, to, night] of PERIODS) {
    const codes = [];
    let prSum = 0;
    for (let i = 0; i < d.hourly.time.length; i++) {
      const t = d.hourly.time[i];
      if (t.slice(0, 10) !== date) continue;
      const hh = parseInt(t.slice(11, 13), 10);
      if (hh >= from && hh < to) {
        if (d.hourly.code[i] != null) codes.push(d.hourly.code[i]);
        prSum += d.hourly.precip[i] || 0;
      }
    }
    if (!codes.length) break;
    const freq = {};
    codes.forEach(c => { freq[c] = (freq[c] || 0) + 1; });
    const best = Object.keys(freq).map(Number)
      .sort((a, b) => freq[b] - freq[a] || codeRank(b) - codeRank(a))[0];
    const pr = Math.round(prSum * 10) / 10;
    cells.push(`<span class="dp-ico" title="${esc(precipLabel(best, pr))}">${icon(best, night)}</span>`);
  }
  return cells.length === 4 ? cells.join("") : fallback;
}

/* Почасовой прогноз на сутки date (из d.hourly, МЕСТНОЕ время точки) */
function hoursHtml(d, date) {
  if (!d.hourly) return `<div class="hours-empty">Почасовые данные недоступны</div>`;
  const h = d.hourly;
  const off = d.tz_offset != null ? d.tz_offset : 3 * 3600;
  const nowIso = new Date(Date.now() + off * 1000).toISOString().slice(0, 19);
  const today = nowIso.slice(0, 10);
  const nowH = parseInt(nowIso.slice(11, 13), 10);
  let cells = "";
  for (let i = 0; i < h.time.length; i++) {
    if (h.time[i].slice(0, 10) !== date) continue;
    const hh = parseInt(h.time[i].slice(11, 13), 10);
    const isNow = date === today && hh === nowH;
    const pr = h.precip[i] || 0;
    cells += `
      <div class="h-cell${isNow ? " now" : ""}" data-h="${hh}">
        <div class="h-time">${isNow ? "сейчас" : String(hh).padStart(2, "0") + ":00"}</div>
        <div class="h-icon">${icon(h.code[i], hh < 6 || hh >= 21)}</div>
        <div class="h-t">${h.t[i] ?? "—"}°</div>
        <div class="h-pr">${pr >= 0.1 ? pr.toFixed(1) : ""}</div>
        <div class="h-w">${h.wind[i] ?? "—"}</div>
      </div>`;
  }
  return `<div class="hours-strip">${cells}</div><div class="hours-legend">осадки, мм · ветер,  м/с</div>`;
}

function toggleHours(rowEl) {
  const wrap = rowEl.parentElement.querySelector(".hours-wrap");
  const opening = wrap.classList.contains("hidden");
  wrap.classList.toggle("hidden");
  rowEl.classList.toggle("open", opening);
  if (opening) {
    const target = wrap.querySelector(".h-cell.now") || wrap.querySelector('[data-h="6"]');
    if (target) target.scrollIntoView({ block: "nearest", inline: "center" });
  }
}

/* ---------- поддержка проекта (одна кнопка → сбор Т-Банк) и связь с автором ---------- */
function donateHtml() {
  return `
    <div class="donate-panel">
      <div class="dp-title">Мы сделали лучшее приложение для себя.<br>И этим хочется поделиться с каждым!</div>
      <button class="dp-go" onclick="donateGo()">Поддержать проект (СБП)</button>
    </div>`;
}

function donateGo() {
  if (isPlaceholder(DONATE_URL)) return soonHint("Ссылка на сбор появится чуть позже 🙏");
  let opened = false;
  try { // в Telegram mini-app — во внешний браузер, чтобы сработал переход в приложение Т-Банка
    if (window.Telegram && Telegram.WebApp && Telegram.WebApp.openLink) {
      Telegram.WebApp.openLink(DONATE_URL);
      opened = true;
    }
  } catch (e) {}
  if (!opened) { // на сайте — прямое открытие в новой вкладке
    try { opened = !!window.open(DONATE_URL, "_blank", "noopener"); } catch (e) {}
  }
  if (opened) setTimeout(() => soonHint("СПАСИБО 🙏"), 400);
  else showDonateFallback(); // окно со ссылкой — только если программно открыть не удалось
}
function showDonateFallback() {
  const m = document.getElementById("dn-modal");
  if (m) m.classList.remove("hidden");
}
function closeDonateFallback() {
  const m = document.getElementById("dn-modal");
  if (m) m.classList.add("hidden");
  resetScrollX();
}
function donateCopy() {
  const done = () => { soonHint("Ссылка скопирована 📋"); closeDonateFallback(); };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(DONATE_URL).then(done, () => { fallbackCopy(DONATE_URL, () => {}); done(); });
  } else { fallbackCopy(DONATE_URL, () => {}); done(); }
}

const TG_ICON = `<svg class="tg-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>`;

/* ---------- единый SVG-реестр: погода (WIC) + интерфейс + бренд ----------
   Слот badge-verified — отдельный файл skins/<id>/badge.svg: другой стиль
   подменяет её своим символом. Ниже — встроенный запасной вариант (= base). */
const BADGE_FALLBACK = `<svg viewBox="0 0 24 24"><defs><linearGradient id="bs-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7cc4ff"/><stop offset="1" stop-color="#2f9be8"/></linearGradient></defs><path fill="url(#bs-g)" stroke="url(#bs-g)" stroke-width="1.4" stroke-linejoin="round" d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/><ellipse cx="9.3" cy="7.6" rx="2.1" ry="1.15" fill="#ffe58a" opacity=".9" transform="rotate(-28 9.3 7.6)"/></svg>`;
const ICONS = Object.assign({}, WIC, {
  gear: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>`,
  globe: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="8.6"/><path d="M3.4 12h17.2M12 3.4c2.4 2.4 3.7 5.4 3.7 8.6s-1.3 6.2-3.7 8.6c-2.4-2.4-3.7-5.4-3.7-8.6s1.3-6.2 3.7-8.6z"/></svg>`,
  pin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M12 21.2s-6.6-5.5-6.6-10.2a6.6 6.6 0 1 1 13.2 0c0 4.7-6.6 10.2-6.6 10.2z"/><circle cx="12" cy="10.6" r="2.3"/></svg>`,
  palette: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M12 3.2a8.8 8.8 0 1 0 0 17.6c1 0 1.7-.7 1.7-1.6 0-.5-.18-.85-.45-1.13-.26-.29-.45-.64-.45-1.07 0-.9.73-1.6 1.6-1.6h1.9a3.7 3.7 0 0 0 3.7-3.7c0-3.9-4-6.5-8-6.5z"/><circle cx="7.4" cy="11" r="1.15" fill="currentColor" stroke="none"/><circle cx="10.6" cy="7.6" r="1.15" fill="currentColor" stroke="none"/><circle cx="14.8" cy="7.8" r="1.15" fill="currentColor" stroke="none"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12.6l4.8 4.8L19.5 6.8"/></svg>`,
  wave: `<svg class="wic wv-ico" viewBox="0 0 24 24"><g class="wnd"><path d="M2.5 9.2c1.9-2 3.8-2 5.7 0s3.8 2 5.7 0 3.8-2 5.7 0"/><path d="M2.5 15.2c1.9-2 3.8-2 5.7 0s3.8 2 5.7 0 3.8-2 5.7 0"/></g></svg>`,
  badge: BADGE_FALLBACK,
  telegram: TG_ICON,
});
function badgeHtml(p) {
  return p.verified === false ? "" : `<span class="badge-verified" title="Точка от разработчиков">${ICONS.badge}</span>`;
}

/* ---------- стили (skins/): один файл на стиль + реестр skins.json ----------
   Добавление нового стиля = новая папка skins/<id>/ (skin.js + badge.svg)
   и одна строка в skins/skins.json — без правок остального кода. */
const SKIN_KEY = "kp_skin";
let SKINS_REG = null;
let SKIN_ID = "base";
let appliedTokenKeys = [];

function currentSkinId() {
  try { return localStorage.getItem(SKIN_KEY) || "base"; } catch (e) { return "base"; }
}
async function loadSkinsReg() {
  if (SKINS_REG) return SKINS_REG;
  try {
    const r = await fetch("skins/skins.json");
    if (!r.ok) throw new Error("HTTP " + r.status);
    const j = await r.json();
    SKINS_REG = Array.isArray(j.skins) ? j.skins : [];
  } catch (e) { SKINS_REG = []; }
  if (!SKINS_REG.length) SKINS_REG = [{ id: "base", name: "Базовый", author: "От разработчиков" }];
  return SKINS_REG;
}
function loadSkinFile(id) {
  return new Promise(res => {
    if (window.KP_SKINS && KP_SKINS[id]) return res(true);
    const s = document.createElement("script");
    s.src = "skins/" + id + "/skin.js";
    s.onload = () => res(true);
    s.onerror = () => res(false);
    document.head.appendChild(s);
  });
}
async function loadBadge() {
  try {
    const r = await fetch("skins/" + SKIN_ID + "/badge.svg");
    if (!r.ok) return false;
    const t = await r.text();
    if (t.includes("<svg")) {
      const svg = t.replace(/\s*xmlns="[^"]*"/, "").trim();
      if (svg !== ICONS.badge) { ICONS.badge = svg; return true; }
    }
  } catch (e) {}
  return false;
}
function applySkinTokens() {
  const root = document.documentElement;
  appliedTokenKeys.forEach(k => root.style.removeProperty(k));
  appliedTokenKeys = [];
  const skin = window.KP_SKINS && KP_SKINS[SKIN_ID];
  const ov = (skin && skin.icons) || {}; // погодные иконки — слоты: скин может подменить любую
  Object.keys(WIC).forEach(k => { ICONS[k] = ov[k] || WIC[k]; });
  if (skin && skin.tokens && SKIN_ID !== "base") { // base = значения по умолчанию в styles.css
    const theme = root.dataset.theme === "light" ? "light" : "dark";
    const map = skin.tokens[theme] || {};
    Object.keys(map).forEach(k => { root.style.setProperty(k, map[k]); appliedTokenKeys.push(k); });
  }
  applyTgColors();
}
function fillStaticIcons() {
  document.querySelectorAll("[data-icon]").forEach(el => { el.innerHTML = ICONS[el.dataset.icon] || ""; });
}
function rerenderCurrent() {
  const h = location.hash;
  if (h === "#library") renderLibrary(document.getElementById("lib-search").value);
  else if (h.indexOf("#point/") === 0) loadPoint(h.slice(7));
  else if (h === "" || h === "#") renderHome();
  fillStaticIcons();
}
async function initSkin() {
  SKIN_ID = currentSkinId();
  let changed = false;
  if (SKIN_ID !== "base") { await loadSkinFile(SKIN_ID); changed = true; }
  applySkinTokens();
  if (await loadBadge()) changed = true;
  if (changed) rerenderCurrent(); else fillStaticIcons();
}
async function applySkin(id) {
  SKIN_ID = id;
  try { localStorage.setItem(SKIN_KEY, id); } catch (e) {} // выбор сохраняется и восстанавливается после перезапуска
  if (id !== "base") await loadSkinFile(id);
  applySkinTokens(); // мгновенно, без шага предпросмотра
  await loadBadge();
  rerenderCurrent();
  renderStyleList();
  soonHint("Стиль применён");
}
async function renderStyleList() {
  const box = document.getElementById("style-list");
  if (!box) return;
  const skins = await loadSkinsReg();
  box.innerHTML = skins.map(s => {
    const pv = s.preview || {};
    const dots = (pv.palette || []).map(c => `<span class="st-dot" style="background:${esc(String(c))}"></span>`).join("");
    const hero = `<svg viewBox="0 0 400 160" preserveAspectRatio="xMidYMax slice" aria-hidden="true">` +
      `<defs><linearGradient id="psky-${esc(s.id)}" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="${esc(pv.sky0 || "#101c30")}"/><stop offset="1" stop-color="${esc(pv.sky1 || "#0b1220")}"/></linearGradient></defs>` +
      `<rect width="400" height="160" fill="url(#psky-${esc(s.id)})"/>` +
      `<path d="M0 160 L60 84 L95 122 L150 52 L205 128 L245 88 L300 140 L340 100 L400 160 Z" fill="${esc(pv.mt1 || "#16243c")}"/>` +
      `<path d="M0 160 L80 108 L140 150 L210 96 L280 152 L330 122 L400 160 Z" fill="${esc(pv.mt2 || "#0f1930")}"/>` +
      `<path d="M0 160 L120 132 L220 160 L320 138 L400 160 Z" fill="${esc(pv.mt3 || "#0a1120")}"/></svg>`;
    const active = s.id === SKIN_ID;
    return `<div class="style-card${active ? " active" : ""}">
      <div class="st-prev">${hero}</div>
      <div class="st-name">${esc(s.name || s.id)}</div>
      <div class="st-author">${esc(s.author || "")}</div>
      <div class="st-dots">${dots}</div>
      <button class="st-apply${active ? " done" : ""}"${active ? "" : ` onclick="applySkin('${esc(s.id)}')"`}>${active ? "Применён ✓" : "Применить"}</button>
    </div>`;
  }).join("") + donateBtnHtml();
}

/* ---------- навигация: настройки / стили ---------- */
function openSettings() { location.hash = "#settings"; }
function closeSettings() { location.hash = ""; }
function openStyle() { location.hash = "#style"; }
function closeStyle() { location.hash = "#settings"; }

function communityHtml() {
  return `<button class="community-panel" onclick="authorGo()">${TG_ICON}Написать автору</button>`;
}
function authorGo() {
  try {
    if (window.Telegram && Telegram.WebApp && Telegram.WebApp.openTelegramLink) {
      Telegram.WebApp.openTelegramLink(AUTHOR_TG);
      return;
    }
  } catch (e) {}
  window.open(AUTHOR_TG, "_blank");
}

/* Единый компонент доната: один текст и один стиль (залитая кнопка) на всех экранах */
function donateBtnHtml(pre) {
  return `<button class="dp-sbp" onclick="${pre || ""}donateGo()">Поддержать проект (СБП)</button>`;
}

function renderPanels() {
  const hp = document.getElementById("home-panels");
  if (hp) hp.innerHTML = donateHtml() + communityHtml(); // главная: донат + «Написать автору» в самом низу
  const pp = document.getElementById("point-panels");
  if (pp) pp.innerHTML = donateBtnHtml(); // вторичный экран — та же залитая кнопка
}

/* ---------- роутинг ---------- */
/* ⓘ на крайней правой горе хиро: позиция от viewBox с учётом slice-кропа */
function placeHeroInfo() {
  const btn = document.getElementById("hero-info");
  const svg = document.querySelector(".hero-mountains");
  if (!btn || !svg) return;
  const W = svg.clientWidth, H = svg.clientHeight;
  if (!W) return;
  const scale = Math.max(W / 400, H / 160);
  const offX = (400 - W / scale) / 2;  /* xMid: левая граница видимого окна (юниты viewBox) */
  const offY = 160 - H / scale;        /* YMax: верхняя граница */
  const half = 23;                     /* половина кнопки 46px */
  const cx = Math.max(half + 4, Math.min((340 - offX) * scale, W - half - 4));
  const cy = Math.max(half + 4, Math.min((132 - offY) * scale, H - half - 4));
  btn.style.left = cx + "px";
  btn.style.top = cy + "px";
}
window.addEventListener("resize", placeHeroInfo);

function goPoint(id) { location.hash = "#point/" + id; }
function goHome() { location.hash = ""; }

function route() {
  const h = location.hash;
  // защита от горизонтального смещения страницы после закрытия оверлеев
  resetScrollX();
  const home = document.getElementById("home-screen");
  const point = document.getElementById("point-screen");
  const lib = document.getElementById("lib-screen");
  const about = document.getElementById("about-screen");
  const settings = document.getElementById("settings-screen");
  const style = document.getElementById("style-screen");
  const m = h.match(/^#point\/(.+)$/);
  if (lib) lib.classList.toggle("hidden", h !== "#library");
  if (about) about.classList.toggle("hidden", h !== "#about");
  if (settings) settings.classList.toggle("hidden", h !== "#settings");
  if (style) style.classList.toggle("hidden", h !== "#style");
  if (h === "#library") { renderLibrary(document.getElementById("lib-search").value); return; }
  if (h === "#about") return;
  if (h === "#settings") return;
  if (h === "#style") { renderStyleList(); return; }
  if (m) {
    home.classList.add("hidden");
    point.classList.remove("hidden");
    loadPoint(m[1]);
    window.scrollTo(0, 0);
  } else {
    point.classList.add("hidden");
    home.classList.remove("hidden");
    placeHeroInfo();
  }
}

/* ---------- свайп вправо = назад (библиотека, точка, «О проекте» → главная) ---------- */
(function bindSwipeBack() {
  let sx = 0, sy = 0, st = 0, tracking = false;
  document.addEventListener("touchstart", e => {
    if (e.touches.length !== 1) { tracking = false; return; }
    sx = e.touches[0].clientX; sy = e.touches[0].clientY;
    st = Date.now(); tracking = true;
  }, { passive: true });
  document.addEventListener("touchend", e => {
    if (!tracking) return;
    tracking = false;
    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;
    if (dx < 70 || Math.abs(dy) > 50 || Date.now() - st > 600) return;
    if (editMode || dragCtx) return; // идёт перетаскивание виджета
    const t = e.target;
    if (t && t.closest && t.closest(".hours-wrap, input, textarea")) return; // горизонтальный скролл/ввод
    const h = location.hash;
    if (h === "#style") { closeStyle(); return; } // свайп со стилей → назад в настройки
    if (h === "#library" || h === "#about" || h === "#settings" || h.indexOf("#point/") === 0) goHome();
  }, { passive: true });
})();

window.addEventListener("hashchange", route);
// iOS/Telegram: после закрытия клавиатуры viewport иногда остаётся сдвинутым — возвращаем на место
if (window.visualViewport) {
  visualViewport.addEventListener("resize", () => {
    const ae = document.activeElement;
    if (ae && /^(INPUT|TEXTAREA)$/.test(ae.tagName)) return; // не мешаем центрированию поля ввода
    if (window.scrollX > 0 || visualViewport.offsetLeft > 0) resetScrollX();
  });
}
initTheme();
bindHomeList();
fillStaticIcons();
route();
loadHome();
initSkin(); // стиль + бейдж из skins/; при смене перерисует текущий экран
