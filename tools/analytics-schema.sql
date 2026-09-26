/* Схема аналитики pogoda-pro.ru (Cloudflare D1, SQLite) — этап 1
   Применение: dash.cloudflare.com → Storage & Databases → D1 → pogoda-analytics → Console → вставить целиком → Execute.
   Комментарии только в блочном стиле: консоль D1 склеивает строки, и строчные комментарии -- ломают вставку. */
CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, day TEXT NOT NULL, event TEXT NOT NULL, channel TEXT NOT NULL, user_key TEXT NOT NULL, utm_source TEXT, utm_medium TEXT, utm_campaign TEXT, country TEXT, meta TEXT);
CREATE INDEX IF NOT EXISTS idx_events_day ON events (day);
CREATE INDEX IF NOT EXISTS idx_events_event ON events (event, day);
CREATE INDEX IF NOT EXISTS idx_events_user ON events (user_key, day);
CREATE TABLE IF NOT EXISTS donations (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, amount INTEGER NOT NULL, note TEXT, ts INTEGER NOT NULL);
/* Этап 2: заявки на свои скины (форма «Закажи свой стиль»). Антиспам: 1 заявка/сутки на user_key (индекс ниже). */
CREATE TABLE IF NOT EXISTS skin_requests (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, day TEXT NOT NULL, name TEXT NOT NULL, description TEXT, contact TEXT, channel TEXT NOT NULL, user_key TEXT NOT NULL, country TEXT);
CREATE INDEX IF NOT EXISTS idx_skin_requests_day ON skin_requests (day);
CREATE INDEX IF NOT EXISTS idx_skin_requests_user ON skin_requests (user_key, day);
