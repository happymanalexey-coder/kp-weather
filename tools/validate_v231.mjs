/* Проверка данных v2.3.1 (Этап 5 пакета) — гоняет боевой weather.js по 3 точкам
   и новые SVG-иконки/периоды из app.js. Запуск: node tools/validate_v231.mjs */
import fs from "node:fs";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url)) + "/";
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* --- боевой движок weather.js в vm (fetch берём нода-вский) --- */
const wsrc = fs.readFileSync(root + "weather.js", "utf8");
const wctx = vm.createContext({ fetch, console, setTimeout, clearTimeout, AbortController, URLSearchParams, Date, Math, JSON, Promise, Error, Set, Object, Array, Number, String, parseInt, parseFloat, isNaN });
vm.runInContext(wsrc + "\nthis.__agg = aggregate;", wctx);

/* --- из app.js вырезаем иконный блок (WMO, esc, wmoLabel, WIC/iconName/icon, codeRank, periodsHtml) --- */
const asrc = fs.readFileSync(root + "app.js", "utf8");
function cut(startMark, endMark) {
  const a = asrc.indexOf(startMark), b = asrc.indexOf(endMark, a);
  if (a < 0 || b < 0) throw new Error("не нашёл блок: " + startMark);
  return asrc.slice(a, b);
}
const iconCode =
  cut("const WMO =", "const WD =") +
  cut("/* Честное название осадков", "function fmtDay") +
  cut("/* ---------- SVG-иконки погоды", "function wmoLabel") +
  "function wmoLabel(code){return (WMO[code]||[\"\",\"—\"])[1];}\n" +
  cut("/* «Суровость» кода погоды", "/* Почасовой прогноз на сутки");
const actx = vm.createContext({ console });
vm.runInContext(iconCode + "\nthis.__fns = { icon, iconName, codeRank, periodsHtml, wmoLabel };", actx);
const F = actx.__fns;

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? "  ✅ " : "  ❌ ") + msg); if (!cond) fails++; };

/* --- иконки: ни одного эмодзи, валидный svg, ночные варианты --- */
console.log("== Иконки (1.2 / 2.1) ==");
const codes = [0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67,
               71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99];
let allOk = true;
for (const c of codes) for (const night of [false, true]) {
  const s = F.icon(c, night);
  if (!s.startsWith("<svg") || !s.endsWith("</svg>") || EMOJI.test(s)) allOk = false;
}
ok(allOk, codes.length + " кодов × день/ночь → SVG без эмодзи");
ok(F.icon(0, false).includes("wg-sun") && F.icon(0, true).includes("wg-moon"), "ясно: день=солнце, ночь=луна");
ok(F.icon(2, true) !== F.icon(2, false), "переменная облачность: день/ночь различаются");

/* --- данные по 3 точкам --- */
const POINTS = [
  { id: "achishkho-glavnaya", name: "Ачишхо", lat: 43.727442, lon: 40.124403, ele: 2370, region: "Красная Поляна" },
  { id: "balangan", name: "Баланган", lat: -8.7926, lon: 115.1233, ele: 5, region: "Бали" },
  { id: "rosa-pik", name: "Роза Пик", lat: 43.625286, lon: 40.310063, ele: 2293, region: "Красная Поляна" },
];
const EXPECT_TZ = { "achishkho-glavnaya": 3 * 3600, "balangan": 8 * 3600, "rosa-pik": 3 * 3600 };
const EXPECT_WAVES = { "achishkho-glavnaya": false, "balangan": true, "rosa-pik": false };

for (const p of POINTS) {
  console.log(`\n== ${p.name} (${p.lat}, ${p.lon}, ${p.ele} м) ==`);
  let d;
  try { d = await wctx.__agg(p); }
  catch (e) { console.log("  ❌ aggregate упал: " + e.message); fails++; continue; }
  ok(d.errors.length === 0, `источники без ошибок (${d.sources.join(", ")})` + (d.errors.length ? " — " + d.errors.join("; ") : ""));
  ok(d.tz_offset === EXPECT_TZ[p.id], `часовой пояс UTC+${d.tz_offset / 3600} (ожидали +${EXPECT_TZ[p.id] / 3600})`);

  /* 5.1: дневная сумма = сумма почасовых (±0.1) */
  if (d.hourly) {
    let bad = [];
    for (const day of d.days) {
      let s = 0, n = 0;
      for (let i = 0; i < d.hourly.time.length; i++)
        if (d.hourly.time[i].slice(0, 10) === day.date) { s += d.hourly.precip[i] || 0; n++; }
      const sum = Math.round(s * 10) / 10;
      if (Math.abs(sum - day.precip) > 0.1) bad.push(`${day.date}: часы ${sum} ≠ день ${day.precip}`);
      if (n !== 24) bad.push(`${day.date}: ${n} часов вместо 24`);
    }
    ok(bad.length === 0, "осадки: день = сумма 24 часов (±0.1)" + (bad.length ? " — " + bad.join(" | ") : ""));
  }

  /* температура сейчас в разумных пределах для высоты */
  if (d.current) {
    const lapse = 20 - (p.ele / 1000) * 6.5; // грубая оценка: 20° у моря, −6.5°/км
    const lo = lapse - 25, hi = lapse + 25;
    ok(d.current.t >= lo && d.current.t <= hi, `температура сейчас ${d.current.t}° (коридор ${Math.round(lo)}…${Math.round(hi)}°)`);
  }

  /* min ≤ средняя ≤ max */
  let spreadBad = [];
  for (const day of d.days) {
    if (day.t_day_spread && day.t_day != null && !(day.t_day >= day.t_day_spread[0] && day.t_day <= day.t_day_spread[1]))
      spreadBad.push(`${day.date}: ${day.t_day} вне ${day.t_day_spread}`);
  }
  ok(spreadBad.length === 0, "разброс: min ≤ средняя ≤ max по всем дням" + (spreadBad.length ? " — " + spreadBad.join(" | ") : ""));

  /* волны только там, где есть данные */
  ok(!!(d.waves && d.waves.length) === EXPECT_WAVES[p.id], `волны: ${d.waves ? d.waves.length + " дн." : "нет"} (ожидали: ${EXPECT_WAVES[p.id] ? "есть" : "нет"})`);

  /* почасовые метки — местное время: первый час сегодня = 00:00 */
  ok(d.hourly && d.hourly.time[0].slice(11, 16) === "00:00", "почасовой начинается с местной полуночи");

  /* 2.1: четыре иконки периодов для каждого дня */
  let pOk = true;
  for (const day of d.days) {
    const html = F.periodsHtml(d, day.date, day.code);
    const n = (html.match(/<svg/g) || []).length;
    if (n !== 4 || EMOJI.test(html)) { pOk = false; console.log("     ⚠ " + day.date + ": иконок " + n); }
  }
  ok(pOk, "каждый день: 4 SVG-иконки периодов (ночь/утро/день/вечер)");

  console.log(`     сейчас: ${d.current ? d.current.t + "°" : "—"}, день1: ${d.days[0].t_day}°/${d.days[0].t_night}°, осадки ${d.days[0].precip} мм, ветер ${d.days[0].wind} м/с`);
  await sleep(1200); // вежливость к API
}

console.log("\n" + (fails ? `❌ ПРОВАЛОВ: ${fails}` : "✅ ВСЕ ПРОВЕРКИ ЗЕЛЁНЫЕ"));
process.exit(fails ? 1 : 0);
