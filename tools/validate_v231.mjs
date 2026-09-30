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
vm.runInContext(wsrc + "\nthis.__agg = aggregate; this.__omurl = p => omParams(p, {});", wctx);

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
vm.runInContext(iconCode + "\nthis.__fns = { icon, iconName, codeRank, periodsHtml, wmoLabel, precipLabel, hourPrecipCode, isWetCode, precipMmText };", actx);
const F = actx.__fns;

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
const WET_SVG = /#38bdf8|url\(#wg-bolt\)|#7dd3fc/; // капли/молния/снежинка в ИСПОЛЬЗОВАНИИ — сухие иконки их не содержат
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
  { id: "roza-khutor-1100m", name: "Роза Хутор 1100м", lat: 43.6584, lon: 40.3194, ele: 1153, region: "Красная Поляна" },
  { id: "balangan", name: "Баланган", lat: -8.7926, lon: 115.1233, ele: 5, region: "Бали" },
  { id: "rosa-pik", name: "Роза Пик", lat: 43.625286, lon: 40.310063, ele: 2293, region: "Красная Поляна" },
];
const EXPECT_TZ = { "achishkho-glavnaya": 3 * 3600, "roza-khutor-1100m": 3 * 3600, "balangan": 8 * 3600, "rosa-pik": 3 * 3600 };
const EXPECT_WAVES = { "achishkho-glavnaya": false, "roza-khutor-1100m": false, "balangan": true, "rosa-pik": false };

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

  /* 7 (зеркало данных): период с осадками ≥0.1 мм обязан рисовать «мокрую» иконку;
     почасовая ячейка с ≥0.5 мм — тоже (единый маппинг hourPrecipCode) */
  const PERIODS = [[0, 6], [6, 12], [12, 18], [18, 24]];
  let mirrorBad = [];
  let rainDays = 0;
  if (d.hourly) for (const day of d.days) {
    if ((day.precip || 0) >= 1) rainDays++;
    const html = F.periodsHtml(d, day.date, day.code);
    const cells = html.match(/<span class="dp-ico"[\s\S]*?<\/svg><\/span>/g) || [];
    for (let j = 0; j < PERIODS.length && j < cells.length; j++) {
      let prSum = 0, hourMax = 0;
      for (let i = 0; i < d.hourly.time.length; i++) {
        if (d.hourly.time[i].slice(0, 10) !== day.date) continue;
        const hh = parseInt(d.hourly.time[i].slice(11, 13), 10);
        if (hh >= PERIODS[j][0] && hh < PERIODS[j][1]) {
          prSum += d.hourly.precip[i] || 0;
          if ((d.hourly.precip[i] || 0) > hourMax) hourMax = d.hourly.precip[i] || 0;
        }
      }
      if (hourMax >= 0.1 && !WET_SVG.test(cells[j]))
        mirrorBad.push(`${day.date} ${PERIODS[j][0]}–${PERIODS[j][1]}ч: час до ${hourMax.toFixed(1)} мм (сумма ${prSum.toFixed(1)}), но иконка сухая`);
    }
    for (let i = 0; i < d.hourly.time.length; i++) {
      if (d.hourly.time[i].slice(0, 10) !== day.date) continue;
      if ((d.hourly.precip[i] || 0) >= 0.5 && !F.isWetCode(F.hourPrecipCode(d, i)))
        mirrorBad.push(`${d.hourly.time[i]}: ${d.hourly.precip[i]} мм, код не «мокрый»`);
    }
  }
  ok(mirrorBad.length === 0, "зеркало: дождливый период → иконка с осадками (сводка и лента)" +
    (mirrorBad.length ? " — " + mirrorBad.join(" | ") : "") + (rainDays ? ` [дождливых дней: ${rainDays}]` : " [сухая неделя — проверка на других точках]"));

  /* 9: семантика осадков — raw daily = Σ raw hourly (ε), факт наличия не теряется */
  let prBad = [];
  if (d.hourly) for (const day of d.days) {
    let rawSum = 0, nz = 0;
    for (let i = 0; i < d.hourly.time.length; i++) {
      if (d.hourly.time[i].slice(0, 10) !== day.date) continue;
      const v = d.hourly.precip[i] || 0;
      rawSum += v;
      if (v > 0) nz++;
    }
    const okDay = day.precip_raw != null &&
      Math.abs(day.precip_raw - rawSum) <= 0.001 &&
      (day.precip_raw > 0) === (rawSum > 0) &&
      (nz > 0) === (rawSum > 0);
    if (!okDay) prBad.push(day.date);
  }
  ok(prBad.length === 0, "осадки: raw daily == Σ raw hourly (ε), семантика «есть/нет» сходится" +
    (prBad.length ? " — " + prBad.join(", ") : ""));

  console.log(`     сейчас: ${d.current ? d.current.t + "°" : "—"}, день1: ${d.days[0].t_day}°/${d.days[0].t_night}°, осадки ${d.days[0].precip} мм, ветер ${d.days[0].wind} м/с`);
  await sleep(1200); // вежливость к API
}

