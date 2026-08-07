# ASIHJAYA RMS/POS — Roadmap Implementasi Telegram Reporting

**Dokumen handoff implementasi**  
**Versi:** 1.1 — Local-first development revision  
**Tanggal revisi:** 7 Agustus 2026  
**Project:** ASIHJAYA FINISHING / ASIHJAYA RMS + POS

## 1. Tujuan dokumen

Dokumen ini menjadi handoff untuk implementasi fitur **Telegram Integration** pada project ASIHJAYA RMS/POS di sesi chat baru.

Seluruh implementasi wajib memakai pola **local-first development**:

```text
Audit dan coding di lokal
→ test dengan database lokal dan mocked Telegram API
→ test opsional dengan bot development
→ Git commit dan push
→ review/merge ke main
→ checkout exact commit di VPS
→ immutable deployment
→ konfigurasi secret production
→ instalasi service/timer
→ production acceptance test
```

**Jangan mengembangkan atau mengedit source langsung di VPS.** VPS hanya digunakan sebagai environment deployment, konfigurasi production, dan validasi operasional.

Model integrasi yang disepakati:

```text
ASIHJAYA RMS/POS
→ Telegram Bot
→ private Telegram group per outlet
```

Telegram hanya menjadi kanal pengiriman notifikasi dan laporan. Database RMS tetap menjadi sumber data utama.

---

## 2. Konteks project

### Stack

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

### Production VPS

```text
Project path:
  /opt/asihjaya-rms/app

Production environment:
  /etc/asihjaya-rms/production.env

Deployment state:
  /var/lib/asihjaya-rms/deployments

Domain:
  https://ajsystem.id
```

### Deployment workflow yang sudah tersedia

```text
Git exact commit
→ immutable Docker images
→ pre-deployment PostgreSQL backup
→ Backblaze B2 verification
→ migration guard
→ candidate smoke test
→ production health check
→ atomic promotion
→ rollback support
```

Command utama:

```bash
ajsystem-deploy <exact-commit>
ajsystem-rollback check
ajsystem-rollback execute <release-id>
ajsystem-deployment-preflight check
ajsystem-deployment-preflight status
ajsystem-monitor
```

Seluruh implementasi Telegram harus mengikuti workflow ini.

---

## 2A. Aturan implementasi local-first

### Source of truth

Source of truth project adalah repository Git.

```text
Laptop lokal
→ Git repository
→ GitHub
→ exact commit di VPS
```

Dilarang melakukan development dengan mengedit file berikut langsung di VPS:

```text
src/
scripts/
drizzle/
ops/
compose.production.yaml
package.json
Dockerfile*
```

Perubahan darurat di VPS hanya boleh berupa konfigurasi secret atau operasi runtime yang memang tidak masuk Git, misalnya:

```text
/etc/asihjaya-rms/production.env
systemctl start/stop/status
journalctl
ajsystem-deploy
ajsystem-rollback
```

### Pembagian tanggung jawab environment

| Area                       | Lokal |                         GitHub |                             VPS |
| -------------------------- | ----: | -----------------------------: | ------------------------------: |
| Audit source dan schema    |    Ya |                          Tidak |                           Tidak |
| Coding Telegram client     |    Ya |                Menyimpan versi |                           Tidak |
| Migration Drizzle/SQL      |    Ya |                Menyimpan versi | Dijalankan otomatis saat deploy |
| Mock Telegram API test     |    Ya |                          Tidak |                           Tidak |
| Bot development test       |    Ya |                          Tidak |                           Tidak |
| Unit/integration test      |    Ya | Hasil melalui CI jika tersedia |                           Tidak |
| Systemd unit source        |    Ya |                Menyimpan versi |    Di-install dari exact commit |
| Bot token production       | Tidak |                          Tidak |                              Ya |
| Private group production   | Tidak |                          Tidak |                     Ya/Telegram |
| Immutable deployment       | Tidak |       Menyediakan exact commit |                              Ya |
| Acceptance test production | Tidak |                          Tidak |                              Ya |
| Monitoring dan rollback    | Tidak |                          Tidak |                              Ya |

### Pemisahan bot development dan production

Gunakan bot dan group terpisah:

```text
Development:
  Bot development
  Private group development
  Database lokal

Production:
  Bot production
  Private group per outlet
  Database production
```

Jangan pernah memakai group owner/finance production untuk test berulang selama development.

### Secret contract

Local secret disimpan hanya pada environment lokal yang diabaikan Git.

Production secret disimpan hanya pada:

```text
/etc/asihjaya-rms/production.env
```

Token tidak boleh berada pada:

```text
Git
patch/ZIP code bundle
screenshot
shared deployment log
database
client-side bundle
health endpoint
```

---

## 3. Scope yang sudah disepakati

### Termasuk

```text
Outbound-only Telegram bot
Private group per outlet
Penerima: owner, manager, finance
Opening shift notification
Closing outlet + daily finance summary
Weekly finance report
Monthly finance report
Cost of goods dan gross margin
Summary text only
Delivery outbox
Retry
Idempotency
Delivery audit
Admin test message
Delivery history
Manual retry
Systemd worker dan timers
Monitoring
Immutable deployment ke VPS
```

### Tidak termasuk

