/* Движок сводки погоды — клиентская версия (без сервера).
   Источники: Open-Meteo (best_match), Open-Meteo (ECMWF/GFS/ICON), MET Norway.
   Все API открыты для CORS и не требуют ключей. Кэш — localStorage, 30 мин. */

const CACHE_TTL_MS = 30 * 60 * 1000;
const THUNDER = new Set([95, 96, 99]);
const MSK_OFFSET_MS = 3 * 3600 * 1000; // МСК = UTC+3 круглый год

function mskNow() { return new Date(Date.now() + MSK_OFFSET_MS); }
function mskToday() { return mskNow().toISOString().slice(0, 10); }
function mskNowIso() { return mskNow().toISOString().slice(0, 19); }

async function fetchJson(url, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}

/* ---------- источники ---------- */

function omParams(p, extra) {
  const q = new URLSearchParams({
    latitude: p.lat, longitude: p.lon, elevation: p.ele,
    timezone: "Europe/Moscow", forecast_days: 6, wind_speed_unit: "ms",
    ...extra,
  });
  return "https://api.open-meteo.com/v1/forecast?" + q.toString();
}

function fetchOpenMeteo(p) {
  return fetchJson(omParams(p, {
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_gusts_10m",
    hourly: "temperature_2m,precipitation,weather_code,cloud_cover,wind_speed_10m,relative_humidity_2m",
    daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code,wind_speed_10m_max,cloud_cover_mean",
  }));
}

function fetchOpenMeteoModels(p) {
  return fetchJson(omParams(p, {
    daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code,wind_speed_10m_max,cloud_cover_mean",
    models: "ecmwf_ifs025,gfs_global,icon_eu",
  }));
}

function fetchMetNo(p) {
  const q = new URLSearchParams({ lat: p.lat, lon: p.lon, altitude: Math.round(p.ele) });
  return fetchJson("https://api.met.no/weatherapi/locationforecast/2.0/compact?" + q.toString());
}

/* Суточные агрегаты MET Norway по МСК: {date: {tmax,tmin,precip,wind,cloud}} */
function metnoDaily(raw) {
  const days = {};
  const series = (raw && raw.properties && raw.properties.timeseries) || [];
  for (const ts of series) {
    const tMsk = new Date(new Date(ts.time).getTime() + MSK_OFFSET_MS);
    const key = tMsk.toISOString().slice(0, 10);
    const d = days[key] || (days[key] = { temps: [], precip: 0, wind: [], cloud: [] });
    const inst = (ts.data && ts.data.instant && ts.data.instant.details) || {};
    if (inst.air_temperature != null) d.temps.push(inst.air_temperature);
    if (inst.wind_speed != null) d.wind.push(inst.wind_speed);
    if (inst.cloud_area_fraction != null) d.cloud.push(inst.cloud_area_fraction);
    if (ts.data && ts.data.next_1_hours) {
      d.precip += (ts.data.next_1_hours.details || {}).precipitation_amount || 0;
    } else if (ts.data && ts.data.next_6_hours) {
      d.precip += (ts.data.next_6_hours.details || {}).precipitation_amount || 0;
    }
  }
  const out = {};
  for (const [k, d] of Object.entries(days)) {
    if (!d.temps.length) continue;
    out[k] = {
      tmax: Math.max(...d.temps), tmin: Math.min(...d.temps),
      precip: Math.round(d.precip * 10) / 10,
      wind: d.wind.length ? Math.max(...d.wind) : null,
      cloud: d.cloud.length ? d.cloud.reduce((a, b) => a + b, 0) / d.cloud.length : null,
    };
  }
  return out;
}

/* Текущие значения MET Norway: первая запись timeseries ≈ текущий час */
function metnoCurrent(raw) {
  const series = (raw && raw.properties && raw.properties.timeseries) || [];
  if (!series.length) return null;
  const inst = (series[0].data && series[0].data.instant && series[0].data.instant.details) || {};
  return {
    t: inst.air_temperature != null ? Math.round(inst.air_temperature) : null,
    wind: inst.wind_speed != null ? Math.round(inst.wind_speed) : null,
  };
}

