/* Скин «Тёма 299» — реализация Тёма299_пакет_для_терминала.md (01.10.2026).
   Мультяшная сочность: мото-арт шапки (день ⇄ неоновая ночь), Nunito 400/700/800,
   температура непрерывной шкалой temp_color (Д-Р1), трёхцветные градиентные полоски,
   белая донат-кнопка на голубом неоне (Д-Р2). Статус: draft — скрыт от пользователей,
   просмотр владельцем: ?skin=tema299&draft=1 */
window.KP_SKINS = window.KP_SKINS || {};
(function () {
  "use strict";

  /* ---------- §7: погодные иконки 48×48, порт генераторов 1:1 (gid — уникальный id) ---------- */
  var _uid = 0;
  function gid() { return "t9g" + (++_uid); }
  function rad(a) { return a * Math.PI / 180; }
  function f1(v) { return v.toFixed(1); }

  function sun() {
    var g = gid(), rays = "";
    for (var a = 0; a < 360; a += 45) {
      rays += '<line x1="' + f1(24 + 16 * Math.cos(rad(a))) + '" y1="' + f1(24 + 16 * Math.sin(rad(a))) +
             '" x2="' + f1(24 + 20.5 * Math.cos(rad(a))) + '" y2="' + f1(24 + 20.5 * Math.sin(rad(a))) +
             '" stroke="#FFC94D" stroke-width="3.4" stroke-linecap="round"/>';
    }
    return '<radialGradient id="' + g + '" cx="40%" cy="35%"><stop offset="0%" stop-color="#FFE98A"/>' +
           '<stop offset="100%" stop-color="#FFB200"/></radialGradient>' + rays +
           '<circle cx="24" cy="24" r="11" fill="url(#' + g + ')"/>';
  }
  function moon() {
    var g = gid();
    return '<linearGradient id="' + g + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#FFF3C9"/>' +
           '<stop offset="100%" stop-color="#EFD288"/></linearGradient>' +
           '<path d="M30 7 A15.5 15.5 0 1 0 41 30 A17 17 0 0 1 30 7 Z" fill="url(#' + g + ')"/>' +
           '<circle cx="35" cy="13" r="1.8" fill="#FFF8DC"/><circle cx="40" cy="9" r="1.2" fill="#FFF8DC"/>';
  }
  function cloudGrad() {
    var g = gid();
    return { d: '<linearGradient id="' + g + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#FFFFFF"/>' +
                '<stop offset="100%" stop-color="#D8E4EE"/></linearGradient>', g: g };
  }
  function cloudShape(dy, fill) {
    return '<path d="M14 ' + (33 + dy) + ' a7.5 7.5 0 0 1 -1.5-14.8 a9.5 9.5 0 0 1 18.4-2.2 ' +
           'a6.8 6.8 0 0 1 4.6 12.8 Z" fill="url(#' + fill + ')" stroke="#C9D6E2" stroke-width="1.4"/>';
  }
  function cloud() { var c = cloudGrad(); return c.d + cloudShape(0, c.g); }
  function suncloud() {
    var g = gid(), c = cloudGrad(), s = '', a;
    s = '<radialGradient id="' + g + '" cx="40%" cy="35%"><stop offset="0%" stop-color="#FFE98A"/>' +
        '<stop offset="100%" stop-color="#FFB200"/></radialGradient>' +
        '<circle cx="31" cy="15" r="7.5" fill="url(#' + g + ')"/>';
    var angles = [-60, -20, 20, 60, 100];
    for (var i = 0; i < angles.length; i++) {
      a = angles[i];
      s += '<line x1="' + f1(31 + 11 * Math.cos(rad(a))) + '" y1="' + f1(15 + 11 * Math.sin(rad(a))) +
           '" x2="' + f1(31 + 14 * Math.cos(rad(a))) + '" y2="' + f1(15 + 14 * Math.sin(rad(a))) +
           '" stroke="#FFC94D" stroke-width="2.8" stroke-linecap="round"/>';
    }
    return c.d + s + cloudShape(4, c.g);
  }
  function moonShape(x, y, r) {
    return '<path d="M' + x + ' ' + y + ' A' + r + ' ' + r + ' 0 1 0 ' + (x + 7) + ' ' + (y + 15) +
           ' A' + (r + 1) + ' ' + (r + 1) + ' 0 0 1 ' + x + ' ' + y + ' Z" fill="#F6E7B6"/>';
  }
  function mooncloud() { var c = cloudGrad(); return c.d + moonShape(33, 6, 10) + cloudShape(4, c.g); }
  function dropPath(x, y, s) {
    return '<path d="M' + x + ' ' + y + ' c' + f1(-2.4 * s) + ' ' + f1(3.4 * s) + ' ' + f1(-3.4 * s) + ' ' + f1(5.4 * s) + ' ' + f1(-3.4 * s) + ' ' + f1(7.6 * s) +
           ' a' + f1(3.4 * s) + ' ' + f1(3.4 * s) + ' 0 1 0 ' + f1(6.8 * s) + ' 0 c0 ' + f1(-2.2 * s) + ' ' + f1(-1.0 * s) + ' ' + f1(-4.2 * s) + ' ' + f1(-3.4 * s) + ' ' + f1(-7.6 * s) + ' Z"/>';
  }
  function drops(pts, big) {
    var g = gid(), out = '<linearGradient id="' + g + '" x1="0" y1="0" x2="0" y2="1">' +
           '<stop offset="0%" stop-color="#8FC7F5"/><stop offset="100%" stop-color="#2F7FD0"/></linearGradient>';
    for (var i = 0; i < pts.length; i++) {
      var s = big === false ? 0.72 : 1.0, x = pts[i][0], y = pts[i][1];
      out += '<path d="M' + x + ' ' + y + ' c' + f1(-2.4 * s) + ' ' + f1(3.4 * s) + ' ' + f1(-3.4 * s) + ' ' + f1(5.4 * s) + ' ' + f1(-3.4 * s) + ' ' + f1(7.6 * s) +
             ' a' + f1(3.4 * s) + ' ' + f1(3.4 * s) + ' 0 1 0 ' + f1(6.8 * s) + ' 0 c0 ' + f1(-2.2 * s) + ' ' + f1(-1.0 * s) + ' ' + f1(-4.2 * s) + ' ' + f1(-3.4 * s) + ' ' + f1(-7.6 * s) +
             ' Z" fill="url(#' + g + ')"/>' +
             '<ellipse cx="' + f1(x - 1.1 * s) + '" cy="' + f1(y + 8.9 * s) + '" rx="' + f1(0.9 * s) + '" ry="' + f1(1.4 * s) + '" fill="#D8ECFB" opacity=".85"/>';
    }
    return out;
  }
  function rain() { var c = cloudGrad(); return c.d + cloudShape(-3, c.g) + drops([[15, 33], [24, 36], [33, 33]]); }
  function drizzle() { var c = cloudGrad(); return c.d + cloudShape(-3, c.g) + drops([[16, 34], [24, 37], [32, 34]], false); }
  function flakes(pts, s) {
    var out = "";
    for (var i = 0; i < pts.length; i++) {
      var x = pts[i][0], y = pts[i][1];
      for (var k = 0; k < 3; k++) {
        var a = rad(k * 60), dx = 3.4 * s * Math.cos(a), dy = 3.4 * s * Math.sin(a);
        out += '<line x1="' + f1(x - dx) + '" y1="' + f1(y - dy) + '" x2="' + f1(x + dx) + '" y2="' + f1(y + dy) +
               '" stroke="#A9D8F5" stroke-width="2.1" stroke-linecap="round"/>';
      }
      out += '<circle cx="' + x + '" cy="' + y + '" r="1.3" fill="#CDEAFB"/>';
    }
    return out;
  }
  function snow() { var c = cloudGrad(); return c.d + cloudShape(-3, c.g) + flakes([[16, 37], [25, 40.5], [33, 37]], 1); }
  function blizzard() {
    var c = cloudGrad();
    return c.d + cloudShape(-4, c.g) + flakes([[17, 35], [30, 35]], 0.8) +
      '<path d="M10 42 q4 -2.6 8 0 q4 2.6 8 0" fill="none" stroke="#9FB6C8" stroke-width="2" stroke-linecap="round"/>' +
      '<path d="M26 45 q4 -2.6 8 0 q4 2.6 8 0" fill="none" stroke="#9FB6C8" stroke-width="2" stroke-linecap="round"/>';
  }
  function boltPath(d) {
    var g = gid();
    return '<linearGradient id="' + g + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#FFE066"/>' +
           '<stop offset="100%" stop-color="#F5A300"/></linearGradient>' +
           '<path d="' + d + '" fill="url(#' + g + ')" stroke="#E8A800" stroke-width="1" stroke-linejoin="round"/>';
  }
  function storm() { var c = cloudGrad(); return c.d + cloudShape(-4, c.g) + boltPath("M27 26 L19 38 L24.5 38 L21.5 47 L32 34.5 L26.5 34.5 L30.5 26 Z"); }
  function fog() {
    var c = cloudGrad(), lines = "";
    [36, 41, 46].forEach(function (y) {
      lines += '<line x1="10" y1="' + y + '" x2="38" y2="' + y + '" stroke="#A9B6C2" stroke-width="2.6" stroke-linecap="round"/>';
    });
    return c.d + cloudShape(-6, c.g) + lines;
  }
  function windIcon() {
    return '<path d="M6 18 L30 18 q8 0 8 -6.5 q0 -4.8 -5.4 -4.8" fill="none" stroke="#7FB6C9" stroke-width="3" stroke-linecap="round"/>' +
           '<path d="M10 26 L38 26 q6.8 0 6.8 6 q0 4.4 -4.8 4.4" fill="none" stroke="#9CCBDA" stroke-width="3" stroke-linecap="round"/>' +
           '<path d="M6 34 L22 34" fill="none" stroke="#7FB6C9" stroke-width="3" stroke-linecap="round"/>' +
           '<circle cx="42" cy="10" r="1.6" fill="#9CCBDA"/><circle cx="45" cy="25" r="1.6" fill="#7FB6C9"/>';
  }
  function wave() {
    var g = gid();
    return '<linearGradient id="' + g + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#7FCCF7"/>' +
           '<stop offset="100%" stop-color="#1F6FBF"/></linearGradient>' +
           '<path d="M6 20 q6 -8 12 0 q6 8 12 0 q6 -8 12 0" fill="none" stroke="url(#' + g + ')" stroke-width="3.4" stroke-linecap="round"/>' +
           '<path d="M6 30 q6 -8 12 0 q6 8 12 0 q6 -8 12 0" fill="none" stroke="url(#' + g + ')" stroke-width="3.4" stroke-linecap="round" opacity=".65"/>' +
           '<path d="M6 40 q6 -8 12 0 q6 8 12 0 q6 -8 12 0" fill="none" stroke="url(#' + g + ')" stroke-width="3.4" stroke-linecap="round" opacity=".35"/>';
  }
  function overcast() {
    var c1 = cloudGrad(), g2 = gid();
    return c1.d +
      '<linearGradient id="' + g2 + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#C9D3DD"/>' +
      '<stop offset="100%" stop-color="#9FABB8"/></linearGradient>' +
      '<path d="M10 26 a6 6 0 0 1 -1.2-11.9 a7.6 7.6 0 0 1 14.7-1.8 a5.4 5.4 0 0 1 3.7 10.3 Z" fill="url(#' + g2 + ')" stroke="#8E99A6" stroke-width="1.2"/>' +
      cloudShape(5, c1.g);
  }
  function moonrain() { var c = cloudGrad(); return c.d + moonShape(33, 6, 10) + cloudShape(1, c.g) + drops([[15, 36], [24, 39], [33, 36]]); }
  function rainshowers() {
    var c = cloudGrad(), g = gid(), dr = '';
    dr = '<linearGradient id="' + g + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#8FC7F5"/>' +
         '<stop offset="100%" stop-color="#2F7FD0"/></linearGradient>';
    [[13, 34, 8], [20, 36, 10], [27, 34, 8], [34, 36, 10], [40, 34, 7]].forEach(function (p) {
      dr += '<line x1="' + p[0] + '" y1="' + p[1] + '" x2="' + (p[0] - 2.5) + '" y2="' + (p[1] + p[2]) +
            '" stroke="url(#' + g + ')" stroke-width="2.8" stroke-linecap="round"/>';
    });
    return c.d + cloudShape(-3, c.g) + dr;
  }
  function rainsnow() { var c = cloudGrad(); return c.d + cloudShape(-3, c.g) + drops([[15, 34], [33, 34]]) + flakes([[24, 40]], 0.9); }
  function moonsnow() { var c = cloudGrad(); return c.d + moonShape(33, 6, 10) + cloudShape(1, c.g) + flakes([[16, 39], [25, 42.5], [33, 39]], 1); }
  function hailstones(pts) {
    var g = gid(), out = '<radialGradient id="' + g + '" cx="35%" cy="30%"><stop offset="0%" stop-color="#FFFFFF"/>' +
           '<stop offset="60%" stop-color="#CDE9F8"/><stop offset="100%" stop-color="#8FC3E8"/></radialGradient>';
    pts.forEach(function (p) {
      var x = p[0], y = p[1], r = p[2];
      out += '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="url(#' + g + ')" stroke="#7FB2D9" stroke-width="1"/>' +
             '<circle cx="' + f1(x - r * 0.35) + '" cy="' + f1(y - r * 0.35) + '" r="' + f1(r * 0.28) + '" fill="#FFFFFF" opacity=".9"/>';
    });
    return out;
  }
  function hail() { var c = cloudGrad(); return c.d + cloudShape(-3, c.g) + hailstones([[15, 38, 3.2], [24, 41.5, 3.6], [33, 38, 3.2]]); }
  function thunderhail() {
    var c = cloudGrad();
    return c.d + cloudShape(-4, c.g) +
      boltPath("M20 26 L13.5 36 L17.5 36 L15 44 L24 33.5 L19.8 33.5 L23 26 Z") +
      hailstones([[30, 40, 3], [37.5, 37.5, 2.6]]);
  }
  function wic(inner) { return '<svg class="wic" viewBox="0 0 48 48" fill="none">' + inner + "</svg>"; }
  var icons = {
    sun: wic(sun()), moon: wic(moon()), cloud: wic(cloud()),
    sunCloud: wic(suncloud()), moonCloud: wic(mooncloud()),
    rain: wic(rain()), drizzle: wic(drizzle()), snow: wic(snow()),
    blizzard: wic(blizzard()), thunder: wic(storm()), fog: wic(fog()),
    wind: wic(windIcon()), wave: wic(wave()), overcast: wic(overcast()),
    moonRain: wic(moonrain()), rainShowers: wic(rainshowers()),
    rainSnow: wic(rainsnow()), moonSnow: wic(moonsnow()),
    hail: wic(hail()), thunderHail: wic(thunderhail())
  };

  /* ---------- §6.3: иконки быстрого ряда (колесо / гайка / шлем), мастер 24×24 ---------- */
  function wheel2() {
    var uid = "t299";
    var tread = "", spokes = "";
    for (var a = 0; a < 360; a += 24) {
      tread += '<line x1="' + f1(12 + 9.2 * Math.cos(rad(a))) + '" y1="' + f1(12 + 9.2 * Math.sin(rad(a))) +
               '" x2="' + f1(12 + 11 * Math.cos(rad(a))) + '" y2="' + f1(12 + 11 * Math.sin(rad(a))) +
               '" stroke="#3A3D42" stroke-width="1.7" stroke-linecap="round"/>';
    }
    for (var a2 = 0; a2 < 360; a2 += 72) {
      spokes += '<path d="M12 12 L' + f1(12 + 5.4 * Math.cos(rad(a2 - 14))) + ' ' + f1(12 + 5.4 * Math.sin(rad(a2 - 14))) +
                ' L' + f1(12 + 5.4 * Math.cos(rad(a2 + 14))) + ' ' + f1(12 + 5.4 * Math.sin(rad(a2 + 14))) +
                ' Z" fill="url(#w2m' + uid + ')"/>';
    }
    return '<radialGradient id="w2t' + uid + '" cx="35%" cy="30%"><stop offset="0%" stop-color="#4A4E54"/>' +
           '<stop offset="100%" stop-color="#1C1E22"/></radialGradient>' +
           '<linearGradient id="w2m' + uid + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#F0F2F5"/>' +
           '<stop offset="55%" stop-color="#B9BEC6"/><stop offset="100%" stop-color="#848B94"/></linearGradient>' +
           tread + '<circle cx="12" cy="12" r="8.8" fill="url(#w2t' + uid + ')"/>' +
           '<circle cx="12" cy="12" r="6.1" fill="url(#w2m' + uid + ')"/>' +
           '<circle cx="12" cy="12" r="4.9" fill="#2E3238"/>' +
           '<g>' + spokes + '</g>' +
           '<circle cx="12" cy="12" r="1.7" fill="url(#w2m' + uid + ')"/>' +
           '<circle cx="12" cy="12" r="0.7" fill="#5A616A"/>' +
           '<path d="M16.2 7.4 a6.4 6.4 0 0 1 1.4 3.2" fill="none" stroke="#E04556" stroke-width="1.5" stroke-linecap="round"/>';
  }
  function nut2() {
    var uid = "t299";
    return '<linearGradient id="n2' + uid + '" x1="0" y1="0" x2="1" y2="1">' +
           '<stop offset="0%" stop-color="#F4F6F9"/><stop offset="45%" stop-color="#AEB4BD"/>' +
           '<stop offset="70%" stop-color="#DEE2E8"/><stop offset="100%" stop-color="#7C838D"/></linearGradient>' +
           '<path d="M12 3.2 L19.6 7.6 L19.6 16.4 L12 20.8 L4.4 16.4 L4.4 7.6 Z" fill="url(#n2' + uid + ')"/>' +
           '<path d="M12 3.2 L19.6 7.6 L12 11.9 L4.4 7.6 Z" fill="#FFFFFF" opacity=".35"/>' +
           '<circle cx="12" cy="12" r="3.9" fill="#22252A"/>' +
           '<circle cx="12" cy="12" r="3.9" fill="none" stroke="#0E1013" stroke-width=".8"/>' +
           '<circle cx="12" cy="12" r="2.6" fill="none" stroke="#3A3E45" stroke-width=".7"/>' +
           '<path d="M5.6 8.2 L12 4.5 L18.4 8.2" fill="none" stroke="#FFFFFF" stroke-width="1" opacity=".7" stroke-linecap="round"/>' +
           '<circle cx="12" cy="12" r="1" fill="#E04556"/>';
  }
  function helmet2() {
    var uid = "t299";
    return '<linearGradient id="h2s' + uid + '" x1="0" y1="0" x2="0" y2="1">' +
           '<stop offset="0%" stop-color="#FFFFFF"/><stop offset="100%" stop-color="#C9CDD4"/></linearGradient>' +
           '<linearGradient id="h2v' + uid + '" x1="0" y1="0" x2="1" y2="1">' +
           '<stop offset="0%" stop-color="#3A4150"/><stop offset="100%" stop-color="#0D1015"/></linearGradient>' +
           '<path d="M3.2 14 C3.2 6.8 7.6 3.2 12 3.2 C16.4 3.2 20.8 6.8 20.8 14 L20.8 15.6 L3.2 15.6 Z" fill="url(#h2s' + uid + ')"/>' +
           '<path d="M3.2 14 C3.2 6.8 7.6 3.2 12 3.2 C13.2 3.2 14.4 3.5 15.5 4 ' +
           'C11 5.4 8.6 8.4 8.2 12.6 L3.2 13.4 Z" fill="#2F6FBF" opacity=".9"/>' +
           '<path d="M15.5 4 C17.8 5 19.8 7.4 20.5 10.6 L17.4 11.4 C16.9 8.6 16 6 15.5 4 Z" fill="#E04556" opacity=".9"/>' +
           '<path d="M12.8 10.2 L20.2 10.2 L20.2 15 L12.8 15 Q11.6 12.6 12.8 10.2 Z" fill="url(#h2v' + uid + ')"/>' +
           '<path d="M13.6 11.4 L17.4 11.4" stroke="#8FA3BC" stroke-width="1" stroke-linecap="round" opacity=".8"/>' +
           '<path d="M3.2 15.6 L20.8 15.6 L20.8 17.6 Q12 20 3.2 17.6 Z" fill="#B9BEC6"/>' +
           '<path d="M3.2 15.6 L20.8 15.6" stroke="#9AA0A8" stroke-width=".6"/>';
  }
  icons["qa-search"] = '<svg viewBox="0 0 24 24" fill="none">' + wheel2() + "</svg>";
  icons["qa-add"] = '<svg viewBox="0 0 24 24" fill="none">' + nut2() + "</svg>";
  icons["qa-skin"] = '<svg viewBox="0 0 24 24" fill="none">' + helmet2() + "</svg>";

  /* ---------- §5: temp_color (порт 1:1, округление как в python) + формат «+27°» ---------- */
  function pyRound(x) {
    var fl = Math.floor(x), d = x - fl;
    if (d < 0.5) return fl;
    if (d > 0.5) return fl + 1;
    return fl % 2 === 0 ? fl : fl + 1;
  }
  function lerp(c1, c2, k) {
    var out = "#";
    for (var i = 1; i <= 5; i += 2) {
      var a = parseInt(c1.substr(i, 2), 16), b = parseInt(c2.substr(i, 2), 16);
      out += ("0" + pyRound(a + (b - a) * k).toString(16)).slice(-2);
    }
    return out;
  }
  function tempColor(t, dark) {
    if (t > 0) {
      var k = Math.min(t / 50, 1);
      return dark ? lerp("#F2BCA8", "#FF5A6E", k) : lerp("#E2704B", "#7A0E2B", k);
    }
    if (t < 0) {
      var k2 = Math.min(-t / 50, 1);
      return dark ? lerp("#CFE9F8", "#6FA8F5", k2) : lerp("#5BA8E0", "#16338C", k2);
    }
    return dark ? "#CFE9F8" : "#6FB9E8";
  }
  function tempText(t) {
    if (t > 0) return "+" + t + "°";
    if (t < 0) return "−" + Math.abs(t) + "°"; // типографский минус
    return "0°";
  }

  /* ---------- §2: 16 цветовых ролей → токены приложения ---------- */
  var tokens = {
    dark: {
      "--bg": "#0B0C0E", "--bg2": "#242529", "--card": "#1C1D21", "--card2": "#242529",
      "--line": "rgba(242,243,245,.12)", "--text": "#F2F3F5", "--text2": "#E6E8EB", "--muted": "#9AA0A8",
      "--accent": "#FF4457", "--on-accent": "#FFFFFF", "--on-accent2": "#FFFFFF",
      "--green": "#4FB573", "--yellow": "#D4AC3A", "--red": "#FF6B72", "--blue": "#4E9BE6",
      "--tmax": "#FF5A6E", "--tmin": "#6FA8F5", "--prc": "#9AA0A8", "--star": "#FF4650",
      "--head": "rgba(11,12,14,.92)", "--overlay": "rgba(0,0,0,.6)",
      "--accent-soft": "rgba(255,68,87,.14)", "--accent-glow": "rgba(255,68,87,.18)",
      "--green-bg": "rgba(79,181,115,.14)", "--yellow-bg": "rgba(212,172,58,.14)",
      "--red-bg": "#3A1E22", "--red-soft": "rgba(255,107,114,.12)",
      "--shadow": "rgba(0,0,0,.45)", "--shadow2": "rgba(0,0,0,.35)",
      "--card-sh": "0 12px 28px rgba(0,0,0,.45)",
      "--hero-sk0": "#0B0C0E", "--hero-sk1": "#0B0C0E", "--hero-mt1": "#0B0C0E", "--hero-mt2": "#0B0C0E", "--hero-mt3": "#0B0C0E",
      "--hero-snow": "#F2F3F5", "--hero-moon": "#F2F3F5", "--hero-sun": "#F2F3F5",
      "--hero-sub": "#9AA0A8", "--hero-shadow": "rgba(0,0,0,0)", "--hero-globe-shadow": "rgba(0,0,0,0)",
      "--hi-border": "rgba(242,243,245,.12)", "--hi-color": "#9AA0A8", "--hi-bg": "#242529", "--hi-glow": "rgba(0,0,0,0)",
      "--info-border": "#9AA0A8", "--info-color": "#9AA0A8",
      "--i-sun": "#FFC94D", "--i-moon": "#F6E7B6", "--i-cloud": "#D8E4EE", "--i-fog": "#A9B6C2",
      "--i-rain": "#8FC7F5", "--i-drz": "#8FC7F5", "--i-snow": "#A9D8F5", "--i-bolt": "#FFE066", "--i-wind": "#9CCBDA",
      "--r-lg": "20px", "--r-md": "16px", "--r-sm": "13px"
    },
    light: {
      "--bg": "#E9E7E1", "--bg2": "#FAF8F4", "--card": "#F5F3EE", "--card2": "#FAF8F4",
      "--line": "rgba(35,38,43,.12)", "--text": "#23262B", "--text2": "#3A3E45", "--muted": "#71767D",
      "--accent": "#E04556", "--on-accent": "#FFFFFF", "--on-accent2": "#FFFFFF",
      "--green": "#3E9B5F", "--yellow": "#C99020", "--red": "#D0454A", "--blue": "#3E8FE0",
      "--tmax": "#7A0E2B", "--tmin": "#16338C", "--prc": "#71767D", "--star": "#FF4650",
      "--head": "rgba(233,231,225,.92)", "--overlay": "rgba(35,38,43,.45)",
      "--accent-soft": "rgba(224,69,86,.12)", "--accent-glow": "rgba(224,69,86,.16)",
      "--green-bg": "rgba(62,155,95,.12)", "--yellow-bg": "rgba(201,144,32,.12)",
      "--red-bg": "#FBE9EA", "--red-soft": "rgba(208,69,74,.10)",
      "--shadow": "rgba(35,38,43,.08)", "--shadow2": "rgba(35,38,43,.06)",
      "--card-sh": "0 10px 26px rgba(35,38,43,.08)",
      "--hero-sk0": "#E9E7E1", "--hero-sk1": "#E9E7E1", "--hero-mt1": "#E9E7E1", "--hero-mt2": "#E9E7E1", "--hero-mt3": "#E9E7E1",
      "--hero-snow": "#23262B", "--hero-moon": "#23262B", "--hero-sun": "#23262B",
      "--hero-sub": "#71767D", "--hero-shadow": "rgba(0,0,0,0)", "--hero-globe-shadow": "rgba(0,0,0,0)",
      "--hi-border": "rgba(35,38,43,.12)", "--hi-color": "#71767D", "--hi-bg": "#FAF8F4", "--hi-glow": "rgba(0,0,0,0)",
      "--info-border": "#71767D", "--info-color": "#71767D",
      "--i-sun": "#FFC94D", "--i-moon": "#F6E7B6", "--i-cloud": "#D8E4EE", "--i-fog": "#A9B6C2",
      "--i-rain": "#8FC7F5", "--i-drz": "#8FC7F5", "--i-snow": "#A9D8F5", "--i-bolt": "#FFE066", "--i-wind": "#9CCBDA",
      "--r-lg": "20px", "--r-md": "16px", "--r-sm": "13px"
    }
  };

  /* ---------- §3: арт шапки + тап-зоны; §6: полоски/рамки; типографика; донат ---------- */
  var RED_L = "#E04556", RED_D = "#FF4457", BLUE_L = "#3E8FE0", BLUE_D = "#4E9BE6", W = "#FFFFFF";
  function tri(c1, c2, c3) { return "linear-gradient(90deg," + c1 + " 0%," + c2 + " 50%," + c3 + " 100%)"; }

  var css = [
    '@font-face { font-family: "Nunito"; src: url("skins/tema299/assets/Nunito-400.ttf") format("truetype"); font-weight: 400; font-display: swap; }',
    '@font-face { font-family: "Nunito"; src: url("skins/tema299/assets/Nunito-700.ttf") format("truetype"); font-weight: 700; font-display: swap; }',
    '@font-face { font-family: "Nunito"; src: url("skins/tema299/assets/Nunito-800.ttf") format("truetype"); font-weight: 800; font-display: swap; }',
    '[data-skin="tema299"] body { font-family: "Nunito", system-ui, sans-serif; }',
    /* ---- §3: шапка Э-1 — арт 130px, вуаль в фон, контент с 104px ---- */
    '[data-skin="tema299"] .hero { height: 104px; overflow: visible; border-radius: 0; }',
    '[data-skin="tema299"] .hero-mountains, [data-skin="tema299"] .hero-text, [data-skin="tema299"] .hero-info, [data-skin="tema299"] .theme-toggle { display: none; }',
    '[data-skin="tema299"] #t299-art { position: absolute; top: 0; left: 0; right: 0; height: 130px; background-size: cover; background-position: center 32%; transition: opacity .12s ease; }',
    '[data-skin="tema299"] #t299-art.t299-press { opacity: .6; }',
    '[data-skin="tema299"] .t299-veil { position: absolute; left: 0; right: 0; bottom: 0; height: 62%; background: linear-gradient(180deg, transparent 40%, var(--bg) 100%); pointer-events: none; }',
    '[data-skin="tema299"] .t299-zone { position: absolute; cursor: pointer; -webkit-tap-highlight-color: transparent; }',
    /* мотоциклист: центральные ~50% арта — переключение темы */
    '[data-skin="tema299"] .t299-z-moto { left: 22%; width: 56%; top: 0; height: 100%; }',
    /* день: знак 299 в руке — «О проекте» */
    '[data-skin="tema299"] .t299-z-299 { left: 36%; width: 22%; top: 0; height: 34%; }',
    '[data-skin="tema299"][data-theme="dark"] .t299-z-299 { display: none; }',
    /* ночь: неон @tema.polyana — Instagram; красная «i» — «О проекте» */
    '[data-skin="tema299"] .t299-z-ig { left: 62%; width: 34%; top: 26%; height: 36%; }',
    '[data-skin="tema299"] .t299-z-i { left: 8%; width: 18%; top: 6%; height: 42%; }',
    '[data-skin="tema299"][data-theme="light"] .t299-z-ig, [data-skin="tema299"][data-theme="light"] .t299-z-i { display: none; }',
    /* ---- §6.2: quick row — градиентные рамки (double-background), непрозрачная сердцевина ---- */
    '[data-skin="tema299"] .top-actions { gap: 10px; margin: 2px 0 4px; }',
    '[data-skin="tema299"] .top-actions .ha-btn { height: 40px; border-radius: 13px; border: 1.5px solid transparent; color: var(--text); font-size: 13.5px; font-weight: 800; gap: 6px; font-family: "Nunito", system-ui, sans-serif; box-shadow: 0 0 12px rgba(78,155,230,.28), 0 0 12px rgba(255,70,80,.22), inset 0 0 5px rgba(255,255,255,.06); }',
    '[data-skin="tema299"][data-theme="light"] .top-actions .ha-btn { background: linear-gradient(#FBFAF7, #FBFAF7) padding-box, ' + tri(BLUE_L, W, RED_L) + ' border-box; }',
    '[data-skin="tema299"][data-theme="dark"] .top-actions .ha-btn { background: linear-gradient(#17191E, #17191E) padding-box, ' + tri(BLUE_D, W, RED_D) + ' border-box; }',
    '[data-skin="tema299"] .top-actions .ha-btn:nth-child(1) { }',
    '[data-skin="tema299"][data-theme="light"] .top-actions .ha-btn:nth-child(2) { background: linear-gradient(#FBFAF7, #FBFAF7) padding-box, ' + tri(W, RED_L, BLUE_L) + ' border-box; }',
    '[data-skin="tema299"][data-theme="dark"] .top-actions .ha-btn:nth-child(2) { background: linear-gradient(#17191E, #17191E) padding-box, ' + tri(W, RED_D, BLUE_D) + ' border-box; }',
    '[data-skin="tema299"][data-theme="light"] .top-actions .ha-btn:nth-child(3) { background: linear-gradient(#FBFAF7, #FBFAF7) padding-box, ' + tri(RED_L, BLUE_L, W) + ' border-box; }',
    '[data-skin="tema299"][data-theme="dark"] .top-actions .ha-btn:nth-child(3) { background: linear-gradient(#17191E, #17191E) padding-box, ' + tri(RED_D, BLUE_D, W) + ' border-box; }',
    '[data-skin="tema299"] .top-actions .ha-btn:active { opacity: .6; transition: opacity .12s; }',
    '[data-skin="tema299"] .top-actions .sic { width: 19px; height: 19px; }',
    '[data-skin="tema299"] .top-actions .sic svg { width: 100%; height: 100%; display: block; }',
    /* ---- §6.1: трёхцветные полоски 2.5px над виджетами (порядки по росписи) ---- */
    '[data-skin="tema299"] .point-btn::before, [data-skin="tema299"] #point-content .card::before, [data-skin="tema299"] .hours-strip::before { content: ""; position: absolute; top: 0; left: 0; right: 0; height: 2.5px; border-radius: 2px 2px 0 0; opacity: .9; pointer-events: none; }',
    '[data-skin="tema299"] #point-content .card { position: relative; }',
    /* Э-1: карточка 1 r→w→b, карточка 2 b→w→r */
    '[data-skin="tema299"][data-theme="light"] .point-btn:nth-of-type(odd)::before { background: ' + tri(RED_L, W, BLUE_L) + '; }',
    '[data-skin="tema299"][data-theme="light"] .point-btn:nth-of-type(even)::before { background: ' + tri(BLUE_L, W, RED_L) + '; }',
    '[data-skin="tema299"][data-theme="dark"] .point-btn:nth-of-type(odd)::before { background: ' + tri(RED_D, W, BLUE_D) + '; }',
    '[data-skin="tema299"][data-theme="dark"] .point-btn:nth-of-type(even)::before { background: ' + tri(BLUE_D, W, RED_D) + '; }',
    /* «Сейчас» w→b→r; неделя w→r→b; часы b→r→w */
    '[data-skin="tema299"][data-theme="light"] #point-content .card:has(.now-main)::before { background: ' + tri(W, BLUE_L, RED_L) + '; }',
    '[data-skin="tema299"][data-theme="dark"] #point-content .card:has(.now-main)::before { background: ' + tri(W, BLUE_D, RED_D) + '; }',
    '[data-skin="tema299"][data-theme="light"] #point-content .card:has(.day-block)::before { background: ' + tri(W, RED_L, BLUE_L) + '; }',
    '[data-skin="tema299"][data-theme="dark"] #point-content .card:has(.day-block)::before { background: ' + tri(W, RED_D, BLUE_D) + '; }',
    '[data-skin="tema299"][data-theme="light"] .hours-strip::before { background: ' + tri(BLUE_L, RED_L, W) + '; }',
    '[data-skin="tema299"][data-theme="dark"] .hours-strip::before { background: ' + tri(BLUE_D, RED_D, W) + '; }',
    /* ---- карточки без обводок, тени; общая форма ---- */
    '[data-skin="tema299"] .point-btn, [data-skin="tema299"] .card, [data-skin="tema299"] .donate-panel, [data-skin="tema299"] .community-panel { border: none; box-shadow: var(--card-sh); border-radius: 20px; }',
    '[data-skin="tema299"] .point-btn:active { opacity: .7; transition: opacity .12s; }',
    /* ---- §4/§7: типографика и размеры иконок ---- */
    '[data-skin="tema299"] .now-t { font-size: 44px; font-weight: 800; }',
    '[data-skin="tema299"] .now-icon .wic { width: 56px; height: 56px; }',
    '[data-skin="tema299"] .h-icon .wic { width: 26px; height: 26px; }',
    '[data-skin="tema299"] .day-icon .wic, [data-skin="tema299"] .dp-ico .wic { width: 28px; height: 28px; }',
    '[data-skin="tema299"] .d-right .wic { width: 20px; height: 20px; }',
    '[data-skin="tema299"] .pt-title { font-size: 16px; font-weight: 800; }',
    /* ---- Э-1 карточки избранного: температура 19px/800 справа + иконка 34px (К-04/§7) ---- */
    '[data-skin="tema299"] .point-btn { padding-right: 64px; min-height: 104px; }',
    '[data-skin="tema299"] .p-name { font-size: 13px; font-weight: 800; }',
    '[data-skin="tema299"] .p-wicon { display: block; position: absolute; right: 12px; top: 14px; }',
    '[data-skin="tema299"] .p-wicon svg { width: 34px; height: 34px; }',
    '[data-skin="tema299"] .p-temp { position: absolute; right: 12px; top: 52px; font-size: 19px; font-weight: 800; }',
    '[data-skin="tema299"] .point-btn .p-temp::before { content: none; }',
    /* ---- §6.4 (Д-Р2): донат — белая кнопка, голубой неон, обе темы ---- */
    '[data-skin="tema299"] .dp-go, [data-skin="tema299"] .dp-sbp { background: #FFFFFF; color: #23262B; border: 1.5px solid rgba(94,177,255,.85); box-shadow: 0 0 16px rgba(94,177,255,.5), 0 0 4px rgba(94,177,255,.35); border-radius: 13px; font-weight: 800; }',
    /* ---- мелкая стилизация общих элементов ---- */
    '[data-skin="tema299"] .home-updated { font-weight: 700; }',
    '[data-skin="tema299"] .ha-hint, [data-skin="tema299"] .d-date, [data-skin="tema299"] .h-time { font-weight: 700; }',
    '[data-skin="tema299"] .h-mid { border-radius: 13px; }',
    '[data-skin="tema299"] .fb-input { border-radius: 13px; }'
  ].join("\n");

  /* ---------- §3: монтаж арта и тап-зон (в onApply, т.к. тема уже применена) ---------- */
  var IG_URL = "https://www.instagram.com/tema.polyana?stkn=MW5uNTRkOTk1cW1vdQ==";
  function mountArt() {
    var hero = document.querySelector(".hero");
    if (!hero) return;
    var dark = document.documentElement.dataset.theme === "dark";
    var art = document.getElementById("t299-art");
    if (!art) {
      art = document.createElement("div");
      art.id = "t299-art";
      art.innerHTML = '<div class="t299-veil"></div>' +
        '<div class="t299-zone t299-z-moto" role="button" aria-label="Сменить тему" title=""></div>' +
        '<div class="t299-zone t299-z-299" role="button" aria-label="О проекте" title=""></div>' +
        '<div class="t299-zone t299-z-ig" role="button" aria-label="Instagram Тёмы" title=""></div>' +
        '<div class="t299-zone t299-z-i" role="button" aria-label="О проекте" title=""></div>';
      hero.appendChild(art);
      /* pressed-состояние: opacity .6 на 120мс */
      art.addEventListener("pointerdown", function () {
        art.classList.add("t299-press");
        setTimeout(function () { art.classList.remove("t299-press"); }, 120);
      });
      art.querySelector(".t299-z-moto").addEventListener("click", function () { toggleTheme(); });
      art.querySelector(".t299-z-299").addEventListener("click", function () { openAbout(); });
      art.querySelector(".t299-z-i").addEventListener("click", function () { openAbout(); });
      art.querySelector(".t299-z-ig").addEventListener("click", function () {
        window.open(IG_URL, "_blank", "noopener");
      });
    }
    art.style.backgroundImage = "url(skins/tema299/assets/header-" + (dark ? "night" : "day") + ".jpg)";
  }
  function onApply() { mountArt(); }
  function onRemove() {
    var art = document.getElementById("t299-art");
    if (art) art.remove();
  }

  window.KP_SKINS.tema299 = {
    id: "tema299",
    name: "Тёма 299",
    author: "Тёма",
    tokens: tokens,
    icons: icons,
    css: css,
    tempColor: tempColor, // Д-Р1: общий слой tempInner подхватывает шкалу
    tempText: tempText,   // формат «+27°» / «−12°»
    onApply: onApply,
    onRemove: onRemove
  };
})();
