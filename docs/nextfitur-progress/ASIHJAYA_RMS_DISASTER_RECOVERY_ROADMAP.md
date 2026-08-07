# ASIHJAYA RMS/POS — Roadmap Disaster Recovery & VPS Migration

**Roadmap:** `1E — Disaster Recovery & Infrastructure Portability`  
**Project:** ASIHJAYA RMS/POS  
**Status:** Planned — harus diselesaikan sebelum real production  
**Development model:** Local-first → GitHub → immutable deployment → VPS rehearsal

---

# 1. Tujuan Utama

Target akhir tahap 1E:

```text
Server boleh rusak.
Disk boleh hilang.
VM boleh dihapus.

Data + source + secrets tetap tersedia.

→ beli VPS baru
→ bootstrap
→ restore
→ cutover
→ lanjut operasional
```

ASIHJAYA tidak boleh bergantung pada keberadaan fisik satu VPS.

VPS harus diperlakukan sebagai **disposable infrastructure**.

Jika production VPS hilang total, sistem harus dapat direkonstruksi menggunakan sumber eksternal yang independen:

```text
GitHub
+
Backblaze B2
+
secure secret recovery
+
Cloudflare/domain account
```

Tidak boleh membutuhkan satu file pun dari disk VPS lama untuk recovery bencana total.

---

# 2. Kondisi Project Sebelum Tahap 1E

Project sudah memiliki fondasi production yang kuat.

Stack:

```text
Next.js 16
React 19
Node.js 24
npm 11
PostgreSQL 17
Drizzle ORM
Docker Compose
Caddy
Cloudflare
Backblaze B2
```

Production path:

```text
/opt/asihjaya-rms/app
```

Production environment:

```text
/etc/asihjaya-rms/production.env
```

Deployment state:

```text
/var/lib/asihjaya-rms/deployments
```

Domain:

```text
https://ajsystem.id
```

Workflow deployment yang sudah tersedia:

```text
Git exact commit
→ immutable Docker build
→ PostgreSQL pre-deployment backup
→ Backblaze B2 off-site verification
→ migration guard
→ candidate smoke test
→ production activation
→ health verification
→ atomic release promotion
→ explicit rollback
```

Operational commands yang sudah tersedia:

```bash
ajsystem-deploy
ajsystem-rollback
ajsystem-deployment-preflight
ajsystem-db-backup
ajsystem-monitor
```

PostgreSQL backup sudah:

```text
dibuat
→ diverifikasi lokal
→ diupload ke Backblaze B2
→ diverifikasi off-site
```

Tetapi full disaster recovery belum dianggap selesai sampai semua komponen production dapat dipulihkan tanpa VPS lama.

---

# 3. Gap yang Harus Ditutup

Sebelum real production, tahap 1E harus memastikan perlindungan terhadap:

## 3.1 Database

Saat ini PostgreSQL dump off-site sudah tersedia.

Yang masih perlu ditambahkan:

```text
Point-in-Time Recovery / PITR
PostgreSQL WAL archiving
restore automation
recovery verification
```

Dump periodik saja memiliki RPO terlalu besar untuk POS production.

## 3.2 Uploaded Media

Production memiliki uploaded/media data di luar PostgreSQL.

Contoh:

```text
Docker volume:
asihjaya-rms-production_app_uploads
```

Data seperti:

```text
foto produk master
foto produk fisik
media upload lain
```

harus ikut memiliki backup off-site.

## 3.3 Production Secrets

Secret production saat ini disimpan di:

```text
/etc/asihjaya-rms/production.env
```

Secret ini tidak masuk Git, sehingga aman dari sisi repository.

Namun jika VPS hilang:

```text
production.env
→ ikut hilang
```

Maka perlu secure encrypted recovery copy.

## 3.4 Fresh VPS Bootstrap

Recovery tidak boleh mengandalkan setup manual yang hanya diingat operator.

Fresh Ubuntu VPS harus dapat dibangun melalui automation yang version-controlled.

## 3.5 Restore Orchestration

Harus tersedia workflow restore yang:

```text
download
→ verify
→ restore
→ validate
```

dan gagal secara aman jika artifact recovery tidak konsisten.

## 3.6 Recovery Metadata

Harus ada manifest yang menjawab:

```text
Commit production terakhir apa?
Backup database mana yang digunakan?
WAL sampai kapan tersedia?
Uploads snapshot mana yang sesuai?
Schema migration sampai index berapa?
Kapan recovery point dibuat?
```

## 3.7 Cloudflare Cutover

Harus ada runbook yang jelas untuk mengganti origin VPS tanpa mengganti URL staff.

## 3.8 Rehearsal

Disaster recovery baru dianggap nyata setelah benar-benar diuji pada VPS kosong.

---

# 4. Recovery Objectives

Tahap `1E.1` harus mengunci dua target.

## 4.1 RPO — Recovery Point Objective

RPO adalah jumlah data maksimal yang boleh hilang setelah disaster.

Target ASIHJAYA:

```text
Target RPO:
≤ 15 menit

Preferred:
≤ 5 menit
```

Contoh:

```text
VPS rusak pukul 14:35
WAL terakhir off-site pukul 14:31

→ kehilangan maksimum sekitar 4 menit
```

RPO harus diuji, bukan hanya diasumsikan.

## 4.2 RTO — Recovery Time Objective

RTO adalah lama waktu sistem boleh offline setelah disaster.

Target awal:

```text
RTO:
30–60 menit
```

Target ini berlaku setelah:

```text
recovery automation selesai
operator sudah memiliki credential
VPS baru sudah tersedia
```

RTO aktual harus dicatat saat rehearsal.

---

# 5. Disaster Scenarios

Tahap 1E harus mendukung dua skenario berbeda.

## 5.1 Planned VPS Migration

Contoh:

```text
pindah provider
upgrade CPU/RAM/storage
pindah region
maintenance provider
cost optimization
```

VPS lama masih hidup.

Goal:

```text
minimal downtime
no data loss
safe fallback
```

High-level flow:

```text
OLD VPS
    ↓
initial database restore/sync
    ↓
initial uploads sync
    ↓
NEW VPS ready
    ↓
internal validation
    ↓
maintenance window
    ↓
final DB catch-up
    ↓
final uploads sync
    ↓
NEW VPS production health
    ↓
Cloudflare origin cutover
    ↓
acceptance test
```

OLD VPS tidak langsung dihapus.

Retention fallback yang direkomendasikan:

```text
24–72 jam
```

selama tidak menerima write production lagi.

## 5.2 Total-Loss Disaster

Contoh:

```text
VPS inaccessible
VM deleted
disk corrupt
provider failure
account incident
filesystem unrecoverable
```

Tidak boleh ada asumsi bahwa VPS lama dapat dibaca.

Recovery source:

| Komponen               | Recovery Source           |
| ---------------------- | ------------------------- |
| Source                 | GitHub                    |
| Exact revision         | DR manifest               |
| PostgreSQL base backup | Backblaze B2              |
| PostgreSQL WAL         | Backblaze B2              |
| Uploaded media         | Backblaze B2              |
| Secrets                | encrypted recovery bundle |
| Docker images          | rebuild dari Git commit   |
| Migrations             | Git + restored DB         |
| Compose                | Git                       |
| Caddy                  | Git                       |
| systemd                | Git                       |
| monitoring             | Git                       |
| backup tooling         | Git                       |
| domain                 | registrar                 |
| edge/cutover           | Cloudflare                |

---

# 6. Prinsip Development

Seluruh source code tahap 1E dikembangkan di lokal.

```text
LOCAL
→ Git
→ GitHub
→ exact commit
→ VPS
```

Jangan mengembangkan script langsung di production VPS.

## 6.1 Dikerjakan di Lokal

```text
backup scripts
WAL archive tooling
uploads backup tooling
secret bundle tooling
bootstrap script
restore orchestrator
manifest logic
systemd definitions
installer
monitor checks
quality checks
documentation
tests
```

## 6.2 Dikerjakan di VPS

Hanya:

```text
production secret configuration
exact commit checkout
immutable deployment
systemd installation
Backblaze credentials
Cloudflare cutover
restore rehearsal
production validation
```

---

# 7. Roadmap Tahapan

## 1E.1 — DR Inventory, Threat Model, RPO & RTO Contract

Tujuan: membuat inventory seluruh state yang dibutuhkan untuk membangun production dari nol.

