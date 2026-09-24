/* «Погода в горах, на море и дома» v2.3 — статичный фронт (hash-роутинг, без сервера).
   Данные: weather.js ходит напрямую в Open-Meteo, Ensemble, Marine и MET Norway.
   Время на экранах — местное для каждой точки (timezone=auto).
   Состояние (тема, набор и порядок виджетов) — в localStorage. */

/* ---------- КОНСТАНТЫ ПРОЕКТА (все ссылки — здесь, см. README) ---------- */
const SITE_URL = "https://pogoda-pro.ru/";                    // сайт-визитка
const DONATE_URL = "https://www.tbank.ru/cf/83mAzHJg3A";      // поддержка проекта (сбор Т-Банк)
const AUTHOR_TG = "https://t.me/go_ride_bro";                 // «Написать автору» — сразу личные сообщения
const COMMUNITY_URL = "https://example.com/community";        // комьюнити (зарезервировано)
const FORM_BOT = "https://t.me/Pagoda_assistant_bot";         // «Предложить точку» — ассистент приёма точек 24/7
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

/* ---------- SVG-иконки погоды: не зависят от шрифта устройства (в отличие от эмодзи) ---------- */
const CLD = '<path class="cld" d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>';
const WIC = {
  sun: `<svg class="wic" viewBox="0 0 24 24"><circle class="snf" cx="12" cy="12" r="4.4"/><g class="sn"><line x1="18.6" y1="12" x2="20.9" y2="12"/><line x1="5.4" y1="12" x2="3.1" y2="12"/><line x1="12" y1="5.4" x2="12" y2="3.1"/><line x1="12" y1="18.6" x2="12" y2="20.9"/><line x1="16.67" y1="7.33" x2="18.3" y2="5.7"/><line x1="7.33" y1="7.33" x2="5.7" y2="5.7"/><line x1="16.67" y1="16.67" x2="18.3" y2="18.3"/><line x1="7.33" y1="16.67" x2="5.7" y2="18.3"/></g></svg>`,
  moon: `<svg class="wic" viewBox="0 0 24 24"><path class="mn" d="M20 14.5A8 8 0 1 1 9.5 4a9 9 0 0 0 10.5 10.5z"/></svg>`,
  sunCloud: `<svg class="wic" viewBox="0 0 24 24"><circle class="snf" cx="7.6" cy="7.4" r="3.1"/><g class="sn"><line x1="7.6" y1="2.6" x2="7.6" y2="1"/><line x1="2.7" y1="7.4" x2="1.1" y2="7.4"/><line x1="4.1" y1="3.9" x2="3" y2="2.8"/><line x1="11.1" y1="3.9" x2="12.2" y2="2.8"/></g><g transform="translate(2.6 3.4) scale(0.82)">${CLD}</g></svg>`,
  moonCloud: `<svg class="wic" viewBox="0 0 24 24"><g transform="translate(-1 -1) scale(0.62)"><path class="mn" d="M20 14.5A8 8 0 1 1 9.5 4a9 9 0 0 0 10.5 10.5z"/></g><g transform="translate(2.6 3.4) scale(0.82)">${CLD}</g></svg>`,
  cloud: `<svg class="wic" viewBox="0 0 24 24">${CLD}</svg>`,
  fog: `<svg class="wic" viewBox="0 0 24 24"><g transform="translate(0 -2.2)">${CLD}</g><g class="fg"><line x1="6.5" y1="19.6" x2="17.5" y2="19.6"/><line x1="8.5" y1="22" x2="15.5" y2="22"/></g></svg>`,
  drizzle: `<svg class="wic" viewBox="0 0 24 24"><g transform="translate(1.8 -0.6) scale(0.86)">${CLD}</g><g class="drz"><line x1="8.8" y1="17.6" x2="8.3" y2="19.4"/><line x1="14.6" y1="17.6" x2="14.1" y2="19.4"/></g></svg>`,
  rain: `<svg class="wic" viewBox="0 0 24 24"><g transform="translate(1.8 -0.6) scale(0.86)">${CLD}</g><g class="rn"><line x1="7.2" y1="17.4" x2="6.3" y2="20.3"/><line x1="12" y1="17.4" x2="11.1" y2="20.3"/><line x1="16.8" y1="17.4" x2="15.9" y2="20.3"/></g></svg>`,
  snow: `<svg class="wic" viewBox="0 0 24 24"><g transform="translate(1.8 -0.6) scale(0.86)">${CLD}</g><g class="snw"><line x1="5.9" y1="19.2" x2="8.5" y2="19.2"/><line x1="6.52" y1="18.02" x2="7.88" y2="20.38"/><line x1="6.52" y1="20.38" x2="7.88" y2="18.02"/><line x1="10.7" y1="20.4" x2="13.3" y2="20.4"/><line x1="11.32" y1="19.22" x2="12.68" y2="21.58"/><line x1="11.32" y1="21.58" x2="12.68" y2="19.22"/><line x1="15.5" y1="19.2" x2="18.1" y2="19.2"/><line x1="16.12" y1="18.02" x2="17.48" y2="20.38"/><line x1="16.12" y1="20.38" x2="17.48" y2="18.02"/></g></svg>`,
  thunder: `<svg class="wic" viewBox="0 0 24 24"><g transform="translate(1.8 -0.6) scale(0.86)">${CLD}</g><path class="blt" d="M13.2 15.6 L9.9 20.3 L12 20.3 L10.8 23.4 L14.9 18.4 L12.5 18.4 L14.2 15.6 Z"/></svg>`,
  wind: `<svg class="wic" viewBox="0 0 24 24"><g class="wnd"><path d="M3 8h9.5a3 3 0 1 0-3-3.2"/><path d="M3 12.5h14a3 3 0 1 1-3 3.2"/><path d="M3 17h7"/></g></svg>`,
};
function iconName(code, night) {
  if (code === 0 || code === 1) return night ? "moon" : "sun";
  if (code === 2) return night ? "moonCloud" : "sunCloud";
  if (code === 3) return "cloud";
  if (code === 45 || code === 48) return "fog";
  if ([51, 53, 55, 56, 57].includes(code)) return "drizzle";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "snow";
  if ([95, 96, 99].includes(code)) return "thunder";
  return "cloud";
}
function icon(code, night) { return WIC[iconName(code, night)] || WIC.cloud; }
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
  applyTgColors();
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
function homeBaseIds() {
  let ids = null;
  try { ids = JSON.parse(localStorage.getItem("kp_home_ids") || "null"); } catch (e) {}
  if (!Array.isArray(ids)) ids = POINTS.slice(0, 16).map(p => p.id); // стартовые 16 по алфавиту
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
      <button class="ha-btn" onclick="openLibrary()">🌍 Библиотека точек</button>
      <button class="ha-btn" onclick="openFeedback()">+ Предложить точку</button>
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
        <span class="p-name">${esc(p.name)}</span>
        <span class="p-ele">${p.ele} м</span>
        <span class="p-region">${esc(p.region)}</span>
        <span class="p-remove" data-rm="${p.id}" title="Убрать с главной">✕</span>
      </button>`;
    }).join("") + homeActionsHtml();
}

async function loadHome() {
  const list = document.getElementById("points-list");
  try {
    const r = await fetch("data/points.json");
    if (!r.ok) throw new Error("HTTP " + r.status);
    const data = await r.json();
    POINTS = data.points.slice().sort((a, b) =>
      a.name.toLowerCase().localeCompare(b.name.toLowerCase(), "ru"));
    renderHome();
  } catch (e) {
    list.innerHTML = `<div class="error-box">Не удалось загрузить точки: ${esc(e.message)}</div>`;
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
  return `<div class="lib-tabs">${tab("all", "Все")}${tab("dev", "⭐ От разработчиков")}${mine ? tab("mine", "Мои") : ""}</div>`;
}

function renderLibrary(filter) {
  const box = document.getElementById("lib-list");
  if (!box) return;
  const tabs = document.getElementById("lib-tabs-wrap");
  if (tabs) tabs.innerHTML = libTabsHtml();
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
          <div class="lib-name">${esc(p.name)}</div>
          <div class="lib-sub">${esc(p.region)} · ${p.ele} м</div>
        </div>
        ${on
          ? `<button class="lib-on" data-rm="${p.id}">на главной ✓</button>`
          : `<button class="lib-add" data-add="${p.id}">Добавить</button>`}
      </div>`;
  });
  const emptyText = libTab === "mine"
    ? "Пока пусто — предложенные вами точки появятся здесь после модерации"
    : "Ничего не найдено";
  box.innerHTML = rows.length ? rows.join("") : `<div class="lib-empty">${emptyText}</div>`;
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
  fbShowError("");
}
function closeFeedback() {
  const m = document.getElementById("fb-modal");
  if (m) m.classList.add("hidden");
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

  let last = 0;
  try { last = parseInt(localStorage.getItem("kp_suggest_ts") || "0", 10); } catch (e) {}
  const leftMs = last + 24 * 3600 * 1000 - Date.now();
  if (leftMs > 0) {
    const h = Math.ceil(leftMs / 3600000);
    return { error: `С этого устройства точку можно предложить раз в сутки — подождите ещё ~${h} ч` };
  }
  return { name, lat: Math.round(lat * 10000) / 10000, lon: Math.round(lon * 10000) / 10000 };
}

