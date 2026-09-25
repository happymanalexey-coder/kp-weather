#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
«Погода в горах Красной Поляны» — бэкенд на чистом stdlib.
Сводка по точке из нескольких источников: Open-Meteo (best_match + модели
ECMWF/GFS/ICON как независимые метеомодели) и MET Norway (api.met.no).
Кэш 30 мин. Запуск: python3 server.py [--port 7100] [--host 127.0.0.1]
"""
import json
import os
import time
import argparse
import urllib.request
import urllib.parse
from datetime import datetime, timedelta, timezone
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

ROOT = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.join(ROOT, "web")
CACHE_DIR = os.path.join(ROOT, "cache")
POINTS_FILE = os.path.join(ROOT, "data", "points.json")
def point_tz(offset_sec):
    """Часовой пояс точки по сдвигу в секундах (utc_offset_seconds из Open-Meteo)."""
    return timezone(timedelta(seconds=offset_sec))


def lon_offset_sec(lon):
    """Запасной сдвиг по долготе, если Open-Meteo не ответил."""
    return round(lon / 15) * 3600
UA = {"User-Agent": "KPMountainWeather/0.1 (local app; contact: owner)"}

os.makedirs(CACHE_DIR, exist_ok=True)


def load_env():
    env_path = os.path.join(ROOT, ".env")
    if os.path.exists(env_path):
        with open(env_path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip())


def cache_ttl():
    try:
        return int(os.environ.get("CACHE_TTL_MIN", "30")) * 60
    except ValueError:
        return 1800


def get_json(url, timeout=15):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.load(r)


# ---------- источники ----------

def fetch_openmeteo(lat, lon, ele):
    """best_match: current + hourly + daily."""
    q = urllib.parse.urlencode({
        "latitude": lat, "longitude": lon, "elevation": ele,
        "current": "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_gusts_10m",
        "hourly": "temperature_2m,precipitation,weather_code,cloud_cover,wind_speed_10m,relative_humidity_2m",
        "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code,wind_speed_10m_max,cloud_cover_mean",
        "timezone": "auto", "forecast_days": 6, "wind_speed_unit": "ms",
    })
    return get_json(f"https://api.open-meteo.com/v1/forecast?{q}")


def fetch_openmeteo_models(lat, lon, ele):
    """Те же поля по отдельным метеомоделям (ECMWF IFS, GFS, ICON-EU)."""
    q = urllib.parse.urlencode({
        "latitude": lat, "longitude": lon, "elevation": ele,
        "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code,wind_speed_10m_max,cloud_cover_mean",
        "hourly": "temperature_2m,precipitation,wind_speed_10m",
        "timezone": "auto", "forecast_days": 6, "wind_speed_unit": "ms",
        "models": "ecmwf_ifs025,gfs_global,icon_eu",
    })
    return get_json(f"https://api.open-meteo.com/v1/forecast?{q}")


def fetch_metno(lat, lon, ele):
    q = urllib.parse.urlencode({"lat": lat, "lon": lon, "altitude": int(round(ele))})
    return get_json(f"https://api.met.no/weatherapi/locationforecast/2.0/compact?{q}")


def fetch_ensemble(lat, lon):
    """Ансамбль ICON (51 член): min/max по членам = честный разброс."""
    q = urllib.parse.urlencode({
        "latitude": lat, "longitude": lon,
        "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum",
        "timezone": "auto", "forecast_days": 6,
        "models": "icon_seamless",
    })
    return get_json(f"https://ensemble-api.open-meteo.com/v1/ensemble?{q}")


def ensemble_spreads(raw):
    """{date: {"tmax": [min,max], "tmin": [...], "pr": [...]}} по всем членам."""
    out = {}
    d = (raw or {}).get("daily") or {}
    times = d.get("time") or []
    buckets = {"tmax": [], "tmin": [], "pr": []}
    for k in d:
        if k.startswith("temperature_2m_max"):
            buckets["tmax"].append(d[k])
        elif k.startswith("temperature_2m_min"):
            buckets["tmin"].append(d[k])
        elif k.startswith("precipitation_sum"):
            buckets["pr"].append(d[k])

    def pick(arrs, i):
        vals = [a[i] for a in arrs if a and i < len(a) and a[i] is not None]
        return [min(vals), max(vals)] if vals else None

    for i, date in enumerate(times):
        out[date] = {"tmax": pick(buckets["tmax"], i),
                     "tmin": pick(buckets["tmin"], i),
                     "pr": pick(buckets["pr"], i)}
    return out


def fetch_marine(lat, lon):
    """Волны: Open-Meteo Marine API. В горах значения null — блок не показываем."""
    q = urllib.parse.urlencode({
        "latitude": lat, "longitude": lon,
        "daily": "wave_height_max,wave_period_max,wave_direction_dominant",
        "timezone": "auto", "forecast_days": 6,
    })
    return get_json(f"https://marine-api.open-meteo.com/v1/marine?{q}")


def waves_from(raw):
    d = (raw or {}).get("daily") or {}
    times = d.get("time") or []
    days = []
    for i, date in enumerate(times):
        h = (d.get("wave_height_max") or [None] * len(times))[i]
        if h is None:
            continue
        days.append({
            "date": date, "height": h,
            "period": (d.get("wave_period_max") or [None] * len(times))[i],
            "dir": (d.get("wave_direction_dominant") or [None] * len(times))[i],
        })
    return days[:6] or None


def metno_daily(raw, tz):
    """Суточные агрегаты из compact: {date: {tmax,tmin,precip,wind,cloud}} по МСК."""
    days = {}
    for ts in raw.get("properties", {}).get("timeseries", []):
        t_utc = datetime.fromisoformat(ts["time"].replace("Z", "+00:00"))
        key = t_utc.astimezone(tz).date().isoformat()
        d = days.setdefault(key, {"temps": [], "precip": 0.0, "wind": [], "cloud": []})
        inst = ts.get("data", {}).get("instant", {}).get("details", {})
        if inst.get("air_temperature") is not None:
            d["temps"].append(inst["air_temperature"])
        if inst.get("wind_speed") is not None:
            d["wind"].append(inst["wind_speed"])
        if inst.get("cloud_area_fraction") is not None:
            d["cloud"].append(inst["cloud_area_fraction"])
        if "next_1_hours" in ts.get("data", {}):
            d["precip"] += ts["data"]["next_1_hours"].get("details", {}).get("precipitation_amount", 0) or 0
        elif "next_6_hours" in ts.get("data", {}):
            d["precip"] += ts["data"]["next_6_hours"].get("details", {}).get("precipitation_amount", 0) or 0
    out = {}
    for k, d in days.items():
        if not d["temps"]:
            continue
        out[k] = {
            "tmax": max(d["temps"]), "tmin": min(d["temps"]),
            "precip": round(d["precip"], 1),
            "wind": max(d["wind"]) if d["wind"] else None,
            "cloud": sum(d["cloud"]) / len(d["cloud"]) if d["cloud"] else None,
        }
    return out


def metno_hourly(raw, tz):
    """Почасовые данные по МСК: {"YYYY-MM-DDTHH:00": {t,wind,precip}}."""
    out = {}
    for ts in raw.get("properties", {}).get("timeseries", []):
        t_utc = datetime.fromisoformat(ts["time"].replace("Z", "+00:00"))
        key = t_utc.astimezone(tz).strftime("%Y-%m-%dT%H:00")
        inst = ts.get("data", {}).get("instant", {}).get("details", {})
        precip = None
        if "next_1_hours" in ts.get("data", {}):
            precip = ts["data"]["next_1_hours"].get("details", {}).get("precipitation_amount")
        out[key] = {
            "t": inst.get("air_temperature"),
            "wind": inst.get("wind_speed"),
            "precip": precip,
        }
    return out


def metno_current(raw):
    """Текущие значения MET Norway: первая запись timeseries ≈ текущий час."""
    series = raw.get("properties", {}).get("timeseries", [])
    if not series:
        return None
    inst = series[0].get("data", {}).get("instant", {}).get("details", {})
    t, w = inst.get("air_temperature"), inst.get("wind_speed")
    return {
        "t": round(t) if t is not None else None,
        "wind": round(w) if w is not None else None,
    }


# ---------- агрегация ----------

THUNDER = {95, 96, 99}


def verdict_for(precip, wind, cloud, code):
    if code in THUNDER or (precip is not None and precip >= 8) or (wind is not None and wind >= 15):
        return "red"
    if (precip is not None and precip >= 2) or (wind is not None and wind >= 8) or (cloud is not None and cloud >= 90):
        return "yellow"
    return "green"


def mean(vals):
    vals = [v for v in vals if v is not None]
    return sum(vals) / len(vals) if vals else None


def aggregate(point):
    lat, lon, ele = point["lat"], point["lon"], point["ele"]
    sources, errors = [], []

    om = om_models = metno = m_cur = metno_h = None
    try:
        om = fetch_openmeteo(lat, lon, ele)
        sources.append("Open-Meteo")
    except Exception as e:
        errors.append(f"Open-Meteo: {type(e).__name__}")
    try:
        om_models = fetch_openmeteo_models(lat, lon, ele)
        sources.append("ECMWF/GFS/ICON")
    except Exception as e:
        errors.append(f"Open-Meteo models: {type(e).__name__}")

    # Часовой пояс точки — из ответа Open-Meteo (timezone=auto), запасной — по долготе
    tz_off = ((om or {}).get("utc_offset_seconds")
              or (om_models or {}).get("utc_offset_seconds")
              or lon_offset_sec(lon))
    tz = point_tz(tz_off)

    try:
        metno_raw = fetch_metno(lat, lon, ele)
        metno = metno_daily(metno_raw, tz)
        m_cur = metno_current(metno_raw)
        metno_h = metno_hourly(metno_raw, tz)
        sources.append("MET Norway")
    except Exception as e:
        errors.append(f"MET Norway: {type(e).__name__}")
    ens = None
    try:
        ens = ensemble_spreads(fetch_ensemble(lat, lon))
        sources.append("ICON Ensemble")
    except Exception as e:
        errors.append(f"Ensemble: {type(e).__name__}")
    waves = None
    try:
        waves = waves_from(fetch_marine(lat, lon))
        if waves:
            sources.append("Marine")  # в горах данных нет — это норма, не ошибка
    except Exception:
        pass  # волны — необязательный блок

    if om is None and metno is None:
        raise RuntimeError("все источники недоступны: " + "; ".join(errors))

    # Почасовой консенсус: среднее по всем источникам в каждом часе
    # (best_match + ECMWF/GFS/ICON + MET Norway). Код погоды — от best_match.
    if om and om.get("hourly"):
        h = om["hourly"]
        mh = om_models.get("hourly") if om_models else None
        for i, tstr in enumerate(h["time"]):
            tv = [h["temperature_2m"][i]]
            pv = [h["precipitation"][i]]
            wv = [h["wind_speed_10m"][i]]
            if mh:
                for k, s in mh.items():
                    if i >= len(s):
                        continue
                    if k.startswith("temperature_2m_"):
                        tv.append(s[i])
                    elif k.startswith("precipitation_"):
                        pv.append(s[i])
                    elif k.startswith("wind_speed_10m_"):
                        wv.append(s[i])
            m = metno_h.get(tstr[:13] + ":00") if metno_h else None
            if m:
                tv.append(m["t"]); pv.append(m["precip"]); wv.append(m["wind"])
            h["temperature_2m"][i] = mean(tv)
            h["precipitation"][i] = mean(pv)
            h["wind_speed_10m"][i] = mean(wv)

    # даты: 6 суток начиная с сегодня (МСК)
    dates = None
    if om:
        dates = om["daily"]["time"][:6]
    else:
        dates = sorted(metno.keys())[:6]

    days = []
    for i, date in enumerate(dates):
        tmax_v, tmin_v, pr_v, w_v, c_v = [], [], [], [], []
        code = None
        if om and i < len(om["daily"]["time"]):
            dd = om["daily"]
            tmax_v.append(dd["temperature_2m_max"][i])
            tmin_v.append(dd["temperature_2m_min"][i])
            pr_v.append(dd["precipitation_sum"][i])
            w_v.append(dd["wind_speed_10m_max"][i])
            c_v.append(dd["cloud_cover_mean"][i])
            code = dd["weather_code"][i]
        if om_models:
            dd = om_models["daily"]
            for var, acc in (("temperature_2m_max", tmax_v), ("temperature_2m_min", tmin_v),
                             ("precipitation_sum", pr_v), ("wind_speed_10m_max", w_v),
                             ("cloud_cover_mean", c_v)):
                for k, series in dd.items():
                    if k.startswith(var + "_") and i < len(series):
                        acc.append(series[i])
        if metno and date in metno:
            m = metno[date]
            tmax_v.append(m["tmax"]); tmin_v.append(m["tmin"])
            pr_v.append(m["precip"]); w_v.append(m["wind"]); c_v.append(m["cloud"])

        tmax_f = [v for v in tmax_v if v is not None]
        tmin_f = [v for v in tmin_v if v is not None]
        pf = [v for v in pr_v if v is not None]
        t_day, t_night = mean(tmax_f), mean(tmin_f)
        precip, wind, cloud = mean(pr_v), mean(w_v), mean(c_v)

        # Разброс: модели + члены ансамбля ICON (честный min/max сценариев)
        es = (ens or {}).get(date) or {}

        def widen(vals, ext, nd):
            r = [min(vals), max(vals)] if vals else None
            if ext:
                r = [min(r[0], ext[0]), max(r[1], ext[1])] if r else list(ext)
            if not r:
                return None
            if nd == 0:
                return [int(round(r[0])), int(round(r[1]))]
            return [round(r[0], nd), round(r[1], nd)]

        days.append({
            "date": date,
            "t_day": round(t_day) if t_day is not None else None,
            "t_night": round(t_night) if t_night is not None else None,
            "t_day_spread": widen(tmax_f, es.get("tmax"), 0),
            "t_night_spread": widen(tmin_f, es.get("tmin"), 0),
            "precip": round(precip, 1) if precip is not None else None,
            "precip_spread": widen(pf, es.get("pr"), 1),
            "wind": round(wind) if wind is not None else None,
            "cloud": round(cloud) if cloud is not None else None,
            "code": code,
            "verdict": verdict_for(precip, wind, cloud, code),
        })

    # Дневная сумма осадков = сумме показываемых часов (один источник, best_match).
    # Иначе число в дне не сходится с почасовой раскладкой — подрывает доверие.
    if om and om.get("hourly") and om["hourly"].get("precipitation"):
        sums = {}
        for t, pr in zip(om["hourly"]["time"], om["hourly"]["precipitation"]):
            d = t[:10]
            sums[d] = sums.get(d, 0.0) + (pr or 0)
        for day in days:
            if day["date"] in sums:
                day["precip"] = round(sums[day["date"]], 1)
                day["verdict"] = verdict_for(day["precip"], day["wind"], day["cloud"], day["code"])

    current = None
    if om and "current" in om:
        c = om["current"]
        current = {
            "t": round(c["temperature_2m"]),
            "feels": round(c["apparent_temperature"]),
            "humidity": round(c["relative_humidity_2m"]),
            "wind": round(c["wind_speed_10m"]),
            "gust": round(c["wind_gusts_10m"]),
            "cloud": round(c["cloud_cover"]),
            "code": c["weather_code"],
            "precip": round(c.get("precipitation") or 0, 1),
        }
    if m_cur and current is not None:
        if m_cur["t"] is not None:
            current["metno_t"] = m_cur["t"]
        if m_cur["wind"] is not None:
            current["metno_wind"] = m_cur["wind"]

    # Осадки «сейчас» = тому же консенсус-часу, что виден в почасовой ленте.
    # current.precipitation у Open-Meteo — одиночная модель best_match,
    # из-за неё число в шапке расходилось с ячейкой «сейчас».
    if current is not None and om and om.get("hourly"):
        now_key = datetime.now(tz).strftime("%Y-%m-%dT%H:00")
        if now_key in om["hourly"]["time"]:
            ni = om["hourly"]["time"].index(now_key)
            v = om["hourly"]["precipitation"][ni]
            if v is not None:
                current["precip"] = round(v, 1)

    overall = "green"
    for d in days[:2]:
        if d["verdict"] == "red":
            overall = "red"
            break
        if d["verdict"] == "yellow":
            overall = "yellow"

    return {
        "point": {k: point.get(k) for k in ("id", "name", "lat", "lon", "ele", "region")},
        "fetched_at": datetime.now(tz).isoformat(timespec="seconds"),
        "tz_offset": tz_off,
        "sources": sources, "errors": errors,
        "current": current, "days": days,
        "verdict": overall,
        "waves": waves,
        "hourly": ({
            "time": om["hourly"]["time"],
            "t": [round(v) if v is not None else None for v in om["hourly"]["temperature_2m"]],
            "precip": om["hourly"]["precipitation"],
            "code": om["hourly"]["weather_code"],
            "wind": [round(v) if v is not None else None for v in om["hourly"]["wind_speed_10m"]],
        } if om else None),
    }


# ---------- HTTP ----------

class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path
        if path == "/api/points":
            return self.send_json(self.points_payload())
        if path == "/api/weather":
            qs = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            pid = (qs.get("id") or [""])[0]
            payload, code = self.weather_payload(pid)
            return self.send_json(payload, code)
        # статика
        if path == "/":
            path = "/index.html"
        safe = os.path.normpath(path).lstrip("/")
        full = os.path.join(WEB, safe)
        if not full.startswith(WEB) or not os.path.isfile(full):
            self.send_error(404)
            return
        ext = os.path.splitext(full)[1]
        ctype = {".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
                 ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml",
                 ".png": "image/png", ".jpg": "image/jpeg"}.get(ext, "application/octet-stream")
        with open(full, "rb") as f:
            body = f.read()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(body)

    def send_json(self, obj, code=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(body)

    def points_payload(self):
        with open(POINTS_FILE, encoding="utf-8") as f:
            data = json.load(f)
        pts = sorted(data["points"], key=lambda p: p["name"].lower())
        return {"points": [{**{k: p[k] for k in ("id", "name", "ele", "region")},
                            **({"marine": True} if p.get("marine") else {})} for p in pts]}

    def weather_payload(self, pid):
        with open(POINTS_FILE, encoding="utf-8") as f:
            data = json.load(f)
        point = next((p for p in data["points"] if p["id"] == pid), None)
        if not point:
            return {"error": "unknown point"}, 404
        cache_file = os.path.join(CACHE_DIR, f"{pid}.json")
        if os.path.exists(cache_file) and time.time() - os.path.getmtime(cache_file) < cache_ttl():
            with open(cache_file, encoding="utf-8") as f:
                return json.load(f), 200
        try:
            payload = aggregate(point)
        except Exception as e:
            return {"error": str(e)}, 502
        with open(cache_file, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False)
        return payload, 200


def main():
    load_env()
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=7100)
    ap.add_argument("--host", default="127.0.0.1")
    args, _ = ap.parse_known_args()
    srv = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"Сервер: http://{args.host}:{args.port}")
    srv.serve_forever()


if __name__ == "__main__":
    main()