Audit minimal:

```text
PostgreSQL database
uploads/media
production.env
deployment metadata
Caddy configuration
Cloudflare dependency
systemd definitions
Docker volumes
Docker networks
Git exact revision
backup credentials
SSH keys
domain registrar
Telegram secrets jika sudah ada
future integration secrets
```

Output:

```text
docs/operations/disaster-recovery-contract.md
```

Acceptance:

```text
[ ] semua persistent state teridentifikasi
[ ] tidak ada production-only file tanpa recovery source
[ ] RPO ditetapkan
[ ] RTO ditetapkan
```

## 1E.2 — Off-Site Uploads / Media Backup

Tujuan: melindungi uploaded media dari kehilangan total VPS.

Audit volume/path aktual terlebih dahulu. Jangan hardcode sebelum audit.

Backup harus mendukung:

```text
full snapshot
incremental synchronization
restore
verification
retention
```

Target frequency awal:

```text
setiap 15–60 menit
```

Setiap snapshot harus memiliki metadata seperti snapshot ID, waktu, file count, size, manifest SHA-256, object key, dan verification status.

Acceptance:

```text
[ ] upload backup off-site
[ ] restore berhasil
[ ] hash/manifest cocok
[ ] file count cocok
[ ] old VPS tidak diperlukan untuk restore
```

## 1E.3 — Secure Production Secret Recovery

Tujuan: memastikan production secrets tetap tersedia setelah VPS hilang tanpa menyimpannya plaintext di Git.

Audit seluruh secret:

```text
POSTGRES credentials
application secrets
session/auth secrets
Backblaze B2 credentials
Cloudflare credentials jika disimpan di server
Telegram bot token jika fitur sudah aktif
future external API tokens
```

Buat encrypted secret recovery bundle, misalnya:

```text
asihjaya-production-secrets.enc
```

Recovery key tidak boleh berada di production VPS atau di lokasi yang sama tanpa proteksi tambahan.

Acceptance:

```text
[ ] encrypted bundle dapat dipulihkan pada machine baru
[ ] production.env terbuat dengan permission benar
[ ] token tidak muncul di logs
```

## 1E.4 — PostgreSQL WAL Archiving & Point-in-Time Recovery

Tujuan: mengurangi kehilangan transaksi di antara full backup.

Architecture:

```text
PostgreSQL
→ WAL
→ archive uploader
→ Backblaze B2
```

Recovery:

```text
base backup
→ replay WAL
→ target recovery point
```

Implementasi harus mengikuti PostgreSQL 17 dan diaudit lebih dulu terkait `wal_level`, `archive_mode`, `archive_command`, archive timeout, retention, timeline, dan recovery signal.

WAL uploader harus idempotent, atomic, checksum-aware, dan retry-safe.

Acceptance:

```text
[ ] WAL archived off-site
[ ] PITR rehearsal berhasil
[ ] RPO aktual terukur
[ ] database consistency verified
```

## 1E.5 — Recovery Manifest

Tujuan: membuat satu manifest yang menggambarkan recovery point.

Contoh isi:

```json
{
  "schemaVersion": 1,
  "createdAt": "...",
  "environment": "production",
  "gitRevision": "...",
  "releaseId": "...",
  "database": {
    "baseBackupId": "...",
    "walThrough": "...",
    "migrationCount": 13
  },
  "uploads": {
    "snapshotId": "...",
    "manifestSha256": "..."
  }
}
```

Manifest tidak boleh memuat secret.

Acceptance:

```text
[ ] manifest dibuat otomatis
[ ] manifest ada off-site
[ ] exact Git commit valid
[ ] database artifact valid
[ ] uploads snapshot valid
```

## 1E.6 — Fresh VPS Bootstrap Automation

Target command:

```bash
sudo ./ops/scripts/ajsystem-bootstrap-vps
```

Bootstrap minimal menangani:

```text
OS prerequisites
Docker Engine
Docker Compose
required packages
firewall
production directories
ownership/permissions
deployment user/group
Caddy
systemd reload
backup directories
deployment state directories
log directories
```

Direkomendasikan mode:

```bash
sudo ./ops/scripts/ajsystem-bootstrap-vps check
sudo ./ops/scripts/ajsystem-bootstrap-vps install
sudo ./ops/scripts/ajsystem-bootstrap-vps verify
```

