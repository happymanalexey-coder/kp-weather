#!/usr/bin/env python3
"""Автоприём точек из Telegram-бота @Pagoda_assistant_bot и mini-app (web_app_data).

Запускается из GitHub Actions каждые 15 минут. Читает getUpdates (BOT_TOKEN из
Secrets), принимает заявки двумя путями:
  • текст «Точка: Название — 43.472, 40.534»;
  • mini-app: Telegram.WebApp.sendData({type:"add_point", name, lat, lon}).
Валидные точки публикуются СРАЗУ в data/points.json (GitHub Pages подхватывает
сам, в приложении точка появляется после пересборки и кэша SW — до ~30 минут).

Правила:
  • имена уникальны без учёта регистра; при совпадении бот предлагает «Имя 1»;
  • фильтр мата и негативных названий (BAD_WORDS);
  • не больше 5 заявок в сутки на пользователя;
  • высота определяется через Open-Meteo Elevation API, регион — по координатам,
    marine-флаг — пробой Marine API;
  • админы (data/admins.json) могут удалить любую точку сообщением
    «Удалить: Название» — удаление мгновенное и без подтверждений.

Offset и квоты хранятся в data/intake_state.json.
"""
import json, os, re, sys, time, urllib.parse, urllib.request

TOKEN = os.environ.get("BOT_TOKEN", "")

API = "https://api.telegram.org/bot" + TOKEN
POINTS_PATH = "data/points.json"
STATE_PATH = "data/intake_state.json"
ADMINS_PATH = "data/admins.json"
INBOX_PATH = "data/web_inbox.json"  # заявки с сайта/mini-app через Cloudflare Worker

NAME_RE = re.compile(r"^[А-Яа-яЁёA-Za-z0-9 \-]+$")
MSG_RE = re.compile(
    r"^\s*Точка\s*:\s*(.+?)\s*[—-]\s*(-?\d+(?:[.,]\d+)?)\s*[,\s]\s*(-?\d+(?:[.,]\d+)?)\s*$",
    re.IGNORECASE)
DEL_RE = re.compile(r"^\s*Удалить\s*:\s*(.+?)\s*$", re.IGNORECASE)
BAD_WORDS = ["хуй", "хуя", "хуе", "хуи", "пизд", "бляд", "блят", "ебан", "ебал", "ёбан",
             "ебуч", "мудак", "мудил", "сука", "пидор", "пидар", "гандон", "шлюх",
             "залуп", "манда",
             # негативный смысл и туалетная лексика
             "какашк", "пиписьк", "говн", "дерьм", "жоп", "срал", "срет", "пердн",
             "пёрд", "фекал", "шалав", "проститут",
             # секс/политика/наркотики
             "секс", "порн", "гитлер", "нацист", "наркот"]

TRANSLIT = str.maketrans({
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "yo",
    "ж": "zh", "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m",
    "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u",
    "ф": "f", "х": "kh", "ц": "ts", "ч": "ch", "ш": "sh", "щ": "shch",
    "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya"})


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
    url = f"{API}/{method}?{urllib.parse.urlencode(params)}"
    last = None
    for attempt in range(4):
        try:
            with urllib.request.urlopen(url, timeout=20) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            last = e
            if e.code == 409:
                # параллельный поллер держит getUpdates — ждём и повторяем
                print(f"409 Conflict на {method}, попытка {attempt + 1}/4 — жду 8с")
                time.sleep(8)
                continue
            raise
        except Exception as e:
            last = e
            print(f"{type(e).__name__} на {method}, попытка {attempt + 1}/4 — жду 5с")
            time.sleep(5)
    raise last


def quota_ok(state, uid, now):
    """Не больше 5 заявок в сутки на пользователя."""
    if not uid:
        return False
    quota = state.setdefault("quota", {})
    key = str(uid)
    day_ago = now - 86400
    recent = [t for t in quota.get(key, []) if t > day_ago]
    if len(recent) >= 5:
        quota[key] = recent
        return False
    recent.append(now)
    quota[key] = recent
    return True


def validate(name, lat, lon, existing_names):
    name = " ".join(name.split())
    if not (3 <= len(name) <= 40):
        return None, "название 3–40 символов"
    if not NAME_RE.match(name):
        return None, "недопустимые символы в названии (можно буквы, цифры, пробел и дефис)"
    low = " " + re.sub(r"[^а-яa-z0-9]+", " ", name.lower()) + " "
    if any(w in low for w in BAD_WORDS):
        return None, "название не пройдёт модерацию, придумайте другое"
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        return None, "координаты вне диапазона"
    if abs(lat) < 0.0001 and abs(lon) < 0.0001:
        return None, "координаты 0,0"
    if name.lower() in existing_names:
        return None, "duplicate"
    return name, None


def suggest_name(base, existing_names):
    for i in range(1, 100):
        cand = f"{base} {i}"
        if cand.lower() not in existing_names and len(cand) <= 40:
            return cand
    return None


