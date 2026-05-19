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
git pull origin master >> "$LOG_FILE" 2>&1

log "Install backend dependencies..."
cd "$BACKEND_DIR" && npm install >> "$LOG_FILE" 2>&1

log "Install frontend dependencies..."
cd "$FRONTEND_DIR" && npm install >> "$LOG_FILE" 2>&1

log "Build frontend..."
cd "$FRONTEND_DIR" && npm run build >> "$LOG_FILE" 2>&1

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