Script harus idempotent.

## 1E.7 — Disaster Restore Orchestrator

Target command:

```bash
ajsystem-disaster-restore
```

Contoh interface:

```bash
ajsystem-disaster-restore check <manifest>
ajsystem-disaster-restore database <manifest>
ajsystem-disaster-restore uploads <manifest>
ajsystem-disaster-restore verify <manifest>
```

Restore harus require explicit target, verify checksums, verify compatibility, log evidence, stop on mismatch, dan tidak silently overwrite active production.

Evidence disimpan di:

```text
/var/lib/asihjaya-rms/disaster-recovery/
```

## 1E.8 — Cloudflare Cutover Workflow

Tujuan: mengganti production origin tanpa mengganti URL user.

User tetap menggunakan:

```text
https://ajsystem.id
```

Planned migration:

```text
new VPS ready
→ origin health verified privately
→ maintenance old VPS
→ final sync
→ switch Cloudflare origin
→ public health test
```

Runbook harus mencatat old IP, new IP, Cloudflare record, proxy status, TLS mode, cutover time, dan rollback procedure.

## 1E.9 — Planned VPS Migration Rehearsal

Gunakan temporary test VPS bila memungkinkan.

Flow:

```text
provision new VPS
→ bootstrap
→ restore secrets
→ initial DB restore
→ restore uploads
→ deploy exact current release
→ private validation
→ maintenance old VPS
→ final DB/uploads sync
→ cutover
→ public acceptance
→ fallback window 24–72h
```

Catat downtime, data loss, sync duration, restore duration, cutover duration, dan operator actions.

## 1E.10 — Total-Loss Disaster Recovery Rehearsal

Ini adalah test terpenting.

Simulasikan production VPS tidak tersedia.

Allowed recovery sources hanya:

```text
GitHub
Backblaze B2
encrypted secret bundle
Cloudflare/domain account
```

Tidak boleh menggunakan:

```text
scp dari old VPS
production.env dari old VPS
Docker volume dari old VPS
database langsung dari old VPS
```

Acceptance:

```text
[ ] application boots
[ ] latest expected transaction exists
[ ] inventory correct
[ ] product images available
[ ] login works
[ ] POS works
[ ] scanner works
[ ] finance data works
[ ] backups resume
[ ] monitoring works
[ ] RPO measured
[ ] RTO measured
```

## 1E.11 — DR Monitoring, Retention & Recurring Restore Test

Monitor:

```text
DB base backup age
WAL archive age
WAL failures
uploads snapshot age
uploads verification
manifest age
B2 availability
backup timer state
restore verification result
disk usage
```

Recurring verification yang direkomendasikan:

```text
monthly: automated restore verification
quarterly: full DR rehearsal on temporary VPS
after major infra change: planned migration rehearsal
```

---

# 8. Backup Retention Strategy

Initial proposal:

## PostgreSQL Base Backup

```text
daily: 7
weekly: 4
monthly: 6–12
```

## WAL

```text
7–14 days
```

sesuai base-backup retention dan biaya storage.

## Uploads

```text
daily snapshots: 7
weekly: 4
monthly: 6
```

## DR Manifests

Simpan seluruh manifest yang masih mereferensikan recovery artifact retained.

Jangan hapus manifest sebelum artifact terkait expire.

---

# 9. Backup Consistency

Database dan uploads dapat berubah pada waktu berbeda.

Recovery contract harus mencegah kondisi:

```text
DB references image
but image snapshot predates upload
```

Untuk mostly immutable product images, snapshot media sedikit lebih baru daripada database biasanya lebih aman daripada lebih lama.

Jangan menghapus uploaded media secara agresif tanpa retention/tombstone policy.

---

# 10. Maintenance Mode

Planned migration membutuhkan write freeze.

Jika belum tersedia, implementasikan production maintenance mode.

Minimal block:

```text
POS transaction creation
shift changes
product writes
finance writes
imports
```

Health endpoint tetap harus tersedia untuk operator.

Maintenance harus explicit dan auditable.

---

# 11. Cloud Provider Independence

Recovery harus bekerja pada compatible Ubuntu VPS, tidak tergantung satu provider.

