/* «Погода в горах и на море» v2.1 — фронт серверной версии (hash-роутинг, без сборки).
   Данные: /api/points и /api/weather локального server.py.
   Состояние (тема, набор и порядок виджетов, подписка) — в localStorage. */

/* ---------- плейсхолдер-ссылки (заменить на реальные) ---------- */
const SITE_URL = "https://example.com/";            // сайт-визитка (зарезервировано)
const DONATE_URL = "https://example.com/pay";       // оплата подписки
const COMMUNITY_URL = "https://example.com/community"; // комьюнити
const FEEDBACK_TG = "tg://resolve?domain=broKimibot";  // чат бота для «Предложить точку»

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

/* МСК-время без сторонних библиотек (МСК = UTC+3 круглый год) */
function mskToday() { return new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10); }
function mskNowIso() { return new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 19); }

async function fetchJSON(url) {
  const r = await fetch(url);
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || ("HTTP " + r.status));
  return data;
}

function icon(code) { return (WMO[code] || ["🌡", "—"])[0]; }
function wmoLabel(code) { return (WMO[code] || ["", "—"])[1]; }
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

function fmtDay(iso, i) {
  if (i === 0) return "Сегодня";
  if (i === 1) return "Завтра";
  const d = new Date(iso + "T12:00:00");
  return WD[d.getDay()] + " " + String(d.getDate()).padStart(2, "0") + "." + String(d.getMonth() + 1).padStart(2, "0");
}

