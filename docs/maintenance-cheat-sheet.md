# ASIHJAYA RMS — Maintenance Cheat Sheet

Dokumen ini adalah panduan operasional utama untuk maintenance harian ASIHJAYA RMS, baik di development lokal maupun VPS production/preview.

Tujuan utamanya sederhana: ketika workflow sudah lama tidak disentuh, buka bagian **Quick Cheat Sheet** terlebih dahulu. Bagian lain digunakan ketika membutuhkan detail tambahan.

---

# Quick Cheat Sheet

## 1. Update source lokal

```powershell
cd C:\Users\Misifiksi\Desktop\asihjaya-rms
git switch main
git pull --ff-only origin main
```

## 2. Jalankan development lokal

```powershell
npm run dev
```

Buka aplikasi lokal seperti biasa dan smoke test area yang diubah.

## 3. Commit + push langsung ke `main`

Workflow maintenance default untuk single maintainer:

```powershell
git status --short
git add .
git commit -m "fix: deskripsi perubahan"
git push origin main
git rev-parse HEAD
```

Catat exact SHA dari `git rev-parse HEAD`.

## 4. Deploy normal ke VPS

Jalankan sebagai user `ubuntu`, **tanpa sudo**:

```bash
cd /opt/asihjaya-rms/app
ajsystem-deploy <EXACT_SHA>
```

Gunakan exact SHA agar release yang dipasang tidak ambigu.

## 5. Setelah mengubah `.env.production` di VPS

Canonical environment:

```text
/opt/asihjaya-rms/app/.env.production
```

Jika hanya `.env.production` yang berubah, **tidak perlu commit atau push GitHub**. Terapkan perubahan dengan me-deploy ulang exact SHA yang sedang aktif:

```bash
cd /opt/asihjaya-rms/app
SHA="$(grep '^APP_REVISION=' /var/lib/asihjaya-rms/deployments/current.env | cut -d= -f2)"
ajsystem-deploy "$SHA"
```

Lalu health check:

```bash
curl -fsS http://127.0.0.1:3000/api/health
echo
curl -fsS https://ajsystem.id/api/health
echo
```

**Jangan mengganti `POSTGRES_PASSWORD`, `POSTGRES_USER`, `POSTGRES_DB`, atau `DATABASE_URL` dengan prosedur ini tanpa sinkronisasi credential PostgreSQL. Jangan merotasi `HARDWARE_AGENT_CREDENTIAL_ENCRYPTION_KEY` tanpa migration plan.**

## 6. Cek release aktif VPS

```bash
grep '^APP_REVISION=' /var/lib/asihjaya-rms/deployments/current.env
git rev-parse HEAD
```

Setelah deployment selesai, keduanya harus menunjuk revision yang sama.

## 7. Health check VPS

```bash
curl -fsS http://127.0.0.1:3000/api/health
echo
curl -fsS https://ajsystem.id/api/health
echo
```

## 8. Fresh database LOCAL

> DESTRUKTIF. Hanya jalankan jika memang sengaja ingin menghapus seluruh database development lokal.

```powershell
npm run db:fresh:local -- --confirm=RESET_LOCAL_DATABASE
```

Reset database + hapus local upload storage:

```powershell
npm run db:fresh:local -- --confirm=RESET_LOCAL_DATABASE --purge-local-storage
```

## 9. Fresh total runtime VPS

> **SANGAT DESTRUKTIF.** Menghapus database production/preview, seluruh local uploads, dan Next.js cache, lalu migration + seed ulang.

```bash
ajsystem-rebootstrap <EXACT_SHA> --confirm=RESET_ALL_RUNTIME_DATA
```

Command ini tetap mempertahankan `.env.production`, backup historis, deployment state, Git repository, Docker, reverse proxy, systemd, dan host tooling.

## 10. Status container production

```bash
cd /opt/asihjaya-rms/app

docker compose \
  --env-file .env.production \
  --env-file /var/lib/asihjaya-rms/deployments/current.env \
  -f compose.production.yaml \
  ps
```

## 11. Logs aplikasi

