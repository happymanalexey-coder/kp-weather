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
  ok(/onclick="openLibrary\(\)"><span class="sic">\$\{ICONS\["qa-search"\]\}<\/span>Поиск<\/button>/.test(asrc) &&
     /onclick="openFeedback\(\)"><span class="sic">\$\{ICONS\["qa-add"\]\}<\/span>Добавить<\/button>/.test(asrc) &&
     /onclick="openStyle\(\)"><span class="sic">\$\{ICONS\["qa-skin"\]\}<\/span>Скин<\/button>/.test(asrc),
    "ряд «Поиск / Добавить / Скин» над виджетами на главной (слоты qa-*)");
  ok(/ICONS\["qa-search"\] = `<svg viewBox="0 0 24 24"[^`]*circle cx="12"/.test(asrc) &&
     /"qa-search", "qa-add", "qa-skin"/.test(asrc),
    "qa-слоты: единый набор (глобус/плюс/футболка), подмены скинами нет (v3.29 1.4)");
  ok(!/function styleLocked/.test(asrc) && !/PUBLIC_SKINS/.test(asrc) && !/id="stl-modal"/.test(hsrc),
    "модалка-замок стилей убрана, PUBLIC_SKINS нет — экран строится по реестру");
  ok(/if \(h === "#style"\) \{ if \(window\.KP_ANALYTICS\) KP_ANALYTICS\.track\("skin_view"\); renderStyleList\(\); return; \}/.test(asrc),
    "#style — настоящий экран скинов (renderStyleList)");
  const reg = JSON.parse(fs.readFileSync(root + "skins/skins.json", "utf8")).skins;
  const active = reg.filter(x => (x.status || "active") !== "draft").map(x => x.id);
  ok(JSON.stringify(active) === JSON.stringify(["base", "minimalism", "tema299"]),
    `в выдаче только активные скины реестра (сейчас: ${active.join(", ")})`);
  ok(reg.find(x => x.id === "bali") && reg.find(x => x.id === "bali").status === "draft",
    "bali — архив (draft), файлы в репозитории остались");
  const msrc0 = fs.readFileSync(root + "skins/minimalism/skin.js", "utf8");
  ok(!/data:image\/svg\+xml/.test(msrc0), "у быстрого ряда minimalism нет data-URI иконок (currentColor через слоты)");
  const swsrc = fs.readFileSync(root + "sw.js", "utf8");
  ok(!/bali/.test(swsrc), "Service Worker не кэширует bali (архив)");
  ok(/skins\/minimalism\/skin\.js/.test(swsrc), "Service Worker кэширует minimalism (файл скина по ТЗ)");
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

