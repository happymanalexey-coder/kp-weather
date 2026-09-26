/* ---------- Аналитика (этап 1): согласие, Я.Метрика, события на свой коллектор ----------
   Принципы: 152-ФЗ — Метрика стартует ТОЛЬКО после согласия; tg id не покидает хэш-форму
   (хэширует сервер), сайт — uuid в cookie (1 год); IP не храним (страна — на воркере).
   Всё деградирует тихо: нет воркера/D1 — приложение работает как раньше. */
(function () {
  "use strict";
  var YM_COUNTER_ID = "113082743"; // Яндекс.Метрика, pogoda-pro.ru
  var API = "https://pogoda-intake.happymanalexey.workers.dev";
  var COOKIE_CONSENT = "kp_consent";   // yes | no
  var COOKIE_UUID = "kp_uid";
  var LS_FIRST_UTM = "kp_first_utm";
  var LS_LAST_OPEN = "kp_last_open";

  /* ----- cookie helpers ----- */
  function setCookie(name, value, days) {
    var d = new Date(); d.setTime(d.getTime() + days * 864e5);
    document.cookie = name + "=" + encodeURIComponent(value) + "; expires=" + d.toUTCString() +
      "; path=/; SameSite=Lax";
  }
  function getCookie(name) {
    var m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : "";
  }
  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 3 | 8)).toString(16);
    });
  }

  /* ----- канал и telegram ----- */
  function tg() { return window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null; }
  function channel() { return (tg() && tg().initData) ? "miniapp" : "site"; }
  function tgUserId() {
    try {
      var t = tg(); if (!t || !t.initDataUnsafe || !t.initDataUnsafe.user) return null;
      return String(t.initDataUnsafe.user.id || "") || null;
    } catch (e) { return null; }
  }

  /* ----- user_key: сайт = uuid в cookie; miniapp = tg id (сервер хэширует с SALT) ----- */
  function userKey() {
    if (channel() === "miniapp") { var id = tgUserId(); return id ? "tg:" + id : "tg:anon"; }
    var u = getCookie(COOKIE_UUID);
    if (!u) { u = uuid(); setCookie(COOKIE_UUID, u, 365); }
    return "web:" + u;
  }

  /* ----- источники трафика ----- */
  function parseUtm(search) {
    var q = new URLSearchParams(search || location.search), r = {};
    ["utm_source", "utm_medium", "utm_campaign"].forEach(function (k) {
      var v = q.get(k); if (v) r[k] = v.slice(0, 120);
    });
    return r;
  }
  function parseStartParam() {
    // mini-app: startapp=src_vk / point_<id> / skin_<id> / комбинации через __
    try {
      var t = tg(); var p = t && t.initDataUnsafe ? t.initDataUnsafe.start_param : null;
      if (!p) {
        var q = new URLSearchParams(location.search);
        p = q.get("startapp") || q.get("tgWebAppStartParam");
      }
      if (!p) return null;
      var out = {};
      String(p).split("__").forEach(function (part) {
        if (part.indexOf("src_") === 0) out.src = part.slice(4).slice(0, 60);
        else if (part.indexOf("point_") === 0) out.point = part.slice(6).slice(0, 60);
        else if (part.indexOf("skin_") === 0) out.skin = part.slice(5).slice(0, 60);
        else if (!out.src) out.src = part.slice(0, 60); // голый канал: vk, inst, blogger_nick …
      });
      return Object.keys(out).length ? out : null;
    } catch (e) { return null; }
  }
  function firstUtm() {
    try {
      var saved = localStorage.getItem(LS_FIRST_UTM);
      if (saved) return JSON.parse(saved);
      var sp = parseStartParam();
      var utm = parseUtm();
      if (sp && sp.src && !utm.utm_source) utm.utm_source = sp.src;
      if (sp && sp.point) utm.start_point = sp.point;
      if (sp && sp.skin) utm.start_skin = sp.skin;
      if (Object.keys(utm).length || sp) {
        utm.ts = Date.now();
        localStorage.setItem(LS_FIRST_UTM, JSON.stringify(utm));
        return utm;
      }
    } catch (e) {}
    return null;
  }

  /* ----- отправка события ----- */
  function send(event, meta) {
    try {
      var payload = {
        event: event,
        channel: channel(),
        user_key: userKey(),
        utm: firstUtm(),
        meta: meta || null,
        ts: Date.now()
      };
      var body = JSON.stringify(payload);
      if (navigator.sendBeacon) {
        var ok = navigator.sendBeacon(API + "/api/event", new Blob([body], { type: "application/json" }));
        if (ok) return;
      }
      fetch(API + "/api/event", { method: "POST", headers: { "Content-Type": "application/json" }, body: body, keepalive: true })
        .catch(function () {});
    } catch (e) {}
  }

  /* ----- Яндекс.Метрика: только после согласия и при наличии ID ----- */
  function startYm() {
    if (!YM_COUNTER_ID) return;
    if (window.ym) return;
    (function (m, e, t, r, i, k, a) {
      m[i] = m[i] || function () { (m[i].a = m[i].a || []).push(arguments); };
      m[i].l = 1 * new Date();
      k = e.createElement(t); a = e.getElementsByTagName(t)[0];
      k.async = 1; k.src = r; a.parentNode.insertBefore(k, a);
    })(window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");
    window.ym(YM_COUNTER_ID, "init", {
      clickmap: true, trackLinks: true, accurateTrackBounce: true,
      webvisor: true, trackHash: true
    });
  }

  /* ----- cookie-баннер ----- */
  function bannerHtml() {
    var b = document.createElement("div");
    b.id = "consent-banner";
    b.innerHTML =
      '<div class="cb-text">Мы используем cookie и обезличенную аналитику, чтобы делать приложение лучше. ' +
      '<a href="/privacy/" target="_blank" rel="noopener">Подробнее</a></div>' +
      '<div class="cb-btns"><button class="cb-yes" type="button">Принять</button>' +
      '<button class="cb-no" type="button">Отклонить</button></div>';
    b.querySelector(".cb-yes").onclick = function () { setCookie(COOKIE_CONSENT, "yes", 365); b.remove(); startYm(); };
    b.querySelector(".cb-no").onclick = function () { setCookie(COOKIE_CONSENT, "no", 365); b.remove(); };
    document.body.appendChild(b);
  }

  /* ----- автособытия: app_open, return_visit ----- */
  function autoEvents() {
    send("app_open", { start: parseStartParam() });
    try {
      var last = +(localStorage.getItem(LS_LAST_OPEN) || 0);
      var now = Date.now();
      if (last && now - last > 24 * 3600 * 1000) send("return_visit", { days: Math.round((now - last) / 864e5) });
      localStorage.setItem(LS_LAST_OPEN, String(now));
    } catch (e) {}
  }

  /* ----- публичный API для app.js ----- */
  window.KP_ANALYTICS = {
    track: send,
    channel: channel,
    userKey: userKey, // для форм (заявка на скин): тот же обезличенный ключ, что в событиях
    // заглушки под будущее (этапы 2–3) — функции уже есть, события улетят, когда появится UI
    subscribeInterest: function (where) { send("subscribe_interest", { where: where || null }); },
    bannerPromoClick: function (id) { send("banner_promo_click", { id: id || null }); },
    shareClick: function (meta) { send("share_click", meta || null); }
  };

  /* ----- init ----- */
  function init() {
    firstUtm(); // фиксируем источник при первом заходе — задним числом не восстановить
    var c = getCookie(COOKIE_CONSENT);
    if (c === "yes") startYm();
    else if (c !== "no") bannerHtml();
    autoEvents();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
