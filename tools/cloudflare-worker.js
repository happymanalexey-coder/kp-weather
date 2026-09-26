/**
 * pogoda-intake — Cloudflare Worker (бесплатный тариф).
 *
 * Две функции:
 *  1. POST /            — приём точек {name, lat, lon[, tg, consent]} → data/web_inbox.json (GitHub API),
 *                         дальше GitHub Actions публикует в points.json (каждые 15 мин).
 *                         tg — ник Telegram, сохраняется ТОЛЬКО с consent: true (легальная база контактов).
 *  2. Аналитика (этап 1):
 *     POST /api/event           — событие {event, channel, user_key, utm, meta, ts} → D1.
 *     GET  /api/stats/public    — обезличенные агрегаты для страницы /stats.
 *     GET  /api/donate-config   — {donate_url, sbp} для донат-панели; реквизиты из env
 *                                 (DONATE_URL, SBP_REQUISITES), дефолты в коде.
 *     GET  /admin/stats         — приватная HTML-админка (Basic Auth) + форма доната.
 *     POST /api/admin/donation  — ручной ввод доната {amount, date, note} (Basic Auth).
 *  3. Заявки на скины (этап 2):
 *     POST /api/skin-request    — {name, description, contact, consent, hp, channel, user_key}
 *                                 → D1 (skin_requests) + уведомление админу в Telegram.
 *                                 Антиспам: 1 заявка/сутки на user_key + honeypot-поле hp.
 *
 * Приватность (152-ФЗ):
 *  - IP нигде не сохраняется: только sha256(IP + IP_SALT) для квоты заявок;
 *  - geo = ТОЛЬКО страна из request.cf.country (даёт Cloudflare, IP нам не нужен);
 *  - Telegram ID не хранится: клиент шлёт "tg:<id>", мы храним sha256(id + ANALYTICS_SALT).
 *
 * Переменные/секреты (Settings → Variables and Secrets):
 *   GITHUB_TOKEN (Secret)  — запись в репо (для приёма точек)
 *   IP_SALT (Secret)       — хэш IP для квоты
 *   ANALYTICS_SALT (Secret)— хэш Telegram ID для user_key
 *   ADMIN_USER, ADMIN_PASS (Secret) — вход в /admin/stats
 *   BOT_TOKEN (Secret)     — токен бота @pogoda_xxx_bot: уведомления админу о заявках на скины
 *   ADMIN_CHAT_ID (переменная, опционально) — chat_id админа; по умолчанию 506487479
 * Привязка: D1 database → имя переменной DB (Settings → Bindings).
 * Без привязанной D1 воркер работает как раньше (события принимает, но не пишет: ok, stored:false).
 */

const REPO = "happymanalexey-coder/kp-weather";
const INBOX_PATH = "data/web_inbox.json";
const ALLOWED_ORIGINS = [
  "https://pogoda-pro.ru",
  "https://happymanalexey-coder.github.io",
  "http://127.0.0.1:8901",
  "http://localhost:8901",
];

const NAME_RE = /^[А-Яа-яЁёA-Za-z0-9 \-]+$/;
const BAD_WORDS = ["хуй","хуя","хуе","хуи","пизд","бляд","блят","ебан","ебал","ёбан",
  "ебуч","мудак","мудил","сука","пидор","пидар","гандон","шлюх","залуп","манда",
  "какашк","пиписьк","говн","дерьм","жоп","срал","срет","пердн","пёрд","фекал",
  "шалав","проститут","секс","порн","гитлер","нацист","наркот"];

const KNOWN_EVENTS = new Set([
  "app_open", "return_visit", "point_select", "point_add", "point_suggest",
  "skin_view", "skin_apply", "skin_request_submit", "share_click",
  "donate_open", "subscribe_interest", "banner_promo_click",
]);

function corsHeaders(origin) {
  const ok = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": ok,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}
function jsonResp(obj, code, origin) {
  return new Response(JSON.stringify(obj), {
    status: code,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(origin) },
  });
}
async function sha256hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}
const dayStr = ts => new Date(ts).toISOString().slice(0, 10);