```bash
cd /opt/asihjaya-rms/app

docker compose \
  --env-file .env.production \
  --env-file /var/lib/asihjaya-rms/deployments/current.env \
  -f compose.production.yaml \
  logs --tail 200 app
```

Database:

```bash
docker compose \
  --env-file .env.production \
  --env-file /var/lib/asihjaya-rms/deployments/current.env \
  -f compose.production.yaml \
  logs --tail 200 db
```

## 12. Preflight VPS

```bash
ajsystem-deployment-preflight check
ajsystem-deployment-preflight status
```

## 13. Rollback aplikasi

```bash
ajsystem-rollback check
ajsystem-rollback execute
```

Rollback aplikasi **tidak me-rollback database**. Jika schema berubah, compatibility approval bisa dibutuhkan.

---

# 1. Prinsip Workflow Maintenance

Workflow utama project dibuat sesederhana mungkin:

```text
edit local
→ smoke test
→ commit main
→ push main
→ ambil exact SHA
→ ajsystem-deploy <SHA>
→ smoke test VPS
```

Untuk perubahan environment VPS:

```text
edit /opt/asihjaya-rms/app/.env.production
→ tidak perlu Git commit
→ ambil APP_REVISION aktif
→ ajsystem-deploy <SHA aktif>
→ health check
```

GitHub Quality Gate tetap berjalan otomatis ketika source dipush. Untuk maintenance harian, branch/PR tidak wajib untuk perubahan kecil jika maintainer memilih workflow direct-to-main.

Branch/PR tetap berguna untuk perubahan besar, eksperimental, deployment tooling, migration berisiko tinggi, atau perubahan yang memang membutuhkan isolasi tambahan.

---

# 2. Workflow LOCAL Harian

## Sinkronkan source

```powershell
cd C:\Users\Misifiksi\Desktop\asihjaya-rms
git switch main
git pull --ff-only origin main
```

## Development

```powershell
npm run dev
```

Lakukan perubahan lalu smoke test fitur yang disentuh.

Untuk perubahan yang lebih luas:

```powershell
npm run lint
npm run typecheck
npm run build
```

Tidak perlu menjalankan seluruh suite besar untuk setiap perubahan UI kecil jika scope-nya jelas dan smoke test lokal sudah cukup.

## Commit dan push

```powershell
git status --short
git add .
git commit -m "fix: deskripsi perubahan"
git push origin main
git rev-parse HEAD
```

Exact SHA terakhir adalah revision yang nanti diberikan ke `ajsystem-deploy`.

---

# 3. Workflow Deployment VPS Normal

Canonical project directory:

```text
/opt/asihjaya-rms/app
```

Canonical production environment:

```text
/opt/asihjaya-rms/app/.env.production
```

Current immutable release environment:

```text
/var/lib/asihjaya-rms/deployments/current.env
```

Deploy exact revision:

```bash
cd /opt/asihjaya-rms/app
ajsystem-deploy <EXACT_SHA>
```

`ajsystem-deploy` adalah jalur resmi deployment. Ia menangani fetch source, build image, production environment validation, guarded migration, pre-deployment backup, candidate health, application activation, public health, dan release promotion.

Jangan menggantikan normal deployment dengan rangkaian manual `git pull + docker compose up` kecuali sedang melakukan troubleshooting terarah.

## Setelah deployment

```bash
grep '^APP_RELEASE_ID=' /var/lib/asihjaya-rms/deployments/current.env
grep '^APP_REVISION=' /var/lib/asihjaya-rms/deployments/current.env
git rev-parse HEAD
```

Health:

```bash
curl -fsS http://127.0.0.1:3000/api/health
echo
curl -fsS https://ajsystem.id/api/health
echo
```

Kemudian buka fitur yang baru diubah dan lakukan smoke test browser.

---

# 4. Perubahan UI/UX

Untuk perubahan seperti spacing, layout, typography, label/copywriting, responsive behavior, visual refinement, atau komponen yang tidak mengubah business invariant:

```text
edit → local smoke → push main → exact SHA deploy → browser smoke VPS
```

Tidak perlu reset database.

---

# 5. Perubahan Business Flow Backend