```text
Telegram commands
Approval melalui Telegram
Input closing shift melalui Telegram
Telegram Mini App
Two-way chat
Webhook
Long polling
PDF attachment
Excel attachment
Consolidated all-outlet report
```

---

## 4. Contract operasional outlet

Setiap outlet hanya memiliki satu shift.

```text
Shift dibuka  = outlet dibuka
Shift ditutup = outlet ditutup
```

Kasir utama menjadi operator opening dan closing.

Tidak diperlukan multi-shift aggregation dalam satu hari.

Report dikirim per outlet ke private group outlet tersebut.

---

## 5. Contract waktu report

### Daily

```text
Dikirim setelah outlet closing
```

Jika outlet belum closing, report ditunda.

### Weekly

```text
Periode: Senin 00:00 sampai Minggu 23:59
Dikirim setelah closing terakhir yang relevan
```

### Monthly

```text
Periode: tanggal 1 sampai hari terakhir bulan
Dikirim malam akhir bulan setelah outlet closing
```

Jika outlet tidak buka pada akhir periode:

```text
periode tetap dikunci sesuai kalender
→ report berstatus menunggu closing
→ report dikirim setelah closing berikutnya
```

Timezone default:

```text
Asia/Jakarta
```

---

## 6. Business date

Report harus mengikuti `businessDate` shift, bukan tanggal server ketika Telegram dikirim.

Contoh:

```text
Shift dibuka: 31 Agustus 18:00
Shift ditutup: 1 September 00:30
Business date: 31 Agustus
```

Seluruh transaksi tetap masuk laporan Agustus.

Business date wajib menjadi bagian dari:

```text
shift
finance snapshot
Telegram event
daily report
weekly report
monthly report
```

---

## 7. Prinsip arsitektur

### Telegram tidak boleh menghambat closing

Flow yang salah:

```text
Closing shift
→ call Telegram
→ Telegram timeout
→ closing gagal
```

Flow yang benar:

```text
BEGIN DATABASE TRANSACTION

→ simpan closing shift
→ simpan finance snapshot
→ buat Telegram outbox event

COMMIT

→ worker mengirim Telegram secara asynchronous
```

Jika Telegram gagal:

```text
closing tetap sukses
Telegram delivery = retry/pending
```

### Payload snapshot

Outbox menyimpan snapshot immutable. Jangan menghitung ulang report dari data yang sudah berubah setelah event dibuat.

### Idempotency

Contoh event key:

```text
outlet-opened:<outlet-id>:<business-date>
daily-finance:<outlet-id>:<business-date>
weekly-finance:<outlet-id>:<period-start>
monthly-finance:<outlet-id>:<year-month>
```

Unique constraint:

```text
event_key + destination_id
```

Retry, deployment, atau worker restart tidak boleh menghasilkan duplicate message.

---

## 8. Finance snapshot contract

Historical gross margin tidak boleh dihitung dari harga modal master saat report dikirim.

Idealnya sale item menyimpan:

```text
selling_price_snapshot
cost_price_snapshot
discount_snapshot
net_amount_snapshot
```

Audit awal harus memeriksa:

```text
apakah cost snapshot sudah tersedia
apakah net sales snapshot tersedia
apakah payment breakdown immutable
apakah expected cash dan actual cash tersimpan
apakah cash variance tersimpan
apakah hold cart dan pending approval dapat dihitung stabil
```

Jika cost snapshot belum ada, buat additive migration baru. Jangan edit migration lama.

---

## 9. Message contract

### Opening shift

```text
🟢 OUTLET DIBUKA

Outlet: Pasar Bantar Gebang
Tanggal operasional: 7 Agustus 2026
Kasir utama: Rosalia Manda
Waktu buka: 08:02 WIB
Kas awal: Rp2.000.000

Shift: SHIFT-20260807-001
Status: Operasional dimulai
```

Data minimal:

```text
outlet
business date
main cashier
opening time
opening cash
shift id
```

### Closing + daily finance

Closing dan daily report digabung menjadi satu pesan.

```text
🔴 OUTLET DITUTUP — DAILY FINANCE REPORT

Outlet: Pasar Bantar Gebang
Tanggal operasional: 7 Agustus 2026
Kasir utama: Rosalia Manda
Buka: 08:02 WIB
Tutup: 18:11 WIB

Gross sales: Rp25.450.000
Diskon: Rp350.000
Net sales: Rp25.100.000

Cost of goods: Rp18.250.000
Gross margin: Rp6.850.000
Gross margin rate: 27,29%

Cash: Rp10.500.000
Transfer: Rp8.600.000
EDC: Rp6.000.000

Expected cash: Rp12.500.000
Actual cash: Rp12.450.000
Variance: -Rp50.000

Transaksi: 18
Produk terjual: 22
Hold cart tersisa: 0
Approval pending: 0

Status: Perlu review variance kas
```

### Weekly report

```text
📊 WEEKLY FINANCE REPORT

Outlet: Pasar Bantar Gebang
Periode: 3–9 Agustus 2026

Gross sales: Rp152.300.000
Net sales: Rp149.850.000
Cost of goods: Rp108.400.000
Gross margin: Rp41.450.000
Gross margin rate: 27,66%

Transaksi: 112
Produk terjual: 137
Total diskon: Rp2.450.000
Total variance kas: -Rp75.000

Vs minggu sebelumnya: +8,4%
```