/* ---------- плейсхолдеры: подсказка «скоро» вместо перехода ---------- */
const isPlaceholder = u => !u || u.includes("example.com");
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
function openCommunity(e) {
  if (isPlaceholder(COMMUNITY_URL)) { e.preventDefault(); soonHint("Комьюнити скоро откроется"); }
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
  if (!ids.includes(id)) { ids.push(id); saveHomeIds(ids); }
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
    const { points } = await fetchJSON("/api/points");
    POINTS = points.slice().sort((a, b) =>
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

/* ---------- библиотека виджетов ---------- */
function openLibrary() { location.hash = "#library"; }
function closeLibrary() { location.hash = ""; }

function renderLibrary(filter) {
  const box = document.getElementById("lib-list");
  if (!box) return;
  const q = String(filter || "").trim().toLowerCase();
  const ids = homeBaseIds();
  const rows = POINTS.filter(p =>
    !q || p.name.toLowerCase().includes(q) || p.region.toLowerCase().includes(q)
  ).map(p => {
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
  box.innerHTML = rows.length ? rows.join("") : `<div class="lib-empty">Ничего не найдено</div>`;
  box.querySelectorAll("[data-add]").forEach(b => b.addEventListener("click", () => libAdd(b.dataset.add)));
  box.querySelectorAll("[data-rm]").forEach(b => b.addEventListener("click", () => libRemove(b.dataset.rm)));
}

/* ---------- предложить точку / обратная связь ---------- */
function openFeedback() {
  const m = document.getElementById("fb-modal");
  if (m) m.classList.remove("hidden");
}
function closeFeedback() {
  const m = document.getElementById("fb-modal");
  if (m) m.classList.add("hidden");
}
function feedbackGo() {
  closeFeedback();
  try {
    if (window.Telegram && Telegram.WebApp && Telegram.WebApp.openTelegramLink) {
      Telegram.WebApp.openTelegramLink(FEEDBACK_TG);
      return;
    }
  } catch (e) {}
  window.open(FEEDBACK_TG, "_blank");
}

/* ---------- ссылки ручной перепроверки ---------- */
function windyLink(p) { return `https://www.windy.com/?${p.lat},${p.lon},11`; }
function yrLink(p) { return `https://www.yr.no/en/search?q=${p.lat},${p.lon}`; }
function mfLink(p) { return `https://www.mountain-forecast.com/peaks/${MF_MAP[p.id] || "Mount-Fisht"}`; }

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
    d = await fetchJSON("/api/weather?id=" + encodeURIComponent(id));
  } catch (e) {
    box.innerHTML = `<div class="error-box">Не удалось получить погоду: ${esc(e.message)}<br><br>Попробуйте ещё раз через минуту.</div>`;
    return;
  }
  lastPayload = d;
  pushRecent(id);
  const p = d.point;
  const cur = d.current;
  const fetched = d.fetched_at ? d.fetched_at.slice(11, 16) : "";

  const nowHtml = cur ? `
    <div class="card">
      <h3>Погода сейчас · обновлено ${fetched} МСК</h3>
      <div class="now-main">
        <div class="now-icon">${icon(cur.code)}</div>
        <div>
          <div class="now-t">${cur.t}°</div>
          <div class="now-desc">${wmoLabel(cur.code)} · ощущается ${cur.feels}°</div>
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
    const spread = day.t_day_spread && (day.t_day_spread[0] !== day.t_day_spread[1])
      ? `<span class="spread">разброс ${day.t_day_spread[0]}…${day.t_day_spread[1]}°</span>` : "";
    return `
      <div class="day-block">
        <div class="day-row" onclick="toggleHours(this)">
          <div class="day-date">${label}<small><span class="vdot ${day.verdict}"></span>${day.precip ?? 0} мм${day.precip_spread && day.precip_spread[0] !== day.precip_spread[1] ? ` <span class="d-spread">${day.precip_spread[0]}–${day.precip_spread[1]}</span>` : ""}</small></div>
          <div class="day-icon">${icon(day.code)}</div>
          <div class="day-temp">${day.t_day ?? "—"}° <span class="night">/ ${day.t_night ?? "—"}°</span>${spread}</div>
          <div class="day-stats">💨 ${day.wind ?? "—"} м/с<br>☁️ ${day.cloud ?? "—"}% <span class="chev">▾</span></div>
        </div>
        <div class="hours-wrap hidden">${hoursHtml(d, day.date)}</div>
      </div>`;
  }).join("");

  const SHOW_EXT_LINKS = false; // временно скрыты кнопки Windy / Yr.no / Mountain-Forecast
  box.innerHTML = `
    <h2 class="pt-title">${esc(p.name)}</h2>
    <div class="pt-sub">${esc(p.region)} · ${p.lat}, ${p.lon} · высота ${p.ele} м</div>
    <button class="share-btn" onclick="sharePoint()">📤 Поделиться</button>
    ${nowHtml}
    ${SHOW_EXT_LINKS ? `<div class="links-row">
      <a class="link-btn" href="${windyLink(p)}" target="_blank" rel="noopener">Windy</a>
      <a class="link-btn" href="${yrLink(p)}" target="_blank" rel="noopener">Yr.no</a>
      <a class="link-btn" href="${mfLink(p)}" target="_blank" rel="noopener">Mountain-Forecast</a>
    </div>` : ""}
    <div class="card collapse-card">
      <div class="collapse-head" onclick="toggleCollapse(this)">Микро-анализ сегодня <span class="chev">▾</span></div>
      <div class="collapse-body hidden"><div class="analysis-text">${esc(d.analysis)}</div></div>
    </div>
    <div class="card">
      <h3>5 дней · нажмите на день — прогноз по часам</h3>
      ${daysHtml}
    </div>
  `;
  renderPanels();
}

/* ---------- карточка пересылки ---------- */
function sharePoint() {
  if (!lastPayload) return;
  const d = lastPayload, t = d.days[1];
  if (!t) return;
  const spread = t.t_day_spread && t.t_day_spread[0] !== t.t_day_spread[1]
    ? `, разброс ${t.t_day_spread[0]}…${t.t_day_spread[1]}°` : "";
  const text = `${d.point.name}, завтра ${t.t_day ?? "—"}°${spread}, осадки ${t.precip ?? 0} мм — Погода в горах`;
  const done = () => soonHint("Скопировано — отправь другу 📤");
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
  } else fallbackCopy(text, done);
}
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

function toggleCollapse(headEl) {
  const body = headEl.nextElementSibling;
  const opening = body.classList.contains("hidden");
  body.classList.toggle("hidden");
  headEl.classList.toggle("open", opening);
}

/* Почасовой прогноз на сутки date (из d.hourly, время МСК) */
function hoursHtml(d, date) {
  if (!d.hourly) return `<div class="hours-empty">Почасовые данные недоступны</div>`;
  const h = d.hourly;
  const today = mskToday();
  const nowH = parseInt(mskNowIso().slice(11, 13), 10);
  let cells = "";
  for (let i = 0; i < h.time.length; i++) {
    if (h.time[i].slice(0, 10) !== date) continue;
    const hh = parseInt(h.time[i].slice(11, 13), 10);
    const isNow = date === today && hh === nowH;
    const pr = h.precip[i] || 0;
    cells += `
      <div class="h-cell${isNow ? " now" : ""}" data-h="${hh}">
        <div class="h-time">${isNow ? "сейчас" : String(hh).padStart(2, "0") + ":00"}</div>
        <div class="h-icon">${icon(h.code[i])}</div>
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

/* ---------- донат-подписка и комьюнити ---------- */
let dpAmount = null;

function donateState() {
  try { return JSON.parse(localStorage.getItem("kp_donate") || "null"); } catch (e) { return null; }
}

function donateHtml() {
  const st = donateState();
  if (st && st.subscribed) {
    return `
      <div class="donate-panel">
        <div class="dp-thanks">СПАСИБО 🙏</div>
        <div class="dp-change" onclick="donateReset()">Вы всегда можете изменить сумму подписки</div>
      </div>`;
  }
  return `
    <div class="donate-panel pulse">
      <div class="dp-title">Поддержать проект — любая сумма от 0 ₽/мес</div>
      <div class="dp-amounts">
        ${[0, 100, 500].map(a => `<button class="dp-amt" data-amt="${a}" onclick="donatePick(this)">${a} ₽</button>`).join("")}
        <input class="dp-custom" placeholder="своя сумма" inputmode="numeric" oninput="donateCustom(this)">
      </div>
      <button class="dp-go" onclick="donateGo()">Оформить подписку</button>
    </div>`;
}

function communityHtml() {
  return `<a class="community-panel" href="${COMMUNITY_URL}" target="_blank" rel="noopener" onclick="openCommunity(event)">Вступить в комьюнити</a>`;
}

function renderPanels() {
  const hp = document.getElementById("home-panels");
  if (hp) hp.innerHTML = donateHtml() + communityHtml();
  const pp = document.getElementById("point-panels");
  if (pp) pp.innerHTML = donateHtml() + communityHtml();
  dpAmount = null;
}

/* Скролл к кнопке «Оформить подписку» — только по явному выбору суммы
   (см. donatePick). Никаких автосроллов по viewport/фокусу: иначе
   приложение «тянет» к подписке и не даёт смотреть контент. */

function donatePick(btn) {
  const panel = btn.closest(".donate-panel");
  panel.querySelectorAll(".dp-amt").forEach(b => b.classList.remove("sel"));
  panel.querySelector(".dp-custom").value = "";
  btn.classList.add("sel");
  dpAmount = parseInt(btn.dataset.amt, 10);
  const go = panel.querySelector(".dp-go");
  if (go) setTimeout(() => go.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
}

function donateCustom(input) {
  const panel = input.closest(".donate-panel");
  panel.querySelectorAll(".dp-amt").forEach(b => b.classList.remove("sel"));
  const v = parseInt(String(input.value).replace(/[^\d]/g, ""), 10);
  dpAmount = isNaN(v) ? null : v;
}

function donateGo() {
  const amount = dpAmount == null ? 0 : dpAmount;
  if (amount > 0) {
    if (isPlaceholder(DONATE_URL)) soonHint("Оплата подключится чуть позже — спасибо! 🙏");
    else window.open(DONATE_URL, "_blank", "noopener");
  }
  try { localStorage.setItem("kp_donate", JSON.stringify({ subscribed: true, amount, ts: Date.now() })); } catch (e) {}
  renderPanels();
}

function donateReset() {
  try { localStorage.removeItem("kp_donate"); } catch (e) {}
  renderPanels();
}

/* ---------- роутинг ---------- */
function goPoint(id) { location.hash = "#point/" + id; }
function goHome() { location.hash = ""; }

function route() {
  const h = location.hash;
  const home = document.getElementById("home-screen");
  const point = document.getElementById("point-screen");
  const lib = document.getElementById("lib-screen");
  const m = h.match(/^#point\/(.+)$/);
  if (lib) lib.classList.toggle("hidden", h !== "#library");
  if (h === "#library") { renderLibrary(document.getElementById("lib-search").value); return; }
  if (m) {
    home.classList.add("hidden");
    point.classList.remove("hidden");
    loadPoint(m[1]);
    window.scrollTo(0, 0);
  } else {
    point.classList.add("hidden");
    home.classList.remove("hidden");
  }
}

window.addEventListener("hashchange", route);
initTheme();
bindHomeList();
route();
loadHome();