Untuk perubahan backend normal seperti server action, service/business logic, query, API route, authorization flow, calculation, atau business process, workflow deployment tetap:

```bash
ajsystem-deploy <EXACT_SHA>
```

Yang berbeda hanya local test sebelum push harus mencakup flow bisnis yang diubah.

---

# 6. Database Migration

## Aturan penting

1. Jangan edit migration yang sudah pernah applied.
2. Jangan hapus atau ubah urutan historical migration.
3. Perubahan schema baru dibuat sebagai migration baru.
4. Jangan mengubah isi `drizzle.__drizzle_migrations` secara manual untuk membuat deployment terlihat lulus.
5. Normal release production memakai guarded migration melalui `ajsystem-deploy`.

Generate migration baru:

```powershell
npm run db:generate
```

Review SQL migration yang dihasilkan sebelum commit.

## Migration additive / normal

Contohnya tambah table, column, index, compatible constraint, atau schema addition lain.

```text
buat migration baru
→ local test
→ commit + push
→ ajsystem-deploy <SHA>
```

Deployment menjalankan migration secara otomatis.

## Migration destructive

Contoh operasi yang dapat diblokir:

- `DROP TABLE`;
- `DROP COLUMN`;
- `DROP TYPE`;
- `TRUNCATE`;
- `DELETE FROM` di migration;
- perubahan tipe column;
- penghapusan constraint.

Existing database akan **fail closed** jika ada destructive migration pending tanpa explicit one-shot approval.

Jangan menyimpan destructive permission permanen di `.env.production`.

One-shot runner:

```powershell
npm run db:deploy -- --allow-destructive
```

Untuk VPS, gunakan one-shot destructive hanya setelah SQL direview, backup pre-deployment terverifikasi, impact data loss/downtime dipahami, dan exact candidate/release context jelas.

Jika `ajsystem-deploy <SHA>` berhenti karena destructive migration, jangan improvisasi dengan `drizzle-kit migrate`. Gunakan prosedur:

```text
docs/development/database-deployment.md
```

Fresh database berbeda: historical destructive migration diperbolehkan otomatis ketika migration history masih kosong.

---

# 7. Reset / Fresh Database LOCAL

Secara default, database lokal **dipertahankan** agar data preview/regression tidak hilang.

Fresh local database:

```powershell
npm run db:fresh:local -- --confirm=RESET_LOCAL_DATABASE
```

Script menjalankan:

```text
hapus volume database development lokal
→ start PostgreSQL baru
→ seluruh migration
→ db:seed
→ validasi migration/schema
```

Sekaligus hapus local upload storage:

```powershell
npm run db:fresh:local -- --confirm=RESET_LOCAL_DATABASE --purge-local-storage
```

Jangan memakai `--purge-local-storage` jika hanya database yang ingin di-reset.

---

# 8. Full Fresh Runtime VPS — `ajsystem-rebootstrap`

Command:

```bash
ajsystem-rebootstrap <EXACT_SHA> --confirm=RESET_ALL_RUNTIME_DATA
```

Jalankan sebagai user `ubuntu`, **tanpa sudo**.

Command hanya menerima exact lowercase Git SHA yang merupakan bagian dari `origin/main`.

## Yang dihapus

```text
asihjaya-rms-production_postgres_data
asihjaya-rms-production_app_uploads
asihjaya-rms-production_app_next_cache
```

Efek:

```text
PostgreSQL kosong
uploads kosong
Next.js cache kosong
→ deploy exact SHA
→ seluruh migration replay
→ db:seed
→ bootstrap organization/outlet/register/admin
→ restart app
→ local health check
→ public health check
```

## Yang tetap dipertahankan

```text
/opt/asihjaya-rms/app/.env.production
/var/lib/asihjaya-rms/deployments/
backup historis
Git repository
Docker
reverse proxy
systemd service/timer
deployment automation
host/VPS configuration
```

## Storage requirement

Full-upload rebootstrap saat ini hanya mendukung:

```env
IMAGE_STORAGE_DRIVER=local
IMAGE_STORAGE_ROOT=.data/uploads
```

Jika storage driver bukan `local`, command berhenti sebelum destructive volume cleanup.

