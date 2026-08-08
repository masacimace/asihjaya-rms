# ASIHJAYA RMS — Production Handoff & Local-to-VPS Workflow

**Dokumen:** Final handoff Stage 2C.13F  
**Project:** ASIHJAYA RMS / POS  
**Status:** Telegram Reporting + Controlled Same-Day Shift Reopen sudah lulus production-readiness audit  
**Current audited release:** `d8d566d42ee4634c1ee7387c66cb9f6ee3f0172f`  
**Current release ID:** `20260808T054717Z-d8d566d42ee4`  
**Timezone operasional:** `Asia/Jakarta`

Dokumen ini adalah panduan utama untuk programmer, operator, atau sesi AI berikutnya agar memahami cara kerja project tanpa harus membaca seluruh source terlebih dahulu.

## 1. Prinsip paling penting

ASIHJAYA RMS memakai **local-first development**.

```text
LOCAL COMPUTER = tempat development
GIT / GITHUB   = source of truth
VPS            = tempat menjalankan release production
```

Workflow resmi:

```text
ubah source di LOCAL
→ test di LOCAL
→ commit
→ push ke Git
→ deploy exact Git SHA ke VPS
```

Dilarang di VPS:

```text
edit source dengan nano/vim
ubah migration SQL
generate migration
git commit
copy source manual via SCP/FileZilla
hotfix source langsung di /opt/asihjaya-rms/app
```

Jika ada bug di production:

```text
diagnosis di VPS
→ perbaiki source di LOCAL
→ test
→ commit
→ push
→ deploy exact SHA
```

## 2. Arsitektur runtime

```text
Browser / POS Client
        │
        ▼
 Caddy :80 / :443
        │
        ▼
Next.js application
127.0.0.1:3000
        │
        ▼
PostgreSQL 17
private Docker network
```

Port PostgreSQL tidak dipublish ke internet. Application port `3000` hanya bind ke loopback.

## 3. Lokasi penting di VPS

```text
Project checkout
/opt/asihjaya-rms/app

Production secrets
/etc/asihjaya-rms/production.env

Deployment state
/var/lib/asihjaya-rms/deployments/

Telegram runtime state
/var/lib/asihjaya-rms/telegram-reporting/

Local PostgreSQL backup
/var/backups/asihjaya-rms/postgres/

Off-site backup status
/var/lib/asihjaya-rms/offsite-status/

Installed operational commands
/usr/local/sbin/ajsystem-*
```

| Lokasi | Fungsi |
|---|---|
| Git repository | source code, migration, systemd source, documentation |
| `/etc/asihjaya-rms/production.env` | production secrets/config |
| `/var/lib/asihjaya-rms/deployments` | release identity, history, evidence |
| `/var/backups/asihjaya-rms/postgres` | database backup lokal |
| Backblaze B2 | off-site PostgreSQL backup |
| systemd | timer backup, monitor, Telegram delivery, reconciliation |
| Docker Compose | application, PostgreSQL, migrator, operations runtime |

## 4. Workflow development LOCAL → Git → VPS

### 4.1 Mulai di local

```powershell
git status
git branch --show-current
git log -1 --oneline
```

Semua coding dilakukan di local.

### 4.2 Migration database

Migration dibuat di local.

```text
ubah Drizzle schema
→ generate migration di local
→ review SQL
→ test migration pada DB development/test
→ commit migration bersama source
```

Migration yang sudah diterapkan tidak boleh diedit.

### 4.3 Quality gates local

Minimum umum:

```powershell
npm run typecheck
npm run lint
git diff --check
```

Telegram / Shift Reopen:

```powershell
npm run check:telegram
npm run check:shift-reopen
npm run test:telegram-outbox:local
npm run test:telegram-opening:local
npm run test:telegram-daily:local
npm run test:telegram-worker:local
npm run test:telegram-weekly:local
npm run test:telegram-monthly:local
npm run test:telegram-reconciliation:local
npm run test:shift-reopen:local
```

Deployment/operations:

```powershell
npm run check:database-deployment
npm run check:database-backup
npm run check:database-backup-offsite
npm run check:operations-image
npm run check:deployment
npm run check:deployment-orchestration
npm run check:application-rollback
npm run check:deployment-installation
```

Gate besar:

```powershell
npm run check:stabilization
npm run check:all
```

### 4.4 Commit dan push

```powershell
git status --short
git diff --check
git add .
git commit -m "..."
git push origin HEAD
git rev-parse HEAD
git log -1 --oneline
```

Exact SHA hasil `git rev-parse HEAD` adalah SHA yang dideploy.

## 5. Immutable deployment ke VPS

Login sebagai user deployment `ubuntu`.

```bash
cd /opt/asihjaya-rms/app
ajsystem-deployment-preflight check
ajsystem-deploy <EXACT_GIT_SHA>
```

Contoh format:

```bash
ajsystem-deploy d8d566d42ee4634c1ee7387c66cb9f6ee3f0172f
```

Tanda `< >` hanya placeholder dokumentasi.

## 6. Isi automation deployment

```text
deployment lock
→ preflight Git / disk / runtime
→ resolve exact immutable Git SHA
→ checkout detached
→ build operations image
→ validate production environment
→ build app + migrator image
→ verify OCI identity
→ ensure PostgreSQL running
→ pre-deployment PostgreSQL backup
→ local verification
→ upload Backblaze B2
→ off-site verification
→ guarded DB migration
→ candidate container
→ candidate health check
→ activate production app
→ local/public production health
→ promote release metadata
→ write current.env
```

Tiga immutable image resmi:

```text
asihjaya-rms:<release-id>
asihjaya-rms-migrator:<release-id>
asihjaya-rms-operations:<release-id>
```

Tag `latest` dan `production` bukan identitas release resmi.

## 7. Release identity

```text
APP_RELEASE_ID
APP_REVISION
APP_BUILD_DATE
```

Current audited release:

```text
APP_RELEASE_ID=20260808T054717Z-d8d566d42ee4
APP_REVISION=d8d566d42ee4634c1ee7387c66cb9f6ee3f0172f
```

State aktif:

```text
/var/lib/asihjaya-rms/deployments/current.json
/var/lib/asihjaya-rms/deployments/current.env
```

Evidence:

```text
/var/lib/asihjaya-rms/deployments/evidence/<release-id>/
```

File penting:

```text
pre-deployment-backup.json
database-migration.json
candidate-health.json
production-health.json
```

## 8. Guard migration destructive

Operasi seperti `DROP TABLE`, `DROP COLUMN`, `DROP CONSTRAINT`, `DROP TYPE`, `TRUNCATE`, `DELETE FROM`, dan `ALTER COLUMN TYPE` membuat deployment fail-closed.

Temporary approval hanya setelah review:

```text
DATABASE_MIGRATION_ALLOW_DESTRUCTIVE=true
DATABASE_MIGRATION_APPROVAL_REFERENCE=<AUDITABLE_REFERENCE>
```

Setelah selesai:

```text
DATABASE_MIGRATION_ALLOW_DESTRUCTIVE=false
```

dan baris `DATABASE_MIGRATION_APPROVAL_REFERENCE` harus dihapus.

## 9. Rollback

```bash
ajsystem-rollback check
ajsystem-rollback execute
```

Database tidak di-rollback otomatis.

```text
application rollback ≠ database rollback
```

Jika schema berubah, compatibility previous app terhadap schema baru harus direview.

## 10. Backup & disaster recovery

Target:

```text
Server boleh rusak.
Disk boleh hilang.
VM boleh dihapus.

Source + data + secrets tetap dapat dipulihkan.
```

Recovery assets:

```text
SOURCE   → Git repository
DATABASE → local PostgreSQL dump + Backblaze B2
SECRETS  → /etc/asihjaya-rms/production.env + secure external secret backup
```

Timer:

```text
ajsystem-db-backup-daily.timer
ajsystem-db-backup-weekly.timer
ajsystem-db-backup-verify.timer
ajsystem-monitor.timer
```