/* ---------- 1. приём точек (как было) ---------- */
function validate(name, lat, lon) {
  name = name.trim().replace(/\s+/g, " ");
  if (name.length < 3 || name.length > 40)
    return { error: "Название: от 3 до 40 символов" };
  if (!NAME_RE.test(name))
    return { error: "Недопустимые символы в названии (можно буквы, цифры, пробел и дефис)" };
  const low = " " + name.toLowerCase().replace(/[^а-яa-z0-9]+/g, " ") + " ";
  if (BAD_WORDS.some(w => low.includes(w)))
    return { error: "Такое название не пройдёт модерацию" };
  if (typeof lat !== "number" || typeof lon !== "number" ||
      !(lat >= -90 && lat <= 90) || !(lon >= -180 && lon <= 180))
    return { error: "Координаты вне диапазона" };
  if (Math.abs(lat) < 0.0001 && Math.abs(lon) < 0.0001)
    return { error: "Координаты 0,0" };
  return { name };
}
async function githubGetSha(token) {
  const r = await fetch(
    `https://api.github.com/repos/${REPO}/contents/${INBOX_PATH}?ref=main`,
    { headers: { Authorization: `Bearer ${token}`, "User-Agent": "pogoda-intake",
                 Accept: "application/vnd.github+json" } });
  if (!r.ok) throw new Error("github get " + r.status);
  const d = await r.json();
  const content = JSON.parse(new TextDecoder().decode(
    Uint8Array.from(atob(d.content.replace(/\n/g, "")), c => c.charCodeAt(0))));
  return { sha: d.sha, content };
}
async function githubPutSha(token, sha, content) {
  const body = {
    message: "inbox: заявка с сайта/mini-app",
    content: btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(content)))),
    sha,
    branch: "main",
  };
  const r = await fetch(
    `https://api.github.com/repos/${REPO}/contents/${INBOX_PATH}`,
    { method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "User-Agent": "pogoda-intake",
                 Accept: "application/vnd.github+json", "Content-Type": "application/json" },
      body: JSON.stringify(body) });
  if (!r.ok) throw new Error("github put " + r.status);
}
const TG_NICK_RE = /^[A-Za-z0-9_]{4,32}$/; // правила ника Telegram, без @
async function handleIntake(request, env, origin) {
  let payload;
  try { payload = await request.json(); }
  catch { return jsonResp({ error: "Некорректный JSON" }, 400, origin); }
  const v = validate(String(payload.name || ""), payload.lat, payload.lon);
  if (v.error) return jsonResp({ error: v.error }, 400, origin);
  // ник Telegram — необязателен; без явного согласия не сохраняем (152-ФЗ)
  const tgRaw = String(payload.tg || "").trim().replace(/^@/, "");
  let tg = null;
  if (tgRaw) {
    if (!TG_NICK_RE.test(tgRaw))
      return jsonResp({ error: "Некорректный ник Telegram (латиница, цифры и «_», 4–32 символа)" }, 400, origin);
    if (payload.consent !== true)
      return jsonResp({ error: "Нужно согласие на обработку данных" }, 400, origin);
    tg = "@" + tgRaw;
  }
  const ip = request.headers.get("CF-Connecting-IP") || "anon";
  const uid = (await sha256hex(ip + (env.IP_SALT || "pogoda"))).slice(0, 16);
  const entry = {
    name: v.name,
    lat: Math.round(payload.lat * 10000) / 10000,
    lon: Math.round(payload.lon * 10000) / 10000,
    uid,
    ts: Math.floor(Date.now() / 1000),
  };
  if (tg) { entry.tg = tg; entry.consent = true; }
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { sha, content } = await githubGetSha(env.GITHUB_TOKEN);
      content.inbox = Array.isArray(content.inbox) ? content.inbox : [];
      content.inbox.push(entry);
      await githubPutSha(env.GITHUB_TOKEN, sha, content);
      return jsonResp({ ok: true }, 200, origin);
    } catch (e) {
      if (attempt === 2) {
        console.error("inbox write failed:", e.message);
        return jsonResp({ error: "Не получилось отправить — попробуйте ещё раз" }, 502, origin);
      }
      await new Promise(r => setTimeout(r, 700));
    }
  }
}