## Kapan digunakan

Gunakan ketika memang ingin VPS kembali seperti fresh application installation dari sisi data, misalnya preview environment ingin dikosongkan total atau disposable environment memang akan disiapkan ulang.

Jangan gunakan untuk update aplikasi biasa.

---

# 9. Environment VPS

## Canonical environment

```text
/opt/asihjaya-rms/app/.env.production
```

Cek metadata:

```bash
cd /opt/asihjaya-rms/app
stat -c '%F | %U:%G | %a | %n' .env.production
```

Canonical file adalah `.env.production`, **bukan** `/etc/asihjaya-rms/production.env` dan bukan root `.env`.

Jangan paste isi environment lengkap ke chat, issue, commit, atau log publik. Jangan commit `.env.production` ke Git.

## Setelah mengedit `.env.production`

Container yang sudah berjalan tidak otomatis mendapatkan environment baru hanya karena file di host berubah. Setelah save, gunakan workflow berikut:

```bash
cd /opt/asihjaya-rms/app

SHA="$(grep '^APP_REVISION=' /var/lib/asihjaya-rms/deployments/current.env | cut -d= -f2)"
printf 'Active revision: %s\n' "$SHA"

ajsystem-deploy "$SHA"
```

Tidak perlu membuat Git commit baru jika yang berubah hanya konfigurasi private di `.env.production`.

Setelah deployment:

```bash
curl -fsS http://127.0.0.1:3000/api/health
echo
curl -fsS https://ajsystem.id/api/health
echo
```

Kemudian smoke test fitur yang terkait dengan variable yang baru diubah.

### Contoh perubahan environment yang normal

Contohnya konfigurasi server-side integration, timeout, cache duration, URL runtime, Telegram settings, atau secret aplikasi yang memang boleh diganti sesuai prosedur fitur tersebut.

Workflow sederhananya:

```text
edit .env.production
→ save
→ ajsystem-deploy <APP_REVISION aktif>
→ health check
→ smoke test fitur terkait
```

### Credential database — jangan sekadar edit lalu deploy

Variable berikut memiliki hubungan dengan state PostgreSQL yang sudah berjalan:

```text
POSTGRES_DB
POSTGRES_USER
POSTGRES_PASSWORD
DATABASE_URL
```

Jangan mengubah salah satu sisi saja. Perubahan credential database harus disinkronkan antara PostgreSQL dan application connection. Jika dilakukan hanya dengan edit `.env.production` lalu deploy, aplikasi/database dapat kehilangan koneksi.

### Hardware credential encryption key — jangan rotate biasa

```text
HARDWARE_AGENT_CREDENTIAL_ENCRYPTION_KEY
```

Key ini dipakai untuk credential Hardware Hub yang terenkripsi. Jangan merotasinya seperti secret biasa tanpa migration/re-encryption plan untuk data yang sudah tersimpan.

## `.env.production` vs `current.env`

```text
.env.production
  = konfigurasi mutable/private VPS

/var/lib/asihjaya-rms/deployments/current.env
  = identity release/image aktif yang dikelola deployment automation
```

Jangan edit `current.env` secara manual untuk mengganti release identity.

---

# 10. Preflight Deployment

Readiness host:

```bash
ajsystem-deployment-preflight check
```

Status:

```bash
ajsystem-deployment-preflight status
```

Command maintenance tooling lain:

```bash
ajsystem-deployment-preflight snapshot
ajsystem-deployment-preflight lock-test
```

Gunakan `snapshot` atau `lock-test` ketika melakukan maintenance deployment tooling atau diagnosis lock.

---

# 11. Docker Production

## Status

```bash
cd /opt/asihjaya-rms/app

docker compose \
  --env-file .env.production \
  --env-file /var/lib/asihjaya-rms/deployments/current.env \
  -f compose.production.yaml \
  ps
```

## App logs

```bash
docker compose \
  --env-file .env.production \
  --env-file /var/lib/asihjaya-rms/deployments/current.env \
  -f compose.production.yaml \
  logs --tail 200 app
```

## Database logs