Dokumentasikan minimum requirements:

```text
Ubuntu version
CPU
RAM
storage
network
public IP
Docker support
```

Provider snapshot boleh menjadi lapisan tambahan, tetapi tidak boleh menjadi satu-satunya DR mechanism.

---

# 12. Security Requirements

Backblaze credentials harus least-privilege.

Recovery key harus terpisah dari encrypted secret bundle.

Simpan emergency SSH key di luar VPS.

Pastikan owner memiliki recovery access untuk:

```text
GitHub
Cloudflare
Domain Registrar
Backblaze
password manager / secret recovery
```

DR gagal jika server dapat direstore tetapi domain atau credential account tidak dapat diakses.

---

# 13. Local Development Workflow

Mulai dari main terbaru:

```powershell
cd C:\Users\Misifiksi\Desktop\asihjaya-rms

git switch main
git pull --ff-only origin main
git status --short
```

Create branch:

```powershell
git switch -c feature/disaster-recovery
```

Lebih baik dipecah:

```text
ops/dr-uploads-backup
ops/dr-secret-recovery
ops/dr-postgres-pitr
ops/dr-bootstrap
ops/dr-restore
ops/dr-cloudflare-runbook
docs/dr-rehearsal
```

Quality checks:

```powershell
npm run typecheck
npm run lint
npm run build
```

Tambahkan checker khusus sesuai tahap, misalnya:

```text
scripts/check-dr-uploads-backup.ts
scripts/check-dr-secret-recovery.ts
scripts/check-dr-postgres-pitr.ts
scripts/check-dr-bootstrap.ts
scripts/check-dr-restore.ts
scripts/check-dr-contract.ts
```

Untuk shell scripts:

```bash
bash -n ops/scripts/<script>
```

Sebelum release, jalankan quality gate deployment yang memang tersedia di `package.json` project.

---

# 14. Commit Strategy

Contoh commit bertahap:

```text
docs(dr): define recovery objectives and inventory
feat(backup): add off-site uploads snapshots
feat(dr): add encrypted secret recovery workflow
feat(db): add PostgreSQL WAL archiving support
feat(dr): add recovery manifest
feat(ops): add fresh VPS bootstrap
feat(dr): add disaster restore orchestrator
docs(dr): add Cloudflare cutover runbook
test(dr): add planned VPS migration rehearsal
test(dr): add total-loss recovery rehearsal
```

Jangan membuat satu commit DR raksasa.

---

# 15. Immutable Deployment Workflow

Semua source DR tetap melewati workflow normal.

Local:

```powershell
git push
# merge ke main
git rev-parse HEAD
```

VPS:

```bash
cd /opt/asihjaya-rms/app

RELEASE_COMMIT='HASH_40_KARAKTER'

git fetch --prune origin
git cat-file -e "${RELEASE_COMMIT}^{commit}"
git checkout --detach "$RELEASE_COMMIT"

test "$(git rev-parse HEAD)" = "$RELEASE_COMMIT"
test -z "$(git status --porcelain --untracked-files=all)"

ajsystem-deployment-preflight check
```

Deploy:

```bash
set -o pipefail

DEPLOY_LOG="$HOME/ajsystem-dr-$(date -u +%Y%m%dT%H%M%SZ).log"

ajsystem-deploy "$RELEASE_COMMIT" \
  |& tee "$DEPLOY_LOG"

DEPLOY_EXIT=${PIPESTATUS[0]}

printf 'DEPLOY_LOG=%s\n' "$DEPLOY_LOG"
printf 'DEPLOY_EXIT=%s\n' "$DEPLOY_EXIT"
```

Required:

```text
DEPLOY_EXIT=0
```

---

# 16. Do Not Do

```text
DO NOT store production.env in Git
DO NOT rely only on provider snapshots
DO NOT edit production source directly
DO NOT delete old backup before new backup verification
DO NOT enable WAL archiving without restore test
DO NOT run destructive restore against live production casually
DO NOT use docker volume prune during recovery experiments
DO NOT claim DR complete before total-loss rehearsal
DO NOT assume backup = recoverable until restore succeeds
```

---

# 17. Definition of Done

Tahap 1E selesai hanya jika:

```text
[ ] RPO contract documented
[ ] RTO contract documented

[ ] PostgreSQL base backup off-site verified
[ ] PostgreSQL WAL off-site verified
[ ] PITR tested

[ ] uploaded media off-site verified
[ ] uploaded media restore tested

[ ] production secrets encrypted off-site
[ ] secrets restore tested

[ ] DR manifest implemented
[ ] exact Git revision recoverable

[ ] fresh VPS bootstrap automated
[ ] bootstrap idempotent

[ ] disaster restore orchestrator implemented
[ ] restore evidence stored

[ ] Cloudflare cutover runbook tested

[ ] planned VPS migration rehearsal passed
[ ] total-loss rehearsal passed

[ ] actual RPO measured
[ ] actual RTO measured

[ ] backup/restore monitoring active
[ ] recurring restore test documented

[ ] old VPS not required for total-loss recovery
```

Final statement hanya setelah semua check pass:

```text
ASIHJAYA RMS/POS can recover from total VPS loss.
```

---

# 18. Operational Emergency Quick Flow

Saat disaster nyata terjadi:

```text
1. Declare incident.
2. Provision fresh Ubuntu VPS.
3. Clone Git repository.
4. Checkout revision from latest valid DR manifest.
5. Run VPS bootstrap.
6. Restore encrypted production secrets.
7. Restore PostgreSQL base backup.
8. Replay WAL to latest valid recovery point.
9. Restore uploaded media.
10. Verify recovery manifest.
11. Deploy exact application release.
12. Run preflight and health checks.
13. Test login/POS/data/media.
14. Switch Cloudflare origin.
15. Verify public domain.
16. Resume backup timers.
17. Record actual RPO/RTO and incident evidence.
```

---

# 19. Planned Migration Quick Flow

```text
1. Provision new VPS.
2. Bootstrap new VPS.
3. Restore production secrets.
4. Restore latest DB backup.
5. Restore uploads.
6. Checkout current Git revision.
7. Deploy and test private origin.
8. Enable maintenance on old VPS.
9. Perform final DB/WAL catch-up.
10. Perform final uploads sync.
11. Verify new VPS.
12. Switch Cloudflare origin.
13. Test public production.
14. Disable maintenance.
15. Keep old VPS for 24–72h fallback.
16. Decommission old VPS only after sign-off.
```

---

# 20. Handoff Prompt untuk Sesi Chat Baru

Gunakan prompt berikut bersama roadmap ini:

```text
Saya ingin mengimplementasikan tahap 1E — Disaster Recovery & Infrastructure Portability untuk project ASIHJAYA RMS/POS.

Saya melampirkan:
ASIHJAYA_RMS_DISASTER_RECOVERY_ROADMAP.md

Gunakan roadmap tersebut sebagai contract utama.

Target utama:

Server boleh rusak.
Disk boleh hilang.
VM boleh dihapus.

Data + source + secrets tetap tersedia.

→ beli VPS baru
→ restore
→ lanjut operasional

Project saat ini sudah memiliki:
- immutable deployment
- exact Git commit release
- PostgreSQL verified backup
- Backblaze B2 off-site backup
- migration guard
- candidate health check
- explicit rollback
- monitoring
- Cloudflare
- Caddy
- Docker Compose

Yang harus ditambahkan:
- off-site uploads/media backup
- encrypted production secret recovery
- PostgreSQL WAL archiving / PITR
- DR recovery manifest
- fresh VPS bootstrap automation
- disaster restore orchestrator
- Cloudflare cutover workflow
- planned migration rehearsal
- total-loss disaster rehearsal
- recurring restore verification

Development harus LOCAL-FIRST.

Semua source, migration, tests, systemd definition, installer, dan documentation dibuat di lokal lalu masuk Git.

Jangan develop source langsung di VPS.

VPS hanya untuk:
- production secrets
- exact commit deployment
- systemd installation
- recovery rehearsal
- production validation
- Cloudflare cutover

Mulai dari:
1E.1 — DR Inventory, Threat Model, RPO & RTO Contract

Jangan langsung membuat seluruh fitur sekaligus.

Audit source dan persistent production state terlebih dahulu.

Setiap code bundle hanya boleh berisi file baru atau file yang berubah.

Selalu berikan Git add, commit, dan push commands di akhir setiap tahap.
```

---
