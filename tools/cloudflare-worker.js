/**
 * Приёмник точек pogoda-pro.ru — Cloudflare Worker (бесплатный тариф).
 *
 * Что делает: принимает POST {name, lat, lon} с сайта и Telegram mini-app,
 * валидирует (те же правила, что tools/intake_points.py), и дописывает заявку
 * в data/web_inbox.json в репозитории через GitHub API. Дальше GitHub Actions
 * (каждые 15 минут) публикует точку в points.json.
 *
 * Деплой (5 минут):
 *   1. dash.cloudflare.com → регистрация (бесплатно, карта не нужна).
 *   2. Workers & Pages → Create Worker → назвать pogoda-intake → Deploy.
 *   3. Edit code → заменить всё содержимое на этот файл → Deploy.
 *   4. Settings → Variables and Secrets → добавить два Secret:
 *        GITHUB_TOKEN = <токен GitHub со scope repo> (тот же ghp_Wp8n…)
 *        IP_SALT      = любая длинная случайная строка (для хеша IP)
 *   5. URL вида https://pogoda-intake.<account>.workers.dev — прислать мне,
 *      я впишу его в INTAKE_API в app.js.
 *
 * Приватность: IP пользователя нигде не сохраняется — только sha256-хеш
 * (IP + IP_SALT), нужен для лимита 5 заявок в сутки.
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

function corsHeaders(origin) {
  const ok = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": ok,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function jsonResp(obj, code, origin) {
  return new Response(JSON.stringify(obj), {
    status: code,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(origin) },
  });
}

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

async function sha256hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
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

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    if (request.method !== "POST")
      return jsonResp({ error: "Только POST" }, 405, origin);

    let payload;
    try { payload = await request.json(); }
    catch { return jsonResp({ error: "Некорректный JSON" }, 400, origin); }

    const v = validate(String(payload.name || ""), payload.lat, payload.lon);
    if (v.error) return jsonResp({ error: v.error }, 400, origin);

    const ip = request.headers.get("CF-Connecting-IP") || "anon";
    const uid = (await sha256hex(ip + (env.IP_SALT || "pogoda"))).slice(0, 16);
    const entry = {
      name: v.name,
      lat: Math.round(payload.lat * 10000) / 10000,
      lon: Math.round(payload.lon * 10000) / 10000,
      uid,
      ts: Math.floor(Date.now() / 1000),
    };

    // до 3 попыток: между чтением и записью inbox мог измениться (sha-конфликт)
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
  },
};
