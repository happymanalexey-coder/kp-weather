#!/usr/bin/env python3
"""Приём предложенных точек из Telegram-бота @broKimibot.

Запускается из GitHub Actions раз в сутки. Читает getUpdates (BOT_TOKEN из
Secrets), парсит сообщения вида «Точка: Название — 43.472, 40.534», валидирует
теми же правилами, что клиентская форма (app.js → validateSuggestion), и складывает
валидные заявки в data/pending.json — очередь модерации. Само ничего не публикует:
одобрение = ручной перенос записи из pending.json в data/points.json (см. README).

Offset хранится в data/intake_state.json, чтобы не читать старые сообщения.
"""
import json, os, re, sys, time, urllib.request

TOKEN = os.environ.get("BOT_TOKEN", "")
if not TOKEN:
    print("BOT_TOKEN не задан — выходим (задайте в GitHub Secrets)")
    sys.exit(0)

API = f"https://api.telegram.org/bot{TOKEN}"
POINTS_PATH = "data/points.json"
PENDING_PATH = "data/pending.json"
STATE_PATH = "data/intake_state.json"

NAME_RE = re.compile(r"^[А-Яа-яЁёA-Za-z0-9 \-]+$")
MSG_RE = re.compile(
    r"^\s*Точка\s*:\s*(.+?)\s*[—-]\s*(-?\d+(?:[.,]\d+)?)\s*[,\s]\s*(-?\d+(?:[.,]\d+)?)\s*$",
    re.IGNORECASE)
BAD_WORDS = ["хуй", "хуя", "хуе", "хуи", "пизд", "бляд", "блят", "ебан", "ебал", "ёбан",
             "ебуч", "мудак", "мудил", "сука", "пидор", "пидар", "гандон", "шлюх",
             "залуп", "манда"]


def load(path, default):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default


def save(path, obj):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)
        f.write("\n")


def api(method, **params):
    import urllib.parse
    url = f"{API}/{method}?{urllib.parse.urlencode(params)}"
    with urllib.request.urlopen(url, timeout=20) as r:
        return json.loads(r.read().decode("utf-8"))


def validate(name, lat, lon, existing_names):
    name = " ".join(name.split())
    if not (3 <= len(name) <= 40):
        return None, "название 3–40 символов"
    if not NAME_RE.match(name):
        return None, "недопустимые символы в названии"
    low = " " + re.sub(r"[^а-яa-z0-9]+", " ", name.lower()) + " "
    if any(w in low for w in BAD_WORDS):
        return None, "не пройдёт модерацию"
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        return None, "координаты вне диапазона"
    if abs(lat) < 0.0001 and abs(lon) < 0.0001:
        return None, "координаты 0,0"
    if name.lower() in existing_names:
        return None, "дубликат"
    return name, None


def main():
    points = load(POINTS_PATH, {"points": []})
    pending = load(PENDING_PATH, {"meta": {"note": "очередь модерации, не публикуется"}, "pending": []})
    state = load(STATE_PATH, {"offset": 0})

    existing = {p["name"].strip().lower() for p in points.get("points", [])}
    existing |= {p["name"].strip().lower() for p in pending.get("pending", [])}

    resp = api("getUpdates", offset=state.get("offset", 0), timeout=10)
    if not resp.get("ok"):
        print("getUpdates failed:", resp)
        sys.exit(1)

    added, skipped = 0, 0
    for upd in resp.get("result", []):
        state["offset"] = max(state.get("offset", 0), upd["update_id"] + 1)
        msg = upd.get("message") or upd.get("channel_post") or {}
        text = msg.get("text") or ""
        m = MSG_RE.match(text)
        if not m:
            continue
        name_raw, lat_s, lon_s = m.group(1), m.group(2), m.group(3)
        lat = float(lat_s.replace(",", "."))
        lon = float(lon_s.replace(",", "."))
        user = (msg.get("from") or {})
        name, err = validate(name_raw, lat, lon, existing)
        if err:
            skipped += 1
            print(f"skip: {name_raw!r} ({lat}, {lon}) — {err}")
            continue
        entry = {
            "name": name,
            "lat": round(lat, 4),
            "lon": round(lon, 4),
            "submitted_by": user.get("id"),
            "submitted_by_username": user.get("username"),
            "ts": int(time.time()),
        }
        pending["pending"].append(entry)
        existing.add(name.lower())
        added += 1
        print(f"ok: {name} — {lat}, {lon} от @{user.get('username') or user.get('id')}")

    save(PENDING_PATH, pending)
    save(STATE_PATH, state)
    print(f"готово: добавлено {added}, отклонено {skipped}, всего в очереди {len(pending['pending'])}")


if __name__ == "__main__":
    main()
