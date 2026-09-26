-- Схема аналитики pogoda-pro.ru (Cloudflare D1, SQLite) — этап 1
-- Применение: dash.cloudflare.com → Workers & Pages → D1 → pogoda-analytics → Console → вставить целиком.

CREATE TABLE IF NOT EXISTS events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  ts           INTEGER NOT NULL,            -- unix, секунды
  day          TEXT    NOT NULL,            -- YYYY-MM-DD (UTC) для быстрых агрегатов
  event        TEXT    NOT NULL,            -- app_open, point_select, …
  channel      TEXT    NOT NULL,            -- site | miniapp
  user_key     TEXT    NOT NULL,            -- w_<uuid> | t_<sha256> | anon (ПДн нет)
  utm_source   TEXT,                        -- первый источник (фиксируется клиентом навсегда)
  utm_medium   TEXT,
  utm_campaign TEXT,
  country      TEXT,                        -- ТОЛЬКО страна (ISO), IP не храним
  meta         TEXT                         -- JSON до 500 симв. (id точки, скин и т.п.)
);
CREATE INDEX IF NOT EXISTS idx_events_day   ON events (day);
CREATE INDEX IF NOT EXISTS idx_events_event ON events (event, day);
CREATE INDEX IF NOT EXISTS idx_events_user  ON events (user_key, day);

CREATE TABLE IF NOT EXISTS donations (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  date   TEXT    NOT NULL,                  -- YYYY-MM-DD
  amount INTEGER NOT NULL,                  -- рубли
  note   TEXT,
  ts     INTEGER NOT NULL                   -- когда внесено в админке
);