def slugify(name, existing_ids):
    s = name.lower().translate(TRANSLIT)
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-") or "point"
    slug, i = s, 2
    while slug in existing_ids:
        slug = f"{s}-{i}"
        i += 1
    return slug


def fetch_elevation(lat, lon):
    """Высота через Open-Meteo Elevation API. None — если сервис недоступен."""
    try:
        url = "https://api.open-meteo.com/v1/elevation?" + urllib.parse.urlencode(
            {"latitude": lat, "longitude": lon})
        with urllib.request.urlopen(url, timeout=15) as r:
            d = json.loads(r.read().decode("utf-8"))
        ele = (d.get("elevation") or [None])[0]
        return int(round(ele)) if ele is not None else None
    except Exception as e:
        print(f"elevation failed: {type(e).__name__}")
        return None


def probe_marine(lat, lon):
    """Точка морская, если Marine API отдаёт высоту волны."""
    try:
        url = "https://marine-api.open-meteo.com/v1/marine?" + urllib.parse.urlencode(
            {"latitude": lat, "longitude": lon, "hourly": "wave_height",
             "forecast_days": 1, "timezone": "UTC"})
        with urllib.request.urlopen(url, timeout=15) as r:
            d = json.loads(r.read().decode("utf-8"))
        return any(v is not None for v in (d.get("hourly", {}).get("wave_height") or []))
    except Exception as e:
        print(f"marine probe failed: {type(e).__name__}")
        return False


def classify_region(lat, lon):
    if 43.85 <= lat <= 44.35 and 39.7 <= lon <= 40.6:
        return "Адыгея"
    if 43.55 <= lat <= 43.85 and 39.95 <= lon <= 40.55:
        return "Красная Поляна"
    if 43.35 <= lat <= 43.75 and 39.55 <= lon <= 39.95:
        return "Сочи"
    if 42.9 <= lat <= 43.6 and 40.0 <= lon <= 41.6:
        return "Абхазия"
    if -9.0 <= lat <= -8.2 and 114.3 <= lon <= 115.8:
        return "Бали"
    return "Пользовательская точка"


def notify(chat_id, text):
    """Ответ пользователю в Telegram. Тихо пропускаем ошибки (бот мог быть заблокирован)."""
    if not chat_id:
        return
    try:
        api("sendMessage", chat_id=chat_id, text=text)
    except Exception as e:
        print(f"notify {chat_id} failed: {type(e).__name__}")


def accept_point(points, state, name_raw, lat, lon, user, via, now):
    """Полный цикл одной заявки. Возвращает (ok, reply_text)."""
    existing_names = {p["name"].strip().lower() for p in points.get("points", [])}
    existing_ids = {p["id"] for p in points.get("points", [])}
    name, err = validate(name_raw, lat, lon, existing_names)
    if err == "duplicate":
        sug = suggest_name(" ".join(str(name_raw).split()), existing_names)
        extra = f" Например: «{sug}»" if sug else ""
        return False, f"Имя «{' '.join(str(name_raw).split())}» уже занято, придумайте другое.{extra}"
    if err:
        return False, f"Не принято: «{' '.join(str(name_raw).split())}» — {err}"
    if not quota_ok(state, user.get("id"), now):
        return False, "Не принято: можно предложить не больше 5 точек в сутки"
    ele = fetch_elevation(lat, lon)
    if ele is None:
        return False, "Не получилось определить высоту точки (сервис высот недоступен). Попробуйте ещё раз через полчаса."
    entry = {
        "id": slugify(name, existing_ids),
        "name": name,
        "lat": round(lat, 4),
        "lon": round(lon, 4),
        "ele": ele,
        "region": classify_region(lat, lon),
        "verified": False,
        "added_by": user.get("id"),
        "added_by_username": user.get("username"),
        "added_ts": now,
        "via": via,
    }
    if probe_marine(lat, lon):
        entry["marine"] = True
    points["points"].append(entry)
    print(f"ok {via}: {name} — {lat}, {lon} — {ele} м, {entry['region']}, "
          f"marine={entry.get('marine', False)} от @{user.get('username') or user.get('id')}")
    return True, f"Готово! «{name}» добавлена и появится в приложении в течение ~30 минут 🏔"


def delete_point(points, name_raw):
    """Удаление точки админом. Возвращает (ok, reply_text)."""
    target = " ".join(name_raw.split()).strip().lower()
    for i, p in enumerate(points.get("points", [])):
        if p["name"].strip().lower() == target:
            removed = points["points"].pop(i)
            print(f"deleted by admin: {removed['name']} ({removed['id']})")
            return True, f"Удалено: «{removed['name']}» — пропадёт из приложения в течение ~30 минут ✅"
    return False, f"Точку «{' '.join(name_raw.split())}» не нашёл — проверьте точное название"


