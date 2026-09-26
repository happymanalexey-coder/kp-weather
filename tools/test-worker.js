// Юнит-тест воркера аналитики: node tools/test-worker.js
const mod = await import("./cloudflare-worker.js");
const worker = mod.default;
let passed = 0, failed = 0;
const ok = (cond, name) => { if (cond) { passed++; console.log("  ✓", name); } else { failed++; console.log("  ✗ FAIL:", name); } };

// Мок D1: записывает все вызовы; first() эмулирует антиспам skin_requests (заявка с таким ключом уже есть)
const calls = [];
const DB = {
  prepare(sql) {
    return {
      bind(...args) {
        return {
          run: async () => { calls.push({ sql: sql.slice(0, 40), args }); return {}; },
          all: async () => ({ results: [] }),
          first: async () => {
            if (sql.includes("skin_requests") &&
                calls.some(c => c.sql.startsWith("INSERT INTO skin_requests") && c.args[6] === args[0]))
              return { n: 1 };
            return null;
          },
        };
      },
    };
  },
};
const env = { DB, IP_SALT: "s1", ANALYTICS_SALT: "pepper", ADMIN_USER: "admin", ADMIN_PASS: "pw", GITHUB_TOKEN: "x", BOT_TOKEN: "bot123" };
const req = (method, path, body, headers = {}) => new Request("https://w.dev" + path, {
  method,
  headers: { "Content-Type": "application/json", Origin: "https://pogoda-pro.ru", ...headers },
  body: body ? JSON.stringify(body) : undefined,
});

// Стаб fetch: перехватываем Telegram Bot API и GitHub Contents API,
// остальное — в реальную сеть (не используется в тестах)
const tgCalls = [];
const ghPuts = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  const u = String(url);
  if (u.includes("api.telegram.org")) {
    tgCalls.push({ url: u, body: opts && opts.body });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }
  if (u.includes("api.github.com")) {
    if (opts && opts.method === "PUT") {
      ghPuts.push(JSON.parse(opts.body));
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    return new Response(JSON.stringify({
      sha: "testsha",
      content: btoa(JSON.stringify({ inbox: [] })),
    }), { status: 200 });
  }
  return realFetch(url, opts);
};

console.log("— /api/event —");
let r = await worker.fetch(req("POST", "/api/event", {
  event: "app_open", channel: "miniapp", user_key: "tg:506487479",
  utm: { utm_source: "vk" }, meta: { a: 1 }, ts: 1759000000000,
}), env);
let j = await r.json();
ok(r.status === 200 && j.ok && j.stored, "событие принято и записано");
const ins = calls.find(c => c.sql.startsWith("INSERT INTO events"));
ok(ins && ins.args[4].startsWith("t_") && !String(ins.args[4]).includes("506487479"), "tg id захэширован (t_, без сырого id)");
ok(ins && ins.args[3] === "miniapp" && ins.args[5] === "vk", "channel и utm_source сохранены");
ok(ins && ins.args[8] === null, "страна null без request.cf (IP не трогаем)");

calls.length = 0;
r = await worker.fetch(req("POST", "/api/event", { event: "donate_open", channel: "site", user_key: "web:550e8400-e29b-41d4-a716-446655440000" }), env);
j = await r.json();
const ins2 = calls.find(c => c.sql.startsWith("INSERT INTO events"));
ok(ins2 && ins2.args[4].startsWith("w_550e8400"), "web uuid сохраняется с префиксом w_");

r = await worker.fetch(req("POST", "/api/event", { event: "hack_attempt", channel: "site", user_key: "web:x" }), env);
ok(r.status === 400, "неизвестное событие отклонено (400)");

r = await worker.fetch(req("POST", "/api/event", { event: "app_open", channel: "site", user_key: "web:x" }), { ...env, DB: undefined });
j = await r.json();
ok(r.status === 200 && j.stored === false, "без D1 — ok, stored:false (приложение не ломается)");

console.log("— /api/stats/public —");
r = await worker.fetch(req("GET", "/api/stats/public"), env);
j = await r.json();
ok(r.status === 200 && j.totals && Array.isArray(j.days) && Array.isArray(j.sources), "публичная статистика отдаёт структуру");
r = await worker.fetch(req("GET", "/api/stats/public"), { ...env, DB: undefined });
ok(r.status === 503, "без D1 — 503 (страница /stats покажет заглушку)");

console.log("— админка —");
r = await worker.fetch(req("GET", "/admin/stats"), env);
ok(r.status === 401 && r.headers.get("WWW-Authenticate"), "без авторизации — 401 + Basic realm");
const auth = { Authorization: "Basic " + btoa("admin:pw") };
r = await worker.fetch(req("GET", "/admin/stats", null, auth), env);
ok(r.status === 200 && (await r.text()).includes("Админка"), "с авторизацией — HTML админки");
r = await worker.fetch(req("GET", "/admin/stats", null, { Authorization: "Basic " + btoa("admin:no") }), env);
ok(r.status === 401, "неверный пароль — 401");

r = await worker.fetch(req("POST", "/api/admin/donation", { amount: 500, date: "2026-09-26", note: "тест" }, auth), env);
j = await r.json();
ok(j.ok === true, "донат принят");
ok(calls.some(c => c.sql.startsWith("INSERT INTO donations")), "донат записан в таблицу");
r = await worker.fetch(req("POST", "/api/admin/donation", { amount: -5, date: "26.09.2026" }, auth), env);
ok(r.status === 400, "кривой донат отклонён");