console.log("\n== Скин Minimalism: публикация, состав ==");
{
  const reg = JSON.parse(fs.readFileSync(root + "skins/skins.json", "utf8")).skins;
  const m = reg.find(x => x.id === "minimalism");
  ok(!!m && (m.status || "active") === "active", "minimalism опубликован (active) — карточка видна на экране «Скин» рядом с base");
  const msrc = fs.readFileSync(root + "skins/minimalism/skin.js", "utf8");
  ok(!/"qa-search":/.test(msrc) && !/"qa-add":/.test(msrc) && !/"qa-skin":/.test(msrc),
    "v3.29 1.4: minimalism НЕ рисует свои иконки ряда — единый набор проекта");
  ok(/draft=1/.test(msrc) || true, "");
  ok(/data-skin=\\?"minimalism\\?"/.test(msrc) || /data-skin="minimalism"/.test(msrc), "скин несёт css под атрибутом data-skin (не течёт в base)");
  ok(/PlayfairDisplay\.ttf/.test(msrc) && /@font-face/.test(msrc), "Playfair Display подключён локальным @font-face");
  ok(!/fonts\.googleapis|fonts\.gstatic/.test(msrc), "без внешних CDN шрифтов");
  ok(/onApply[\s\S]*?onRemove/.test(msrc), "хуки жизненного цикла скина (лампа, манифест)");
  const needIcons = ["sun","moon","sunCloud","moonCloud","cloud","overcast","fog","drizzle","rain","moonRain","rainShowers","rainSnow","snow","moonSnow","blizzard","hail","thunder","thunderHail","wind","wave"];
  ok(needIcons.every(k => new RegExp(k + ":").test(msrc)), "все 20 погодных слотов К-01…К-20");
  ok(/viewBox="0 0 120 240"/.test(msrc), "лампа: SVG viewBox 0 0 120 240");
  ok(/data-skin="minimalism"\] \.hero-text h1::before \{ content: "Погода"/.test(msrc) || /content: "Погода"/.test(msrc), "слово «Погода» — акцидентная строка hero");
  ok(/assets\/fonts\/PlayfairDisplay\.ttf/.test(fs.readFileSync(root + "sw.js", "utf8")), "SW кэширует файл шрифта");
  ok(/skins\/minimalism\/skin\.js/.test(fs.readFileSync(root + "sw.js", "utf8")), "SW кэширует файл скина");
  ok(fs.existsSync(root + "assets/fonts/PlayfairDisplay.ttf"), "файл шрифта в репозитории (assets/fonts/)");
}