```bash
docker compose \
  --env-file .env.production \
  --env-file /var/lib/asihjaya-rms/deployments/current.env \
  -f compose.production.yaml \
  logs --tail 200 db
```

## Migration logs

```bash
docker compose \
  --env-file .env.production \
  --env-file /var/lib/asihjaya-rms/deployments/current.env \
  -f compose.production.yaml \
  logs --tail 200 migrate
```

---

# 12. Backup Database

Package scripts yang tersedia antara lain:

```powershell
npm run db:backup:production
npm run db:backup:weekly
npm run db:backup:verify
npm run db:backup:offsite:verify
```

Normal `ajsystem-deploy` sudah menjalankan pre-deployment backup + verification sebagai bagian deployment orchestration.

Cek timer backup:

```bash
systemctl is-active ajsystem-db-backup-daily.timer
systemctl is-enabled ajsystem-db-backup-daily.timer
systemctl is-active ajsystem-db-backup-weekly.timer
systemctl is-enabled ajsystem-db-backup-weekly.timer
systemctl is-active ajsystem-db-backup-verify.timer
systemctl is-enabled ajsystem-db-backup-verify.timer
```

Daftar jadwal:

```bash
systemctl list-timers --all | grep ajsystem
```

---

# 13. Monitor dan Telegram Operations

Monitor:

```bash
systemctl is-active ajsystem-monitor.timer
systemctl is-enabled ajsystem-monitor.timer
```

Telegram reporting:

```bash
systemctl is-active ajsystem-telegram-delivery.timer
systemctl is-enabled ajsystem-telegram-delivery.timer
systemctl is-active ajsystem-telegram-report-reconcile.timer
systemctl is-enabled ajsystem-telegram-report-reconcile.timer
```

Jalankan monitor sekali:

```bash
sudo systemctl start ajsystem-monitor.service
sudo systemctl status ajsystem-monitor.service --no-pager
```

Karena monitor adalah oneshot service, status dapat kembali `inactive (dead)` setelah selesai. Yang penting invocation terakhir tidak failed.

---

# 14. Rollback

Rollback hanya menuju previous healthy release.

```bash
ajsystem-rollback check
```

Jika compatible dan memang ingin rollback:

```bash
ajsystem-rollback execute
```

Aturan penting:

- database tidak pernah otomatis di-rollback;
- schema change dapat membutuhkan compatibility approval;
- rollback tetap melakukan candidate smoke dan production health;
- jangan memakai rollback sebagai pengganti forward-fix untuk migration database yang sudah mengubah data/schema secara incompatible.

Untuk schema change tersedia:

```bash
ajsystem-rollback approve <compatibility-reference>
ajsystem-rollback deny <compatibility-reference>
```

Gunakan hanya dalam prosedur compatibility rollback yang sudah direview.

---

# 15. Deployment Automation Installation

Source installer:

```text
ops/scripts/ajsystem-install-deployment-automation
```

Install/update host commands:

```bash
cd /opt/asihjaya-rms/app
sudo ./ops/scripts/ajsystem-install-deployment-automation install
```

Verifikasi:

```bash
sudo ./ops/scripts/ajsystem-install-deployment-automation verify
```

Command utama:

```text
ajsystem-deployment-lock
ajsystem-db-backup
ajsystem-deploy
ajsystem-rebootstrap
ajsystem-rollback
ajsystem-deployment-preflight
```

Command runtime deployment/rebootstrap/rollback dijalankan sebagai `ubuntu` tanpa sudo. `sudo` dipakai untuk installer host karena installer menulis ke `/usr/local/sbin`, systemd, dan host-level paths.

---

# 16. Troubleshooting Cepat

## Deployment menolak working tree VPS

```bash
cd /opt/asihjaya-rms/app
git status --short
```

Working tree deployment harus bersih. Jangan memakai `git reset --hard` tanpa mengetahui perubahan yang akan hilang.

## Deployment gagal pada migration

```bash
docker compose \
  --env-file .env.production \
  --env-file /var/lib/asihjaya-rms/deployments/current.env \
  -f compose.production.yaml \
  logs --tail 200 migrate
```

Jika penyebabnya destructive migration, ikuti bagian **Database Migration → Migration destructive**.

