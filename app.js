/* «Погода в горах Красной Поляны» — статичный фронт (hash-роутинг, без сервера).
   Данные: weather.js ходит напрямую в Open-Meteo и MET Norway. */

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
const VERDICT = {
  green: "🟢 Отлично", yellow: "🟡 Осторожно", red: "🔴 Не стоит",
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
}

/* ---------- экран точки ---------- */
function mfLink(p) {
  // В базе Mountain-Forecast из вершин региона есть только Mount Fisht
  if (p.region === "Красная Поляна") {
    return `<a class="link-btn" href="https://www.mountain-forecast.com/peaks/Mount-Fisht" target="_blank" rel="noopener">Mountain-Forecast · Фишт</a>`;
  }
  return `<a class="link-btn disabled">Mountain-Forecast: нет вершин Абхазии</a>`;
}

async function loadPoint(id) {
  const box = document.getElementById("point-content");
  box.innerHTML = `<div class="loading">Собираю сводку из источников…</div>`;
  const point = POINTS.find(p => p.id === id);
  if (!point) {
    box.innerHTML = `<div class="error-box">Точка не найдена.</div>`;
    return;
  }
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
      <h3>Сейчас · ${p.ele} м</h3>
      <div class="now-main">
        <div class="now-icon">${icon(cur.code)}</div>
        <div>
          <div class="now-t">${cur.t}°</div>
          <div class="now-desc">${wmoLabel(cur.code)} · ощущается ${cur.feels}°</div>
        </div>
      </div>
      <div class="now-grid">
        <div class="now-cell"><div class="k">Ветер</div><div class="v">${cur.wind} м/с</div></div>
        <div class="now-cell"><div class="k">Порывы</div><div class="v">${cur.gust} м/с</div></div>
        <div class="now-cell"><div class="k">Облачность</div><div class="v">${cur.cloud}%</div></div>
      </div>
      <div class="meta-line">Обновлено ${fetched} МСК · источники: ${d.sources.join(", ")}${d.errors.length ? " · не ответили: " + d.errors.join(", ") : ""}</div>
    </div>` : "";

  const daysHtml = d.days.map((day, i) => {
    const label = fmtDay(day.date, i);
    const spread = day.t_day_spread && (day.t_day_spread[0] !== day.t_day_spread[1])
      ? `<span class="spread">разброс ${day.t_day_spread[0]}…${day.t_day_spread[1]}°</span>` : "";
    return `
      <div class="day-row">
        <div class="day-date">${label}<small><span class="vdot ${day.verdict}"></span>${day.precip ?? 0} мм</small></div>
        <div class="day-icon">${icon(day.code)}</div>
        <div class="day-temp">${day.t_day ?? "—"}° <span class="night">/ ${day.t_night ?? "—"}°</span>${spread}</div>
        <div class="day-stats">💨 ${day.wind ?? "—"} м/с<br>☁️ ${day.cloud ?? "—"}%</div>
      </div>`;
  }).join("");

  box.innerHTML = `
    <h2 class="pt-title">${esc(p.name)}</h2>
    <div class="pt-sub">${p.ele} м · ${esc(p.region)} · ${p.lat.toFixed(4)}, ${p.lon.toFixed(4)}</div>
    ${nowHtml}
    <div class="card">
      <span class="badge ${d.verdict}">${VERDICT[d.verdict]}</span>
      <div class="advice">${esc(d.advice)}</div>
    </div>
    <div class="card">
      <h3>5 дней · день / ночь</h3>
      ${daysHtml}
    </div>
    <div class="card">
      <h3>Микро-анализ</h3>
      <div class="analysis-text">${esc(d.analysis)}</div>
    </div>
    <div class="links-row">
      <a class="link-btn" href="https://www.windy.com/${p.lat},${p.lon},11" target="_blank" rel="noopener">Windy</a>
      ${mfLink(p)}
    </div>
    <div class="soon-note">🔔 Уведомления о походе — в следующей версии</div>
  `;
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
