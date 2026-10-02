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

  /* ---------- v3.27 §2.8: НОВАЯ шкала (отменяет Д-Р1 ±50): насыщенность 0…±30 ----------
     ≥+30 — один насыщенный красный; к 0 красный светлеет (+1 по яркости = прежнему +7);
     0 — лёгкий голубой (как прежний −7); к −30 синий темнеет; ≤−30 — один тёмно-синий.
     Якоря +1/−1 посчитаны pyRound-точно по прежней шкале. */
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
    var P30 = dark ? "#FF4757" : "#C81E3E";
    var P1 = dark ? "#F4AEA0" : "#D36247";
    var N0 = dark ? "#C2EBF8" : "#5198D4";
    var N30 = dark ? "#4664B8" : "#16338C";
    if (t > 0) {
      if (t >= 30) return P30;
      if (t < 1) return P1;
      return lerp(P1, P30, (t - 1) / 29);
    }
    if (t < 0) {
      if (t <= -30) return N30;
      return lerp(N30, N0, (t + 30) / 29);
    }
    return N0;
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
  /* Фирменный градиент проекта v3.27: фиолетовый → синий → белый → красный, плавно */
  var BRAND = "linear-gradient(90deg,#B45CF0 0%,#8B5CF6 15%,#6366F1 30%,#3B82F6 44%,#93C5FD 52%,#FFFFFF 60%,#FBCFE8 68%,#F472B6 76%,#EF4444 87%,#DC2650 100%)";
  var BRAND_REV = "linear-gradient(90deg,#DC2650 0%,#EF4444 13%,#F472B6 24%,#FBCFE8 32%,#FFFFFF 40%,#93C5FD 48%,#3B82F6 56%,#6366F1 70%,#8B5CF6 85%,#B45CF0 100%)";
  var BRAND_DIAG = "linear-gradient(135deg,#B45CF0 0%,#8B5CF6 15%,#6366F1 30%,#3B82F6 44%,#93C5FD 52%,#FFFFFF 60%,#FBCFE8 68%,#F472B6 76%,#EF4444 87%,#DC2650 100%)";

  var css = [
    '@font-face { font-family: "Nunito"; src: url("skins/tema299/assets/Nunito-400.ttf") format("truetype"); font-weight: 400; font-display: swap; }',
    '@font-face { font-family: "Nunito"; src: url("skins/tema299/assets/Nunito-700.ttf") format("truetype"); font-weight: 700; font-display: swap; }',
    '@font-face { font-family: "Nunito"; src: url("skins/tema299/assets/Nunito-800.ttf") format("truetype"); font-weight: 800; font-display: swap; }',
    '[data-skin="tema299"] body { font-family: "Nunito", system-ui, sans-serif; }',
    /* ---- §3: шапка Э-1 — арт ЦЕЛИКОМ (aspect-ratio арта 1170×539: знак 299 с зазором
       сверху, ноги и мотоцикл снизу, без обрезов), скругление как у base, высота единая в обеих темах ---- */
    '[data-skin="tema299"] .hero { height: auto; aspect-ratio: 1170 / 539; overflow: hidden; border-radius: 0 0 var(--r-hero) var(--r-hero); }',
    '[data-skin="tema299"] .hero-mountains, [data-skin="tema299"] .hero-text, [data-skin="tema299"] .hero-info, [data-skin="tema299"] .theme-toggle { display: none; }',
    '[data-skin="tema299"] #t299-art { position: absolute; top: 0; left: 0; right: 0; height: 100%; background-size: cover; background-position: center; transition: opacity .12s ease; }',
    '[data-skin="tema299"] #t299-art.t299-press { opacity: .6; }',
    '[data-skin="tema299"] .t299-veil { position: absolute; left: 0; right: 0; bottom: 0; height: 42%; background: linear-gradient(180deg, transparent 30%, var(--bg) 96%); pointer-events: none; }',
    '[data-skin="tema299"] .t299-zone { position: absolute; cursor: pointer; -webkit-tap-highlight-color: transparent; }',
    /* мотоциклист: центральные ~56% арта — переключение темы */
    '[data-skin="tema299"] .t299-z-moto { left: 22%; width: 56%; top: 0; height: 100%; }',
    /* день: знак 299 в руке (x 41–52%, y 6–30% арта) — «О проекте» */
    '[data-skin="tema299"] .t299-z-299 { left: 37%; width: 17%; top: 2%; height: 32%; }',
    '[data-skin="tema299"][data-theme="dark"] .t299-z-299 { display: none; }',
    /* ночь: неон @tema.polyana (x 72–91%, y 38–46% арта) — Instagram. Круглой кнопки «i» в ночном арте НЕТ (v3.27, вопрос закрыт владельцем) */
    '[data-skin="tema299"] .t299-z-ig { left: 68%; width: 25%; top: 33%; height: 28%; }',
    /* ---- §6.2: quick row — рамки фирменным градиентом (3 направления), непрозрачная сердцевина ---- */
    '[data-skin="tema299"] .top-actions { gap: 10px; margin: 2px 0 4px; }',
    '[data-skin="tema299"] .top-actions .ha-btn { height: 40px; border-radius: 13px; border: 1.5px solid transparent; color: var(--text); font-size: 13.5px; font-weight: 800; gap: 6px; font-family: "Nunito", system-ui, sans-serif; box-shadow: 0 0 12px rgba(139,92,246,.22), 0 0 12px rgba(239,68,68,.18), inset 0 0 5px rgba(255,255,255,.06); }',
    '[data-skin="tema299"][data-theme="light"] .top-actions .ha-btn { background: linear-gradient(#FBFAF7, #FBFAF7) padding-box, ' + BRAND + ' border-box; }',
    '[data-skin="tema299"][data-theme="dark"] .top-actions .ha-btn { background: linear-gradient(#17191E, #17191E) padding-box, ' + BRAND + ' border-box; }',
    '[data-skin="tema299"][data-theme="light"] .top-actions .ha-btn:nth-child(2) { background: linear-gradient(#FBFAF7, #FBFAF7) padding-box, ' + BRAND_REV + ' border-box; }',
    '[data-skin="tema299"][data-theme="dark"] .top-actions .ha-btn:nth-child(2) { background: linear-gradient(#17191E, #17191E) padding-box, ' + BRAND_REV + ' border-box; }',
    '[data-skin="tema299"][data-theme="light"] .top-actions .ha-btn:nth-child(3) { background: linear-gradient(#FBFAF7, #FBFAF7) padding-box, ' + BRAND_DIAG + ' border-box; }',
    '[data-skin="tema299"][data-theme="dark"] .top-actions .ha-btn:nth-child(3) { background: linear-gradient(#17191E, #17191E) padding-box, ' + BRAND_DIAG + ' border-box; }',
    '[data-skin="tema299"] .top-actions .ha-btn:active { opacity: .6; transition: opacity .12s; }',
    '[data-skin="tema299"] .top-actions .sic { width: 19px; height: 19px; }',
    '[data-skin="tema299"] .top-actions .sic svg { width: 100%; height: 100%; display: block; }',
    /* ---- §6.1: тонкая элегантная линия на верхней кромке виджета (эталон формы —
       design-minimalism/Образец-полоски.jpg): линия растворяется вниз, карточка продолжает её;
       цвета — фирменный градиент, направления перетасованы: odd → / even ←, «Сейчас» →, неделя ← ---- */
    '[data-skin="tema299"] .point-btn::before, [data-skin="tema299"] #point-content .card::before { content: ""; position: absolute; top: -1px; left: 10px; right: 10px; height: 6px; border-radius: 6px; background: ' + BRAND + '; opacity: .95; pointer-events: none; box-shadow: 0 0 10px 2px rgba(139,92,246,.28), 0 0 14px 2px rgba(239,68,68,.22); -webkit-mask-image: linear-gradient(180deg, transparent 0%, #000 38%, #000 55%, transparent 100%); mask-image: linear-gradient(180deg, transparent 0%, #000 38%, #000 55%, transparent 100%); }',
    '[data-skin="tema299"] #point-content .card { position: relative; }',
    '[data-skin="tema299"] .point-btn:nth-of-type(odd)::before { background: ' + BRAND + '; }',
    '[data-skin="tema299"] .point-btn:nth-of-type(even)::before { background: ' + BRAND_REV + '; }',
    '[data-skin="tema299"] #point-content .card:has(.now-main)::before { background: ' + BRAND + '; }',
    '[data-skin="tema299"] #point-content .card:has(.day-block)::before { background: ' + BRAND_REV + '; }',
    /* почасовой прогноз внутри дня: градиентной линии сверху НЕТ (v3.27 §2.9) */
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
    /* ---- Э-1 карточки избранного: единый лейаут — температура 19px/800 сверху справа,
       под ней иконка 34px (§7); порядок как в эталоне minimalism ---- */
    '[data-skin="tema299"] .point-btn { padding-right: 64px; min-height: 104px; }',
    '[data-skin="tema299"] .p-name { font-size: 13px; font-weight: 800; }',
    '[data-skin="tema299"] .p-temp { right: 12px; top: 12px; font-size: 19px; font-weight: 800; }',
    '[data-skin="tema299"] .p-wicon { display: block; position: absolute; right: 12px; top: 46px; width: 34px; height: 34px; }',
    '[data-skin="tema299"] .p-wicon svg { width: 100%; height: 100%; }',
    /* ---- v3.27 §2.6: порядок «название → регион → метры»; карточки без метров — без пустой строчки ---- */
    '[data-skin="tema299"] .point-btn .p-region { order: 2; }',
    '[data-skin="tema299"] .point-btn .p-ele { order: 3; display: flex; flex-direction: column; align-items: flex-start; }',
    /* ---- v3.28 §3.5: «Поддержать проект» и «Написать автору» — НЕ белые, без голубого неона:
       спокойная заливка в тон темы + фирменная радужная рамка ---- */
    '[data-skin="tema299"] .dp-go, [data-skin="tema299"] .community-panel { border: 1.5px solid transparent; border-radius: 13px; font-weight: 800; background: linear-gradient(#EDEAE3, #EDEAE3) padding-box, ' + BRAND + ' border-box; color: #3A3E45; }',
    '[data-skin="tema299"][data-theme="dark"] .dp-go, [data-skin="tema299"][data-theme="dark"] .community-panel { background: linear-gradient(#232529, #232529) padding-box, ' + BRAND + ' border-box; color: #E6E8EB; }',
    '[data-skin="tema299"] .dp-sbp, [data-skin="tema299"] .fb-go { border: 1.5px solid transparent; border-radius: 13px; font-weight: 800; }',
    '[data-skin="tema299"][data-theme="light"] .dp-sbp, [data-skin="tema299"][data-theme="light"] .fb-go { background: linear-gradient(#EDEAE3, #EDEAE3) padding-box, ' + BRAND + ' border-box; color: #3A3E45; }',
    '[data-skin="tema299"][data-theme="dark"] .dp-sbp, [data-skin="tema299"][data-theme="dark"] .fb-go { background: linear-gradient(#232529, #232529) padding-box, ' + BRAND + ' border-box; color: #E6E8EB; }',
    /* ---- v3.27 §2.9: рамка выбранного часа — нежная градиентная, приглушённая ---- */
    '[data-skin="tema299"] .h-mid { border: 1.5px solid transparent; border-radius: 13px; opacity: .38; background: linear-gradient(rgba(0,0,0,0), rgba(0,0,0,0)) padding-box, ' + BRAND + ' border-box; }',
    /* ---- v3.27 §2.5: цветовая дисциплина — красный только в фирменных градиентах ---- */
    '[data-skin="tema299"] .back-btn { color: var(--muted); }',
    '[data-skin="tema299"][data-theme="light"] .point-btn .p-ele, [data-skin="tema299"][data-theme="light"] .pt-globe { color: #6E93BD; }',
    '[data-skin="tema299"][data-theme="dark"] .point-btn .p-ele, [data-skin="tema299"][data-theme="dark"] .pt-globe { color: #7FA3CF; }',
    '[data-skin="tema299"] .h-cell.now .h-time { color: var(--text2); }',
    '[data-skin="tema299"] .link-btn { color: var(--text); }',
    '[data-skin="tema299"] .fb-modal a, [data-skin="tema299"] #consent-banner a, [data-skin="tema299"] .sk-consent a { color: var(--muted); }',
    '[data-skin="tema299"] .err-retry, [data-skin="tema299"] .edit-done { background: var(--bg2); color: var(--text); border: 1px solid var(--line); }',
    '[data-skin="tema299"] .cb-yes { background: var(--bg2); color: var(--text); border: 1px solid var(--line); }',
    '[data-skin="tema299"] .dp-thanks { color: var(--text); }',
    '[data-skin="tema299"] .foot-link:active { color: var(--muted); }',
    /* ---- мелкая стилизация общих элементов ---- */
    '[data-skin="tema299"] .ha-hint, [data-skin="tema299"] .d-date, [data-skin="tema299"] .h-time { font-weight: 700; }',
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
        '<div class="t299-zone t299-z-ig" role="button" aria-label="Instagram Тёмы" title=""></div>';
      hero.appendChild(art);
      /* pressed-состояние: opacity .6 на 120мс */
      art.addEventListener("pointerdown", function () {
        art.classList.add("t299-press");
        setTimeout(function () { art.classList.remove("t299-press"); }, 120);
      });
      art.querySelector(".t299-z-moto").addEventListener("click", function () { toggleTheme(); });
      art.querySelector(".t299-z-299").addEventListener("click", function () { openAbout(); });
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