/* ---------- 2. аналитика ---------- */
/* user_key: "tg:<id>" → хэш с солью (сам id не храним); "web:<uuid>" → как есть */
async function normalizeUserKey(raw, env) {
  let uk = String(raw || "").slice(0, 80);
  if (uk.startsWith("tg:")) {
    uk = "t_" + (await sha256hex(uk.slice(3) + (env.ANALYTICS_SALT || "pogoda"))).slice(0, 24);
  } else if (uk.startsWith("web:")) {
    uk = "w_" + uk.slice(4).replace(/[^a-f0-9\-]/gi, "").slice(0, 40);
  } else {
    uk = "anon";
  }
  return uk;
}

async function handleEvent(request, env, origin) {
  let p;
  try { p = await request.json(); }
  catch { return jsonResp({ error: "Некорректный JSON" }, 400, origin); }

  const event = String(p.event || "").slice(0, 40);
  if (!KNOWN_EVENTS.has(event)) return jsonResp({ error: "unknown event" }, 400, origin);

  const channel = p.channel === "miniapp" ? "miniapp" : "site";

  // user_key: "tg:<id>" → хэш с солью (сам id не храним); "web:<uuid>" → как есть
  const uk = await normalizeUserKey(p.user_key, env);

  const country = (request.cf && request.cf.country) || null; // только страна, IP не пишем
  const utm = p.utm && typeof p.utm === "object" ? p.utm : {};
  const ts = Number(p.ts) || Date.now();
  const meta = p.meta ? JSON.stringify(p.meta).slice(0, 500) : null;

  if (!env.DB) return jsonResp({ ok: true, stored: false }, 200, origin); // D1 ещё не привязана — не мешаем приложению
  try {
    await env.DB.prepare(
      "INSERT INTO events (ts, day, event, channel, user_key, utm_source, utm_medium, utm_campaign, country, meta) VALUES (?,?,?,?,?,?,?,?,?,?)"
    ).bind(
      Math.floor(ts / 1000), dayStr(ts), event, channel, uk,
      String(utm.utm_source || "").slice(0, 120) || null,
      String(utm.utm_medium || "").slice(0, 120) || null,
      String(utm.utm_campaign || "").slice(0, 120) || null,
      country, meta
    ).run();
    return jsonResp({ ok: true, stored: true }, 200, origin);
  } catch (e) {
    console.error("event insert failed:", e.message);
    return jsonResp({ ok: true, stored: false }, 200, origin); // аналитика не должна ломать приложение
  }
}

/* ---------- 3. заявки на скины (этап 2) ---------- */
async function notifyAdmin(env, text) {
  const token = env.BOT_TOKEN;
  if (!token) { console.error("BOT_TOKEN не задан — уведомление админу не отправлено"); return; }
  const chatId = env.ADMIN_CHAT_ID || "506487479";
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  });
  if (!r.ok) throw new Error("telegram " + r.status);
}
async function handleSkinRequest(request, env, origin) {
  let p;
  try { p = await request.json(); }
  catch { return jsonResp({ error: "Некорректный JSON" }, 400, origin); }

  // honeypot: скрытое поле заполнил только бот — тихо «проглатываем», как будто отправлено
  if (String(p.hp || "").trim() !== "") return jsonResp({ ok: true }, 200, origin);

  const name = String(p.name || "").trim().replace(/\s+/g, " ").slice(0, 60);
  const description = String(p.description || "").trim().slice(0, 1000);
  const contact = String(p.contact || "").trim().slice(0, 80);
  if (name.length < 3) return jsonResp({ error: "Название: от 3 до 60 символов" }, 400, origin);
  if (/[\u0000-\u001f\u007f]/.test(name + description + contact))
    return jsonResp({ error: "Недопустимые символы в тексте" }, 400, origin);
  if (p.consent !== true) return jsonResp({ error: "Нужно согласие на обработку данных" }, 400, origin);

  const channel = p.channel === "miniapp" ? "miniapp" : "site";
  const uk = await normalizeUserKey(p.user_key, env);
  const country = (request.cf && request.cf.country) || null; // только страна, IP не пишем
  const day = dayStr(Date.now());

  if (env.DB) {
    try {
      const prev = await env.DB.prepare(
        "SELECT COUNT(*) n FROM skin_requests WHERE user_key = ? AND day >= ?"
      ).bind(uk, day).first();
      if (prev && prev.n > 0)
        return jsonResp({ error: "Заявка уже отправлена сегодня — загляните завтра" }, 429, origin);
      await env.DB.prepare(
        "INSERT INTO skin_requests (ts, day, name, description, contact, channel, user_key, country) VALUES (?,?,?,?,?,?,?,?)"
      ).bind(Math.floor(Date.now() / 1000), day, name, description || null, contact || null, channel, uk, country).run();
    } catch (e) {
      console.error("skin_request insert failed:", e.message);
      return jsonResp({ error: "Не получилось отправить — попробуйте ещё раз" }, 502, origin);
    }
  }

  // уведомление админу: заявку нельзя терять, поэтому шлём в Telegram даже без D1
  const tgText =
    "🎨 Заявка на свой стиль\n\n" +
    "Название: " + name +
    (description ? "\nОписание: " + description : "") +
    (contact ? "\nКонтакт: " + contact : "") +
    "\nКанал: " + channel +
    (country ? " · Страна: " + country : "") +
    (env.DB ? "" : "\n\n⚠️ D1 не привязана — заявка не сохранена в базу, ответь из этого сообщения!");
  try { await notifyAdmin(env, tgText); }
  catch (e) { console.error("telegram notify failed:", e.message); } // заявка в D1 сохранена — не роняем ответ

  return jsonResp({ ok: true, stored: !!env.DB }, 200, origin);
}