### Monthly report

```text
📈 MONTHLY FINANCE REPORT

Outlet: Pasar Bantar Gebang
Periode: Agustus 2026

Gross sales: Rp675.400.000
Net sales: Rp661.750.000
Cost of goods: Rp482.100.000
Gross margin: Rp179.650.000
Gross margin rate: 27,15%

Transaksi: 486
Produk terjual: 603
Total diskon: Rp13.650.000
Total variance kas: -Rp215.000

Vs bulan sebelumnya: +5,7%
```

---

## 10. Database design

Migration harus additive dan memakai nomor migration baru sesuai urutan project saat implementasi.

### `telegram_destinations`

```text
id
outlet_id
name
chat_id
destination_type
is_active
created_at
updated_at
created_by
updated_by
```

Fase pertama:

```text
satu destination aktif per outlet
chat_id unique
```

### `telegram_report_settings`

```text
id
destination_id
opening_enabled
closing_daily_enabled
weekly_enabled
monthly_enabled
timezone
is_active
created_at
updated_at
```

### `telegram_delivery_outbox`

```text
id
event_key
destination_id
outlet_id
report_type
business_date
period_start
period_end
payload_snapshot_json
message_text
status
attempt_count
max_attempts
next_attempt_at
locked_at
locked_by
sent_at
telegram_message_id
last_error_code
last_error_message
created_at
updated_at
```

Status:

```text
pending
processing
retry
sent
failed
cancelled
```

Constraint:

```text
unique(event_key, destination_id)
```

### `telegram_delivery_attempts`

```text
id
delivery_id
attempt_number
requested_at
completed_at
http_status
telegram_ok
telegram_error_code
telegram_error_description
telegram_message_id
duration_ms
created_at
```

Jangan menyimpan bot token atau URL Telegram lengkap yang berisi token.

### Finance closing snapshot

Jika belum tersedia, pertimbangkan tabel additive:

```text
finance_closing_snapshots
```

Kolom minimal:

```text
id
shift_id
outlet_id
business_date
gross_sales
discount_total
net_sales
cost_of_goods
gross_margin
gross_margin_rate
cash_total
transfer_total
edc_total
expected_cash
actual_cash
cash_variance
transaction_count
items_sold_count
held_transaction_count
pending_approval_count
opened_at
closed_at
cashier_id
created_at
```

---

## 11. Telegram bot setup

### Bot creation

Buat bot melalui BotFather.

Catat:

```text
bot username
bot token
```

Token tidak boleh masuk Git.

### Group setup

Untuk setiap outlet:

```text
buat private group
tambahkan owner
tambahkan manager
tambahkan finance
tambahkan bot
```

Bot hanya perlu permission mengirim pesan.

### Chat ID

Chat ID boleh didapat melalui utility setup sementara.

Jangan mengaktifkan webhook.

Jangan menjalankan long polling permanen.

### Secret management

Local:

```env
TELEGRAM_INTEGRATION_ENABLED=false
TELEGRAM_BOT_TOKEN=...
```

Production:

```text
/etc/asihjaya-rms/production.env
```

Tambahkan:

```env
TELEGRAM_INTEGRATION_ENABLED=true
TELEGRAM_BOT_TOKEN=...
TELEGRAM_API_BASE_URL=https://api.telegram.org
TELEGRAM_REQUEST_TIMEOUT_MS=10000
TELEGRAM_MAX_ATTEMPTS=5
```

Permission production env harus tetap aman:

```text
root:ubuntu
640
```

Token tidak boleh muncul pada:

```text
Git
console log
browser
API response
health endpoint
deployment evidence
database
error report
```

---

## 12. Telegram client

Direkomendasikan berada di:

```text
src/server/integrations/telegram/
```

Contoh struktur:

```text
telegram-client.ts
telegram-types.ts
telegram-errors.ts
telegram-message-formatter.ts
telegram-delivery-service.ts
telegram-redaction.ts
```

Client minimal:

```text
getMe()
sendMessage()
```

Tidak perlu:

```text
getUpdates()
setWebhook()
callback query
command router
```

### Timeout

Gunakan `AbortController`.

### Retry classification

Retry:

```text
network timeout
HTTP 429
HTTP 500–599
temporary Telegram error
```

Jangan retry tanpa batas untuk:

```text
invalid bot token
invalid chat id
bot removed from group
forbidden
malformed request
```

Jika Telegram memberikan `retry_after`, simpan ke `next_attempt_at`.

### Redacted logging

Log boleh berisi:

```text
delivery id
report type
destination id
HTTP status
Telegram error code
attempt
duration
```

Log tidak boleh berisi token.

---

## 13. Outbox worker

Script yang disarankan:

```text
scripts/run-telegram-delivery.ts
```

Command:

```text
npm run telegram:deliver
```

Flow:

```text
ambil pending batch
→ lock rows
→ tandai processing
→ sendMessage
→ catat attempt
→ sent/retry/failed
```

Concurrency protection:

```text
PostgreSQL advisory lock
atau
FOR UPDATE SKIP LOCKED
```

Batch awal:

```text
10–25 delivery per run
```

Contoh retry policy:

```text
Attempt 1: langsung
Attempt 2: +1 menit
Attempt 3: +5 menit
Attempt 4: +15 menit
Attempt 5: +60 menit
Lalu failed
```

Manual retry menggunakan delivery row yang sama, bukan membuat event baru.

---

## 14. Event generation

### Opening

Setelah opening transaction sukses:

```text
outlet-opened:<outlet-id>:<business-date>
```

### Closing + daily

Dalam transaction closing:

```text
simpan closing
simpan finance snapshot
buat daily event
commit
```

Event key:

```text
daily-finance:<outlet-id>:<business-date>
```

### Weekly

Ketika closing selesai:

```text
cek weekly period yang sudah selesai
cek destination weekly aktif
cek event belum ada
buat weekly event
```

Event key:

```text
weekly-finance:<outlet-id>:<period-start>
```

### Monthly

Event key:

```text
monthly-finance:<outlet-id>:<year-month>
```

---

## 15. Report reconciliation

Tetap diperlukan reconciliation job untuk menangani:

```text
server restart
deployment saat closing
event generation terlewat
outlet tidak buka pada akhir periode
```

Script:

```text
scripts/run-telegram-report-reconciliation.ts
```

Command:

```text
npm run telegram:reconcile-reports
```

Flow:

```text
cari period yang sudah selesai
→ cari destination aktif
→ cari finance snapshot
→ buat missing event secara idempotent
```

Jalankan setiap satu jam.

---

## 16. Admin UI

Route:

```text
/admin/integrasi/telegram
```

Permission:

```text
owner/admin
manager tertentu jika disetujui
```

Sales POS tidak boleh mengakses halaman ini.

### Fitur minimal

```text
integration status
bot username
destination mapping per outlet
test message
opening toggle
closing/daily toggle
weekly toggle
monthly toggle
timezone
delivery history
last error
manual retry
```

Token tidak pernah ditampilkan.

### Test message

Test message tidak boleh membuat finance event.

Contoh:

```text
✅ ASIHJAYA RMS Telegram Integration

Test message berhasil.
Outlet: Pasar Bantar Gebang
Waktu: 7 Agustus 2026 10:30 WIB
```

### Delivery history

Kolom:

```text
created at
outlet
report type
status
attempts
sent at
Telegram message ID
last error
action
```

Action:

```text
view
retry
```

---

## 17. Systemd dan VPS operations

### Delivery service

```text
ajsystem-telegram-delivery.service
```

Tipe:

```text
oneshot
```

### Delivery timer

```text
ajsystem-telegram-delivery.timer
```

Frekuensi awal:

```text
setiap 2 menit
```

### Reconciliation service

```text
ajsystem-telegram-report-reconcile.service
```

### Reconciliation timer

```text
ajsystem-telegram-report-reconcile.timer
```

Frekuensi:

```text
setiap 1 jam
```

### Monitor

Monitor memeriksa:

```text
timer enabled
timer active
last successful delivery run
last successful reconciliation run
pending backlog
retry backlog
failed delivery count
oldest pending age
```

Telegram failure tidak boleh membuat health utama POS menjadi gagal.

---

## 18. Security

Telegram summary tidak boleh memuat:

```text
password
bot token
payment gateway secret
full card number
customer phone
customer address
personal data yang tidak diperlukan
```

Gunakan private group.

Jika token bocor:

```text
revoke di BotFather
buat token baru
update production.env
restart delivery service
test connection
```

Plain text direkomendasikan pada fase awal agar escaping lebih aman.

---

## 19. Testing strategy

### Unit tests

```text
message formatter
currency formatter
date formatter
business date
weekly boundary
monthly boundary
gross margin
comparison percentage
retry classification
token redaction
event key generation
```

### Telegram API mocked tests

```text
send success
timeout
HTTP 429 + retry_after
HTTP 500
HTTP 401
HTTP 403
invalid chat ID
duplicate event
worker restart
concurrent worker
```

### Database tests

```text
unique event key
outbox state transition
attempt audit
retry scheduling
manual retry
destination disabled
report disabled
```

### Closing tests

```text
closing tetap sukses saat Telegram timeout
daily event hanya dibuat sekali
finance snapshot konsisten
duplicate closing tidak membuat duplicate message
```

### Weekly tests

```text
Monday–Sunday boundary
week crossing month
outlet tidak buka Minggu
delayed sending
previous week comparison
no duplicate
```

### Monthly tests

```text
28-day February
29-day February
30-day month
31-day month
shift crossing midnight
business date assignment
previous month comparison
no duplicate
```

---

## 19A. Matrix implementasi lokal sampai VPS

Setiap tahap harus memiliki batas yang jelas.

