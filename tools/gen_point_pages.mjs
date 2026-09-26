/* Генератор статических OG-страниц точек: point/<id>/index.html (шеринг, этап 3).
   Считает консенсус/разброс боевым weather.js в node:vm (по образцу validate_v231.mjs)
   и вшивает в og:title «Погода на {название}: консенсус {X}°, разброс {Y}°»,
   og:description, og:image. Сама страница — редирект на /#point/<id> (короткая
   ссылка под QR партнёров; GitHub Pages отдаёт её без сервера).

   Запуск:  node tools/gen_point_pages.mjs [--limit N] [--ids a,b,c] [--outdir DIR]
   Крон:    .github/workflows/og-refresh.yml — раз в сутки (консенсус живёт день).
   Импорт:  generatePages({ ids, outdir, agg }) — agg можно передать извне (тесты). */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url)) + "/";
const SITE = "https://pogoda-pro.ru";
const OG_IMAGE = SITE + "/icons/og-cover.png";
const sleep = ms => new Promise(r => setTimeout(r, ms));

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* weather.js в vm: тот же приём, что в tools/validate_v231.mjs */
function defaultAgg() {
  const wsrc = fs.readFileSync(ROOT + "weather.js", "utf8");
  const wctx = vm.createContext({
    fetch, console, setTimeout, clearTimeout, AbortController, URLSearchParams,
    Date, Math, JSON, Promise, Error, Set, Object, Array, Number, String,
    parseInt, parseFloat, isNaN,
  });
  vm.runInContext(wsrc + "\nthis.__agg = aggregate;", wctx);
  return wctx.__agg;
}

function ogTitle(p, day0) {
  if (day0 && day0.t_day != null && day0.t_day_spread) {
    const spread = day0.t_day_spread[1] - day0.t_day_spread[0];
    return `Погода на ${p.name}: консенсус ${day0.t_day}°, разброс ${spread}°`;
  }
  return `Погода на ${p.name} — консенсус пяти источников`;
}
function ogDescription(p, d) {
  const cur = d && d.current;
  const now = cur ? `Сейчас ${cur.t}°, ощущается как ${cur.feels}°. ` : "";
  return `${now}Прогноз на 5 дней с почасовой раскладкой — консенсус пяти мировых метеоисточников, время местное для точки.`;
}

function pageHtml(p, title, desc) {
  const url = `${SITE}/point/${p.id}`;
  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<title>${esc(title)}</title>
<meta property="og:type" content="website">
<meta property="og:site_name" content="Погода в горах, на море и дома">
<meta property="og:locale" content="ru_RU">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${OG_IMAGE}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="${url}">
<meta http-equiv="refresh" content="0; url=/#point/${p.id}">
</head>
<body>
<p>Открываем погоду на «${esc(p.name)}»… <a href="/#point/${p.id}">перейти</a></p>
<script>location.replace("/#point/${p.id}");</script>
</body>
</html>
`;
}

/* Генерирует страницы точек. opts: { ids, outdir, agg, sleepMs } → отчёт по каждой точке */
export async function generatePages(opts = {}) {
  const agg = opts.agg || defaultAgg();
  const outdir = opts.outdir || ROOT + "point";
  const sleepMs = opts.sleepMs != null ? opts.sleepMs : 400;
  const all = JSON.parse(fs.readFileSync(ROOT + "data/points.json", "utf8")).points;
  const wanted = Array.isArray(opts.ids) && opts.ids.length ? new Set(opts.ids) : null;
  const points = all.filter(p => !wanted || wanted.has(p.id));
  const report = [];
  for (const p of points) {
    let d = null;
    try { d = await agg(p); }
    catch (e) { console.error(`  ⚠ ${p.id}: aggregate упал (${e.message}) — страница без цифр`); }
    const title = ogTitle(p, d && d.days && d.days[0]);
    const desc = ogDescription(p, d);
    const dir = path.join(outdir, p.id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), pageHtml(p, title, desc));
    report.push({ id: p.id, ok: !!d, title });
    console.log(`  ${d ? "✓" : "⚠"} ${p.id} — ${title}`);
    if (sleepMs) await sleep(sleepMs);
  }
  return report;
}

/* CLI: node tools/gen_point_pages.mjs [--limit N] [--ids a,b] [--outdir DIR] */
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const opt = (name, def) => { const i = args.indexOf("--" + name); return i >= 0 ? args[i + 1] : def; };
  const limit = parseInt(opt("limit", "0"), 10) || 0;
  const ids = (opt("ids", "") || "").split(",").map(s => s.trim()).filter(Boolean);
  const outdir = opt("outdir", ROOT + "point");
  let list = ids.length ? ids : null;
  if (!list && limit > 0) {
    const all = JSON.parse(fs.readFileSync(ROOT + "data/points.json", "utf8")).points;
    list = all.slice(0, limit).map(p => p.id);
  }
  console.log(`Генерация OG-страниц точек → ${outdir} (${list ? list.length + " шт. по выборке" : "все"})`);
  const rep = await generatePages({ ids: list, outdir });
  const failed = rep.filter(r => !r.ok).length;
  console.log(`готово: ${rep.length - failed} с консенсусом, ${failed} без цифр (источники недоступны)`);
  process.exit(rep.length ? 0 : 1);
}