Flow:

```text
PostgreSQL dump
→ local verification
→ SHA-256
→ Backblaze B2
→ remote verification
→ receipt/status
```

High-level VPS disaster recovery:

```text
1. provision VPS baru
2. install OS/runtime prerequisites
3. clone Git repository
4. restore production secrets
5. restore PostgreSQL backup dari Backblaze B2
6. install AJSystem operational commands/systemd
7. validate database
8. deploy exact known-good Git SHA
9. validate health
10. enable timers
11. acceptance test
12. lanjut operasional
```

## 11. Telegram Reporting

Telegram bersifat outbound-only.

```text
POS event
→ DB transaction
→ immutable payload snapshot
→ telegram_delivery_outbox
→ COMMIT
→ systemd timer
→ delivery worker
→ Telegram API
→ attempt record
```

Telegram failure tidak boleh menggagalkan operasi POS.

Report types:

```text
opening
closing_daily
weekly
monthly
shift_reopened
test
```

Payment reporting V1:

```text
Cash
Bank Transfer
EDC Debit
EDC Credit
```

QRIS/other masih di-hold sesuai contract. Dana Titip tetap domain tersendiri.

Outbox states:

```text
pending
processing
retry
sent
failed
cancelled
```

Idempotency:

```text
(event_key, destination_id)
```

Timer:

```text
ajsystem-telegram-delivery.timer
ajsystem-telegram-report-reconcile.timer
```

Status:

```bash
ajsystem-telegram-reporting status
```

Steady-state target:

```text
integration_enabled=true
pending=0
retry=0
failed=0
```

Service Telegram adalah `Type=oneshot`, sehingga setelah sukses kondisi ini normal:

```text
ActiveState=inactive
SubState=dead
Result=success
ExecMainStatus=0
```

Timer-nya yang harus `enabled` dan `active`.

## 12. Controlled Same-Day Shift Reopen

Contract:

```text
1 outlet + 1 business_date = 1 shift
```

Reopen tidak membuat shift kedua.

Permission:

```text
system_admin
owner
manager
→ shifts.reopen

cashier
→ tidak
```

Flow:

```text
OPEN
→ close
→ CLOSED
→ reopen
→ OPEN
→ final close
→ CLOSED
```

Tetap mempertahankan:

```text
shift_id
business_date
opening_cash
opening cash movement
```

Finance revision:

```text
closing pertama → revision 1 CURRENT
reopen           → revision 1 SUPERSEDED
final closing    → revision 2 CURRENT
```

Weekly/monthly hanya membaca current snapshot (`superseded_at IS NULL`).

Telegram saat reopen:

```text
pending/retry/failed affected report → dapat cancelled
processing → reopen diblok
sent → immutable
sent closing sebelumnya → enqueue shift_reopened correction
final closing → event key revision baru
```

Contoh:

```text
daily-finance:<outlet>:2026-08-08
daily-finance:<outlet>:2026-08-08:r2
```

## 13. Acceptance yang sudah terbukti

```text
Opening
→ Telegram Sent

Closing #1
→ finance revision 1
→ Telegram Daily Sent

Reopen
→ revision 1 SUPERSEDED
→ same shift OPEN
→ Telegram Shift Reopened Sent

Final Closing
→ finance revision 2 CURRENT
→ corrected Daily Telegram Sent
```

Invariant audit:

```text
duplicate shift per outlet/business_date = 0
duplicate current finance snapshot = 0
duplicate revision = 0
invalid superseded state = 0
opening_balance_count reopened shift = 1
```

Telegram audit:

```text
pending = 0
retry   = 0
failed  = 0

idempotency duplicates = 0
invalid outbox state   = 0
invalid attempts       = 0
```

## 14. Monitoring

```bash
ajsystem-monitor
systemctl --failed --no-pager
ajsystem-deployment-preflight check
```

Healthy target:

```text
overall=healthy
critical=0
warning=0
```

## 15. Troubleshooting cepat