| Tahap             | Dikerjakan di lokal                    | Dikerjakan di VPS                | Gate sebelum lanjut                        |
| ----------------- | -------------------------------------- | -------------------------------- | ------------------------------------------ |
| 2C.0 Audit        | Audit source, schema, shift, finance   | Tidak ada                        | Contract dan gap terdokumentasi            |
| 2C.1 Connectivity | Mock API + bot development             | Tidak ada                        | `getMe` dan test message development lulus |
| 2C.2 Client       | Client, timeout, retry, redaction      | Tidak ada                        | Unit/integration tests lulus               |
| 2C.3 Outbox       | Migration dan repository pada DB lokal | Migration dijalankan oleh deploy | Fresh DB dan upgraded DB lulus             |
| 2C.4 Opening      | Event generation lokal                 | Acceptance test opening          | Duplicate guard lulus                      |
| 2C.5 Daily        | Finance snapshot dan formatter lokal   | Acceptance test closing          | Closing tetap sukses saat Telegram gagal   |
| 2C.6 Worker       | Worker dan mocked delivery lokal       | Timer/service test               | Retry dan locking lulus                    |
| 2C.7 Weekly       | Aggregation lokal                      | Acceptance period                | Boundary Senin–Minggu lulus                |
| 2C.8 Monthly      | Aggregation lokal                      | Acceptance period                | Month/business date tests lulus            |
| 2C.9 Admin UI     | UI dan permission lokal                | Configure destination            | Token tidak terekspos                      |
| 2C.10 Ops         | Unit/service/installer dibuat lokal    | Install dan verify               | Installer idempotent                       |
| 2C.11 Release     | Final quality gates dan merge          | Immutable deploy + rehearsal     | `DEPLOY_EXIT=0`, monitor healthy           |

Tidak ada tahap coding yang memerlukan edit source langsung di VPS.

---

## 20. Roadmap implementasi bertahap

### 2C.0 — Baseline audit dan contract lock

**Environment utama:** Lokal

Checklist:

```text
[ ] audit shift opening
[ ] audit shift closing
[ ] audit payment methods
[ ] audit cost snapshots
[ ] audit gross margin source
[ ] audit business date
[ ] audit permissions
[ ] audit admin route patterns
[ ] audit systemd/operations pattern
```

Output:

```text
audit document
data flow map
report field contract
schema gap list
```

### 2C.1 — Bot setup dan local connectivity

**Environment utama:** Lokal + private group development

```text
[ ] BotFather setup
[ ] local secret
[ ] private test group
[ ] chat ID discovery
[ ] getMe script
[ ] send test script
[ ] token redaction
```

### 2C.2 — Telegram client

**Environment utama:** Lokal

```text
[ ] typed client
[ ] getMe
[ ] sendMessage
[ ] timeout
[ ] retry_after
[ ] typed errors
[ ] redacted logs
[ ] mocked tests
```

### 2C.3 — Database outbox dan audit

**Environment utama:** Lokal; migration production hanya melalui immutable deploy

```text
[ ] destinations
[ ] report settings
[ ] delivery outbox
[ ] delivery attempts
[ ] constraints
[ ] indexes
[ ] repositories
[ ] state transition tests
```

### 2C.4 — Opening notification

**Environment utama:** Lokal; VPS hanya acceptance test setelah release

```text
[ ] hook shift opening
[ ] event key
[ ] payload snapshot
[ ] setting guard
[ ] destination guard
[ ] duplicate test
```

### 2C.5 — Closing + daily finance

**Environment utama:** Lokal; VPS hanya acceptance test setelah release

```text
[ ] closing transaction integration
[ ] finance snapshot
[ ] gross sales
[ ] discount
[ ] net sales
[ ] cost of goods
[ ] gross margin
[ ] payment breakdown
[ ] expected cash
[ ] actual cash
[ ] variance
[ ] transaction count
[ ] items sold
[ ] hold count
[ ] pending approval count
[ ] Telegram failure does not block closing
```

### 2C.6 — Delivery worker

**Environment utama:** Lokal; systemd runtime diuji di VPS setelah source di-merge

```text
[ ] locking
[ ] batch processing
[ ] sent
[ ] retry
[ ] failed
[ ] retry_after
[ ] concurrent safety
[ ] graceful exit
```

### 2C.7 — Weekly report

**Environment utama:** Lokal

```text
[ ] Monday–Sunday
[ ] business date aggregation
[ ] delayed report
[ ] previous week comparison
[ ] idempotency
```

### 2C.8 — Monthly report

**Environment utama:** Lokal

```text
[ ] calendar month
[ ] business date handling
[ ] delayed report
[ ] previous month comparison
[ ] idempotency
```

### 2C.9 — Admin UI

**Environment utama:** Lokal; destination production dikonfigurasi setelah deploy

```text
[ ] permission guard
[ ] destination mapping
[ ] enable/disable settings
[ ] test message
[ ] delivery history
[ ] manual retry
[ ] responsive layout
[ ] token never exposed
```

### 2C.10 — VPS services dan timers

**Source dibuat di lokal; instalasi dan verifikasi dilakukan di VPS.**

```text
[ ] delivery service
[ ] delivery timer
[ ] reconciliation service
[ ] reconciliation timer
[ ] installer
[ ] uninstaller
[ ] verify command
[ ] journal logging
[ ] monitor integration
```

### 2C.11 — Production rehearsal

**Environment utama:** VPS, menggunakan exact commit yang sudah lulus seluruh quality gate lokal

```text
[ ] real private group test
[ ] opening message
[ ] closing/daily message
[ ] weekly test
[ ] monthly test
[ ] invalid token test
[ ] invalid chat ID test
[ ] timeout and retry test
[ ] duplicate prevention
[ ] audit verification
[ ] timer verification
[ ] monitor healthy
```

