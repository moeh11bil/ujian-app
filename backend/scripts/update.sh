#!/bin/bash
LOG_FILE="$1"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_DIR="$(dirname "$BACKEND_DIR")"
FRONTEND_DIR="$PROJECT_DIR/frontend"
LOCK_FILE="$BACKEND_DIR/backups/update.lock"

log() {
  echo "[$(date '+%H:%M:%S')] $1" >> "$LOG_FILE"
}

error_cleanup() {
  log "Error: Proses update gagal!"
  rm -f "$LOCK_FILE"
}
trap error_cleanup ERR

cleanup() {
  rm -f "$LOCK_FILE"
}
trap cleanup EXIT

rm -f "$LOCK_FILE"

log "Memulai proses update..."
cd "$PROJECT_DIR" || { log "Gagal masuk ke direktori $PROJECT_DIR"; exit 1; }

log "Git pull..."
git fetch origin master >> "$LOG_FILE" 2>&1
git reset --hard origin/master >> "$LOG_FILE" 2>&1

log "Install backend dependencies..."
rm -f "$BACKEND_DIR/node_modules/.package-lock.json"
cd "$BACKEND_DIR" && timeout 120 npm install --prefer-offline --no-audit --no-fund >> "$LOG_FILE" 2>&1 || true
NPM_EXIT=$?
if [ $NPM_EXIT -ne 0 ]; then
  log "npm install gagal (exit code $NPM_EXIT), coba dengan cache clean..."
  npm cache clean --force >> "$LOG_FILE" 2>&1
  cd "$BACKEND_DIR" && timeout 120 npm install --no-audit --no-fund >> "$LOG_FILE" 2>&1 || true
fi

log "Install frontend dependencies..."
cd "$FRONTEND_DIR" && timeout 120 npm install --prefer-offline --no-audit --no-fund >> "$LOG_FILE" 2>&1 || true

log "Build frontend..."
cd "$FRONTEND_DIR" && timeout 120 npm run build >> "$LOG_FILE" 2>&1 || true

log "Update selesai! Restart server..."
sleep 1

# Baca PORT dari .env
SERVER_PORT=$(grep '^PORT=' "$BACKEND_DIR/.env" | cut -d= -f2)
SERVER_PORT=${SERVER_PORT:-3000}

# Kill server lama berdasarkan port
kill $(lsof -ti:$SERVER_PORT) 2>/dev/null
sleep 2
cd "$BACKEND_DIR" && nohup node server.js > server_output.log 2>&1 &

log "Server berhasil direstart"
echo "DONE" >> "$LOG_FILE"
rm -f "$LOCK_FILE"