function feedbackSubmit() {
  const nameEl = document.getElementById("fb-name");
  const coordsEl = document.getElementById("fb-coords");
  const r = validateSuggestion(nameEl && nameEl.value, coordsEl && coordsEl.value);
  if (r.error) { fbShowError(r.error); return; }
  const text = `Точка: ${r.name} — ${r.lat}, ${r.lon}`;
  try { localStorage.setItem("kp_suggest_ts", String(Date.now())); } catch (e) {}
  closeFeedback();
  const openChat = () => {
    try {
      if (window.Telegram && Telegram.WebApp && Telegram.WebApp.openTelegramLink) {
        Telegram.WebApp.openTelegramLink(FORM_BOT);
        return;
      }
    } catch (e) {}
    window.open(FORM_BOT, "_blank");
  };
  const done = () => { soonHint("Текст скопирован — вставьте его в чат бота 📋"); openChat(); };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done, () => { fallbackCopy(text, () => {}); done(); });
  } else { fallbackCopy(text, () => {}); done(); }
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
  return `🌊 ${w.height.toFixed(1)} м · период ${Math.round(w.period)} с · направление ${rumb(w.dir)}`;
}
function wavesHtml(d) {
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
  return mn !== mx ? `от ${mn} до ${mx} м/с` : `${mn} м/с`;
}