---

## 21. Workflow local-first yang wajib

### 21.1 Sinkronkan `main`

```powershell
cd C:\Users\Misifiksi\Desktop\asihjaya-rms

git switch main
git pull --ff-only origin main
git status --short
```

Working tree harus bersih sebelum membuat branch.

### 21.2 Branch strategy

Jangan mengembangkan seluruh fitur dalam satu perubahan raksasa.

Rekomendasi branch:

```text
feature/telegram-client
feature/telegram-outbox
feature/telegram-opening-report
feature/telegram-daily-report
feature/telegram-periodic-reports
feature/telegram-admin-settings
ops/telegram-systemd
```

Jika implementasi dilakukan berurutan dalam satu branch integrasi, setiap tahap tetap harus memiliki commit terpisah dan checker khusus.

### 21.3 Environment lokal awal

Mulai dengan integrasi dimatikan:

```env
TELEGRAM_INTEGRATION_ENABLED=false
TELEGRAM_BOT_TOKEN=
TELEGRAM_API_BASE_URL=http://127.0.0.1:PORT_MOCK
TELEGRAM_REQUEST_TIMEOUT_MS=1000
TELEGRAM_MAX_ATTEMPTS=5
```

Jangan membuat kebutuhan koneksi ke Telegram production untuk menjalankan unit test atau build.

### 21.4 Mock Telegram API

Sebelum menggunakan bot nyata, sediakan mock server lokal yang dapat mensimulasikan:

```text
200 sendMessage success
401 invalid token
403 bot removed/forbidden
400 invalid chat ID
429 retry_after
500 temporary failure
network timeout
malformed response
```

Test harus dapat berjalan deterministik dan tidak mengirim pesan Telegram nyata.

### 21.5 Bot development

Setelah mocked tests lulus:

```env
TELEGRAM_INTEGRATION_ENABLED=true
TELEGRAM_BOT_TOKEN=<DEVELOPMENT_BOT_TOKEN>
TELEGRAM_API_BASE_URL=https://api.telegram.org
```

Gunakan private group development. Jangan gunakan token atau chat ID production.

### 21.6 Database lokal

Migration dibuat dan diuji di lokal terhadap dua kondisi:

```text
Fresh database:
semua migration dijalankan dari awal

Upgraded database:
database dengan migration existing
→ hanya migration Telegram baru dijalankan
```

Wajib memvalidasi:

```text
unique event key
destination constraint
outbox state transitions
worker locking
finance snapshot
previous application compatibility
```

### 21.7 Test flow lokal

Urutan test yang direkomendasikan:

```text
formatter/unit tests
→ Telegram mocked client tests
→ repository/outbox tests
→ opening integration test
→ closing/daily integration test
→ worker retry test
→ weekly/monthly boundary tests
→ admin UI test
→ production build
```

### 21.8 Quality gates

Minimal:

```powershell
npm run typecheck
npm run lint
npm run build
```

Checker khusus yang direkomendasikan:

```text
scripts/check-telegram-client.ts
scripts/check-telegram-outbox.ts
scripts/check-telegram-reporting.ts
scripts/check-telegram-operations.ts
```

Contoh:

```powershell
npx tsx scripts/check-telegram-client.ts
npx tsx scripts/check-telegram-outbox.ts
npx tsx scripts/check-telegram-reporting.ts
npx tsx scripts/check-telegram-operations.ts
```

Sebelum release ke VPS, jalankan scripts yang benar-benar tersedia pada `package.json`, termasuk:

```powershell
npm run check:database-deployment
npm run check:deployment
npm run check:deployment-orchestration
npm run check:application-rollback
npm run typecheck
npm run lint
npm run build
```

Jangan memakai nama npm script yang tidak ada. Periksa dengan:

```powershell
npm run
```

### 21.9 Review sebelum commit

```powershell
git status --short
git diff --check
git diff
```

Jangan gunakan `git add .` tanpa memeriksa file yang ikut masuk.

### 21.10 Commit discipline

Contoh commit bertahap:

```text
feat(telegram): add outbound API client
feat(telegram): add delivery outbox schema
feat(telegram): enqueue shift opening notification
feat(finance): snapshot closing report metrics
feat(telegram): send daily closing summaries
feat(telegram): add weekly and monthly reports
feat(admin): add Telegram integration settings
feat(ops): install Telegram delivery timers
```

Contoh command:

```powershell
git add -- <file-baru-dan-berubah>
git commit -m "feat(telegram): add outbound API client"
git push -u origin HEAD
```

Jangan membuat empty commit.

### 21.11 Merge dan release commit

Setelah branch lulus review:

```powershell
git switch main
git pull --ff-only origin main
git merge --no-ff <nama-branch>
git push origin main
git rev-parse HEAD
```

Hash 40 karakter hasil `git rev-parse HEAD` adalah satu-satunya commit yang boleh dideploy.

---

## 22. Rollout migration dan feature flag

Semua migration dibuat dan diuji di lokal. Production migration hanya dijalankan oleh `ajsystem-deploy`.

Jangan menjalankan SQL manual ke production database kecuali dalam prosedur recovery yang sudah diaudit.