## App tidak healthy

```bash
curl -i http://127.0.0.1:3000/api/health
curl -i https://ajsystem.id/api/health
```

```bash
docker compose \
  --env-file .env.production \
  --env-file /var/lib/asihjaya-rms/deployments/current.env \
  -f compose.production.yaml \
  logs --tail 200 app
```

## Database container bermasalah

```bash
docker compose \
  --env-file .env.production \
  --env-file /var/lib/asihjaya-rms/deployments/current.env \
  -f compose.production.yaml \
  ps db
```

```bash
docker compose \
  --env-file .env.production \
  --env-file /var/lib/asihjaya-rms/deployments/current.env \
  -f compose.production.yaml \
  logs --tail 200 db
```

## Perubahan `.env.production` belum terlihat

Pastikan container sudah direcreate melalui exact active revision:

```bash
cd /opt/asihjaya-rms/app
SHA="$(grep '^APP_REVISION=' /var/lib/asihjaya-rms/deployments/current.env | cut -d= -f2)"
ajsystem-deploy "$SHA"
```

Jangan hanya `docker restart app`, karena restart container lama tidak membuat ulang environment dari file host.

## Command host tidak sama dengan source

Contoh rebootstrap:

```bash
sha256sum \
  ops/scripts/ajsystem-rebootstrap \
  /usr/local/sbin/ajsystem-rebootstrap
```

Jika hash berbeda:

```bash
sudo ./ops/scripts/ajsystem-install-deployment-automation install
```

---

# 17. Hal yang Jangan Dilakukan

Hindari shortcut maintenance berikut:

```text
docker compose down -v
docker system prune --volumes
docker volume prune
```

Command tersebut terlalu luas dan dapat menghapus resource di luar target maintenance.

Jangan:

- commit `.env` atau `.env.production`;
- paste secret ke issue/chat/log publik;
- edit `current.env` secara manual;
- mengedit migration lama yang sudah applied;
- menghapus migration history secara manual;
- menjalankan `drizzle-kit migrate` sebagai jalur production release;
- mengganti credential PostgreSQL hanya pada `.env.production` tanpa sinkronisasi database;
- merotasi `HARDWARE_AGENT_CREDENTIAL_ENCRYPTION_KEY` tanpa migration plan;
- menjalankan `ajsystem-rebootstrap` untuk update harian biasa;
- menjalankan deployment/rebootstrap/rollback dengan `sudo`.

---

# 18. Decision Guide Singkat

```text
UI/UX kecil
  → local smoke
  → push main
  → ajsystem-deploy <SHA>

Backend/business flow normal
  → local test flow terkait
  → push main
  → ajsystem-deploy <SHA>

.env.production berubah
  → tidak perlu Git commit
  → ambil APP_REVISION aktif
  → ajsystem-deploy <APP_REVISION aktif>
  → health + feature smoke

DB additive
  → migration baru
  → local test
  → push main
  → ajsystem-deploy <SHA>

DB destructive pada existing DB
  → migration baru
  → review SQL
  → backup verified
  → one-shot destructive procedure
  → deploy/retry exact SHA

Fresh LOCAL database
  → npm run db:fresh:local -- --confirm=RESET_LOCAL_DATABASE

Fresh TOTAL VPS runtime
  → ajsystem-rebootstrap <SHA> --confirm=RESET_ALL_RUNTIME_DATA

Aplikasi release bermasalah
  → ajsystem-rollback check
  → ajsystem-rollback execute jika compatible
```

---

# 19. Referensi Detail

Jika butuh detail di luar cheat sheet ini:

```text
docs/development/database-deployment.md
docs/development/database-backup-restore.md
docs/development/deployment-rollback-automation.md
docs/development/deployment-rollback-vps-rehearsal.md
docs/development/production-environment.md
docs/development/asihjaya-rms-production-handoff.md
```

Cheat sheet ini adalah titik masuk utama untuk maintenance harian. Dokumentasi detail digunakan ketika menangani migration destructive, recovery, restore, deployment tooling, credential/database changes, atau incident yang membutuhkan prosedur lebih lengkap.
