/* Движок сводки погоды — клиентская версия (без сервера).
   Источники: Open-Meteo (best_match), Open-Meteo (ECMWF/GFS/ICON),
   Open-Meteo Ensemble (ICON, min/max по членам ансамбля), MET Norway,
   Open-Meteo Marine (волны). Все API открыты для CORS и не требуют ключей.
   Кэш — localStorage, 30 мин.
   Время — МЕСТНОЕ для каждой точки (timezone=auto, utc_offset_seconds из ответа). */

const CACHE_TTL_MS = 30 * 60 * 1000;
const THUNDER = new Set([95, 96, 99]);

/* Локальное «сейчас» точки: offsetSec — сдвиг её часового пояса от UTC */
function tzNowIso(offsetSec) {
  return new Date(Date.now() + offsetSec * 1000).toISOString().slice(0, 19);
}
/* Запасной сдвиг по долготе (если Open-Meteo не ответил и взять неоткуда) */
function lonOffsetSec(lon) { return Math.round(lon / 15) * 3600; }

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
    timezone: "auto", forecast_days: 6, wind_speed_unit: "ms",
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
    hourly: "temperature_2m,precipitation,wind_speed_10m",
    models: "ecmwf_ifs025,gfs_global,icon_eu",
  }));
}

function fetchMetNo(p) {
  const q = new URLSearchParams({ lat: p.lat, lon: p.lon, altitude: Math.round(p.ele) });
  return fetchJson("https://api.met.no/weatherapi/locationforecast/2.0/compact?" + q.toString());
}

/* Ансамбль ICON (51 член): min/max по членам = честный разброс прогноза */
function fetchEnsemble(p) {
  const q = new URLSearchParams({
    latitude: p.lat, longitude: p.lon,
    timezone: "auto", forecast_days: 6,
    daily: "temperature_2m_max,temperature_2m_min,precipitation_sum",
    models: "icon_seamless",
  });
  return fetchJson("https://ensemble-api.open-meteo.com/v1/ensemble?" + q.toString());
}

/* {date: {tmax:[min,max], tmin:[min,max], pr:[min,max]}} по всем членам ансамбля */
function ensembleSpreads(raw) {
  const out = {};
  const d = raw && raw.daily;
  if (!d || !d.time) return out;
  const buckets = { tmax: [], tmin: [], pr: [] };
  for (const k of Object.keys(d)) {
    if (k.startsWith("temperature_2m_max")) buckets.tmax.push(d[k]);
    else if (k.startsWith("temperature_2m_min")) buckets.tmin.push(d[k]);
    else if (k.startsWith("precipitation_sum")) buckets.pr.push(d[k]);
  }
  const pick = (arrs, i) => {
    const vals = [];
    for (const a of arrs) if (a && a[i] != null) vals.push(a[i]);
    return vals.length ? [Math.min(...vals), Math.max(...vals)] : null;
  };
  d.time.forEach((date, i) => {
    out[date] = { tmax: pick(buckets.tmax, i), tmin: pick(buckets.tmin, i), pr: pick(buckets.pr, i) };
  });
  return out;
}

/* Волны: Open-Meteo Marine API. В горах приходят null — блок не показываем. */
function fetchMarine(p) {
  const q = new URLSearchParams({
    latitude: p.lat, longitude: p.lon,
    timezone: "auto", forecast_days: 6,
    daily: "wave_height_max,wave_period_max,wave_direction_dominant",
  });
  return fetchJson("https://marine-api.open-meteo.com/v1/marine?" + q.toString());
}

function wavesFrom(raw) {
  const d = raw && raw.daily;
  if (!d || !d.time) return null;
  const days = d.time.map((date, i) => ({
    date,
    height: d.wave_height_max ? d.wave_height_max[i] : null,
    period: d.wave_period_max ? d.wave_period_max[i] : null,
    dir: d.wave_direction_dominant ? d.wave_direction_dominant[i] : null,
  })).filter(w => w.height != null);
  return days.length ? days.slice(0, 6) : null;
}

