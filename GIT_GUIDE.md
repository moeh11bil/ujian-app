# Panduan Git untuk Update Aplikasi

## Awal: Clone & Setup (hanya sekali)

```bash
# Clone repo
git clone https://github.com/moeh11bil/ujian-app.git
cd ujian-app

# Install dependencies
cd backend && npm install
cd ../frontend && npm install
cd ..

# Setup database
cd backend
cp .env.example .env   # edit .env sesuai konfigurasi DB kamu
node scripts/database/create-db.js
node scripts/database/init-db.js
cd ..
```

## Setiap Ada Update Baru

### Cara 1: Via Halaman Web (Mudah)
1. Login sebagai **admin**
2. Buka sidebar → **Pengaturan → Update Aplikasi**
3. Klik **Update Sekarang**
4. Proses otomatis: git pull → install deps → migrasi DB → restart

### Cara 2: Via Terminal

```bash
# Masuk ke folder proyek
cd ~/Aplikasi/ujian-app

# Tarik kode terbaru
git pull origin master

# Install dependencies baru (jika ada)
cd backend && npm install
cd ../frontend && npm install
cd ..

# Jalankan migrasi database (jika ada)
cd backend
node update-schema.js
cd ..

# Build ulang frontend
cd frontend && npm run build
cd ..

# Restart server backend
pm2 restart ujian-app   # atau: kill PID lama, lalu node server.js
```

## Upload Perubahan Sendiri (Push)

```bash
# Cek status
git status

# Stage file yang diubah
git add .

# Atau stage file spesifik
git add backend/src/routes/backup.js
git add frontend/src/pages/admin/BackupRestore.svelte

# Commit
git commit -m "Pesan perubahan"

# Upload ke GitHub
git push origin master
```

## File yang Tidak Ikut di-track (.gitignore)

File/folder berikut otomatis diabaikan git:

| File/Folder | Keterangan |
|-------------|-----------|
| `node_modules/` | Dependensi (install lewat `npm install`) |
| `.env` | Konfigurasi lokal (DB password, dll) |
| `dist/`, `build/` | Hasil build frontend |
| `*.log` | File log server |
| `backend/backups/` | File backup (dibuat lewat fitur Backup) |
| `backend/uploads/soal/images/` | Gambar soal |
| `.agents/` | Konfigurasi opencode |
| `.vscode/`, `.idea/` | Konfigurasi editor |

## Catatan Penting

- **Jangan pernah commit file `.env`** — isinya password database dan secret key
- Sebelum update via halaman web, fitur **Backup** otomatis dapat dijalankan terlebih dahulu
- Jika server mati setelah update, jalankan ulang: `cd backend && node server.js`
- git remote set-url origin https://github.com/moeh11bil/ujian-app.git