async function loadPoint(id) {
  const box = document.getElementById("point-content");
  const point = POINTS.find(p => p.id === id);
  document.getElementById("sticky-name").textContent = point ? point.name : "";
  if (!point) {
    box.innerHTML = `<div class="error-box">Точка не найдена.</div>`;
    return;
  }
  box.innerHTML = `<div class="loading">Собираю сводку из источников…</div>`;
  const pp = document.getElementById("point-panels");
  if (pp) pp.innerHTML = ""; // панели покажем только после загрузки — без мелькания
  let d;
  try {
    d = await getWeather(point);
  } catch (e) {
    box.innerHTML = `<div class="error-box">Не удалось получить погоду: ${esc(e.message)}<br><br>Попробуйте ещё раз через минуту.</div>`;
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
          <div class="d-right">${WIC.wind} ${day.wind ?? "—"} м/с<br>${WIC.cloud} ${day.cloud ?? "—"}% <span class="chev">▾</span></div>
        </div>
        <div class="hours-wrap hidden">${hoursHtml(d, day.date)}</div>
      </div>`;
  }).join("");

  const SHOW_EXT_LINKS = false; // временно скрыты кнопки Windy / Yr.no / Mountain-Forecast
  box.innerHTML = `
    <h2 class="pt-title">${esc(p.name)} <button class="globe-btn pt-globe" onclick="toggleMapChoice()" aria-label="Показать на карте" title="Показать на карте">🌍</button></h2>
    <div class="pt-sub">${esc(p.region)} · ${p.lat}, ${p.lon} · высота ${p.ele} м</div>
    <div class="map-choice hidden" id="map-choice">
      <a class="link-btn" href="${gmapsLink(p)}" target="_blank" rel="noopener">Google Maps</a>
      <a class="link-btn" href="${yamapsLink(p)}" target="_blank" rel="noopener">Яндекс Карты</a>
    </div>
    ${nowHtml}
    ${wavesHtml(d)}
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
      out.push(`${nd.date}: ветер усилился до ${nd.wind} м/с`);
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
  return `<div class="hours-strip">${cells}</div><div class="hours-legend">осадки, мм · ветер, м/с</div>`;
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
  window.open(DONATE_URL, "_blank", "noopener");
  setTimeout(() => soonHint("СПАСИБО 🙏"), 400);
}

const TG_ICON = `<svg class="tg-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>`;
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

function renderPanels() {
  const hp = document.getElementById("home-panels");
  if (hp) hp.innerHTML = donateHtml() + communityHtml(); // главная: донат + автор
  const pp = document.getElementById("point-panels");
  if (pp) pp.innerHTML = donateHtml(); // на экранах точек — только поддержка (СБП)
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
  const home = document.getElementById("home-screen");
  const point = document.getElementById("point-screen");
  const lib = document.getElementById("lib-screen");
  const about = document.getElementById("about-screen");
  const m = h.match(/^#point\/(.+)$/);
  if (lib) lib.classList.toggle("hidden", h !== "#library");
  if (about) about.classList.toggle("hidden", h !== "#about");
  if (h === "#library") { renderLibrary(document.getElementById("lib-search").value); return; }
  if (h === "#about") return;
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
    if (h === "#library" || h === "#about" || h.indexOf("#point/") === 0) goHome();
  }, { passive: true });
})();

window.addEventListener("hashchange", route);
initTheme();
bindHomeList();
route();
loadHome();
