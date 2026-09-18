/* «Погода в горах и на море» v2 — статичный фронт (hash-роутинг, без сервера).
   Данные: weather.js ходит напрямую в Open-Meteo и MET Norway. */

/* ---------- плейсхолдер-ссылки (заменить на реальные) ---------- */
const SITE_URL = "https://example.com/";            // сайт-визитка (луна в шапке)
const DONATE_URL = "https://example.com/pay";       // оплата подписки
const COMMUNITY_URL = "https://example.com/community"; // комьюнити

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
        Telegram.WebApp.setHeaderColor("#0b1220");
        Telegram.WebApp.setBackgroundColor("#0b1220");
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

function icon(code) { return (WMO[code] || ["🌡", "—"])[0]; }
function wmoLabel(code) { return (WMO[code] || ["", "—"])[1]; }
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

function fmtDay(iso, i) {
  if (i === 0) return "Сегодня";
  if (i === 1) return "Завтра";
  const d = new Date(iso + "T12:00:00");
  return WD[d.getDay()] + " " + String(d.getDate()).padStart(2, "0") + "." + String(d.getMonth() + 1).padStart(2, "0");
}

/* Плейсхолдеры: пока ссылок нет — не уводим пользователя на заглушку */
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

/* ---------- главный экран ---------- */
async function loadHome() {
  const list = document.getElementById("points-list");
  try {
    const r = await fetch("data/points.json");
    if (!r.ok) throw new Error("HTTP " + r.status);
    const data = await r.json();
    POINTS = data.points.slice().sort((a, b) =>
      a.name.toLowerCase().localeCompare(b.name.toLowerCase(), "ru"));
    list.innerHTML = POINTS.map(p => `
      <button class="point-btn" onclick="goPoint('${p.id}')">
        <span class="p-name">${esc(p.name)}</span>
        <span class="p-ele">${p.ele} м</span>
        <span class="p-region">${esc(p.region)}</span>
      </button>`).join("");
  } catch (e) {
    list.innerHTML = `<div class="error-box">Не удалось загрузить точки: ${esc(e.message)}</div>`;
  }
  renderPanels();
}

/* ---------- ссылки ручной перепроверки ---------- */
function windyLink(p) { return `https://www.windy.com/?${p.lat},${p.lon},11`; }
function yrLink(p) { return `https://www.yr.no/en/search?q=${p.lat},${p.lon}`; }
function mfLink(p) { return `https://www.mountain-forecast.com/peaks/${MF_MAP[p.id] || "Mount-Fisht"}`; }

/* ---------- экран точки ---------- */
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
        ${[0, 10, 20, 30, 50, 100].map(a => `<button class="dp-amt" data-amt="${a}" onclick="donatePick(this)">${a} ₽</button>`).join("")}
        <input class="dp-custom" placeholder="своя сумма" inputmode="numeric" oninput="donateCustom(this)">
      </div>
      <button class="dp-go" onclick="donateGo()">Оформить подписку</button>
    </div>`;
}

function renderPanels() {
  const hp = document.getElementById("home-panels");
  if (hp) {
    hp.innerHTML = donateHtml() +
      `<a class="community-panel" href="${COMMUNITY_URL}" target="_blank" rel="noopener" onclick="openCommunity(event)">Вступить в комьюнити</a>`;
  }
  const pp = document.getElementById("point-panels");
  if (pp) pp.innerHTML = donateHtml();
  dpAmount = null;
}

function donatePick(btn) {
  const panel = btn.closest(".donate-panel");
  panel.querySelectorAll(".dp-amt").forEach(b => b.classList.remove("sel"));
  panel.querySelector(".dp-custom").value = "";
  btn.classList.add("sel");
  dpAmount = parseInt(btn.dataset.amt, 10);
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
  const m = h.match(/^#point\/(.+)$/);
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
route();
loadHome();