console.log("— /api/skin-request (этап 2) —");
calls.length = 0; tgCalls.length = 0;
r = await worker.fetch(req("POST", "/api/skin-request", {
  name: "Рассвет в горах", description: "Тёплые цвета", contact: "@ivan",
  consent: true, hp: "", channel: "miniapp", user_key: "tg:506487479",
}), env);
j = await r.json();
ok(r.status === 200 && j.ok && j.stored, "заявка принята и записана");
const skIns = calls.find(c => c.sql.startsWith("INSERT INTO skin_requests"));
ok(skIns && skIns.args[6].startsWith("t_") && !String(skIns.args[6]).includes("506487479"), "user_key заявки захэширован (без сырого tg id)");
ok(skIns && skIns.args[2] === "Рассвет в горах" && skIns.args[5] === "miniapp", "название и канал сохранены");
ok(tgCalls.length === 1 && tgCalls[0].body.includes("Рассвет в горах") && tgCalls[0].body.includes("@ivan"), "админу ушло уведомление в Telegram");

r = await worker.fetch(req("POST", "/api/skin-request", {
  name: "Вторая сегодня", consent: true, channel: "miniapp", user_key: "tg:506487479",
}), env);
ok(r.status === 429, "вторая заявка тем же пользователем в тот же день — 429");

r = await worker.fetch(req("POST", "/api/skin-request", {
  name: "Другой юзер", consent: true, channel: "site", user_key: "web:550e8400-e29b-41d4-a716-446655440000",
}), env);
j = await r.json();
ok(r.status === 200 && j.ok, "другой пользователь — заявка принята");

r = await worker.fetch(req("POST", "/api/skin-request", { name: "Без согласия", consent: false }), env);
ok(r.status === 400, "без согласия — 400");
r = await worker.fetch(req("POST", "/api/skin-request", { name: "Аб", consent: true }), env);
ok(r.status === 400, "короткое название отклонено");

calls.length = 0; tgCalls.length = 0;
r = await worker.fetch(req("POST", "/api/skin-request", { name: "Бот заявка", consent: true, hp: "http://spam" }), env);
j = await r.json();
ok(r.status === 200 && j.ok && !calls.some(c => c.sql.startsWith("INSERT INTO skin_requests")) && tgCalls.length === 0,
  "honeypot: ботская заявка «съедена» тихо (без записи и уведомления)");

calls.length = 0; tgCalls.length = 0;
r = await worker.fetch(req("POST", "/api/skin-request", {
  name: "Без базы", consent: true, channel: "site", user_key: "web:550e8400-e29b-41d4-a716-446655440000",
}), { ...env, DB: undefined });
j = await r.json();
ok(r.status === 200 && j.stored === false, "без D1 — ok, stored:false (тихая деградация)");
ok(tgCalls.length === 1, "без D1 уведомление в Telegram всё равно уходит (заявка не теряется)");

console.log("— приём точек (регрессия) —");
r = await worker.fetch(req("POST", "/", { name: "какашка богов", lat: 43.6, lon: 40.2 }), env);
j = await r.json();
ok(r.status === 400 && j.error, "плохое слово в названии отклоняется");
r = await worker.fetch(req("POST", "/", { name: "Норм Точка", lat: 200, lon: 40.2 }), env);
ok(r.status === 400, "координаты вне диапазона отклоняются");
r = await worker.fetch(new Request("https://w.dev/api/event", { method: "OPTIONS", headers: { Origin: "https://pogoda-pro.ru" } }), env);
ok(r.status === 204 && r.headers.get("Access-Control-Allow-Origin") === "https://pogoda-pro.ru", "preflight CORS работает");

console.log("— приём точек: ник Telegram + согласие (этап 3) —");
ghPuts.length = 0;
r = await worker.fetch(req("POST", "/", { name: "Точка С Ником", lat: 43.6, lon: 40.2, tg: "@ivan_petrov", consent: true }), env);
j = await r.json();
ok(r.status === 200 && j.ok, "точка с ником и согласием принята");
let inboxWritten = null;
if (ghPuts.length) {
  const content = JSON.parse(new TextDecoder().decode(
    Uint8Array.from(atob(ghPuts[0].content), c => c.charCodeAt(0))));
  inboxWritten = content.inbox && content.inbox[0];
}
ok(inboxWritten && inboxWritten.tg === "@ivan_petrov" && inboxWritten.consent === true,
  "ник и согласие записаны в inbox");

r = await worker.fetch(req("POST", "/", { name: "Ник Без Согласия", lat: 43.6, lon: 40.2, tg: "@ivan" }), env);
ok(r.status === 400, "ник без согласия — 400 (не храним контакты без базы)");
r = await worker.fetch(req("POST", "/", { name: "Кривой Ник", lat: 43.6, lon: 40.2, tg: "ivan!!", consent: true }), env);
ok(r.status === 400, "некорректный ник — 400");
r = await worker.fetch(req("POST", "/", { name: "Без Ника", lat: 43.6, lon: 40.2 }), env);
j = await r.json();
ok(r.status === 200 && j.ok, "точка без ника принята (ник необязателен)");

console.log("— /api/donate-config (этап 3) —");
r = await worker.fetch(req("GET", "/api/donate-config"), env);
j = await r.json();
ok(r.status === 200 && j.donate_url === "https://www.tbank.ru/cf/83mAzHJg3A" && j.sbp === null,
  "без env — дефолтный donate_url, sbp null");
r = await worker.fetch(req("GET", "/api/donate-config"), { ...env, DONATE_URL: "https://example.com/d", SBP_REQUISITES: "+7 900 000-00-00" });
j = await r.json();
ok(j.donate_url === "https://example.com/d" && j.sbp === "+7 900 000-00-00",
  "реквизиты берутся из env");

console.log(`\nИТОГ: ${passed} пройдено, ${failed} провалено`);
process.exit(failed ? 1 : 0);