async function statsData(env) {
  const q = (sql, ...b) => env.DB.prepare(sql).bind(...b).all().then(r => r.results);
  const one = async (sql, ...b) => (await env.DB.prepare(sql).bind(...b).first()) || {};
  const today = dayStr(Date.now());
  const d7 = dayStr(Date.now() - 7 * 864e5);
  const d30 = dayStr(Date.now() - 30 * 864e5);

  const users = async (from) =>
    (await one("SELECT COUNT(DISTINCT user_key) n, COUNT(DISTINCT CASE WHEN channel='site' THEN user_key END) site, COUNT(DISTINCT CASE WHEN channel='miniapp' THEN user_key END) mini FROM events WHERE day >= ?", from));

  const tToday = await users(today), tWeek = await users(d7), tMonth = await users(d30);

  const returning = await one(`SELECT COUNT(*) n FROM (
      SELECT user_key FROM events WHERE day >= ? GROUP BY user_key HAVING COUNT(DISTINCT day) > 1)`, d30);
  const returningPct = tMonth.n ? Math.round((returning.n / tMonth.n) * 100) : null;

  const days = await q(`SELECT day, COUNT(DISTINCT user_key) users FROM events
      WHERE day >= ? GROUP BY day ORDER BY day`, dayStr(Date.now() - 13 * 864e5));

  const sources = await q(`SELECT COALESCE(utm_source,'(прямые заходы)') source, COUNT(DISTINCT user_key) users
      FROM events WHERE day >= ? GROUP BY COALESCE(utm_source,'(прямые заходы)') ORDER BY users DESC LIMIT 10`, d30);

  return {
    totals: {
      today: tToday.n, week: tWeek.n, month: tMonth.n,
      site_month: tMonth.site, miniapp_month: tMonth.mini,
      returning_pct: returningPct,
    },
    days, sources,
  };
}

async function handlePublicStats(env, origin) {
  if (!env.DB) return jsonResp({ ok: false, error: "db not bound" }, 503, origin);
  try { return jsonResp(await statsData(env), 200, origin); }
  catch (e) { return jsonResp({ ok: false, error: "stats failed" }, 500, origin); }
}

/* ---------- админка ---------- */
function checkAdmin(request, env) {
  const h = request.headers.get("Authorization") || "";
  if (!h.startsWith("Basic ")) return false;
  let u = "", p = "";
  try { [u, p] = atob(h.slice(6)).split(":"); } catch { return false; }
  return !!env.ADMIN_USER && u === env.ADMIN_USER && p === (env.ADMIN_PASS || "");
}
const needAuth = origin => new Response("Auth required", {
  status: 401,
  headers: { "WWW-Authenticate": 'Basic realm="pogoda-admin"', ...corsHeaders(origin) },
});