/* --- этап 8А: город без ele получает погоду (блокер «пустых точек») --- */
console.log("\n== Этап 8А: город без ele ==");
{
  const CITY = { id: "city-moskva", name: "Москва", lat: 55.7505, lon: 37.6175, region: "Москва", verified: true };
  const omUrl = wctx.__omurl(CITY);
  ok(!omUrl.includes("elevation"), "omParams: без ele параметр elevation НЕ передаётся");
  ok(wctx.__omurl({ lat: 55, lon: 37, ele: 1500 }).includes("elevation=1500"), "omParams: с ele поведение прежнее");
  const seen = [];
  const realFetch = fetch;
  wctx.fetch = async (url, opts) => { seen.push(String(url)); return realFetch(url, opts); };
  let d = null;
  try { d = await wctx.__agg(CITY); } catch (e) { console.log("     ⚠ aggregate:", e.message); }
  ok(d && d.days && d.days.length > 0, "живой aggregate по городу без ele: дни получены");
  ok(d && d.sources && (d.sources.includes("Open-Meteo") || d.sources.includes("MET Norway")),
    "живой aggregate: погода от основного источника (" + (d ? d.sources.join(", ") : "—") + ")");
  ok(!seen.filter(u => u.includes("open-meteo")).some(u => u.includes("undefined") || u.includes("NaN")),
    "open-meteo запросы без elevation=undefined");
  ok(!seen.filter(u => u.includes("met.no")).some(u => u.includes("undefined") || u.includes("NaN")),
    "met.no запросы без altitude=NaN");
}

