#!/bin/bash
LOG_FILE="$1"

log() {
  echo "[$(date '+%H:%M:%S')] $1" >> "$LOG_FILE"
}

log "Memulai proses update..."
cd /home/hilya/Aplikasi/ujian-app

log "Git pull..."
git pull origin master 2>&1 >> "$LOG_FILE"

log "Install backend dependencies..."
cd backend && npm install 2>&1 >> "$LOG_FILE"

log "Install frontend dependencies..."
cd ../frontend && npm install 2>&1 >> "$LOG_FILE"

log "Jalankan migrasi database..."
cd ../backend && node update-schema.js 2>&1 >> "$LOG_FILE"

log "Build frontend..."
cd ../frontend && npm run build 2>&1 >> "$LOG_FILE"

log "Update selesai! Restart server..."
sleep 1

# Kill server lama dan restart
kill $(lsof -ti:3000) 2>/dev/null
sleep 1
cd ../backend && nohup node server.js > server_output.log 2>&1 &

log "Server berhasil direstart"
echo "DONE" >> "$LOG_FILE"