async function handleAdminStats(env, origin) {
  if (!env.DB) return new Response("D1 не привязана (Settings → Bindings → DB)", { status: 503, headers: corsHeaders(origin) });
  const pub = await statsData(env);
  const one = async (sql, ...b) => (await env.DB.prepare(sql).bind(...b).first()) || {};
  const all = (sql, ...b) => env.DB.prepare(sql).bind(...b).all().then(r => r.results);
  const d30 = dayStr(Date.now() - 30 * 864e5);

  const geo = await all("SELECT COALESCE(country,'—') c, COUNT(DISTINCT user_key) u FROM events WHERE day >= ? GROUP BY c ORDER BY u DESC LIMIT 15", d30);
  const evs = await all("SELECT event, COUNT(*) n, COUNT(DISTINCT user_key) u FROM events WHERE day >= ? GROUP BY event ORDER BY n DESC", d30);
  const dons = await all("SELECT date, amount, note FROM donations ORDER BY date DESC LIMIT 30");
  const donSum = await one("SELECT COALESCE(SUM(amount),0) s, COUNT(*) n FROM donations");
  const donateOpens = await one("SELECT COUNT(*) n FROM events WHERE event='donate_open' AND day >= ?", d30);
  const skinReqs = await all("SELECT day, name, contact, channel, country FROM skin_requests ORDER BY ts DESC LIMIT 20");
  const recent = await all("SELECT day, event, channel, country, COALESCE(utm_source,'') s FROM events ORDER BY ts DESC LIMIT 25");

  const esc = s => String(s ?? "").replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const rows = (arr, fn) => arr.map(fn).join("");
  const conv = donateOpens.n && donSum.n ? ((donSum.n / donateOpens.n) * 100).toFixed(1) + "%" : "—";

  const html = `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Админка · Погода</title><style>
body{background:#0b1220;color:#e8eef7;font:14px/1.5 -apple-system,Arial,sans-serif;max-width:820px;margin:0 auto;padding:24px 16px}
h1{font-size:20px}h2{font-size:15px;color:#63d6d0;margin:20px 0 8px}
table{width:100%;border-collapse:collapse;background:#16223a;border-radius:10px;overflow:hidden}
td,th{padding:6px 10px;border-bottom:1px solid #24334f;text-align:left;font-size:13px}
th{color:#8fa3bf;font-weight:600}.big{font-size:26px;font-weight:800}
.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.c{background:#16223a;border-radius:10px;padding:10px;text-align:center}
.c span{display:block;color:#8fa3bf;font-size:11px;margin-top:2px}
form{background:#16223a;border-radius:10px;padding:12px;margin-top:8px}
input,button{padding:8px;border-radius:8px;border:1px solid #24334f;background:#0b1220;color:#e8eef7}
button{background:#63d6d0;color:#04202b;font-weight:700;border:none;cursor:pointer}
</style></head><body>
<h1>Админка · аналитика</h1>
<div class="cards">
<div class="c"><div class="big">${pub.totals.today}</div><span>сегодня</span></div>
<div class="c"><div class="big">${pub.totals.week}</div><span>7 дней</span></div>
<div class="c"><div class="big">${pub.totals.month}</div><span>30 дней</span></div>
<div class="c"><div class="big">${pub.totals.returning_pct ?? "—"}%</div><span>возвращаются</span></div>
</div>
<h2>События (30 дней)</h2><table><tr><th>Событие</th><th>Всего</th><th>Уникальных</th></tr>
${rows(evs, e => `<tr><td>${esc(e.event)}</td><td>${e.n}</td><td>${e.u}</td></tr>`)}</table>
<h2>Гео (страны, 30 дней)</h2><table><tr><th>Страна</th><th>Пользователей</th></tr>
${rows(geo, g => `<tr><td>${esc(g.c)}</td><td>${g.u}</td></tr>`)}</table>
<h2>Источники</h2><table><tr><th>Источник</th><th>Пользователей</th></tr>
${rows(pub.sources, s => `<tr><td>${esc(s.source)}</td><td>${s.users}</td></tr>`)}</table>
<h2>Донаты</h2>
<p>Кликов «Поддержать» (30 дн): <b>${donateOpens.n}</b> · Донатов: <b>${donSum.n}</b> на <b>${donSum.s} ₽</b> · Конверсия: <b>${conv}</b></p>
<form method="POST" action="/api/admin/donation" onsubmit="return fd(this)">
<input name="amount" type="number" min="1" placeholder="Сумма ₽" required>
<input name="date" type="date" required>
<input name="note" placeholder="Комментарий" size="18">
<button>Добавить донат</button></form>
<table><tr><th>Дата</th><th>Сумма</th><th>Комментарий</th></tr>
${rows(dons, d => `<tr><td>${esc(d.date)}</td><td>${d.amount} ₽</td><td>${esc(d.note)}</td></tr>`)}</table>
<h2>Заявки на свои стили</h2><table><tr><th>День</th><th>Название</th><th>Контакт</th><th>Канал</th><th>Страна</th></tr>
${skinReqs.length ? rows(skinReqs, s => `<tr><td>${esc(s.day)}</td><td>${esc(s.name)}</td><td>${esc(s.contact || "—")}</td><td>${esc(s.channel)}</td><td>${esc(s.country || "—")}</td></tr>`) : `<tr><td colspan="5">пока нет заявок</td></tr>`}</table>
<h2>Последние события</h2><table><tr><th>День</th><th>Событие</th><th>Канал</th><th>Страна</th><th>Источник</th></tr>
${rows(recent, r => `<tr><td>${r.day}</td><td>${esc(r.event)}</td><td>${r.channel}</td><td>${esc(r.country || "—")}</td><td>${esc(r.s)}</td></tr>`)}</table>
<script>function fd(f){fetch('/api/admin/donation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({amount:+f.amount.value,date:f.date.value,note:f.note.value})}).then(()=>location.reload());return false}</script>
</body></html>`;
  return new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", ...corsHeaders(origin) } });
}