/* --- этап 3: конфиг-флаги выключены, генератор OG-страниц --- */
console.log("\n== Этап 3: монетизация выключена, OG-страницы ==");
ok(/PROMO_BANNER\s*=\s*\{[\s\S]*?enabled:\s*false/.test(asrc), "промо-слот выключен по умолчанию (enabled: false)");
ok(/point_add:\s*false/.test(asrc) && /skin_custom:\s*false/.test(asrc) && /point_pin:\s*false/.test(asrc),
  "все PAID_ACTIONS выключены (false = бесплатно, текущее поведение)");
ok(/FREE_POINTS_LIMIT\s*=\s*3/.test(asrc), "free_points_limit = 3");
ok(/function paidGate\(/.test(asrc) && /share_click/.test(fs.readFileSync(root + "analytics.js", "utf8")),
  "единая проверка paidGate + событие share_click в аналитике");

const os = await import("node:os");
const tmpOut = fs.mkdtempSync(os.tmpdir() + "/kp-og-");
const { generatePages } = await import("./gen_point_pages.mjs");
const rep = await generatePages({ ids: ["rosa-pik"], outdir: tmpOut, agg: wctx.__agg, sleepMs: 0 });
ok(rep.length === 1 && rep[0].ok, "генератор OG-страницы отработал по живым данным");
const page = fs.readFileSync(tmpOut + "/rosa-pik/index.html", "utf8");
ok(page.includes('property="og:title"') && /Погода на Роза Пик: консенсус -?\d+°, разброс \d+°/.test(page),
  "og:title: «Погода на {название}: консенсус {X}°, разброс {Y}°»");
ok(page.includes('property="og:description"') && page.includes('property="og:image"') &&
  page.includes("https://pogoda-pro.ru/icons/og-cover.png"), "og:description и og:image на месте");
ok(page.includes('url=/#point/rosa-pik') && page.includes('location.replace("/#point/rosa-pik")'),
  "страница редиректит на /#point/rosa-pik (deep link)");
ok(fs.existsSync(root + "icons/og-cover.png"), "обложка og-cover.png существует");
const pointPages = fs.readdirSync(root + "point").filter(d => fs.existsSync(root + "point/" + d + "/index.html"));
const totalPoints = JSON.parse(fs.readFileSync(root + "data/points.json", "utf8")).points.length;
ok(pointPages.length === totalPoints, `страницы point/<id>/ на все ${totalPoints} точек (сейчас ${pointPages.length})`);
fs.rmSync(tmpOut, { recursive: true, force: true });

console.log("\n== Этап 7: регрессия симптома (синтетика, без сети) ==");
{
  // Симптом «Роза Хутор 1100м»: консенсус-осадки 0.8–0.9 мм в 16–18ч, а код best_match там
  // молчит (облако); утром лёгкая морось 0.2 мм. Старая логика рисовала дождь только утром.
  const date = "2026-09-28";
  const time = [], code = [], precip = [], t = [], wind = [];
  for (let hh = 0; hh < 24; hh++) {
    time.push(date + "T" + String(hh).padStart(2, "0") + ":00");
    code.push(3); precip.push(0); t.push(12); wind.push(2);
  }
  code[9] = 61; precip[9] = 0.2;                          // утро: честная морось от best_match
  precip[16] = 0.8; precip[17] = 0.9; precip[18] = 0.9;   // день/вечер: дождь по консенсусу, код «облако»
  const sd = { hourly: { time, code, precip, t, wind } };
  const html = F.periodsHtml(sd, date, 3);
  const cells = html.match(/<span class="dp-ico"[\s\S]*?<\/svg><\/span>/g) || [];
  ok(cells.length === 4, "синтетика: 4 иконки периодов");
  ok(!WET_SVG.test(cells[0]), "синтетика: ночь без осадков — сухая иконка");
  ok(WET_SVG.test(cells[1]) && WET_SVG.test(cells[2]) && WET_SVG.test(cells[3]),
    "синтетика: дождь 16–18ч → мокрые иконки утра(морось), дня и вечера — было: только утро");
  ok(/title="[^"]*дождь[^"]*"/.test(cells[3]), "синтетика: подсказка вечера честно называет дождь");
  ok(F.isWetCode(F.hourPrecipCode(sd, 18)) && F.hourPrecipCode(sd, 5) === 3,
    "синтетика: hourPrecipCode синтезирует дождь при молчаливом коде и не трогает сухие часы");
}

/* --- этап 8Б: интерфейс и ссылки --- */
console.log("\n== Этап 8Б: интерфейс и ссылки ==");
{
  const hsrc = fs.readFileSync(root + "index.html", "utf8");
  const cssSrc = fs.readFileSync(root + "styles.css", "utf8");
  const ptsData = JSON.parse(fs.readFileSync(root + "data/points.json", "utf8"));
  // Блок 1: модалка «Добавить точку»
  ok(!/Отправить в поддержку/.test(hsrc), "кнопка переименована в «Добавить точку»");
  const o1 = hsrc.indexOf('onclick="feedbackSubmit()">Добавить точку<');
  const o2 = hsrc.indexOf('>Поддержать проект (СБП)</button>', o1);
  const o3 = hsrc.indexOf('fb-cancel" onclick="closeFeedback()">Отмена<', o2);
  ok(o1 > 0 && o1 < o2 && o2 < o3, "порядок кнопок: Добавить точку → СБП → Отмена");
  ok(/#fb-form \.fb-go \{ margin-bottom: 12px/.test(cssSrc), "зазор ~12px между зелёными кнопками");
  ok(/id="fb-link"[^>]*class="fb-input fb-soon"/.test(hsrc) && /this\.blur\(\)/.test(hsrc),
    "поле «Ссылка на вас или ваш бизнес» видно, но неактивно");
  ok(!/fb-link/.test(asrc), "поле ссылки никак не участвует в отправке заявки");
  // Блок 2: панель убрана, механизм сохранён
  ok(!/popularCitiesHtml/.test(asrc), "панель «Популярные города» убрана с главной");
  ok(/data\/cities\.json/.test(asrc) && /function cityToPoint/.test(asrc),
    "механизм cities.json (библиотека, поиск, погода) сохранён");
  // Блок 3: звёздочки всем
  ok(ptsData.points.length > 0 && ptsData.points.every(p => p.verified === true),
    `verified:true у всех ${ptsData.points.length} точек библиотеки`);
  ok(/verified: true/.test(asrc), "города получают звезду через cityToPoint");
  // Блок 4 (актуализировано): вкладки «Настройки» нет, стили — реальный экран по реестру
  ok(!/id="settings-screen"/.test(hsrc) && !/function openSettings/.test(asrc),
    "вкладка «Настройки» удалена из интерфейса полностью");
  ok(/onclick="openLibrary\(\)"><span class="sic">\$\{ICONS\.globe\}<\/span>Поиск<\/button>/.test(asrc) &&
     /onclick="openFeedback\(\)"><span class="sic">\$\{ICONS\.pin\}<\/span>Добавить<\/button>/.test(asrc) &&
     /onclick="openStyle\(\)"><span class="sic">\$\{ICONS\.palette\}<\/span>Скин<\/button>/.test(asrc),
    "ряд «Поиск / Добавить / Скин» над виджетами на главной");
  ok(!/function styleLocked/.test(asrc) && !/PUBLIC_SKINS/.test(asrc) && !/id="stl-modal"/.test(hsrc),
    "модалка-замок стилей убрана, PUBLIC_SKINS нет — экран строится по реестру");
  ok(/if \(h === "#style"\) \{ if \(window\.KP_ANALYTICS\) KP_ANALYTICS\.track\("skin_view"\); renderStyleList\(\); return; \}/.test(asrc),
    "#style — настоящий экран скинов (renderStyleList)");
  const reg = JSON.parse(fs.readFileSync(root + "skins/skins.json", "utf8")).skins;
  const active = reg.filter(x => (x.status || "active") !== "draft").map(x => x.id);
  ok(JSON.stringify(active) === JSON.stringify(["base"]),
    `в выдаче только активные скины реестра (сейчас: ${active.join(", ")})`);
  ok(reg.filter(x => x.id === "minimalism" || x.id === "bali").every(x => x.status === "draft"),
    "minimalism и bali — архив (draft), файлы в репозитории остались");
  const swsrc = fs.readFileSync(root + "sw.js", "utf8");
  ok(!/minimalism|bali/.test(swsrc), "Service Worker не кэширует файлы архивных скинов");
  // Блок 5: наборы точек
  ok(/const POINT_SETS = \{[\s\S]*?kuban: \[/.test(asrc), "POINT_SETS с тестовым набором kuban");
  const km = asrc.match(/kuban: \[([^\]]+)\]/);
  const kubanIds = km ? km[1].match(/"([^"]+)"/g).map(s => s.slice(1, -1)) : [];
  ok(kubanIds.length > 0 && kubanIds.every(id => ptsData.points.some(p => p.id === id)),
    "набор kuban состоит только из существующих точек");
  ok(/indexOf\("set_"\) === 0\) out\.set/.test(asrc), "парсер startapp=set_<id> (комбинации через __)");
  ok(/localStorage\.getItem\("kp_home_ids"\)\) return/.test(asrc),
    "сидинг набора только при первом визите (выбор пользователя не трогаем)");
}

console.log("\n== Этап 9: семантика осадков (форматтер) ==");
ok(F.precipMmText(0).text === "нет" && !F.precipMmText(0).present, "0 → «нет» (осадков нет)");
ok(F.precipMmText(0.01).traces && F.precipMmText(0.01).present && F.precipMmText(0.01).text === "морось",
  "0.01 → «морось» (ненулевое не исчезает семантически)");
ok(F.precipMmText(0.04).traces && F.precipMmText(0.04).text === "морось", "0.04 → «морось»");
ok(F.precipMmText(0.96).text === "1.0 мм" && F.precipMmText(0.96).present && !F.precipMmText(0.96).traces,
  "0.96 → «1.0 мм» (округление только после агрегации)");
ok(F.precipMmText(null).text === "—", "null → «—»");
ok(!/title="[^"]*моросью/.test(asrc) && !/title="Осадки есть/.test(asrc),
  "всплывающих подсказок у суммы осадков нет");

console.log("\n" + (fails ? `❌ ПРОВАЛОВ: ${fails}` : "✅ ВСЕ ПРОВЕРКИ ЗЕЛЁНЫЕ"));
process.exit(fails ? 1 : 0);