/* ---------- агрегация ---------- */

function verdictFor(precip, wind, cloud, code) {
  if (THUNDER.has(code) || (precip != null && precip >= 8) || (wind != null && wind >= 15)) return "red";
  if ((precip != null && precip >= 2) || (wind != null && wind >= 8) || (cloud != null && cloud >= 90)) return "yellow";
  return "green";
}

function mean(vals) {
  const v = vals.filter(x => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

async function aggregate(point) {
  const sources = [], errors = [];
  const [omR, modelsR, metnoR] = await Promise.allSettled([
    fetchOpenMeteo(point), fetchOpenMeteoModels(point), fetchMetNo(point),
  ]);
  const om = omR.status === "fulfilled" ? omR.value : null;
  const omModels = modelsR.status === "fulfilled" ? modelsR.value : null;
  let metno = null, mCur = null;
  if (om) sources.push("Open-Meteo"); else errors.push("Open-Meteo: " + errName(omR.reason));
  if (omModels) sources.push("ECMWF/GFS/ICON"); else errors.push("Open-Meteo models: " + errName(modelsR.reason));
  if (metnoR.status === "fulfilled") {
    try {
      metno = metnoDaily(metnoR.value);
      mCur = metnoCurrent(metnoR.value);
      sources.push("MET Norway");
    }
    catch (e) { errors.push("MET Norway: " + errName(e)); }
  } else errors.push("MET Norway: " + errName(metnoR.reason));

  if (!om && !metno) throw new Error("все источники недоступны: " + errors.join("; "));

  const dates = om ? om.daily.time.slice(0, 6) : Object.keys(metno).sort().slice(0, 6);

  const days = dates.map((date, i) => {
    const tmaxV = [], tminV = [], prV = [], wV = [], cV = [];
    let code = null;
    if (om && i < om.daily.time.length) {
      const dd = om.daily;
      tmaxV.push(dd.temperature_2m_max[i]); tminV.push(dd.temperature_2m_min[i]);
      prV.push(dd.precipitation_sum[i]); wV.push(dd.wind_speed_10m_max[i]);
      cV.push(dd.cloud_cover_mean[i]); code = dd.weather_code[i];
    }
    if (omModels) {
      const dd = omModels.daily;
      const acc = { temperature_2m_max: tmaxV, temperature_2m_min: tminV, precipitation_sum: prV, wind_speed_10m_max: wV, cloud_cover_mean: cV };
      for (const [varName, arr] of Object.entries(acc)) {
        for (const [k, series] of Object.entries(dd)) {
          if (k.startsWith(varName + "_") && i < series.length) arr.push(series[i]);
        }
      }
    }
    if (metno && metno[date]) {
      const m = metno[date];
      tmaxV.push(m.tmax); tminV.push(m.tmin); prV.push(m.precip); wV.push(m.wind); cV.push(m.cloud);
    }
    const tmaxF = tmaxV.filter(v => v != null), tminF = tminV.filter(v => v != null);
    const tDay = mean(tmaxF), tNight = mean(tminF);
    const precip = mean(prV), wind = mean(wV), cloud = mean(cV);
    return {
      date,
      t_day: tDay != null ? Math.round(tDay) : null,
      t_night: tNight != null ? Math.round(tNight) : null,
      t_day_spread: tmaxF.length ? [Math.round(Math.min(...tmaxF)), Math.round(Math.max(...tmaxF))] : null,
      t_night_spread: tminF.length ? [Math.round(Math.min(...tminF)), Math.round(Math.max(...tminF))] : null,
      precip: precip != null ? Math.round(precip * 10) / 10 : null,
      wind: wind != null ? Math.round(wind) : null,
      cloud: cloud != null ? Math.round(cloud) : null,
      code,
      verdict: verdictFor(precip, wind, cloud, code),
    };
  });

  /* Дневная сумма осадков = сумме показываемых часов (один и тот же источник,
     best_match). Иначе число в дне не сходится с почасовой раскладкой —
     подрывает доверие к прогнозу. */
  if (om && om.hourly && om.hourly.precipitation) {
    const sums = {};
    om.hourly.time.forEach((t, i) => {
      const d = t.slice(0, 10);
      sums[d] = (sums[d] || 0) + (om.hourly.precipitation[i] || 0);
    });
    for (const day of days) {
      if (sums[day.date] != null) {
        day.precip = Math.round(sums[day.date] * 10) / 10;
        day.verdict = verdictFor(day.precip, day.wind, day.cloud, day.code);
      }
    }
  }

  let current = null;
  if (om && om.current) {
    const c = om.current;
    current = {
      t: Math.round(c.temperature_2m), feels: Math.round(c.apparent_temperature),
      humidity: Math.round(c.relative_humidity_2m), wind: Math.round(c.wind_speed_10m),
      gust: Math.round(c.wind_gusts_10m), cloud: Math.round(c.cloud_cover), code: c.weather_code,
      precip: c.precipitation != null ? Math.round(c.precipitation * 10) / 10 : 0,
    };
  }
  if (mCur && current) {
    if (mCur.t != null) current.metno_t = mCur.t;
    if (mCur.wind != null) current.metno_wind = mCur.wind;
  }

  const analysis = buildAnalysis(om, days);
  const advice = buildAdvice(days.length > 1 ? days[1] : days[0]);
  let overall = "green";
  for (const d of days.slice(0, 2)) {
    if (d.verdict === "red") { overall = "red"; break; }
    if (d.verdict === "yellow") overall = "yellow";
  }

  return {
    point: { id: point.id, name: point.name, lat: point.lat, lon: point.lon, ele: point.ele, region: point.region },
    fetched_at: mskNowIso(),
    sources, errors, current, days, analysis, advice, verdict: overall,
    hourly: om ? {
      time: om.hourly.time,
      t: om.hourly.temperature_2m.map(v => v == null ? null : Math.round(v)),
      precip: om.hourly.precipitation,
      code: om.hourly.weather_code,
      wind: om.hourly.wind_speed_10m.map(v => v == null ? null : Math.round(v)),
    } : null,
  };
}

function errName(e) { return (e && e.name) || "Error"; }

/* ---------- микро-анализ ---------- */

function buildAnalysis(om, days) {
  const parts = [];
  if (om) {
    const today = dayAnalysis(om, days[0] && days[0].date, "Сегодня");
    if (today) parts.push(today);
    const tomorrow = dayAnalysis(om, days[1] && days[1].date, "Завтра");
    if (tomorrow) parts.push(tomorrow);
  }
  if (days.length >= 5) {
    const later = days.slice(2);
    const wetLater = later.filter(d => (d.precip || 0) >= 2);
    const tomorrowWet = days.length > 1 && (days[1].precip || 0) >= 2;
    if (!wetLater.length) parts.push(tomorrowWet ? "После завтра в основном сухо." : "Весь период в основном сухо.");
    else parts.push(`С ${fmtDate(wetLater[0].date)} осадки местами усиливаются.`);
  }
  return parts.length ? parts.join(" ") : "Без выраженных погодных явлений.";
}

function dayAnalysis(om, dateStr, label) {
  if (!dateStr) return "";
  const h = om.hourly;
  const idx = [];
  for (let i = 0; i < h.time.length; i++) if (h.time[i].slice(0, 10) === dateStr) idx.push(i);
  if (!idx.length) return "";
  const pr = idx.map(i => h.precipitation[i] || 0);
  const w = idx.map(i => h.wind_speed_10m[i] || 0);
  const cl = idx.map(i => h.cloud_cover[i] || 0);
  const rh = idx.map(i => h.relative_humidity_2m[i] || 0);
  const hrs = idx.map(i => parseInt(h.time[i].slice(11, 13), 10));
  const sub = [];

  const wet = hrs.filter((_, j) => pr[j] >= 0.3);
  sub.push(wet.length ? "осадки: " + spanify(wet) : "осадков не ожидается");

  const best = bestWindow(hrs, pr, w);
  if (best) sub.push("лучшее окно: " + best);

  let wmaxI = 0;
  for (let j = 0; j < idx.length; j++) if (w[j] > w[wmaxI]) wmaxI = j;
  if (w[wmaxI] >= 8) sub.push(`ветер на гребне до ${Math.round(w[wmaxI])} м/с ближе к ${daypart(hrs[wmaxI])}`);

  const mornRh = mean(rh.filter((_, j) => hrs[j] < 9));
  const mornCl = mean(cl.filter((_, j) => hrs[j] < 9));
  if (mornRh != null && mornRh > 92 && mornCl != null && mornCl > 80) {
    sub.push("утром возможен туман и низкая облачность в долине");
  }

  if (idx.some(i => THUNDER.has(h.weather_code[i]))) {
    sub.push("возможна гроза — гребень проходить в первой половине дня");
  }
  return label + ": " + sub.join("; ") + ".";
}

function spanify(hours) {
  hours = [...new Set(hours)].sort((a, b) => a - b);
  const spans = [];
  let start = hours[0], prev = hours[0];
  for (const hh of hours.slice(1)) {
    if (hh === prev + 1) { prev = hh; continue; }
    spans.push([start, prev + 1]); start = hh; prev = hh;
  }
  spans.push([start, prev + 1]);
  const out = [];
  for (const [a, b] of spans) {
    if (a === 0 && b >= 23) return "в течение суток";
    out.push(`с ${String(a).padStart(2, "0")}:00 до ${String(b).padStart(2, "0")}:00`);
  }
  return out.join(", ");
}

function bestWindow(hrs, pr, w) {
  let best = null, cur = [];
  for (let j = 0; j < hrs.length; j++) {
    if (hrs[j] < 6 || hrs[j] > 20) continue;
    if (pr[j] < 0.3 && w[j] < 8) cur.push(hrs[j]);
    else { if (!best || cur.length > best.length) best = cur; cur = []; }
  }
  if (!best || cur.length > best.length) best = cur;
  if (best && best.length >= 3) {
    return `${String(best[0]).padStart(2, "0")}:00–${String(best[best.length - 1] + 1).padStart(2, "0")}:00`;
  }
  return null;
}

function daypart(h) {
  if (h < 6) return "ночи";
  if (h < 12) return "утру";
  if (h < 18) return "вечеру";
  return "ночи";
}

function fmtDate(iso) {
  const d = new Date(iso + "T12:00:00");
  const wd = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"][(d.getDay() + 6) % 7];
  return `${wd} ${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function buildAdvice(day) {
  const take = [];
  if ((day.precip || 0) >= 1) take.push("дождевик");
  if (day.t_night != null && day.t_night < 5) take.push("тёплый слой");
  if ((day.wind || 0) >= 8) take.push("ветровка");
  if ((day.cloud != null ? day.cloud : 100) < 40 && (day.precip || 0) < 1) take.push("солнцезащита");
  return "Взять: " + (take.length ? take.join(" · ") : "стандартный набор") + ".";
}

/* ---------- кэш и публичный интерфейс ---------- */

async function getWeather(point) {
  const key = "wx4_" + point.id;
  try {
    const cached = JSON.parse(localStorage.getItem(key) || "null");
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.payload;
  } catch (e) {}
  const payload = await aggregate(point);
  try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), payload })); } catch (e) {}
  return payload;
}