/* Суточные агрегаты MET Norway по МЕСТНОМУ времени точки: {date: {tmax,tmin,precip,wind,cloud}} */
function metnoDaily(raw, offsetSec) {
  const days = {};
  const series = (raw && raw.properties && raw.properties.timeseries) || [];
  for (const ts of series) {
    const tLoc = new Date(new Date(ts.time).getTime() + offsetSec * 1000);
    const key = tLoc.toISOString().slice(0, 10);
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

/* Почасовые данные MET Norway по МЕСТНОМУ времени точки: {"YYYY-MM-DDTHH:00": {t,wind,precip}} */
function metnoHourly(raw, offsetSec) {
  const out = {};
  const series = (raw && raw.properties && raw.properties.timeseries) || [];
  for (const ts of series) {
    const key = new Date(new Date(ts.time).getTime() + offsetSec * 1000).toISOString().slice(0, 13) + ":00";
    const inst = (ts.data && ts.data.instant && ts.data.instant.details) || {};
    let precip = null;
    if (ts.data && ts.data.next_1_hours) precip = (ts.data.next_1_hours.details || {}).precipitation_amount ?? null;
    out[key] = {
      t: inst.air_temperature != null ? inst.air_temperature : null,
      wind: inst.wind_speed != null ? inst.wind_speed : null,
      precip,
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
  const [omR, modelsR, metnoR, ensR, marineR] = await Promise.allSettled([
    fetchOpenMeteo(point), fetchOpenMeteoModels(point), fetchMetNo(point),
    fetchEnsemble(point), fetchMarine(point),
  ]);
  const om = omR.status === "fulfilled" ? omR.value : null;
  const omModels = modelsR.status === "fulfilled" ? modelsR.value : null;
  const ens = ensR.status === "fulfilled" ? ensembleSpreads(ensR.value) : null;
  const waves = marineR.status === "fulfilled" ? wavesFrom(marineR.value) : null;
  /* Часовой пояс точки — из ответа Open-Meteo (timezone=auto), запасной вариант — по долготе */
  const tzOffset = (om && om.utc_offset_seconds) ||
    (omModels && omModels.utc_offset_seconds) || lonOffsetSec(point.lon);
  let metno = null, mCur = null, metnoH = null;
  if (om) sources.push("Open-Meteo"); else errors.push("Open-Meteo: " + errName(omR.reason));
  if (omModels) sources.push("ECMWF/GFS/ICON"); else errors.push("Open-Meteo models: " + errName(modelsR.reason));
  if (ens) sources.push("ICON Ensemble"); else errors.push("Ensemble: " + errName(ensR.reason));
  if (waves) sources.push("Marine"); // в горах данных нет — это норма, не ошибка
  if (metnoR.status === "fulfilled") {
    try {
      metno = metnoDaily(metnoR.value, tzOffset);
      mCur = metnoCurrent(metnoR.value);
      metnoH = metnoHourly(metnoR.value, tzOffset);
      sources.push("MET Norway");
    }
    catch (e) { errors.push("MET Norway: " + errName(e)); }
  } else errors.push("MET Norway: " + errName(metnoR.reason));

  if (!om && !metno) throw new Error("все источники недоступны: " + errors.join("; "));

  /* Почасовой консенсус: среднее по всем источникам в каждом часе
     (best_match + ECMWF/GFS/ICON + MET Norway). Иконка/код — от best_match. */
  if (om && om.hourly) {
    const h = om.hourly, mh = omModels && omModels.hourly;
    for (let i = 0; i < h.time.length; i++) {
      const tv = [h.temperature_2m[i]], pv = [h.precipitation[i]], wv = [h.wind_speed_10m[i]];
      if (mh) for (const [k, s] of Object.entries(mh)) {
        if (k.startsWith("temperature_2m_")) tv.push(s[i]);
        else if (k.startsWith("precipitation_")) pv.push(s[i]);
        else if (k.startsWith("wind_speed_10m_")) wv.push(s[i]);
      }
      const m = metnoH && metnoH[h.time[i].slice(0, 13) + ":00"];
      if (m) { tv.push(m.t); pv.push(m.precip); wv.push(m.wind); }
      h.temperature_2m[i] = mean(tv);
      h.precipitation[i] = mean(pv);
      h.wind_speed_10m[i] = mean(wv);
    }
  }

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
    /* Разброс: модели + члены ансамбля ICON (честный min/max сценариев) */
    const es = ens && ens[date];
    const widen = (vals, ext, scale) => {
      let r = vals.length ? [Math.min(...vals), Math.max(...vals)] : null;
      if (ext) r = r ? [Math.min(r[0], ext[0]), Math.max(r[1], ext[1])] : ext;
      return r ? [Math.round(r[0] * scale) / scale, Math.round(r[1] * scale) / scale] : null;
    };
    return {
      date,
      t_day: tDay != null ? Math.round(tDay) : null,
      t_night: tNight != null ? Math.round(tNight) : null,
      t_day_spread: widen(tmaxF, es && es.tmax, 1),
      t_night_spread: widen(tminF, es && es.tmin, 1),
      precip: precip != null ? Math.round(precip * 10) / 10 : null,
      precip_spread: widen(prV.filter(v => v != null), es && es.pr, 10),
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

  /* Осадки «сейчас» = тому же консенсус-часу, что виден в почасовой ленте.
     current.precipitation у Open-Meteo — это одиночная модель best_match,
     из-за неё число в шапке расходилось с ячейкой «сейчас». */
  if (current && om && om.hourly) {
    const ni = om.hourly.time.indexOf(tzNowIso(tzOffset).slice(0, 13) + ":00");
    if (ni >= 0 && om.hourly.precipitation[ni] != null)
      current.precip = Math.round(om.hourly.precipitation[ni] * 10) / 10;
  }

  let overall = "green";
  for (const d of days.slice(0, 2)) {
    if (d.verdict === "red") { overall = "red"; break; }
    if (d.verdict === "yellow") overall = "yellow";
  }

  return {
    point: { id: point.id, name: point.name, lat: point.lat, lon: point.lon, ele: point.ele, region: point.region },
    fetched_at: tzNowIso(tzOffset),
    tz_offset: tzOffset,
    sources, errors, current, days, verdict: overall,
    waves,
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

/* ---------- кэш и публичный интерфейс ---------- */

async function getWeather(point) {
  const key = "wx8_" + point.id;
  try {
    const cached = JSON.parse(localStorage.getItem(key) || "null");
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.payload;
  } catch (e) {}
  const payload = await aggregate(point);
  try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), payload })); } catch (e) {}
  return payload;
}