### Release A — Schema dan dormant feature

Isi:

```text
tabel destinations
tabel report settings
tabel outbox
tabel delivery attempts
finance snapshot jika diperlukan
Telegram client
admin settings dasar
```

Feature flag:

```env
TELEGRAM_INTEGRATION_ENABLED=false
```

Timer belum diaktifkan.

Tujuan:

```text
membuktikan migration additive
membuktikan previous release tetap compatible
mengonfigurasi destination tanpa mengirim report otomatis
```

### Release B — Opening dan closing/daily event generation

Aktifkan bertahap melalui settings:

```text
opening_enabled=true
closing_daily_enabled=false
weekly_enabled=false
monthly_enabled=false
```

Setelah opening stabil:

```text
closing_daily_enabled=true
```

### Release C — Periodic reports dan timers

Setelah data daily tervalidasi:

```text
weekly_enabled=true
monthly_enabled=true
```

Aktifkan delivery dan reconciliation timers.

### Compatibility rule

Migration harus additive sehingga rollback aplikasi tetap memungkinkan.

```text
Jangan rename/drop kolom existing
Jangan ubah migration lama
Jangan membuat closing bergantung pada Telegram API
Jangan menghapus outbox saat rollback
```

---

## 23. Deployment ke VPS

VPS tidak digunakan untuk coding. Semua file yang di-install harus berasal dari exact Git commit yang sudah lulus quality gate lokal.

Urutan wajib:

```text
merge ke main
→ catat exact commit
→ checkout detached commit di VPS
→ configure secret dengan integration off
→ immutable deploy
→ install service/timer dari source release
→ configure destination
→ test message
→ enable integration bertahap
```

### Merge ke main

```powershell
git switch main
git pull --ff-only origin main
git merge --no-ff feature/telegram-reporting
git push origin main
git rev-parse HEAD
```

### Checkout exact commit

```bash
cd /opt/asihjaya-rms/app

RELEASE_COMMIT='HASH_COMMIT_40_KARAKTER'

git fetch --prune origin
git cat-file -e "${RELEASE_COMMIT}^{commit}"
git checkout --detach "$RELEASE_COMMIT"

test "$(git rev-parse HEAD)" = "$RELEASE_COMMIT"
test -z "$(git status --porcelain --untracked-files=all)"

git status --branch --short
```

Tidak boleh ada edit manual atau untracked file di source production.

### Production secret

Tambahkan ke:

```text
/etc/asihjaya-rms/production.env
```

```env
TELEGRAM_INTEGRATION_ENABLED=false
TELEGRAM_BOT_TOKEN=...
TELEGRAM_API_BASE_URL=https://api.telegram.org
TELEGRAM_REQUEST_TIMEOUT_MS=10000
TELEGRAM_MAX_ATTEMPTS=5
```

Permission:

```bash
sudo chown root:ubuntu /etc/asihjaya-rms/production.env
sudo chmod 640 /etc/asihjaya-rms/production.env
```

Jangan menampilkan token pada log yang dibagikan.

### Preflight

```bash
ajsystem-deployment-preflight check
ajsystem-deployment-preflight status
```

### Immutable deployment

```bash
set -o pipefail

DEPLOY_LOG="$HOME/ajsystem-telegram-reporting-$(date -u +%Y%m%dT%H%M%SZ).log"

ajsystem-deploy "$RELEASE_COMMIT" \
  |& tee "$DEPLOY_LOG"

DEPLOY_EXIT=${PIPESTATUS[0]}

printf 'DEPLOY_LOG=%s\n' "$DEPLOY_LOG"
printf 'DEPLOY_EXIT=%s\n' "$DEPLOY_EXIT"
```

Harus:

```text
DEPLOY_EXIT=0
```

### Install systemd units

Contoh installer:

```bash
sudo ./ops/scripts/ajsystem-install-telegram-reporting install
sudo ./ops/scripts/ajsystem-install-telegram-reporting verify
```

Jangan aktifkan timers sebelum destination dan test message selesai.

### Configure destination

Buka:

```text
https://ajsystem.id/admin/integrasi/telegram
```

Masukkan:

```text
outlet
destination name
chat ID
opening enabled
closing/daily enabled
weekly enabled
monthly enabled
```

Kirim test message.

### Enable integration

Ubah:

```env
TELEGRAM_INTEGRATION_ENABLED=true
```

Restart/recreate melalui workflow ops yang terdokumentasi, bukan edit container manual.

### Start timers

```bash
sudo systemctl enable --now \
  ajsystem-telegram-delivery.timer \
  ajsystem-telegram-report-reconcile.timer
```

Audit:

```bash
systemctl is-enabled ajsystem-telegram-delivery.timer
systemctl is-active ajsystem-telegram-delivery.timer
systemctl is-enabled ajsystem-telegram-report-reconcile.timer
systemctl is-active ajsystem-telegram-report-reconcile.timer
systemctl list-timers 'ajsystem-telegram-*' --all --no-pager
```

---

## 24. Production acceptance test

### Connectivity

```text
[ ] getMe berhasil
[ ] test message masuk
[ ] token tidak muncul di log
[ ] invalid chat ID ditangani benar
```

### Opening

