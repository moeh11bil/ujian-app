#!/bin/bash
LOG_FILE="$1"
PROJECT_DIR="/home/hilya/Aplikasi/ujian-app"
BACKEND_DIR="$PROJECT_DIR/backend"
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

log "Jalankan migrasi database..."
cd "$BACKEND_DIR" && node update-schema.js >> "$LOG_FILE" 2>&1

log "Build frontend..."
cd "$FRONTEND_DIR" && npm run build >> "$LOG_FILE" 2>&1

log "Update selesai! Restart server..."
sleep 1

kill $(lsof -ti:3000) 2>/dev/null
sleep 1
cd "$BACKEND_DIR" && nohup node server.js > server_output.log 2>&1 &

log "Server berhasil direstart"
echo "DONE" >> "$LOG_FILE"
rm -f "$LOCK_FILE"
