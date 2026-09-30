/* Скин «Minimalism» — реализация Minimalism_Design_Spec.md (01.10.2026).
   Тёплая бумага + бронза, редакционная типографика (Playfair Display 500 — только акцидентные строки),
   округлые карточки 20px без обводок, линейные иконки 24×24 stroke 1.5.
   Статус: draft — скрыт от пользователей, просмотр владельцем: ?skin=minimalism&draft=1 */
window.KP_SKINS = window.KP_SKINS || {};
(function () {
  "use strict";

  /* ---------- погодные иконки: линейный контур, stroke 1.5, round, токены --i-* ---------- */
  var C = 'var(--i-cloud)', U = 'var(--i-sun)', N = 'var(--i-moon)', R = 'var(--i-rain)',
      D = 'var(--i-drz)', W = 'var(--i-snow)', B = 'var(--i-bolt)', F = 'var(--i-fog)', K = 'var(--i-wind)';
  var S1 = 'stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"';
  var CLOUD = "M6.8 17.2 a4.1 4.1 0 0 1 .4-8.2 a5.3 5.3 0 0 1 10.1 1.1 a3.8 3.8 0 0 1 .3 7.1 z";
  var MOON = "M15 3 a9 9 0 1 0 6 15.8 a7.5 7.5 0 0 1-6-15.8 z";
  var BOLT = "M12.8 16.5 l-2 3.3 h1.8 l-1.2 3";
  function rays(cx, cy, r0, r1, n) { // n лучей длиной r1-r0 с шагом 360/n
    var s = "";
    for (var i = 0; i < n; i++) {
      var a = i * Math.PI * 2 / n, c = Math.cos(a), n2 = Math.sin(a);
      s += '<line x1="' + (cx + c * r0).toFixed(2) + '" y1="' + (cy + n2 * r0).toFixed(2) +
           '" x2="' + (cx + c * r1).toFixed(2) + '" y2="' + (cy + n2 * r1).toFixed(2) + '"/>';
    }
    return s;
  }
  function drops(xs, y, dx, len) {
    return xs.map(function (x) { return '<line x1="' + x + '" y1="' + y + '" x2="' + (x + dx) + '" y2="' + (y + len) + '"/>'; }).join("");
  }
  function flake(x, y, r) { // три перекрестия 60°, штрих 1.0 в каждую сторону
    var h = r * 0.87, hr = r * 0.5, f = function (v) { return v.toFixed(2); };
    return '<line x1="' + f(x - r) + '" y1="' + f(y) + '" x2="' + f(x + r) + '" y2="' + f(y) + '"/>' +
           '<line x1="' + f(x - hr) + '" y1="' + f(y - h) + '" x2="' + f(x + hr) + '" y2="' + f(y + h) + '"/>' +
           '<line x1="' + f(x - hr) + '" y1="' + f(y + h) + '" x2="' + f(x + hr) + '" y2="' + f(y - h) + '"/>';
  }
  function svg(inner) { return '<svg class="wic" viewBox="0 0 24 24" ' + S1 + '>' + inner + '</svg>'; }
  function cloudSvg(inner) { return svg('<path d="' + CLOUD + '" stroke="' + C + '"/>' + inner); }

  var icons = {
    sun: svg('<circle cx="12" cy="12" r="5.2" stroke="' + U + '"/><g stroke="' + U + '">' + rays(12, 12, 6.8, 9.4, 8) + '</g>'),
    moon: svg('<path d="' + MOON + '" stroke="' + N + '"/>'),
    sunCloud: svg('<g stroke="' + U + '"><circle cx="8.6" cy="8" r="3"/><line x1="8.6" y1="2.6" x2="8.6" y2="4"/><line x1="3.2" y1="8" x2="4.6" y2="8"/><line x1="4.7" y1="4.1" x2="5.7" y2="5.1"/><line x1="12.5" y1="4.1" x2="11.5" y2="5.1"/></g>' +
                 '<path d="M9 19.4 a3.3 3.3 0 0 1 .3-6.6 a4.2 4.2 0 0 1 8 .9 a3 3 0 0 1 .2 5.7 z" stroke="' + C + '"/>'),
    moonCloud: svg('<path d="M13.4 3.2 a6.4 6.4 0 1 0 4.3 11.3 a5.4 5.4 0 0 1-4.3-11.3 z" stroke="' + N + '"/>' +
                   '<path d="M8 19.6 a3.2 3.2 0 0 1 .3-6.4 a4.1 4.1 0 0 1 7.9.9 a2.9 2.9 0 0 1 .2 5.5 z" stroke="' + C + '"/>'),
    cloud: svg('<path d="' + CLOUD + '" stroke="' + C + '"/>'),
    overcast: svg('<path d="M8.4 9.8 a3.2 3.2 0 0 1 6.3.7" stroke="' + C + '"/>' +
                  '<path d="' + CLOUD + '" stroke="' + C + '"/>'),
    fog: cloudSvg('<g stroke="' + F + '"><line x1="7" y1="19.6" x2="17" y2="19.6"/><line x1="8.6" y1="21.2" x2="15.4" y2="21.2"/></g>'),
    drizzle: cloudSvg('<g fill="' + D + '" stroke="none"><circle cx="9" cy="19.4" r=".9"/><circle cx="14.6" cy="19.4" r=".9"/></g>'),
    rain: cloudSvg('<g stroke="' + R + '">' + drops([7.6, 12, 16.4], 18.4, -0.4, 2.6) + '</g>'),
    moonRain: svg('<path d="M13.6 2.6 a6.2 6.2 0 1 0 4.1 10.9 a5.2 5.2 0 0 1-4.1-10.9 z" stroke="' + N + '"/>' +
                  '<path d="M7.6 18.8 a2.9 2.9 0 0 1 .3-5.8 a3.7 3.7 0 0 1 7.1.8 a2.6 2.6 0 0 1 .2 5 z" stroke="' + C + '"/>' +
                  '<g stroke="' + R + '">' + drops([9.4, 14.2], 19.2, -0.35, 2.2) + '</g>'),
    rainShowers: cloudSvg('<g stroke="' + R + '">' + drops([7.4, 12, 16.6], 18.2, -0.5, 3) + '</g>'),
    rainSnow: cloudSvg('<g stroke="' + R + '"><line x1="9" y1="18.6" x2="8.6" y2="21.2"/></g>' +
                       '<g stroke="' + W + '">' + flake(15, 20, 1.6) + '</g>'),
    snow: cloudSvg('<g stroke="' + W + '">' + flake(7.6, 19.6, 1.5) + flake(12, 20.6, 1.5) + flake(16.4, 19.6, 1.5) + '</g>'),
    moonSnow: svg('<path d="M13.6 2.6 a6.2 6.2 0 1 0 4.1 10.9 a5.2 5.2 0 0 1-4.1-10.9 z" stroke="' + N + '"/>' +
                  '<path d="M7.6 18.8 a2.9 2.9 0 0 1 .3-5.8 a3.7 3.7 0 0 1 7.1.8 a2.6 2.6 0 0 1 .2 5 z" stroke="' + C + '"/>' +
                  '<g stroke="' + W + '">' + flake(12, 20.4, 1.6) + '</g>'),
    blizzard: cloudSvg('<g stroke="' + W + '">' + flake(8.6, 19.4, 1.5) + '</g>' +
                       '<g stroke="' + K + '"><path d="M10.5 20.6 h6.4 a1.7 1.7 0 1 0-1.7-1.8"/></g>'),
    hail: cloudSvg('<g fill="' + W + '" stroke="none"><circle cx="8.2" cy="19.6" r="1"/><circle cx="12" cy="20.8" r="1"/><circle cx="15.8" cy="19.6" r="1"/></g>'),
    thunder: cloudSvg('<path d="' + BOLT + '" stroke="' + B + '" stroke-width="1.6"/>'),
    thunderHail: cloudSvg('<path d="M11.6 17.4 l-1.4 2.4 h1.3 l-0.9 2.2" stroke="' + B + '" stroke-width="1.4"/>' +
                          '<circle cx="16.6" cy="20.6" r="1" fill="' + W + '" stroke="none"/>'),
    wind: svg('<g stroke="' + K + '"><path d="M3.5 8.5 h9 a2.6 2.6 0 1 0-2.6-2.8"/><path d="M3.5 12.7 h12.6 a2.6 2.6 0 1 1-2.6 2.8"/><path d="M3.5 16.9 h6.5"/></g>'),
    wave: svg('<g stroke="' + K + '"><path d="M2.5 9.2c1.9-2 3.8-2 5.7 0s3.8 2 5.7 0 3.8-2 5.7 0"/><path d="M2.5 15.2c1.9-2 3.8-2 5.7 0s3.8 2 5.7 0 3.8-2 5.7 0"/></g>'),
    /* UI: «поделиться» — бумажный самолётик (К-03), мастер 24×24, stroke 1.8 */
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 3.5 L10.8 14.2"/><path d="M21.5 3.5 L14.5 21.5 L10.8 14.2 L2.5 10.5 Z"/></svg>'
  };

  /* ---------- 16 цветовых ролей (§2 спеки) → токены приложения ---------- */
  var tokens = {
    dark: {
      "--bg": "#161513", "--bg2": "#1B1A16", "--card": "#22211C", "--card2": "#26241E",
      "--line": "#2E2C26", "--text": "#EDEAE2", "--text2": "#E3DFD5", "--muted": "#97907F",
      "--accent": "#C99A55", "--on-accent": "#1B1A16", "--on-accent2": "#1B1A16",
      "--green": "#4FB573", "--yellow": "#D4AC3A", "--red": "#D4726A", "--blue": "#8FA9BF",
      "--tmax": "#E0885A", "--tmin": "#8FA9BF", "--prc": "#7E97AE", "--star": "#D19A3F",
      "--head": "rgba(22,21,19,.92)", "--overlay": "rgba(10,9,8,.6)",
      "--accent-soft": "rgba(201,154,85,.12)", "--accent-glow": "rgba(201,154,85,.18)",
      "--green-bg": "rgba(79,181,115,.14)", "--yellow-bg": "rgba(212,172,58,.14)",
      "--red-bg": "#33241F", "--red-soft": "rgba(212,114,106,.12)",
      "--shadow": "rgba(0,0,0,.45)", "--shadow2": "rgba(0,0,0,.35)",
      "--card-sh": "0 12px 28px rgba(0,0,0,.45)",
      "--hero-sk0": "#161513", "--hero-sk1": "#161513", "--hero-mt1": "#161513", "--hero-mt2": "#161513", "--hero-mt3": "#161513",
      "--hero-snow": "#EDEAE2", "--hero-moon": "#EDEAE2", "--hero-sun": "#EDEAE2",
      "--hero-sub": "#A39B8A", "--hero-shadow": "rgba(0,0,0,0)", "--hero-globe-shadow": "rgba(0,0,0,0)",
      "--hi-border": "#2E2C26", "--hi-color": "#97907F", "--hi-bg": "#1B1A16", "--hi-glow": "rgba(0,0,0,0)",
      "--info-border": "#A39B8A", "--info-color": "#A39B8A",
      "--i-sun": "#A39B8A", "--i-moon": "#A39B8A", "--i-cloud": "#A39B8A", "--i-fog": "#A39B8A",
      "--i-rain": "#A39B8A", "--i-drz": "#A39B8A", "--i-snow": "#A39B8A", "--i-bolt": "#A39B8A", "--i-wind": "#A39B8A",
      "--r-lg": "20px", "--r-md": "20px", "--r-sm": "14px"
    },
    light: {
      "--bg": "#F8F6F1", "--bg2": "#EFEBE2", "--card": "#FFFEFA", "--card2": "#F4F0E7",
      "--line": "#E7E1D3", "--text": "#23211C", "--text2": "#3A372F", "--muted": "#7A756A",
      "--accent": "#8A6B3A", "--on-accent": "#FFFDF8", "--on-accent2": "#FFFDF8",
      "--green": "#3E9B5F", "--yellow": "#B28A1E", "--red": "#A84A40", "--blue": "#5B7A96",
      "--tmax": "#A8542E", "--tmin": "#5B7A96", "--prc": "#6E8CA8", "--star": "#C08A2E",
      "--head": "rgba(248,246,241,.92)", "--overlay": "rgba(35,33,28,.45)",
      "--accent-soft": "rgba(138,107,58,.10)", "--accent-glow": "rgba(138,107,58,.16)",
      "--green-bg": "rgba(62,155,95,.12)", "--yellow-bg": "rgba(178,138,30,.12)",
      "--red-bg": "#F7E9E4", "--red-soft": "rgba(168,74,64,.10)",
      "--shadow": "rgba(60,52,38,.10)", "--shadow2": "rgba(60,52,38,.08)",
      "--card-sh": "0 10px 26px rgba(60,52,38,.10)",
      "--hero-sk0": "#F8F6F1", "--hero-sk1": "#F8F6F1", "--hero-mt1": "#F8F6F1", "--hero-mt2": "#F8F6F1", "--hero-mt3": "#F8F6F1",
      "--hero-snow": "#23211C", "--hero-moon": "#23211C", "--hero-sun": "#23211C",
      "--hero-sub": "#6E685B", "--hero-shadow": "rgba(0,0,0,0)", "--hero-globe-shadow": "rgba(0,0,0,0)",
      "--hi-border": "#E7E1D3", "--hi-color": "#7A756A", "--hi-bg": "#EFEBE2", "--hi-glow": "rgba(0,0,0,0)",
      "--info-border": "#6E685B", "--info-color": "#6E685B",
      "--i-sun": "#6E685B", "--i-moon": "#6E685B", "--i-cloud": "#6E685B", "--i-fog": "#6E685B",
      "--i-rain": "#6E685B", "--i-drz": "#6E685B", "--i-snow": "#6E685B", "--i-bolt": "#6E685B", "--i-wind": "#6E685B",
      "--r-lg": "20px", "--r-md": "20px", "--r-sm": "14px"
    }
  };

  /* ---------- структурный слой (то, что токенами не выразить) ---------- */
  var LAMP_SVG =
    '<svg viewBox="0 0 120 240" fill="none" style="overflow:visible">' +
    '<defs><radialGradient id="m-glow" cx="50%" cy="52%" r="50%">' +
    '<stop class="gs0" offset="0"/><stop class="gs1" offset=".5"/><stop class="gs2" offset="1" stop-opacity="0"/>' +
    '</radialGradient></defs>' +
    '<circle cx="60" cy="128" r="86" fill="url(#m-glow)"/>' +
    '<line class="m-cord" x1="60" y1="28" x2="60" y2="72" stroke-width="2.4" stroke-linecap="round"/>' +
    '<path class="m-base" d="M50 72 h20 l3 18 h-26 z"/>' +
    '<path class="m-bulb" d="M60 90 C34 90 24 110 24 130 C24 153 40 166 60 166 C80 166 96 153 96 130 C96 110 86 90 60 90 Z" stroke-width="1.6"/>' +
    '<path class="m-fil" d="M44 138 L52 124 L60 138 L68 124 L76 138" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>';

  var css = [
    '@font-face { font-family: "Playfair Display"; src: url("assets/fonts/PlayfairDisplay.ttf") format("truetype"); font-weight: 500; font-display: swap; }',
    '/* UI-гарнитура: системный стек Noto Sans без загрузки файлов */',
    '[data-skin="minimalism"] body { font-family: "Noto Sans", "Noto Sans Display", -apple-system, "Segoe UI", Roboto, Arial, sans-serif; }',
    '/* ---- К-02 hero (§4): слово-кнопка + лампа ---- */',
    '[data-skin="minimalism"] .hero { height: 190px; }',
    '[data-skin="minimalism"] .hero-mountains, [data-skin="minimalism"] .theme-toggle, [data-skin="minimalism"] .hero-info { display: none; }',
    '[data-skin="minimalism"] .hero-text { inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 0; pointer-events: none; }',
    '[data-skin="minimalism"] .hero-text h1 { font-size: 0; pointer-events: auto; cursor: pointer; transition: opacity .12s; }',
    '[data-skin="minimalism"] .hero-text h1::before { content: "Погода"; font-family: "Playfair Display", serif; font-weight: 500; font-size: 52px; color: var(--text); }',
    '[data-skin="minimalism"] .hero-text h1:active { opacity: .6; }',
    '[data-skin="minimalism"] .hero-text p { font-size: 0; margin-top: 12px; pointer-events: auto; cursor: pointer; }',
    '[data-skin="minimalism"] .hero-text p::before { content: "О ПРОЕКТЕ ›"; font-size: 10px; font-weight: 500; letter-spacing: 2.6px; color: var(--muted); }',
    '[data-skin="minimalism"] #m-lamp { position: absolute; right: 24px; top: 0; width: 104px; height: 208px; transform: translateY(-28px); pointer-events: none; }',
    '[data-skin="minimalism"] .m-lamp-hit { position: absolute; left: 50%; top: 58%; transform: translate(-50%, -50%); width: 64px; height: 64px; pointer-events: auto; cursor: pointer; }',
    '[data-skin="minimalism"] #m-lamp .gs0 { stop-color: #FFFDF6; stop-opacity: 1; }',
    '[data-skin="minimalism"] #m-lamp .gs1 { stop-color: #FBEED4; stop-opacity: .45; }',
    '[data-skin="minimalism"] #m-lamp .m-cord { stroke: #A89E8D; }',
    '[data-skin="minimalism"] #m-lamp .m-base { fill: #8A6B3A; }',
    '[data-skin="minimalism"] #m-lamp .m-bulb { fill: #FFFDF8; stroke: #D9CFBE; }',
    '[data-skin="minimalism"] #m-lamp .m-fil { stroke: #B9AD97; stroke-width: 2.2; }',
    '[data-skin="minimalism"][data-theme="dark"] #m-lamp .gs0 { stop-color: #FFBE66; stop-opacity: .8; }',
    '[data-skin="minimalism"][data-theme="dark"] #m-lamp .gs1 { stop-color: #DE8F35; stop-opacity: .32; }',
    '[data-skin="minimalism"][data-theme="dark"] #m-lamp .m-cord { stroke: #57503F; }',
    '[data-skin="minimalism"][data-theme="dark"] #m-lamp .m-bulb { fill: #201D18; stroke: #463F33; }',
    '[data-skin="minimalism"][data-theme="dark"] #m-lamp .m-fil { stroke: #FFB75E; stroke-width: 3.6; }',
    '/* ---- Д-Р2 quick row: три кнопки, вставка, пилюли 22px ---- */',
    '[data-skin="minimalism"] .top-actions { margin: 2px 0 4px; }',
    '[data-skin="minimalism"] .top-actions .ha-btn { height: 44px; border: none; border-radius: 22px; background: var(--bg2); color: var(--text); font-size: 12px; font-weight: 700; gap: 6px; }',
    '[data-skin="minimalism"] .top-actions .ha-btn:active { opacity: .7; transition: opacity .12s; }',
    '[data-skin="minimalism"] .top-actions .sic { width: 15px; height: 15px; color: var(--accent); }',
    '[data-skin="minimalism"] .top-actions .sic svg { display: none; }',
    '[data-skin="minimalism"] .top-actions .ha-btn:nth-child(1) .sic { background: url(\'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6"/><line x1="15.2" y1="15.2" x2="20" y2="20"/></svg>\') center/contain no-repeat; }',
    '[data-skin="minimalism"] .top-actions .ha-btn:nth-child(2) .sic { background: url(\'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>\') center/contain no-repeat; }',
    '[data-skin="minimalism"] .top-actions .ha-btn:nth-child(3) .sic { background: url(\'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21a9 9 0 1 1 9-9"/><path d="M12 21a9 9 0 0 0 9-9"/><circle cx="7.5" cy="10.5" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="7.5" r="1.3" fill="currentColor" stroke="none"/></svg>\') center/contain no-repeat; }',
    '/* ---- общие: карточки 20px, без обводок, тень по теме ---- */',
    '[data-skin="minimalism"] .point-btn, [data-skin="minimalism"] .card, [data-skin="minimalism"] .donate-panel, [data-skin="minimalism"] .community-panel { border: none; box-shadow: var(--card-sh); border-radius: 20px; }',
    '[data-skin="minimalism"] .point-btn:active { opacity: .7; transition: opacity .12s; }',
    '/* ---- К-05 «Сейчас»: Playfair 56px, иконка 52px ---- */',
    '[data-skin="minimalism"] .now-t { font-family: "Playfair Display", serif; font-weight: 500; font-size: 56px; }',
    '[data-skin="minimalism"] .now-icon .wic { width: 52px; height: 52px; }',
    '/* ---- К-08: «сейчас» — плашка вставки радиус 10 вместо рамки ---- */',
    '[data-skin="minimalism"] .h-cell.now { border: none; background: var(--bg2); border-radius: 10px; }',
    '[data-skin="minimalism"] .hours-wrap { background: transparent; }',
    '/* ---- К-03: название точки Playfair 30 ---- */',
    '[data-skin="minimalism"] .pt-title { font-family: "Playfair Display", serif; font-weight: 500; font-size: 30px; }',
    '[data-skin="minimalism"] .d-date { font-weight: 700; }',
    '/* ---- К-17/Э-6 «О проекте» (Д-Р5): заголовок, слово 42px, манифест-карта ---- */',
    '[data-skin="minimalism"] #about-screen .lib-head { justify-content: center; }',
    '[data-skin="minimalism"] #about-screen .about-title { font-family: "Playfair Display", serif; font-weight: 500; font-size: 17px; }',
    '[data-skin="minimalism"] #about-screen .lib-close { position: absolute; left: 12px; }',
    '[data-skin="minimalism"] .about-body::before { content: "Погода"; display: block; text-align: center; font-family: "Playfair Display", serif; font-weight: 500; font-size: 42px; color: var(--text); margin: 2px 0 14px; }',
    '[data-skin="minimalism"] .m-manifest { background: var(--card); border-radius: 20px; padding: 16px; box-shadow: var(--card-sh); }',
    '[data-skin="minimalism"] .m-manifest p { font-size: 12.5px; line-height: 1.55; color: var(--text); margin: 0 0 10px; }',
    '[data-skin="minimalism"] .m-manifest p:last-child { margin-bottom: 0; }',
    '[data-skin="minimalism"] .about-body > .dp-sbp { margin-top: 14px; height: 48px; border-radius: 24px; font-size: 14.5px; }',
    '/* ---- поля ввода: фон вставки, радиус 14 (К-11…К-14) ---- */',
    '[data-skin="minimalism"] .fb-input { background: var(--bg2); border: none; border-radius: 14px; }',
    '[data-skin="minimalism"] .fb-input:focus { border: none; }',
    '[data-skin="minimalism"] .fb-card { border: none; box-shadow: var(--card-sh); }'
  ].join("\n");

  /* ---------- хуки жизненного цикла ---------- */
  function onApply() {
    var hero = document.querySelector(".hero");
    if (hero && !document.getElementById("m-lamp")) {
      var lamp = document.createElement("div");
      lamp.id = "m-lamp";
      lamp.innerHTML = LAMP_SVG + '<div class="m-lamp-hit" role="button" aria-label="Сменить тему"></div>';
      lamp.querySelector(".m-lamp-hit").addEventListener("click", function () { toggleTheme(); });
      hero.appendChild(lamp);
    }
    var word = document.querySelector(".hero-text h1");
    if (word && !word.classList.contains("m-bound")) {
      word.classList.add("m-bound");
      word.addEventListener("click", openAbout);
      var cap = document.querySelector(".hero-text p");
      if (cap) cap.addEventListener("click", openAbout);
    }
    var body = document.querySelector(".about-body");
    if (body && !body.querySelector(".m-manifest")) {
      var ps = Array.prototype.slice.call(body.querySelectorAll("p"));
      var btn = body.querySelector(".dp-sbp");
      var card = document.createElement("div");
      card.className = "m-manifest";
      ps.forEach(function (p) { card.appendChild(p); });
      body.insertBefore(card, btn || null);
    }
  }
  function onRemove() {
    var lamp = document.getElementById("m-lamp");
    if (lamp) lamp.remove();
    var word = document.querySelector(".hero-text h1");
    if (word) {
      word.classList.remove("m-bound");
      word.removeEventListener("click", openAbout);
      var cap = document.querySelector(".hero-text p");
      if (cap) cap.removeEventListener("click", openAbout);
    }
    var card = document.querySelector(".about-body .m-manifest");
    if (card) {
      var body = card.parentElement;
      while (card.firstChild) body.insertBefore(card.firstChild, card);
      card.remove();
    }
  }

  window.KP_SKINS.minimalism = {
    id: "minimalism",
    name: "Minimalism",
    author: "Алексей × Kimi",
    tokens: tokens,
    icons: icons,
    css: css,
    onApply: onApply,
    onRemove: onRemove
  };
})();