### Telegram tidak terkirim

```bash
ajsystem-telegram-reporting status
systemctl is-active ajsystem-telegram-delivery.timer
sudo journalctl -u ajsystem-telegram-delivery.service --since "1 hour ago"
```

Jangan update outbox manual.

### Deployment gagal sebelum migration

Biasanya app lama masih aktif dan DB belum berubah. Perbaiki source di local dan deploy SHA baru.

### Deployment gagal karena destructive guard

Review migration, pastikan backup verified, pakai temporary approval jika memang disetujui, lalu cabut approval setelah deployment.

### Deployment gagal setelah migration

Jangan restore DB spontan. Periksa evidence, migration result, current/previous release, dan compatibility rollback.

### Salah close shift

Gunakan `Buka Kembali Shift` oleh role yang berwenang. Jangan membuat shift kedua.

### DB local stale

Jangan generate migration baru untuk menutupi schema local yang tertinggal.

```powershell
npm run db:migrate
npm run check:database
```

## 16. Command reference

LOCAL:

```powershell
npm run dev
npm run typecheck
npm run lint
npm run check:telegram
npm run check:shift-reopen
npm run check:deployment
git status --short
git diff --check
git rev-parse HEAD
git push origin HEAD
```

VPS:

```bash
cd /opt/asihjaya-rms/app
ajsystem-deployment-preflight check
ajsystem-deploy <EXACT_GIT_SHA>
ajsystem-monitor
ajsystem-telegram-reporting status
systemctl --failed --no-pager
```

## 17. Dokumentasi teknis terkait

```text
docs/development/deployment-rollback-automation.md
docs/development/telegram-reporting-stage-2c.md
docs/development/controlled-shift-reopen.md
docs/development/quality-gates.md
```

Dokumen ini adalah entry point/handoff, bukan pengganti detail teknis.

## 18. Cara melanjutkan di sesi AI baru

Berikan:

```text
1. file dokumentasi ini
2. exact current Git SHA
3. branch yang dipakai
4. stage/tujuan berikutnya
5. error/output terbaru jika ada
```

Instruksi utama:

```text
Audit source dari Git/local.
Jangan mengubah source langsung di VPS.
VPS hanya untuk deployment, runtime, secret, evidence, dan acceptance.
```

## 19. Current audited baseline

```text
Git revision:
d8d566d42ee4634c1ee7387c66cb9f6ee3f0172f

Release:
20260808T054717Z-d8d566d42ee4

Migration:
15 applied
latest = 0014_controlled_shift_reopen

Telegram:
enabled
delivery timer active
reconcile timer active
pending/retry/failed = 0

Monitor:
overall=healthy
critical=0
warning=0

Migration destructive guard:
false

Approval reference:
not present
```

Audit closure:

```text
2C.13A PASS — Release Identity & Deployment Integrity
2C.13B PASS — Runtime / Systemd / Monitoring
2C.13C PASS — Database / Migration / Shift Revision
2C.13D PASS — Telegram Outbox / Retry / Idempotency / Reconciliation
2C.13E PASS — Security / Backup / Deployment Safety
```

## 20. Go-live boundary

Environment ini telah dipakai untuk production-style deployment dan acceptance.

Sebelum true production go-live, lakukan fresh production DB/bootstrap, final secret inventory, restore rehearsal, dan business-data cutover terkontrol.

Jangan menganggap data preview/testing sebagai final production master tanpa proses go-live tersendiri.

## 21. Golden rules

```text
SOURCE berubah di LOCAL.
GIT adalah source of truth.
VPS tidak diedit manual.

Commit.
Push.
Deploy exact SHA.

Migration dibuat di local.
Migration lama tidak diedit.

Backup verified sebelum migration.
Destructive migration fail-closed.

Telegram tidak boleh memblok operasi POS.
Telegram memakai outbox.

Salah close shift:
reopen shift yang sama.
Jangan buat shift kedua.

Rollback app bukan rollback database.

Server boleh hilang.
Data + source + secrets harus tetap recoverable.
```
