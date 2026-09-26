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

// Стаб fetch: перехватываем обращения к Telegram Bot API, остальное — в реальную сеть (не используется в тестах)
const tgCalls = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  if (String(url).includes("api.telegram.org")) {
    tgCalls.push({ url: String(url), body: opts && opts.body });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
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

console.log(`\nИТОГ: ${passed} пройдено, ${failed} провалено`);
process.exit(failed ? 1 : 0);
