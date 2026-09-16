#!/bin/bash
# Поднимает сервер (если не запущен) и публичный туннель Pinggy.
# Бесплатный туннель живёт 60 минут — для новой сессии просто перезапустите скрипт.
cd "$(dirname "$0")"

if ! curl -s -o /dev/null http://localhost:7100/; then
  echo "Запускаю сервер на :7100 ..."
  (python3 server.py --port 7100 > server.log 2>&1 & echo $! > server.pid)
  sleep 2
fi

echo "Поднимаю публичный туннель (Pinggy, 60 мин) ..."
ssh -p 443 -o StrictHostKeyChecking=no -o ServerAliveInterval=15 -R0:localhost:7100 a.pinggy.io