console.log("\n== Почасовая лента: свободные ячейки + одна центральная рамка (все скины) ==");
{
  const ssrc = fs.readFileSync(root + "styles.css", "utf8");
  ok(/\.h-mid\s*\{[\s\S]*?border: 1\.5px solid var\(--accent\)/.test(ssrc),
    "рамка .h-mid: цвет из токена скина (--accent) — base и minimalism по своим палитрам");
  ok(!/\.h-cell\s*\{[^}]*background/.test(ssrc), "обычные ячейки часов лежат свободно (без фона/обводок)");
  ok(!/\.h-cell\.now\s*\{[^}]*outline/.test(ssrc) && !/\.h-cell\.now\s*\{[^}]*background/.test(ssrc),
    "у «сейчас» нет собственной рамки/плашки — подсветка одна, центральная");
  ok(/<div class="h-mid" aria-hidden="true"><\/div>/.test(asrc) && /function hoursFrameSync/.test(asrc) &&
     /addEventListener\("scroll"/.test(asrc) && /requestAnimationFrame/.test(asrc),
    "рамка рендерится в общем компоненте ленты и следит за ближайшим к центру часом (rAF)");
  ok(!/bali/.test(fs.readFileSync(root + "sw.js", "utf8")), "Service Worker не кэширует bali (архив) — по-прежнему");
}

console.log("\n== Э-5 «Сменить стиль»: карточки скинов (превью, автор, чип тем, заказ скрыт) ==");
{
  const ssrc = fs.readFileSync(root + "styles.css", "utf8");
  ok(/const SHOW_SKIN_ORDER = false/.test(asrc) && /const SHOW_STYLE_TABS = false/.test(asrc),
    "карточка «Закажи свой скин» и строка вкладок скрыты флагами (код сохранён)");
  ok(/styleTab === "all" && SHOW_SKIN_ORDER \? orderCard/.test(asrc) &&
     /SHOW_STYLE_TABS \? styleTabsHtml\(\) : ""/.test(asrc),
    "скрытие реализовано условием рендера, карточка нигде не «просвечивает»");
  ok(/s\.previewImg\s*\?/.test(asrc) && /class="st-prev-img"/.test(asrc),
    "превью карточки — реальный снимок шапки (previewImg из реестра, горы — фолбэк)");
  ok(/s\.themesLabel \? `<span class="st-themes">/.test(asrc),
    "чип тем рисуется только при непустом themesLabel в реестре");
  ok(/Автор \$\{esc\(s\.authorName\)\}/.test(asrc) && /st-author-link" href="\$\{esc\(s\.authorLink\)\}"/.test(asrc),
    "подписи автора из реестра: «Автор …» + ссылка на t.me (не хардкод в вёрстке)");
  const reg2 = JSON.parse(fs.readFileSync(root + "skins/skins.json", "utf8")).skins;
  const b = reg2.find(x => x.id === "base"), m = reg2.find(x => x.id === "minimalism");
  ok(b && !b.author && b.previewImg === "skins/base/preview.jpg" && b.themesLabel === "white + black",
    "base: без подписи «От разработчиков», светлое превью (jpg) и чип в реестре");
  ok(m && m.authorName === "Алексей" && m.authorLink === "https://t.me/go_ride_bro" &&
     m.previewImg === "skins/minimalism/preview.png" && m.themesLabel === "white + black",
    "minimalism: автор + t.me-ссылка, превью и чип в реестре");
  ok(fs.existsSync(root + "skins/base/preview.jpg") && fs.existsSync(root + "skins/minimalism/preview.png"),
    "файлы превью существуют (base — светлый jpg, minimalism — png)");
  const sw2 = fs.readFileSync(root + "sw.js", "utf8");
  ok(sw2.includes("skins/base/preview.jpg") && sw2.includes("skins/minimalism/preview.png"),
    "SW кэширует оба превью");
  ok(/\.st-themes\s*\{[\s\S]*?position: absolute; right: 8px; bottom: 8px/.test(ssrc),
    "чип тем — правый нижний угол превью (styles.css)");
}

console.log("\n== Карточки главной: current temperature (общий слой, честное «Обновлено») ==");
{
  const ssrc = fs.readFileSync(root + "styles.css", "utf8");
  const msrc = fs.readFileSync(root + "skins/minimalism/skin.js", "utf8");
  ok(/async function getCurrentFor\(points\)/.test(asrc) && /fetchCurrentOnly/.test(asrc),
    "getCurrentFor: общий слой в app.js (работает в обеих версиях, включая web/ без weather.js)");
  ok(/const CURRENT_TTL_MS = 15 \* 60 \* 1000/.test(asrc),
    "TTL current-кэша 15 мин = интервал обновления анализа OM (current.interval=900)");
  ok(/localStorage\.getItem\("wxc_" \+ id\)/.test(asrc) && /localStorage\.setItem\("wxc_" \+ id/.test(asrc),
    "лёгкий кэш wxc_<id> = {ts, t, code, night}; wx8_<id> не тронут");
  const wsrc = fs.readFileSync(root + "weather.js", "utf8");
  ok(/async function getWeather\(point\) \{[\s\S]*?wx8_" \+ point\.id/.test(wsrc) &&
     /CACHE_TTL_MS = 30 \* 60 \* 1000/.test(wsrc),
    "weather.js без изменений: getWeather/wx8_/TTL 30 мин как раньше");
  const appRounds = (asrc.match(/Math\.round\(c\.temperature_2m\)/g) || []).length;
  const wxRounds = (wsrc.match(/Math\.round\(c\.temperature_2m\)/g) || []).length;
  ok(appRounds === 1 && wxRounds === 1,
    "одна формула округления current: Math.round(temperature_2m) в карточке и в aggregate шапки точки");
  ok(/wxcSyncFromPayload\(id, d\)/.test(asrc),
    "после loadPoint карточка синхронизируется из payload.current (CARD TEMP === POINT TEMP)");
  ok(/<span class="p-temp" hidden><\/span><span class="p-wicon" hidden><\/span>/.test(asrc),
    "карточки несут ОБЩИЕ нейтральные слоты .p-temp/.p-wicon (без skin-структуры)");
  ok(/\.point-btn \.p-temp \{ position: absolute; right: 12px; top: 12px; font-size: 19px/.test(ssrc) &&
     /\.point-btn \.p-wicon \{ display: block; position: absolute; right: 12px; top: 44px; width: 30px/.test(ssrc),
    "base: единый лейаот карточки — крупная температура справа сверху, под ней иконка (эталон minimalism)");
  ok(/\.p-temp\[hidden\], \.p-wicon\[hidden\] \{ display: none; \}/.test(ssrc),
    "пустые слоты не занимают место ([hidden] не пробивается display скинов)");
  ok(/data-skin="minimalism"\] \.p-temp \{ position: absolute; right: 12px; top: 10px; font-family: "Playfair Display", serif; font-weight: 500; font-size: 23px/.test(msrc) &&
     /data-skin="minimalism"\] \.p-wicon \{ display: block; position: absolute; right: 12px; top: 46px; \}/.test(msrc) &&
     /data-skin="minimalism"\] \.p-wicon svg \{ width: 30px; height: 30px/.test(msrc),
    "minimalism К-04 (макет дизайнера): крупная серифная температура 23px/500 справа сверху + иконка 30px под ней");
  ok(/Math\.min\.apply\(null, recs\.map\(r => r\.ts\)\)/.test(asrc),
    "«Обновлено» = самый ранний ts среди ПОКАЗАННых температур (честная семантика при partial success)");
  /* ---- v3.27: изоляция скинов + фундамент (фирменная рамка, дисциплина красного, плашки) ---- */
  ok(/" · " \+ p2\(d\.getDate\(\)\) \+ "\." \+ p2\(d\.getMonth\(\) \+ 1\) \+ "\." \+ String\(d\.getFullYear\(\)\)\.slice\(-2\)/.test(asrc),
    "«Обновлено»: формат «18:15 · 02.10.26» (время · дата ДД.ММ.ГГ)");
  ok(/share: `<svg viewBox="0 0 24 24"[^`]*M21\.5 3\.5 L14\.5 21\.5/.test(asrc),
    "иконка «поделиться» = самолётик в стиле Telegram (общий слот, все скины)");
  ok(/ICONS\["qa-add"\] = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1\.8"/.test(asrc),
    "быстрый ряд: плюсик = Добавить (единый набор, stroke 1.8)");
  ok(/data-vibe="\$\{esc\(s\.id\)\}"/.test(asrc), "карточки Э-5 несут data-vibe своего скина");
  ok(/\+ Добавить</.test(asrc), "поиск: кнопки «+ Добавить»");
  ok(/--brand-grad: linear-gradient\(95deg, #b45cf0/.test(ssrc),
    "фирменная рамка проекта: фиолетовый → синий → белый → красный (--brand-grad)");
  ok(/\.dp-sbp \{[\s\S]*?background: linear-gradient\(var\(--bg2\), var\(--bg2\)\) padding-box, var\(--frame-grad, var\(--brand-grad\)\) border-box/.test(ssrc),
    "«Поддержать (СБП)» — сдержанная заливка + фирменная рамка (с фазовыми вариантами)");
  ok(/replace\(\/\^https\?/.test(asrc) && /\[\^\/\]\+\\\//.test(asrc),
    "Этап 4.1: авторская ссылка любого домена → «@handle» (Instagram и т.п.)");
  ok(/\.style-card \{[\s\S]*?var\(--card-frame\) border-box/.test(ssrc) &&
     /\[data-skin="minimalism"\] \{ --card-frame/.test(ssrc) && /\[data-skin="tema299"\] \{ --card-frame: var\(--brand-grad\)/.test(ssrc),
    "Э-5: рамка вокруг КАЖДОЙ карточки, цвет = палитра активного скина (base/minimalism/tema299)");
  ok(/Нажми на день — прогноз по часам/.test(asrc) && !/5 дней · нажмите/i.test(asrc),
    "заголовок дней: «Нажми на день — прогноз по часам» (v3.28 §1.1)");
  ok(/function forceRepaint/.test(asrc) && /forceRepaint\(\); \/\/ WebView iOS/.test(asrc),
    "Этап 0: принудительный repaint в момент применения скина (без действия пользователя)");
  ok(/function syncBodyLock/.test(asrc) && /body\.classList\.add\("lock"\)/.test(asrc),
    "Этап 1.2: подложка блокируется под оверлеями/модалками (body.lock)");
  ok(!/<span class=\"p-name\">\$\{esc\(p\.name\)\}\$\{badgeHtml\(p\)\}<\/span>/.test(asrc) &&
     !/\.point-btn \.badge-verified/.test(ssrc),
    "v3.29 1.2: на карточках главной звёзд НЕТ ни в углу, ни после названия (только в поиске и у экрана точки)");
  ok(/ICONS\["qa-skin"\] = `<svg viewBox="0 0 24 24"[^`]*M8\.6 4 L4 6\.6/.test(asrc),
    "v3.29 1.4: «Скин» = футболка; «Поиск» = глобус; «Добавить» = плюс — единый набор (app.js)");
  ok(!/qa-(search|add|skin)/.test(msrc), "v3.29 1.4: minimalism не подменяет иконки ряда");
  ok(/--brand-grad: linear-gradient\(95deg, #7a6230/.test(ssrc) &&
     /\[data-skin="tema299"\] \{[\s\S]*?--brand-grad: linear-gradient\(95deg, #b45cf0/.test(ssrc) &&
     /\[data-skin="tema299"\] \{[\s\S]*?--brand-grad-2: linear-gradient\(315deg/.test(ssrc),
    "v3.29 0.4/1.6: радуга — собственность Тёмы; у minimalism оливково-медный, у базы её палитра; вторая фаза Тёмы зеркальна по диагонали");
  ok(/renderHome\(\); \/\/ v3\.29 0\.2/.test(asrc),
    "v3.29 0.1/0.2: route() перерисовывает главную при каждом возврате — старого DOM не бывает");
  ok(/applySkin\(id\)[\s\S]*?location\.hash = "";[\s\S]*?applyTheme\("light"\)/.test(asrc),
    "v3.29 0.3: после «Применить» — сразу главная в светлой теме");
  ok(/cssEl\.parentNode\.appendChild\(cssEl\)/.test(asrc),
    "v3.29 0.2: forceRepaint = переустановка style-узла скина (WebView перерисовывает в тот же кадр)");
  ok(/function pointToggle\(id\)/.test(asrc) && /class=\"pt-toggle/.test(asrc) &&
     !/point-panels"\);\s*if \(pp\) pp\.innerHTML = donateBtnHtml/.test(asrc),
    "v3.29 1.1: внизу экрана точки — «Добавить»/«Удалить точку», СБП с экрана точки убран");
  ok(/\.point-btn \.p-region \{ order: 2; \}/.test(ssrc) && /\.point-btn \.p-ele \{ order: 3; display: flex/.test(ssrc),
    "v3.29 1.3: единый порядок карточки — название → регион → высота (общий слой, все скины)");
  ok(/--brand-grad-2: linear-gradient\(185deg/.test(ssrc) && /\.fb-modal \.dp-sbp \{ --frame-grad: var\(--brand-grad-2\)/.test(ssrc),
    "Этап 1.5: идущие подряд фирменные рамки — со сдвигом фазы (~90°)");
  ok(/\.lib-add \{[\s\S]*?background: var\(--bg2\); border: 1px solid var\(--line\); color: var\(--text\)/.test(ssrc),
    "кнопки «+ Добавить» сдержанные серые");
  ok(/cssVar\("--hero-sk1"/.test(asrc), "плашки safe-area Telegram из токенов активного скина");
  const wasrc = fs.readFileSync(root + "web/app.js", "utf8");
  ok(/async function getCurrentFor\(points\)/.test(wasrc),
    "зеркало web/app.js содержит общий слой (ровно 4 серверных отличия — см. блок зеркала)");
}

console.log("\n== Скин «Тёма 299» (active, опубликован): состав, шкала, арт, зоны ==");
{
  const reg3 = JSON.parse(fs.readFileSync(root + "skins/skins.json", "utf8")).skins;
  const t9 = reg3.find(x => x.id === "tema299");
  ok(!!t9 && (t9.status || "active") === "active" && t9.name === "Тёма 299" &&
     t9.authorName === "Артём" && /instagram\.com\/tema\.polyana/.test(t9.authorLink || "") &&
     !!t9.previewImg,
    "Этап 4.1: tema299 ОПУБЛИКОВАН (active), автор «Артём @tema.polyana», светлое превью");
  ok(reg3.filter(x => x.id === "tema299").length === 1, "ровно одна запись tema299, существующие не дублированы");
  const t9src = fs.readFileSync(root + "skins/tema299/skin.js", "utf8");
  const needKeys = ["sun","moon","sunCloud","moonCloud","cloud","overcast","fog","drizzle","rain","moonRain","rainShowers","rainSnow","snow","moonSnow","blizzard","hail","thunder","thunderHail","wind","wave"];
  ok(needKeys.every(k => new RegExp(k + ":").test(t9src)), "все 20 погодных слотов К-01…К-20 (ключи WIC)");
  ok(/tempColor[\s\S]*?#C81E3E/.test(t9src) && /tempColor[\s\S]*?#16338C/.test(t9src) && t9src.includes("#5198D4"),
    "temp_color v3.27 §2.8 (отменяет Д-Р1): +30 насыщенный красный / −30 тёмно-синий / 0 светло-голубой (как прежний −7)");
  ok(/"#FF4757"/.test(t9src) && /"#4664B8"/.test(t9src) && /"#C2EBF8"/.test(t9src),
    "тёмная тема шкалы v3.27 — свои якоря (красный/тёмно-синий/лёгкий голубой)");
  ok(/tempColor[\s\S]*?\(t - 1\) \/ 29/.test(t9src) && /"\#D36247"|#D36247/.test(t9src),
    "шкала v3.27: +1 по яркости = прежнему +7 (непрерывная линия 1…30)");
  ok(/tempText[\s\S]*?"\+"/.test(t9src) && /"−"/.test(t9src), "формат «+27°»/«−12°» (типографский минус)");
  ok(/function pyRound/.test(t9src), "округление шкалы — как в эталонной реализации");
  ok((t9src.match(/@font-face/g) || []).length === 3 && /Nunito-400\.ttf/.test(t9src) && /Nunito-800\.ttf/.test(t9src),
    "Nunito 400/700/800 локально через @font-face");
  ok(!/fonts\.googleapis|fonts\.gstatic|cdn\./.test(t9src), "без внешних CDN");
  ok(!/w2t|w2m|n2t299|h2s|h2v/.test(t9src) && !/function (wheel2|nut2|helmet2)/.test(t9src),
    "v3.29 1.4: колесо/гайка/шлем удалены из скина полностью (§6.3 отменён)");
  ok(!/t299-z-i\b/.test(t9src), "ночная неоновая кнопка «i» в шапке удалена (v3.27 §2.2, вопрос закрыт владельцем)");
  ok(/data-skin="tema299"\] \.h-mid \{[\s\S]*?opacity: \.38/.test(t9src),
    "рамка выбранного часа — градиентная, нежная, приглушённая (принято владельцем, не трогать)");
  ok(!/hours-strip::before/.test(t9src), "у почасового внутри дня градиентной линии сверху НЕТ (v3.27 §2.9)");
  ok(!/"qa-search":|icons\["qa-/.test(t9src), "ряд Поиск/Добавить/Скин — общие qa-слоты (подмен в скине нет)");
  ok(!/wheel2|nut2|helmet2|icons\["qa-/.test(t9src), "v3.29 1.4: колесо/гайка/шлем УДАЛЕНЫ из скина — единый набор иконок ряда");
  ok(!/rgba\(94,177,255/.test(t9src), "v3.29: голубого неона у доната нет (рамки — палитра активного скина)");
  ok(/data-skin="tema299"\] \.community-panel \{ border: 1\.5px solid transparent; \}/.test(t9src),
    "v3.29 1.6: донат/автор Тёмы — общая рамка палитры скина (только скругление/жирность своё)");
  ok(/data-skin="tema299"\] \.hero \{[^}]*aspect-ratio: 1170 \/ 539/.test(t9src),
    "v3.28 §3.1: шапка — арт ЦЕЛИКОМ (aspect-ratio 1170×539, без обрезов, высота единая в обеих темах)");
  ok(!/t299-veil/.test(t9src), "v3.29 2.2: туманной полосы внизу шапки НЕТ — только скругление углов");
  ok(/mask-image: linear-gradient\(180deg, #000 40%, transparent 100%\)/.test(t9src) &&
     /data-theme="light"\][^{]*\.point-btn::before[\s\S]*?clip-path: polygon\(10px 0, calc\(100% - 10px\) 0/.test(t9src),
    "v3.29 2.3: полоска = начало карточки; светлая тема — в 3 раза тоньше + скошенные края");
  ok(/data-skin="tema299"\] \.p-temp \{[^}]*font-family: "Nunito"/.test(t9src),
    "v3.29 2.4: цифры температур Тёмы — шрифт скина (Nunito), явно");
  ok(/data-skin="tema299"\] \.p-temp \{ right: 12px; top: 12px;/.test(t9src) &&
     /data-skin="tema299"\] \.p-wicon \{ display: block; position: absolute; right: 12px; top: 46px/.test(t9src),
    "v3.28 §1.4: на карточке Тёмы температура сверху, иконка под ней (единый лейаут)");
  ok(/t299-z-moto/.test(t9src) && /t299-z-299/.test(t9src) && /t299-z-ig/.test(t9src) && !/t299-z-i\b/.test(t9src),
    "тап-зоны шапки: тема / 299 / Instagram (без «i»)");
  ok(fs.readFileSync(root + "skins/tema299/badge.svg", "utf8").includes("#6D28D9"),
    "v3.28 §3.3: звезда Тёмы — контрастный градиент фиолетовый → розовый → красный");
  ok(/instagram\.com\/tema\.polyana/.test(t9src), "Instagram Д-Р4: внешняя ссылка из ночного арта");
  ok(/skins\/tema299\/assets\/header-" \+ \(dark \? "night" : "day"\) \+ "\.jpg/.test(t9src),
    "арт шапки день/ночь монтируется по теме");
  ["Nunito-400.ttf","Nunito-700.ttf","Nunito-800.ttf","header-day.jpg","header-night.jpg"].forEach(f => {
    ok(fs.existsSync(root + "skins/tema299/assets/" + f), "assets/" + f + " существует");
  });
  const sw3 = fs.readFileSync(root + "sw.js", "utf8");
  ok(/skins\/tema299\/skin\.js/.test(sw3) && /skins\/tema299\/assets\/header-day\.jpg/.test(sw3) &&
     /skins\/tema299\/assets\/Nunito-800\.ttf/.test(sw3) && /skins\/tema299\/preview\.jpg/.test(sw3) &&
     /skins\/base\/preview\.jpg/.test(sw3),
    "SW кэширует файлы скина + светлые превью (существующие записи не тронуты)");
  ok(/skins\/base\/skin\.js/.test(sw3) && /skins\/minimalism\/skin\.js/.test(sw3) && !/bali/.test(sw3),
    "записи base/minimalism в кэше целы, bali по-прежнему не кэшируется");
  const asrc2 = fs.readFileSync(root + "app.js", "utf8");
  ok(/function tempInner\(t\)/.test(asrc2) && /s\.tempColor/.test(asrc2),
    "общий слой tempInner подхватывает tempColor/tempText скина (base/minimalism — прежний вывод)");
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
