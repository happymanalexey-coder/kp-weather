/* Стиль «Базовый» — текущий дизайн приложения, автор «От разработчиков».
   Значения токенов 1:1 повторяют styles.css (:root = ночь, [data-theme=light] = день):
   base применяется как «сброс к CSS-дефолтам», этот файл — эталон для новых стилей.
   Бейдж verified лежит отдельным файлом: skins/base/badge.svg.
   Новый стиль = копия этой папки с другим id + строка в skins/skins.json. */
window.KP_SKINS = window.KP_SKINS || {};
window.KP_SKINS.base = {
  id: "base",
  name: "Базовый",
  author: "От разработчиков",
  tokens: {
    dark: {
      "--bg": "#0b1220", "--bg2": "#101a2c", "--card": "#16223a", "--card2": "#1a2946",
      "--line": "#24334f", "--text": "#e8eef7", "--text2": "#cdd9ea", "--muted": "#8fa3bf",
      "--accent": "#63d6d0", "--on-accent": "#04202b", "--on-accent2": "#06222a",
      "--terracotta": "#e07856", "--green": "#4ade80", "--yellow": "#facc15", "--red": "#f87171",
      "--blue": "#6db3f2", "--tmax": "#ef6a5a", "--tmin": "#6aa9e0", "--prc": "#5ea3f7",
      "--head": "rgba(11,18,32,.92)", "--overlay": "rgba(4,8,16,.6)",
      "--accent-soft": "rgba(99,214,208,.10)", "--accent-glow": "rgba(99,214,208,.16)",
      "--green-bg": "rgba(74,222,128,.14)", "--yellow-bg": "rgba(250,204,21,.14)",
      "--red-bg": "rgba(248,113,113,.14)", "--red-soft": "rgba(248,113,113,.12)",
      "--shadow": "rgba(0,0,0,.45)", "--shadow2": "rgba(0,0,0,.35)",
      /* хиро-сцена — ночь */
      "--hero-sk0": "#101c30", "--hero-sk1": "#0b1220",
      "--hero-mt1": "#16243c", "--hero-mt2": "#0f1930", "--hero-mt3": "#0a1120",
      "--hero-snow": "#dfeaf2", "--hero-moon": "#e8f4f8", "--hero-sun": "#ffd166",
      "--hero-sub": "#dce7f5", "--hero-shadow": "rgba(0,0,0,.6)", "--hero-globe-shadow": "rgba(0,0,0,.45)",
      "--hi-border": "#8be9e4", "--hi-color": "#aef3ee", "--hi-bg": "rgba(11,18,32,.35)", "--hi-glow": "rgba(139,233,228,.35)",
      "--info-border": "rgba(255,255,255,.75)", "--info-color": "#fff",
      /* иконки погоды */
      "--i-sun": "#ffc93c", "--i-moon": "#dceaf5", "--i-cloud": "#b3c2d6", "--i-fog": "#8fa1b6",
      "--i-rain": "#5ea3f7", "--i-drz": "#86b8f2", "--i-snow": "#cfe8ff", "--i-bolt": "#ffd166", "--i-wind": "#9fb3c8"
    },
    light: {
      "--bg": "#eef2f7", "--bg2": "#e2eaf3", "--card": "#ffffff", "--card2": "#f0f4fa",
      "--line": "#d4dfec", "--text": "#182a44", "--text2": "#cdd9ea", "--muted": "#5d6f88",
      "--accent": "#0f9a8e", "--on-accent": "#04202b", "--on-accent2": "#06222a",
      "--terracotta": "#e07856", "--green": "#4ade80", "--yellow": "#facc15", "--red": "#f87171",
      "--blue": "#6db3f2", "--tmax": "#ef6a5a", "--tmin": "#6aa9e0", "--prc": "#5ea3f7",
      "--head": "rgba(238,242,247,.92)", "--overlay": "rgba(4,8,16,.6)",
      "--accent-soft": "rgba(99,214,208,.10)", "--accent-glow": "rgba(99,214,208,.16)",
      "--green-bg": "rgba(74,222,128,.14)", "--yellow-bg": "rgba(250,204,21,.14)",
      "--red-bg": "rgba(248,113,113,.14)", "--red-soft": "rgba(248,113,113,.12)",
      "--shadow": "rgba(0,0,0,.45)", "--shadow2": "rgba(0,0,0,.35)",
      /* хиро-сцена — день */
      "--hero-sk0": "#7fb2e5", "--hero-sk1": "#cfe3f5",
      "--hero-mt1": "#7d97b8", "--hero-mt2": "#6885a8", "--hero-mt3": "#56719a",
      "--hero-snow": "#ffffff", "--hero-moon": "#e8f4f8", "--hero-sun": "#ffd166",
      "--hero-sub": "#2c4062", "--hero-shadow": "rgba(255,255,255,.55)", "--hero-globe-shadow": "rgba(255,255,255,.6)",
      "--hi-border": "#0d8f88", "--hi-color": "#0b7a74", "--hi-bg": "rgba(255,255,255,.35)", "--hi-glow": "rgba(13,143,136,.25)",
      "--info-border": "rgba(24,42,68,.6)", "--info-color": "#182a44",
      /* иконки погоды */
      "--i-sun": "#ffc93c", "--i-moon": "#7d92ac", "--i-cloud": "#8296ae", "--i-fog": "#6e8199",
      "--i-rain": "#5ea3f7", "--i-drz": "#86b8f2", "--i-snow": "#7aa8d8", "--i-bolt": "#ffd166", "--i-wind": "#6e8199"
    }
  }
};