```text
[ ] kasir utama membuka shift
[ ] opening transaction berhasil
[ ] outbox event dibuat
[ ] message masuk
[ ] duplicate opening tidak membuat duplicate message
```

### Closing + daily

```text
[ ] closing berhasil
[ ] finance snapshot dibuat
[ ] daily event dibuat
[ ] summary cocok dengan RMS
[ ] gross margin benar
[ ] cash variance benar
[ ] Telegram failure tidak membatalkan closing
```

### Weekly/monthly

```text
[ ] period benar
[ ] report per outlet
[ ] comparison benar
[ ] delayed delivery bekerja
[ ] no duplicate
```

### Retry

```text
[ ] timeout disimulasikan
[ ] delivery menjadi retry
[ ] attempt audit tercatat
[ ] setelah recovery message terkirim
[ ] tidak duplicate
```

### Monitor

```bash
ajsystem-monitor
```

Audit journal:

```bash
journalctl -u ajsystem-telegram-delivery.service -n 100 --no-pager
journalctl -u ajsystem-telegram-report-reconcile.service -n 100 --no-pager
```

---

## 25. Rollback strategy

Karena migration additive, tabel Telegram tetap ada saat rollback aplikasi.

Sebelum rollback:

```bash
ajsystem-rollback check
```

Jika release lama tidak memahami worker baru, hentikan timer:

```bash
sudo systemctl stop \
  ajsystem-telegram-delivery.timer \
  ajsystem-telegram-report-reconcile.timer
```

Lalu:

```bash
ajsystem-rollback execute <previous-release-id>
```

Setelah rollback:

```bash
ajsystem-deployment-preflight status
ajsystem-monitor
```

Outbox pending tidak boleh dihapus otomatis.

---

## 26. Failure handling

### Invalid token

```text
delivery failed
admin alert
monitor warning/critical
closing tetap sukses
```

### Bot removed from group

```text
Telegram 403
delivery failed
destination unhealthy
admin memperbaiki membership
```

### Invalid chat ID

```text
non-retryable
failed
admin configuration error
```

### Telegram outage

```text
retry dengan backoff
outbox tetap tersimpan
no duplicate
```

### VPS restart

```text
timer kembali aktif
pending diproses
stale processing rows direcover
```

---

## 27. Definition of Done

```text
[ ] outbound-only bot aktif
[ ] satu private group per outlet
[ ] owner, manager, finance menerima report
[ ] opening notification berhasil
[ ] closing + daily report berhasil
[ ] weekly report berhasil
[ ] monthly report berhasil
[ ] gross margin memakai cost snapshot valid
[ ] business date benar
[ ] Telegram failure tidak menghambat closing
[ ] outbox idempotent
[ ] retry bekerja
[ ] delivery audit tersedia
[ ] test message tersedia
[ ] delivery history tersedia
[ ] manual retry tersedia
[ ] services terpasang
[ ] timers aktif
[ ] monitor sehat
[ ] immutable deployment berhasil
[ ] rollback plan teruji
[ ] token tidak bocor
```

---

## 28. Prompt handoff untuk sesi chat baru

```text
Saya ingin melanjutkan implementasi fitur Telegram Reporting untuk project ASIHJAYA RMS/POS.

Saya sudah melampirkan dokumen:
ASIHJAYA_RMS_TELEGRAM_REPORTING_ROADMAP.md

Tolong baca roadmap tersebut sebagai contract utama implementasi.

Implementasi wajib local-first:
- audit, coding, migration, tests, dan source systemd dikerjakan di lokal;
- test awal memakai mocked Telegram API dan private bot/group development;
- source tidak boleh diedit langsung di VPS;
- VPS hanya untuk secret production, immutable deployment exact commit, instalasi service/timer, dan acceptance test.

Scope:
- outbound-only Telegram Bot
- private group per outlet
- penerima owner, manager, finance
- opening shift notification
- closing shift + daily finance report
- weekly report Senin–Minggu
- monthly report bulan kalender
- cost dan gross margin boleh ditampilkan
- summary text only
- outbox, retry, idempotency, delivery audit
- admin test message dan delivery history
- systemd worker dan timers
- immutable deployment dari lokal ke VPS

Tidak termasuk:
- Telegram commands
- approval melalui Telegram
- input dari Telegram
- Telegram Mini App
- two-way chat
- webhook
- long polling
- PDF/Excel attachment

Project sudah memiliki immutable deployment dan rollback.

Mulai dari tahap:
2C.0 — Baseline Audit dan Contract Lock

Jangan langsung membuat seluruh fitur.
Audit source project terlebih dahulu dan kerjakan secara bertahap.
Setiap code bundle hanya berisi file baru atau file yang berubah.
Selalu berikan command Git add, commit, dan push.
```

---

## 28A. Ringkasan revisi versi 1.1

Revisi ini menambahkan:

```text
local-first development sebagai aturan wajib
pemisahan tanggung jawab lokal/GitHub/VPS
pemisahan bot development dan production
mocked Telegram API sebelum bot nyata
fresh DB dan upgraded DB migration tests
quality gate lokal sebelum exact commit deployment
rollout Release A/B/C dengan feature flag
larangan edit source langsung di VPS
source integrity check pada production checkout
```

---