def process_inbox(points, state, now):
    """Заявки с сайта/mini-app (их кладёт Cloudflare Worker в data/web_inbox.json).
    uid — хеш IP от воркера, уведомлять некому: ответ уже показан в приложении."""
    inbox = load(INBOX_PATH, {"inbox": []})
    items = inbox.get("inbox", [])
    if not items:
        return 0, 0
    added = skipped = 0
    for item in items:
        name_raw = str(item.get("name") or "")
        try:
            lat, lon = float(item.get("lat")), float(item.get("lon"))
        except (TypeError, ValueError):
            print(f"inbox skip: bad coords {name_raw!r}")
            skipped += 1
            continue
        user = {"id": "web:" + str(item.get("uid") or "anon"), "username": None}
        ok, reply = accept_point(points, state, name_raw, lat, lon, user, "web", now)
        added += 1 if ok else 0
        skipped += 0 if ok else 1
        print(f"inbox {'ok' if ok else 'skip'}: {name_raw!r} — {reply.split(chr(10))[0]}")
    save(INBOX_PATH, {**inbox, "inbox": []})  # meta с пояснением сохраняем
    return added, skipped


def main():
    points = load(POINTS_PATH, {"points": []})
    state = load(STATE_PATH, {"offset": 0})
    admins = set(load(ADMINS_PATH, {"admins": []}).get("admins", []))
    now0 = int(time.time())

    # 1) заявки с сайта/mini-app — не зависят от бота
    web_added, web_skipped = process_inbox(points, state, now0)

    # 2) очередь бота — только если задан токен
    if not TOKEN:
        print("BOT_TOKEN не задан — обработан только web_inbox")
        save(POINTS_PATH, points)
        save(STATE_PATH, state)
        print(f"готово: web добавлено {web_added}, web не принято {web_skipped}")
        return

    try:
        resp = api("getUpdates", offset=state.get("offset", 0), timeout=10)
    except urllib.error.HTTPError as e:
        if e.code == 409:
            print("409 Conflict после ретраев — бота пропускаем, web-заявки сохраняем")
            save(POINTS_PATH, points)
            save(STATE_PATH, state)
            return
        raise
    if not resp.get("ok"):
        print("getUpdates failed:", resp)
        save(POINTS_PATH, points)  # web-заявки не теряем даже при проблемах с ботом
        save(STATE_PATH, state)
        sys.exit(1)

    added, skipped, deleted = 0, 0, 0
    for upd in resp.get("result", []):
        state["offset"] = max(state.get("offset", 0), upd["update_id"] + 1)
        msg = upd.get("message") or upd.get("channel_post") or {}
        user = (msg.get("from") or {})
        chat_id = (msg.get("chat") or {}).get("id") or user.get("id")
        now = int(time.time())
        text = msg.get("text") or ""

        # команда админа: «Удалить: Название»
        m_del = DEL_RE.match(text)
        if m_del:
            if user.get("id") in admins:
                ok, reply = delete_point(points, m_del.group(1))
                deleted += 1 if ok else 0
            else:
                reply = "Удалять точки может только администратор"
            notify(chat_id, reply)
            continue

        # заявка из mini-app: Telegram.WebApp.sendData({type:"add_point",...})
        wad = (msg.get("web_app_data") or {}).get("data")
        if wad:
            try:
                payload = json.loads(wad)
            except Exception:
                payload = {}
            if payload.get("type") != "add_point":
                continue
            name_raw = str(payload.get("name") or "")
            try:
                lat, lon = float(payload.get("lat")), float(payload.get("lon"))
            except (TypeError, ValueError):
                notify(chat_id, "Не принято: координаты не распознаны")
                skipped += 1
                continue
            ok, reply = accept_point(points, state, name_raw, lat, lon, user, "mini_app", now)
            added += 1 if ok else 0
            skipped += 0 if ok else 1
            notify(chat_id, reply)
            continue

        # заявка текстом: «Точка: Название — 43.472, 40.534»
        m = MSG_RE.match(text)
        if not m:
            continue
        name_raw, lat_s, lon_s = m.group(1), m.group(2), m.group(3)
        lat = float(lat_s.replace(",", "."))
        lon = float(lon_s.replace(",", "."))
        ok, reply = accept_point(points, state, name_raw, lat, lon, user, "text", now)
        if not ok and not reply.startswith("Имя"):
            reply += "\nФормат: Точка: Название — 43.472, 40.534"
        added += 1 if ok else 0
        skipped += 0 if ok else 1
        notify(chat_id, reply)

    save(POINTS_PATH, points)
    save(STATE_PATH, state)
    print(f"готово: добавлено {added + web_added} (из них web {web_added}), "
          f"не принято {skipped + web_skipped}, удалено админом {deleted}, "
          f"всего точек {len(points['points'])}")


if __name__ == "__main__":
    main()