async function handleDonation(request, env, origin) {
  let p;
  const ct = request.headers.get("Content-Type") || "";
  if (ct.includes("json")) { try { p = await request.json(); } catch { p = null; } }
  else {
    const f = await request.formData().catch(() => null);
    p = f ? { amount: f.get("amount"), date: f.get("date"), note: f.get("note") } : null;
  }
  const amount = Math.round(Number(p && p.amount));
  const date = String((p && p.date) || "").slice(0, 10);
  const note = String((p && p.note) || "").slice(0, 200);
  if (!amount || amount < 1 || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    return jsonResp({ error: "amount>=1 и date YYYY-MM-DD обязательны" }, 400, origin);
  if (!env.DB) return jsonResp({ error: "db not bound" }, 503, origin);
  await env.DB.prepare("INSERT INTO donations (date, amount, note, ts) VALUES (?,?,?,?)")
    .bind(date, amount, note || null, Math.floor(Date.now() / 1000)).run();
  if (!ct.includes("json")) return Response.redirect(new URL("/admin/stats", request.url).toString(), 303);
  return jsonResp({ ok: true }, 200, origin);
}

/* ---------- донат-конфиг (этап 3): реквизиты из env, дефолты в коде ---------- */
function handleDonateConfig(env, origin) {
  return jsonResp({
    donate_url: env.DONATE_URL || "https://www.tbank.ru/cf/83mAzHJg3A",
    sbp: env.SBP_REQUISITES || null, // реквизиты СБП (переменная воркера), null — не показываем
  }, 200, origin);
}

/* ---------- роутер ---------- */
export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers: corsHeaders(origin) });

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (request.method === "POST" && path === "") return handleIntake(request, env, origin);
    if (request.method === "POST" && path === "/api/event") return handleEvent(request, env, origin);
    if (request.method === "POST" && path === "/api/skin-request") return handleSkinRequest(request, env, origin);
    if (request.method === "GET" && path === "/api/stats/public") return handlePublicStats(env, origin);
    if (request.method === "GET" && path === "/api/donate-config") return handleDonateConfig(env, origin);
    if (path === "/admin/stats" || path === "/api/admin/donation") {
      if (!checkAdmin(request, env)) return needAuth(origin);
      if (path === "/admin/stats" && request.method === "GET") return handleAdminStats(env, origin);
      if (path === "/api/admin/donation" && request.method === "POST") return handleDonation(request, env, origin);
    }
    if (request.method === "POST" && path === "/") return handleIntake(request, env, origin);
    return jsonResp({ error: "not found" }, 404, origin);
  },
};
