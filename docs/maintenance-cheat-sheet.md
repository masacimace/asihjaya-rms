# ASIHJAYA RMS — Maintenance Cheat Sheet

Dokumen ini adalah panduan operasional singkat untuk maintenance harian ASIHJAYA RMS, baik di development lokal maupun VPS production/preview.

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

Buka aplikasi lokal seperti biasa dan smoke test hanya area yang diubah.

## 3. Commit + push langsung ke `main`

Workflow maintenance default untuk single maintainer:

```powershell
git add .
git commit -m "fix: deskripsi perubahan"
git push origin main
git rev-parse HEAD
```

Catat exact SHA dari `git rev-parse HEAD`.

## 4. Deploy normal ke VPS

Di VPS, jalankan sebagai user `ubuntu`, **tanpa sudo**:

```bash
cd /opt/asihjaya-rms/app
ajsystem-deploy <EXACT_SHA>
```

Contoh:

```bash
ajsystem-deploy 0123456789abcdef0123456789abcdef01234567
```

Gunakan exact SHA agar release yang dipasang tidak ambigu.

## 5. Cek release aktif VPS

```bash
grep '^APP_REVISION=' /var/lib/asihjaya-rms/deployments/current.env
git rev-parse HEAD
```

Jika deployment baru selesai, keduanya harus menunjuk revision yang sama.

## 6. Health check VPS

```bash
curl -fsS http://127.0.0.1:3000/api/health
echo
curl -fsS https://ajsystem.id/api/health
echo
```

## 7. Fresh database LOCAL

> DESTRUKTIF. Hanya jalankan jika memang sengaja ingin menghapus seluruh database development lokal.

```powershell
npm run db:fresh:local -- --confirm=RESET_LOCAL_DATABASE
```

Reset database + hapus local upload storage:

```powershell
npm run db:fresh:local -- --confirm=RESET_LOCAL_DATABASE --purge-local-storage
```

## 8. Fresh total runtime VPS

> **SANGAT DESTRUKTIF.** Menghapus database production/preview, seluruh local uploads, dan Next.js cache, lalu migration + seed ulang.

```bash
ajsystem-rebootstrap <EXACT_SHA> --confirm=RESET_ALL_RUNTIME_DATA
```

Command ini tetap mempertahankan `.env.production`, backup historis, deployment state, Git repository, Docker, reverse proxy, systemd, dan host tooling.

## 9. Status container production

```bash
cd /opt/asihjaya-rms/app

docker compose \
  --env-file .env.production \
  --env-file /var/lib/asihjaya-rms/deployments/current.env \
  -f compose.production.yaml \
  ps
```

## 10. Logs aplikasi

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

## 11. Preflight VPS

```bash
ajsystem-deployment-preflight check
```

Status ringkas:

```bash
ajsystem-deployment-preflight status
```

## 12. Rollback aplikasi

Cek apakah previous healthy release tersedia:

```bash
ajsystem-rollback check
```

Rollback hanya jika hasil check memang sesuai dengan release yang ingin dikembalikan:

```bash
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

GitHub Quality Gate tetap berjalan otomatis ketika source dipush. Untuk maintenance harian, tidak perlu membuat branch/PR hanya untuk perubahan kecil apabila maintainer memang memilih workflow direct-to-main.

Branch/PR tetap boleh digunakan ketika perubahan sangat besar, eksperimental, atau memang membutuhkan isolasi tambahan. Ini pilihan workflow, bukan kewajiban untuk setiap perubahan.

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

Untuk perubahan yang lebih luas, command berikut tersedia:

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

Jangan menggantikan normal deployment dengan rangkaian manual `git pull + docker compose up` kecuali sedang melakukan troubleshooting yang memang terarah.

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

Untuk perubahan seperti:

- spacing;
- layout;
- typography;
- label/copywriting;
- responsive behavior;
- visual refinement;
- perubahan komponen yang tidak mengubah business invariant;

workflow paling pendek adalah:

```text
edit → local smoke → push main → exact SHA deploy → browser smoke VPS
```

Tidak perlu reset database.

---

# 5. Perubahan Business Flow Backend

Untuk perubahan backend normal seperti:

- server action;
- service/business logic;
- query;
- API route;
- authorization flow;
- calculation/business process;

workflow deployment tetap sama:

```bash
ajsystem-deploy <EXACT_SHA>
```

Yang berbeda hanyalah local test sebelum push harus mencakup flow bisnis yang diubah.

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

Contoh:

- tambah table;
- tambah column;
- tambah index;
- tambah constraint yang kompatibel;
- schema addition lainnya.

Workflow:

```text
buat migration baru
→ local test
→ commit + push
→ ajsystem-deploy <SHA>
```

Deployment akan menjalankan migration secara otomatis.

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

Jangan menyimpan permission destructive permanen di `.env.production`.

One-shot runner tersedia dalam bentuk:

```powershell
npm run db:deploy -- --allow-destructive
```

Tetapi untuk VPS, gunakan one-shot destructive hanya setelah:

1. SQL migration direview;
2. backup pre-deployment terverifikasi;
3. impact data loss/downtime dipahami;
4. exact candidate/release context sudah jelas.

Jika normal `ajsystem-deploy <SHA>` berhenti karena destructive migration, jangan improvisasi dengan `drizzle-kit migrate`. Gunakan prosedur di:

```text
docs/development/database-deployment.md
```

Fresh database berbeda: historical destructive migration diperbolehkan otomatis ketika migration history masih kosong.

---

# 7. Reset / Fresh Database LOCAL

Secara default, database lokal **dipertahankan** agar data preview/regression tidak hilang.

Jika memang sengaja ingin fresh local database:

```powershell
npm run db:fresh:local -- --confirm=RESET_LOCAL_DATABASE
```

Script ini:

```text
hapus volume database development lokal
→ start PostgreSQL baru
→ jalankan seluruh migration
→ jalankan db:seed
→ validasi migration/schema
```

Jika ingin sekaligus menghapus local upload storage:

```powershell
npm run db:fresh:local -- --confirm=RESET_LOCAL_DATABASE --purge-local-storage
```

Jangan memakai flag `--purge-local-storage` jika hanya database yang ingin di-reset.

---

# 8. Full Fresh Runtime VPS — `ajsystem-rebootstrap`

Command:

```bash
ajsystem-rebootstrap <EXACT_SHA> --confirm=RESET_ALL_RUNTIME_DATA
```

Jalankan sebagai user `ubuntu`, **tanpa sudo**.

Command ini hanya menerima exact lowercase Git SHA yang merupakan bagian dari `origin/main`.

## Yang dihapus

```text
asihjaya-rms-production_postgres_data
asihjaya-rms-production_app_uploads
asihjaya-rms-production_app_next_cache
```

Efeknya:

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

Jika storage driver bukan `local`, command akan berhenti sebelum destructive volume cleanup.

## Kapan digunakan

Gunakan hanya ketika memang ingin VPS kembali seperti fresh application installation dari sisi data, misalnya:

- preview environment ingin dikosongkan total;
- selesai perubahan schema besar dan memang sengaja memulai data baru;
- environment disposable akan disiapkan ulang;
- sebelum handoff tertentu ketika seluruh data lama memang tidak diperlukan.

Jangan gunakan command ini untuk update aplikasi biasa.

---

# 9. Environment VPS

Canonical environment file:

```text
/opt/asihjaya-rms/app/.env.production
```

Cek metadata:

```bash
cd /opt/asihjaya-rms/app
stat -c '%F | %U:%G | %a | %n' .env.production
```

Jangan paste isi environment lengkap ke chat, issue, commit, atau log publik karena file tersebut memuat secret.

Jangan commit `.env.production`.

## Release identity

```bash
cat /var/lib/asihjaya-rms/deployments/current.env
```

File `current.env` berisi metadata release dan image aktif. Ia bukan pengganti `.env.production`.

---

# 10. Preflight Deployment

Cek readiness host:

```bash
ajsystem-deployment-preflight check
```

Status:

```bash
ajsystem-deployment-preflight status
```

Command lain yang tersedia:

```bash
ajsystem-deployment-preflight snapshot
ajsystem-deployment-preflight lock-test
```

Gunakan `snapshot` atau `lock-test` hanya ketika sedang melakukan maintenance deployment tooling atau diagnosis lock.

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

Cek timer backup di VPS:

```bash
systemctl is-active ajsystem-db-backup-daily.timer
systemctl is-enabled ajsystem-db-backup-daily.timer

systemctl is-active ajsystem-db-backup-weekly.timer
systemctl is-enabled ajsystem-db-backup-weekly.timer

systemctl is-active ajsystem-db-backup-verify.timer
systemctl is-enabled ajsystem-db-backup-verify.timer
```

Daftar jadwal timer:

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

Telegram reporting timers:

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

Cek terlebih dahulu:

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
- jangan memakai rollback sebagai pengganti forward-fix untuk migration database yang sudah terlanjur mengubah data/schema secara incompatible.

Untuk schema change, command yang tersedia:

```bash
ajsystem-rollback approve <compatibility-reference>
ajsystem-rollback deny <compatibility-reference>
```

Gunakan hanya jika memang sedang menjalankan prosedur compatibility rollback yang sudah direview.

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

Command utama yang dipasang:

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

Cek:

```bash
cd /opt/asihjaya-rms/app
git status --short
```

Working tree deployment harus bersih. Jangan memakai `git reset --hard` tanpa mengetahui perubahan apa yang akan hilang.

## Deployment gagal pada migration

Cek output deployment dan migration log:

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

Lalu:

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

## Command host tidak sama dengan source

Contoh untuk rebootstrap:

```bash
sha256sum \
  ops/scripts/ajsystem-rebootstrap \
  /usr/local/sbin/ajsystem-rebootstrap
```

Jika hash berbeda, install ulang deployment automation dari source revision yang memang ingin dijadikan current tooling:

```bash
sudo ./ops/scripts/ajsystem-install-deployment-automation install
```

---

# 17. Hal yang Jangan Dilakukan

Hindari command berikut sebagai shortcut maintenance biasa:

```text
docker compose down -v
docker system prune --volumes
docker volume prune
```

Command tersebut terlalu luas dan dapat menghapus resource di luar target maintenance yang dimaksud.

Jangan:

- commit `.env` atau `.env.production`;
- paste secret ke issue/chat/log publik;
- mengedit migration lama yang sudah applied;
- menghapus migration history secara manual;
- menjalankan `drizzle-kit migrate` sebagai jalur production release;
- merotasi `HARDWARE_AGENT_CREDENTIAL_ENCRYPTION_KEY` tanpa migration plan untuk credential yang sudah terenkripsi;
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

Jika butuh detail di luar cheat sheet ini, gunakan dokumentasi project berikut:

```text
docs/development/database-deployment.md
docs/development/database-backup-restore.md
docs/development/deployment-rollback-automation.md
docs/development/deployment-rollback-vps-rehearsal.md
docs/development/production-environment.md
docs/development/asihjaya-rms-production-handoff.md
```

Cheat sheet ini adalah titik masuk utama untuk maintenance harian. Dokumentasi detail di atas digunakan ketika sedang menangani migration destructive, recovery, restore, deployment tooling, atau incident yang membutuhkan prosedur lebih lengkap.
