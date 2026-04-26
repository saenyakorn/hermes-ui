#!/bin/sh
set -e
cd /app

# Bind-mount hides image node_modules; anonymous volume keeps Linux-built deps.
# When package-lock.json changes on the host, sync node_modules without manual
# `docker compose down -v` + rebuild.
LOCK_HASH="$(node -e "process.stdout.write(require('crypto').createHash('sha256').update(require('fs').readFileSync('package-lock.json')).digest('hex'))")"
STAMP="/app/node_modules/.hermes-lock-hash"
if [ ! -f "$STAMP" ] || [ "$(cat "$STAMP" 2>/dev/null)" != "$LOCK_HASH" ]; then
  echo "[docker-entrypoint-dev] package-lock.json changed, running npm ci..."
  npm ci
  mkdir -p /app/node_modules
  printf '%s' "$LOCK_HASH" >"$STAMP"
fi

exec "$@"
