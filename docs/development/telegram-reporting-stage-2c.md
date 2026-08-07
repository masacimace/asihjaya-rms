# ASIHJAYA RMS/POS — Telegram Reporting Stage 2C

**Contract:** ASIHJAYA_RMS_TELEGRAM_REPORTING_ROADMAP_V1.1.md
**Stage:** 2C.0 — Baseline Audit dan Contract Lock
**Audit date:** 7 Agustus 2026
**Development model:** local-first

## 1. Status 2C.0

Stage 2C.0 selesai diaudit terhadap source snapshot `ajrms-sources.zip`.

Belum ada Telegram API call, migration Telegram, worker, timer, atau admin UI pada stage ini.

Output stage ini mengunci:

1. baseline source dan data flow existing;
2. field source untuk opening/daily/weekly/monthly report;
3. schema gap yang wajib diselesaikan secara additive;
4. integration points yang tidak boleh merusak atomicity POS;
5. permission dan operations pattern yang akan dipakai pada stage berikutnya.

## 2. Baseline source yang diaudit

### Runtime dan framework

- Next.js 16
- React 19
- TypeScript
- Node.js 24.x contract
- npm 11.x contract
- PostgreSQL 17
- Drizzle ORM / Drizzle Kit
- Docker Compose production
- systemd operations source di repository

### Migration baseline

Migration existing berurutan sampai:

```text
0012_legacy_barcode_pos
```

Migration Telegram berikutnya harus additive dan memakai nomor baru setelah `0012`.
Migration lama tidak boleh diedit.

### Environment hygiene

Source archive tidak memuat `.env` lokal.

`.gitignore` sudah mengabaikan:

```text
.env
.env.*
```

kecuali template environment yang memang committed.

Production environment tetap berada di:

```text
/etc/asihjaya-rms/production.env
```

## 3. Audit checklist 2C.0

| Audit | Status | Temuan |
| --- | --- | --- |
| Shift opening | PASS / GAP | Flow atomik sudah ada; belum menyimpan `business_date` |
| Shift closing | PASS / GAP | Closing atomik dan cash reconciliation sudah ada; belum membuat finance snapshot |
| Payment methods | PASS / CONTRACT LOCK | Enum DB lebih luas, tetapi Telegram V1 hanya mengaktifkan Cash, Debit Card EDC, Credit Card EDC, dan Bank Transfer; QRIS/other di-hold |
| Cost snapshots | GAP CRITICAL | `sale_items` belum menyimpan cost historical |
| Gross margin source | GAP CRITICAL | Report existing masih membaca `product_items.cost_amount` saat query |
| Business date | GAP | Helper timezone tersedia, tetapi business date belum persisted pada shift |
| Permissions | PASS | RBAC existing dapat dipakai; `settings.manage` sesuai untuk config Telegram |
| Admin route pattern | PASS | App Router admin + permission guard sudah konsisten |
| Systemd/operations pattern | PASS | Source unit, timer, installer, monitor, immutable deployment pattern tersedia |

## 4. Data flow existing

### 4.1 Opening shift existing

Source utama:

```text
src/app/actions/pos.ts
openPosShiftAction()
```

Flow:

```text
require shifts.manage
→ resolve primary outlet
→ resolve hardware-hub register
→ reject jika register sudah punya open/closing shift
→ BEGIN TRANSACTION
   → insert shifts
   → insert opening_balance cash movement
   → insert audit log
→ COMMIT
→ revalidate POS/admin pages
```

Data yang sudah tersedia saat opening:

```text
shift id
outlet id/code/name
register id/code/name
opened_by user
opening cash
opened_at
organization timezone
```

Integration point Telegram opening kelak harus berada **di transaction yang sama** dengan insert shift dan cash movement, tetapi hanya melakukan insert outbox. Tidak boleh melakukan HTTP call ke Telegram di transaction tersebut.

### 4.2 Checkout existing

Source utama:

```text
src/app/actions/pos.ts
```

Flow penting:

```text
BEGIN TRANSACTION
→ validate active shift
→ lock/validate inventory item
→ calculate subtotal + discount
→ insert completed sale
→ insert sale_items
→ claim inventory
→ insert inventory movements
→ insert paid payments
→ insert cash movement jika cash
→ update expected cash
→ commit
```

Relasi yang penting untuk reporting:

```text
sales.shift_id → shifts.id
sale_items.sale_id → sales.id
payments.sale_id → sales.id
cash_movements.shift_id → shifts.id
```

Karena sale sudah memiliki `shift_id`, daily finance harus dihitung berdasarkan shift, bukan dengan menebak transaksi dari timestamp server.

### 4.3 Closing shift existing

Source utama:

```text
src/lib/shifts/shift-closing.ts
closeShift()
```

Flow:

```text
BEGIN TRANSACTION
→ lock/read target shift context
→ read seluruh cash movements shift
→ calculate expected cash
→ calculate actual cash variance
→ update shift menjadi closed
→ insert audit log
→ COMMIT
→ best-effort internal variance notification
```

Data closing existing:

```text
expected_cash
actual_cash
cash_variance
variance_reason
closed_by
closed_at
```

Integration point closing/daily Telegram kelak:

```text
BEGIN TRANSACTION
→ closing existing
→ calculate immutable finance closing snapshot
→ insert finance_closing_snapshots
→ insert daily Telegram outbox
→ insert weekly/monthly due events jika period eligible
→ COMMIT
```

Tidak ada HTTP Telegram sebelum COMMIT.

## 5. Business date contract lock

### Existing capability

Project sudah memiliki timezone helper:

```text
src/lib/time/business-time.ts
```

Default:

```text
Asia/Jakarta
```

Organization juga memiliki IANA timezone pada:

```text
organizations.timezone
```

Helper existing sudah menangani calendar date berdasarkan timezone organisasi dan memiliki checker khusus.

### Gap

`shifts` belum memiliki persisted `business_date`.

Menggunakan `opened_at`, `closed_at`, atau `sales.completed_at` secara langsung untuk report period tidak cukup karena shift dapat melewati tengah malam.

### Locked rule

Tambahkan secara additive:

```text
shifts.business_date DATE NULL
```

Nullable di level database adalah compatibility contract agar rollback ke aplikasi lama tetap dapat membuka shift. Mulai aplikasi Telegram stage 2C.4, semua shift **baru** wajib mengisi business date pada application layer dan nilainya immutable. Existing shift sebelum migration tidak di-backfill secara spekulatif.

Nilai shift baru:

```text
business_date = calendar date dari opened_at pada organization timezone
```

Setelah shift dibuka, nilai ini immutable.

Contoh:

```text
opened_at  = 2026-08-31 18:00 WIB
closed_at  = 2026-09-01 00:30 WIB
business_date = 2026-08-31
```

Semua finance snapshot dan Telegram event menggunakan `shifts.business_date`.

Database menjaga satu shift per outlet/business date untuk row yang sudah memiliki business date melalui partial unique index:

```text
unique(outlet_id, business_date) where business_date is not null
```

Existing row dengan `business_date IS NULL` tetap valid dan tidak diklaim sebagai historical business date yang authoritative.

## 6. Historical cost dan gross margin audit

### Existing product cost

Master item menyimpan:

```text
product_items.cost_amount
product_items.selling_amount
```

### Existing sale item snapshot

`sale_items` sudah menyimpan immutable:

```text
list_price_amount
discount_amount
final_price_amount
snapshot JSON
```

Tetapi snapshot JSON saat checkout **belum menyimpan cost amount**.

### Critical issue

Report existing menghitung gross profit menggunakan pola:

```text
sale_items.final_price_amount - product_items.cost_amount
```

Artinya perubahan `product_items.cost_amount` setelah transaksi dapat mengubah gross profit historis ketika report dibuka ulang.

Pola ini tidak boleh dipakai untuk Telegram finance reporting.

### Locked fix

Tambahkan historical cost snapshot pada `sale_items`:

```text
cost_amount_snapshot NUMERIC(18,0)
```

Checkout baru wajib mengambil nilai dari `product_items.cost_amount` di transaction checkout dan menyimpannya pada sale item.

Gross margin Telegram:

```text
COGS = SUM(sale_items.cost_amount_snapshot)
Gross margin = Net sales - COGS
Gross margin rate = Gross margin / Net sales * 100
```

Jika net sales = 0:

```text
gross margin rate = 0
```

### Existing historical sale rows

Source yang diaudit tidak menyediakan cost snapshot yang pasti untuk sale yang terjadi sebelum migration Telegram.
Audit log produk memang mencatat perubahan cost, tetapi rekonstruksi historical cost bukan bagian dari Telegram V1 dan tidak boleh diasumsikan selalu sempurna.

Contract aman:

```text
- transaksi setelah writer cost snapshot diaktifkan pada stage 2C.5 wajib memiliki cost snapshot valid;
- jangan mengarang historical gross margin ketika reliable cost snapshot tidak tersedia;
- comparison weekly/monthly boleh menjadi unavailable sampai snapshot period pembanding tersedia penuh.
```

Kebijakan backfill final harus divalidasi terhadap database lokal sebelum migration production.

## 7. Finance closing snapshot contract

`finance_closing_snapshots` belum tersedia dan dinilai **wajib** untuk V1.

Snapshot dibuat pada transaction closing dan tidak dihitung ulang saat worker mengirim Telegram.

Minimal data:

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
bank_transfer_total
debit_card_total
credit_card_total
customer_deposit_opening_balance
customer_deposit_in
customer_deposit_used
customer_deposit_withdrawal
customer_deposit_adjustment_in
customer_deposit_adjustment_out
customer_deposit_closing_balance
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

Locked constraints:

```text
unique(shift_id)
unique(outlet_id, business_date)
index(organization_id, business_date)
```

Constraint tersebut hanya berlaku pada snapshot baru yang dibuat setelah business date tersedia. Existing shift tidak otomatis dibuatkan snapshot saat migration.

## 8. Daily finance field contract

Daily finance selalu memakai satu closing snapshot shift.

| Telegram field | Locked source |
| --- | --- |
| Outlet | `outlets.name` snapshot/context |
| Business date | `shifts.business_date` |
| Main cashier | user dari `shifts.opened_by` |
| Opened at | `shifts.opened_at` |
| Closed at | `shifts.closed_at` |
| Gross sales | sum `sales.subtotal_amount` untuk completed sale pada shift saat snapshot |
| Discount | sum `sales.discount_amount` |
| Net sales | sum `sale_items.final_price_amount` untuk completed sale pada shift |
| Cost of goods | sum `sale_items.cost_amount_snapshot` |
| Gross margin | net sales - cost of goods |
| Gross margin rate | gross margin / net sales |
| Cash | paid `payments.method = cash` |
| Transfer | paid `payments.method = bank_transfer` |
| Debit Card EDC | paid `payments.method = debit_card` |
| Credit Card EDC | paid `payments.method = credit_card` |
| Dana Titip | immutable ledger snapshot, lihat contract tambahan 10A |
| Expected cash | closed `shifts.expected_cash` |
| Actual cash | closed `shifts.actual_cash` |
| Variance | closed `shifts.cash_variance` |
| Transaction count | completed sales count pada shift |
| Items sold | sale item count dari completed sales pada shift |
| Hold cart remaining | active `pos_held_carts` pada `shift_id` |
| Pending approval | outlet-scoped `approvals.status = pending` saat snapshot |

`additional_fee_amount` tidak dimasukkan ke `net_sales` V1. Jika additional fee dipakai di masa depan, field tersebut harus dilaporkan terpisah agar margin barang tidak tercampur fee.

Refund/void yang sudah mengubah status sale sebelum closing tidak dihitung sebagai completed sale pada closing snapshot. Snapshot yang sudah dibuat tidak ditulis ulang setelah closing.

## 9. Opening message field contract

| Telegram field | Source |
| --- | --- |
| Outlet | outlet opening context |
| Business date | persisted `shifts.business_date` |
| Main cashier | `shifts.opened_by` → `users.full_name` |
| Opening time | `shifts.opened_at` |
| Opening cash | `shifts.opening_cash` |
| Shift id | `shifts.id` |

Project tidak memiliki human-readable shift number khusus. V1 tidak perlu membuat nomor shift baru hanya untuk Telegram; UUID shift tetap menjadi canonical shift id.

## 10. Payment breakdown contract

Database payment enum existing tetap lebih luas:

```text
cash
debit_card
credit_card
bank_transfer
qris_manual
qris_gateway
other
```

Tetapi **Telegram Reporting V1 tidak otomatis mengaktifkan seluruh enum tersebut**. Contract implementasi yang dikunci untuk fase ini:

```text
Cash             = cash
Debit Card EDC   = debit_card
Credit Card EDC  = credit_card
Bank Transfer    = bank_transfer
```

Fitur berikut masih **hold** dan tidak ditampilkan sebagai payment breakdown Telegram fase ini:

```text
QRIS Manual      = qris_manual
QRIS Gateway     = qris_gateway
Other            = other
```

Enum/database existing tidak dihapus atau di-rename. Migration tetap additive agar compatibility dan rollback tidak rusak. Jika QRIS/other diaktifkan pada fase berikutnya, contract report harus direvisi secara eksplisit terlebih dahulu.

Hanya payment dengan status finansial yang eligible sesuai snapshot query yang dihitung. Query final harus memiliki test untuk refund/partial-refund state sebelum dipakai production.

## 10A. Contract lock tambahan — Dana Titip

Dana Titip **masuk ke Telegram finance report**, tetapi diperlakukan sebagai section finansial tersendiri, bukan omzet dan bukan metode pembayaran eksternal biasa.

Source existing mendukung ledger berikut:

```text
deposit_in
deposit_used
deposit_withdrawal
adjustment
```

Flow checkout existing juga mengunci invariant:

```text
external_payment_due
= net_sale
- customer_deposit_used
+ customer_deposit_in
```

Konsekuensinya:

```text
deposit_used       → membayar sebagian nilai transaksi, tetapi tidak mengurangi net sales
deposit_in         → menambah saldo Dana Titip/customer liability, bukan revenue
deposit_withdrawal → cash out setelah approval, bukan penjualan
adjustment         → koreksi ledger, dilaporkan terpisah bila relevan
```

Pencairan Dana Titip existing membuat `cash_movements.type = cash_out` dengan `reference_type = customer_deposit_withdrawal` dan menurunkan expected cash shift. Karena itu daily report harus dapat menjelaskan perubahan kas akibat pencairan tersebut.

Snapshot closing wajib menyimpan minimal:

```text
customer_deposit_opening_balance
customer_deposit_in
customer_deposit_used
customer_deposit_withdrawal
customer_deposit_adjustment_in
customer_deposit_adjustment_out
customer_deposit_closing_balance
```

Telegram summary dapat menyembunyikan baris adjustment bernilai nol, tetapi database snapshot tetap menyimpannya agar reconciliation historis stabil.

Locked presentation order untuk daily finance:

```text
PENJUALAN
→ MARGIN
→ TENDER DITERIMA
→ DANA TITIP
→ KAS
→ OPERASIONAL
```

Tidak boleh memakai invariant yang salah:

```text
Cash + Transfer + EDC = Net Sales
```

Karena `deposit_in` dapat membuat external tender lebih besar dari net sales dan `deposit_used` dapat membuat external tender lebih kecil dari net sales. Reconciliation harus memakai contract checkout existing dan ledger Dana Titip, bukan kesamaan sederhana antara tender dan net sales.

## 11. Hold cart dan pending approval

### Hold cart

`pos_held_carts` sudah memiliki:

```text
shift_id
status
item_count
```

Daily snapshot dapat menghitung secara stabil:

```text
count(pos_held_carts where shift_id = current shift and status = active)
```

### Pending approval

`approvals` memiliki:

```text
organization_id
outlet_id
status
```

Daily V1 menggunakan pending approval yang secara eksplisit scoped ke outlet closing:

```text
outlet_id = shift.outlet_id
status = pending
```

Approval organization-wide dengan `outlet_id IS NULL` tidak dimasukkan ke angka outlet agar satu approval tidak muncul pada seluruh outlet.

Nilai disimpan ke finance closing snapshot sehingga tidak berubah setelah report dibuat.

## 12. Weekly report contract

Report existing `/admin/laporan` memiliki rolling range seperti `last7`, tetapi itu **bukan** contract Telegram weekly.

Telegram weekly harus memakai calendar business date:

```text
Monday 00:00 through Sunday 23:59
```

Aggregation source:

```text
finance_closing_snapshots.business_date
```

Bukan:

```text
server send timestamp
live product cost
rolling last7 report query
```

Previous comparison menggunakan immediately preceding Monday–Sunday period.

Jika snapshot period sebelumnya belum lengkap/reliable, comparison ditandai unavailable dan tidak dihitung menggunakan current master cost.

## 13. Monthly report contract

Report existing `thisMonth` adalah period berjalan sampai hari ini dan tidak dapat langsung dipakai untuk Telegram completed calendar-month report.

Telegram monthly:

```text
first calendar day through last calendar day
```

Aggregation source:

```text
finance_closing_snapshots.business_date
```

Previous comparison menggunakan full previous calendar month.

Jika outlet tidak buka pada akhir period, reconciliation menyimpan period yang sudah terkunci dan menunggu closing berikutnya sebagaimana roadmap.

## 14. Telegram outbox integration contract

Belum ada tabel Telegram pada baseline.

Tabel berikut tetap diperlukan sesuai roadmap:

```text
telegram_destinations
telegram_report_settings
telegram_delivery_outbox
telegram_delivery_attempts
```

Outbox snapshot harus menyimpan data/message yang sudah final.

Unique delivery guard:

```text
unique(event_key, destination_id)
```

Event key:

```text
outlet-opened:<outlet-id>:<business-date>
daily-finance:<outlet-id>:<business-date>
weekly-finance:<outlet-id>:<period-start>
monthly-finance:<outlet-id>:<year-month>
```

HTTP Telegram hanya dijalankan worker setelah transaction bisnis selesai.

## 15. Permission contract

Existing roles:

```text
system_admin
owner
manager
cashier
stock_admin
finance
```

Existing permission yang paling tepat untuk Telegram integration configuration:

```text
settings.manage
```

Saat ini owner dan system admin memiliki seluruh permission. Manager tidak mendapatkan `settings.manage` secara default.

Locked V1 admin rule:

```text
/admin/integrasi/telegram
→ require admin.access melalui admin layout
→ require settings.manage untuk configure destination/settings, test message, dan manual retry
```

Dengan demikian manager hanya dapat mengelola Telegram jika secara eksplisit diberi permission yang sesuai di masa depan.

Kasir tidak mempunyai `admin.access`, sehingga tidak dapat masuk halaman Telegram admin.

Bot token tidak pernah dikirim ke browser.

## 16. Admin UI pattern

Existing admin memakai:

```text
src/app/(admin)/admin/layout.tsx
src/components/layout/admin-shell.tsx
```

Telegram route nantinya mengikuti App Router pattern yang sama.

Navigation dapat ditambahkan ke area integration/settings setelah backend contract stabil; UI bukan bagian dari stage awal client/outbox.

## 17. Operations/systemd audit

Source repository sudah memiliki pattern:

```text
ops/systemd/*.service
ops/systemd/*.timer
ops/scripts/ajsystem-install-deployment-automation
ops/scripts/ajsystem-monitor
```

Pattern yang harus dipertahankan untuk Telegram:

```text
- source unit dibuat dan direview lokal;
- installer menyalin exact source release ke system location;
- daemon-reload setelah install;
- verify harus idempotent;
- timer source committed ke Git;
- production secret tetap external;
- journald tidak boleh memuat bot token;
- monitor Telegram tidak boleh membuat primary POS health gagal hanya karena Telegram outage.
```

Production menggunakan immutable Docker images. Worker runtime design pada 2C.10 harus menjalankan code dari exact release image/source contract, bukan dependency hasil install ad-hoc di VPS.

## 18. Existing deployment compatibility

Production compose memiliki image terpisah:

```text
app
migrate
operations
```

Migration dijalankan oleh guarded migrator dan project sudah memiliki destructive-migration detection, migration advisory lock, deployment evidence, backup, rollback, dan exact-commit deployment.

Telegram migration harus mengikuti mekanisme ini. Tidak boleh menjalankan SQL Telegram manual di production pada rollout normal.

## 19. Schema gap list

### Required before automatic reporting

1. `shifts.business_date` belum ada.
2. historical `sale_items.cost_amount_snapshot` belum ada.
3. `finance_closing_snapshots` belum ada.
4. `telegram_destinations` belum ada.
5. `telegram_report_settings` belum ada.
6. `telegram_delivery_outbox` belum ada.
7. `telegram_delivery_attempts` belum ada.

### Required application layer

1. Telegram environment contract belum ada.
2. Telegram typed client belum ada.
3. redaction utility belum ada.
4. local mocked API connectivity checker belum ada.
5. outbox repositories belum ada.
6. opening enqueue belum ada.
7. closing finance snapshot + daily enqueue belum ada.
8. worker belum ada.
9. weekly/monthly reconciliation belum ada.
10. admin UI belum ada.
11. systemd Telegram units/timers belum ada.
12. monitor Telegram metrics belum ada.

## 20. Important compatibility observations

### 20.1 One shift per outlet contract

Database existing hanya memiliki partial unique constraint satu active shift **per register**:

```text
shifts_one_active_per_register_uq
```

POS opening hanya menerima hardware-hub register, dan schema register membatasi satu hardware-hub register per outlet. Pada normal application flow kondisi ini mendekati satu active shift per outlet.

Namun database belum mengunci satu shift per outlet/business date secara eksplisit.

Sebelum menambah constraint baru, 2C.3 wajib menjalankan preflight terhadap database lokal/upgraded untuk mendeteksi duplicate historical shift per outlet/business date. Jangan menambah constraint yang dapat membuat production migration gagal tanpa preflight.

### 20.2 Existing report queries are not Telegram snapshot queries

Existing reports berguna sebagai referensi UI dan aggregation, tetapi tidak boleh digunakan mentah untuk Telegram finance karena:

```text
- gross profit membaca live product cost;
- period last7 bukan Monday–Sunday;
- thisMonth adalah period berjalan;
- timestamp transaction tidak menggantikan persisted shift business_date.
```

Telegram reporting membutuhkan query/service khusus berbasis finance closing snapshot.

## 21. Stage ordering locked after audit

Implementasi tetap mengikuti roadmap dan tidak digabung menjadi satu perubahan besar.

### 2C.1 — Bot setup dan local connectivity

Target perubahan source awal:

```text
.env.example
.env.production.example
src/lib/env.ts
scripts/check-telegram-connectivity.ts atau utility setara
mock Telegram API test utility
package.json hanya jika command baru diperlukan
```

Tidak ada production token di Git.

### 2C.2 — Telegram client

Typed client, timeout, typed error, retry classification, redaction, mocked tests.

### 2C.3 — Database foundation

Migration additive setelah `0012`, fresh/upgraded DB tests, destination/settings/outbox/attempts, business date, cost snapshot, dan finance snapshot foundation yang sudah dinyatakan perlu oleh audit ini.

Tahap setelahnya mengikuti roadmap 2C.4–2C.11.

## 22. 2C.0 exit gate

Stage 2C.0 dianggap PASS jika tim menerima contract berikut:

```text
[PASS] Telegram tidak berada pada critical HTTP path opening/closing.
[PASS] business_date harus persisted pada shift.
[PASS] Telegram finance tidak boleh memakai live product cost.
[PASS] sale item harus memiliki historical cost snapshot untuk transaksi baru.
[PASS] finance closing snapshot diperlukan.
[PASS] weekly/monthly aggregate closing snapshots berdasarkan business_date.
[PASS] existing last7/thisMonth queries tidak dipakai sebagai period engine Telegram.
[PASS] settings.manage menjadi permission configuration V1.
[PASS] production source tidak diedit langsung.
[PASS] migration production hanya melalui immutable deployment.
```

Setelah gate ini, implementasi berpindah ke **2C.1 — Bot setup dan local connectivity**.

## 23. Stage 2C.1 completion lock

Stage 2C.1 dinyatakan selesai setelah local mock connectivity dan private bot/group development acceptance berhasil.

Contract yang tetap berlaku:

```text
- connectivity default memakai loopback mock API;
- API Telegram nyata memerlukan TELEGRAM_DEV_REAL_API_ALLOWED=true;
- getUpdates hanya dipakai utility one-shot chat discovery development;
- runtime product tetap outbound-only dan tidak memiliki polling/webhook;
- token development hanya berada di .env lokal yang di-ignore Git.
```

## 24. Stage 2C.2 — Telegram client contract

Implementasi typed client dibatasi pada:

```text
getMe()
sendMessage()
request timeout dengan AbortController
typed TelegramClientError
HTTP/Telegram error metadata
retry_after capture
structured redacted logging
mocked error tests
```

Retry contract dikunci sebagai berikut:

```text
retryable:
  network failure
  timeout
  HTTP/Telegram 408
  HTTP/Telegram 429
  HTTP/Telegram 500-599
  invalid/malformed upstream response

non-retryable:
  HTTP/Telegram 400 malformed/invalid request
  HTTP/Telegram 401 invalid token
  HTTP/Telegram 403 forbidden/bot removed
```

Client **tidak menjalankan retry loop sendiri**. Client hanya menghasilkan satu request dan metadata `retryable` / `retryAfterSeconds`. Retry scheduling, attempt counter, max attempts, idempotency, dan delivery audit merupakan tanggung jawab outbox worker pada stage 2C.6.

Structured client log tidak memuat bot token, request URL bertoken, message text, atau chat ID. Metadata yang boleh dicatat pada layer ini hanya method, outcome, HTTP status, Telegram error code, retryable, retry_after, duration, dan error kind.


## 19. Stage 2C.3 — Database outbox dan audit

Status: **implemented locally; production migration belum dijalankan.**

Migration baru:

```text
drizzle/0013_telegram_reporting_foundation.sql
```

Schema foundation yang ditambahkan:

```text
shifts.business_date (nullable untuk rollback compatibility)
sale_items.cost_amount_snapshot (nullable; historical rows tidak dipalsukan)
finance_closing_snapshots
telegram_destinations
telegram_report_settings
telegram_delivery_outbox
telegram_delivery_attempts
```

### 19.1 Dormant schema rule

Migration 0013 hanya menyediakan struktur. Stage 2C.3 **tidak** mengubah opening, checkout, atau closing flow untuk menulis Telegram event. Penulisan field baru dilakukan bertahap pada 2C.4/2C.5.

Existing rows sengaja tetap:

```text
shifts.business_date = NULL
sale_items.cost_amount_snapshot = NULL
```

Tidak ada migration yang menebak historical cost dari `product_items.cost_amount` saat ini.

### 19.2 Destination dan settings constraints

V1 mengunci:

```text
chat_id unique
one active Telegram destination per outlet
one report settings row per destination
private_group sebagai destination type V1
```

Token bot tidak disimpan di database.

### 19.3 Outbox idempotency

Database mengunci:

```text
unique(event_key, destination_id)
```

Insert repository menggunakan `ON CONFLICT DO NOTHING`, kemudian mengembalikan row existing. Retry/deployment restart tidak membuat delivery row baru.

### 19.4 Delivery state machine

Allowed transition:

```text
pending    → processing | cancelled
processing → sent | retry | failed
retry      → processing | cancelled
failed     → retry | cancelled
sent       → terminal
cancelled  → terminal
```

Direct transition seperti `pending → sent` atau `sent → retry` ditolak pada application contract.

`processing` wajib memiliki lock pair `locked_at + locked_by`. `sent` wajib memiliki `sent_at + telegram_message_id`.

### 19.5 Attempt audit

Setiap attempt memiliki unique:

```text
(delivery_id, attempt_number)
```

Audit menyimpan HTTP/Telegram result metadata tanpa bot token. Retry policy/backoff belum dieksekusi pada tahap ini; itu milik worker 2C.6.

### 19.6 Finance snapshot safety

`finance_closing_snapshots` memiliki `cost_snapshot_complete`. Jika historical cost tidak lengkap:

```text
cost_snapshot_complete = false
cost_of_goods = NULL
gross_margin = NULL
gross_margin_rate = NULL
```

Dengan demikian sistem tidak mengarang gross margin. Setelah seluruh sale item pada shift memiliki cost snapshot valid, field cost/margin boleh disimpan.

Payment snapshot V1 hanya menyediakan:

```text
cash_total
bank_transfer_total
debit_card_total
credit_card_total
```

QRIS dan `other` tetap hold sesuai contract 2C.0. Dana Titip disimpan dalam section snapshot tersendiri.

### 19.7 Checker dan local database rehearsal

Commands:

```powershell
npm run check:telegram-outbox
npm run test:telegram-outbox:local
```

`check:telegram-outbox` memvalidasi contract schema, report period, state transition, attempt limits, dan—dengan `--database`—constraint/idempotency database.

`test:telegram-outbox:local` memakai PostgreSQL 17 disposable untuk dua jalur:

```text
fresh DB   → migration 0000..0013 → DB constraint checks
upgraded DB→ migration 0000..0012 → seed representative existing rows
           → migration 0013
           → verify existing business_date/cost snapshot tetap NULL
           → DB constraint checks
```

Ini menjadi gate utama sebelum stage 2C.4.

## 20. Stage 2C.4 — Opening notification implementation lock

Stage 2C.4 mengaktifkan **event generation lokal** untuk opening shift, tetapi tetap tidak melakukan HTTP Telegram dari POS request path.

### 20.1 Persisted business date

Semua shift baru yang dibuka oleh aplikasi stage 2C.4 wajib mengisi:

```text
shifts.business_date = calendar date dari opened_at pada organizations.timezone
```

Implementasi memakai helper existing:

```text
getBusinessDateKey(now, auth.organization.timezone)
```

Nilai tersebut ditulis bersama row shift dalam transaction opening dan juga disimpan pada audit `shift.open`.

### 20.2 Opening outbox event

Event key dikunci:

```text
outlet-opened:<outlet-id>:<business-date>
```

Opening outbox hanya dibuat jika seluruh guard berikut terpenuhi:

```text
TELEGRAM_INTEGRATION_ENABLED=true
active destination tersedia untuk outlet
telegram_report_settings.is_active=true
telegram_report_settings.opening_enabled=true
```

Jika salah satu guard tidak terpenuhi, opening shift tetap berjalan normal dan tidak membuat outbox Telegram.

### 20.3 Transaction boundary

Flow stage 2C.4:

```text
BEGIN TRANSACTION
→ insert shift + business_date
→ insert opening_balance cash movement
→ insert shift.open audit log
→ resolve destination/settings
→ insert opening Telegram outbox idempotently
COMMIT
```

Tidak ada `fetch()`, `sendMessage()`, atau Telegram client pada opening request path.

HTTP delivery tetap menjadi tanggung jawab worker stage 2C.6.

### 20.4 Immutable opening payload

Opening payload snapshot V1 menyimpan:

```text
schema_version = 1
report_type = opening
shift_id
outlet id/code/name
business_date
cashier id/name
opened_at ISO timestamp
opening_cash
report timezone
```

Payload tidak menyimpan bot token atau chat ID.

Message tetap plain text:

```text
🟢 OUTLET DIBUKA

Outlet: <outlet>
Tanggal operasional: <business date>
Kasir utama: <cashier>
Waktu buka: <HH:mm timezone>
Kas awal: <rupiah>

Shift: <uuid>
Status: Operasional dimulai
```

### 20.5 Idempotency dan duplicate guard

`enqueueTelegramDelivery()` tetap menggunakan unique database contract:

```text
unique(event_key, destination_id)
```

Pemanggilan enqueue kedua untuk opening event yang sama mengembalikan existing delivery dan tidak membuat row baru.

### 20.6 Local checks

Commands stage 2C.4:

```powershell
npm run check:telegram-opening
npm run test:telegram-opening:local
```

Checker mengunci:

```text
business date timezone handling
opening message formatter
immutable payload
runtime feature flag
opening_enabled guard
inactive destination guard
idempotency
transaction rollback
no HTTP/client call pada opening path
```

`test:telegram-opening:local` memakai PostgreSQL 17 disposable, menjalankan migration terbaru, lalu menguji opening outbox terhadap database nyata.

Stage 2C.4 belum mengaktifkan systemd worker/timer dan belum melakukan production acceptance test.

## 21. Stage 2C.5 — Closing + daily finance implementation lock

Stage 2C.5 mulai menulis historical finance snapshot dan daily outbox pada closing shift. Tidak ada HTTP Telegram pada request path closing.

### 21.1 Cost snapshot pada checkout

Setiap `sale_items` baru menyimpan:

```text
cost_amount_snapshot = product_items.cost_amount pada saat checkout
```

Nilai `NULL` tetap `NULL`; aplikasi tidak mengubah missing cost menjadi nol. Snapshot JSON item juga menyimpan `costAmountSnapshot` untuk audit payload checkout.

Sale item existing dari sebelum stage ini tidak di-backfill. Jika satu saja item pada shift tidak memiliki cost snapshot, finance snapshot menyimpan:

```text
cost_snapshot_complete = false
cost_of_goods = NULL
gross_margin = NULL
gross_margin_rate = NULL
```

### 21.2 Daily finance formulas

Hanya sale berstatus `completed` pada `shift_id` yang dihitung.

```text
gross_sales    = SUM(sales.subtotal_amount)
discount_total = SUM(sales.discount_amount)
net_sales      = SUM(sale_items.final_price_amount)

cost_of_goods  = SUM(sale_items.cost_amount_snapshot), hanya jika lengkap
gross_margin   = net_sales - cost_of_goods
gross_margin_rate = gross_margin / net_sales * 100
```

`additional_fee_amount` tidak dimasukkan ke net sales Telegram V1 sesuai contract 2C.0.

Payment breakdown V1 hanya:

```text
cash
bank_transfer
debit_card
credit_card
```

QRIS dan `other` tetap hold dan tidak ditampilkan pada finance snapshot Telegram V1.

### 21.3 Dana Titip daily snapshot

Dana Titip tidak diperlakukan sebagai omzet atau tender biasa.

Opening balance dihitung dari seluruh ledger outlet sebelum `shift.opened_at`. Mutasi daily dihitung pada interval `opened_at` sampai `closed_at`:

```text
deposit_in + credit          → Dana Titip masuk
deposit_used + debit         → Dana Titip digunakan
deposit_withdrawal + debit   → Dana Titip dicairkan
adjustment + credit           → adjustment masuk
adjustment + debit            → adjustment keluar
```

Closing balance:

```text
opening
+ deposit_in
+ adjustment_in
- deposit_used
- withdrawal
- adjustment_out
```

### 21.4 Closing transaction boundary

Flow stage 2C.5:

```text
BEGIN TRANSACTION
→ lock/read shift
→ hitung expected cash + variance
→ persist business_date fallback jika shift lama masih NULL
→ update shift menjadi closed
→ insert shift.close audit
→ calculate + insert immutable finance_closing_snapshots
→ resolve destination/settings jika Telegram enabled
→ insert daily outbox idempotently
COMMIT
```

External Telegram API tidak dipanggil di transaction ini. Kegagalan API Telegram tetap tidak dapat membatalkan closing karena delivery HTTP baru dilakukan worker stage 2C.6.

### 21.5 Daily event contract

Event key:

```text
daily-finance:<outlet-id>:<business-date>
```

Outbox hanya dibuat jika:

```text
TELEGRAM_INTEGRATION_ENABLED=true
active destination tersedia
telegram_report_settings.is_active=true
telegram_report_settings.closing_daily_enabled=true
```

Finance snapshot tetap dibuat ketika integration OFF atau destination tidak tersedia.

### 21.6 Immutable daily payload

Payload V1 menyimpan:

```text
shift/outlet/business_date/cashier/opened_at/closed_at/timezone
sales + cost completeness
cash/bank transfer/EDC debit/EDC credit
Dana Titip opening/in/used/withdrawal/adjustments/closing
expected/actual/variance
transaction/items sold/active hold/pending approval counts
```

Message plain text membagi section menjadi:

```text
PENJUALAN
MARGIN
TENDER DITERIMA
DANA TITIP
KAS
OPERASIONAL
```

Jika cost snapshot tidak lengkap, COGS/gross margin ditampilkan sebagai `Belum tersedia`, bukan `Rp0`.

### 21.7 Local checks

Commands:

```powershell
npm run check:telegram-daily
npm run test:telegram-daily:local
```

Checker mengunci:

```text
checkout cost snapshot
business-date fallback saat closing
finance snapshot formulas
Dana Titip separation
payment V1 tanpa QRIS/other
daily event key
closing_daily setting guard
immutable snapshot
idempotency
no HTTP/client pada closing path
```

`test:telegram-daily:local` memakai PostgreSQL 17 disposable dan menjalankan migration terbaru sebelum integration checks.

Stage 2C.5 belum mengirim outbox ke Telegram. Delivery/retry/locking tetap milik stage 2C.6.

## 22. Stage 2C.6 — Delivery worker implementation lock

Stage 2C.6 menjadi titik pertama outbox melakukan HTTP `sendMessage()` ke Telegram. Opening/closing request path tetap hanya menulis database; delivery dilakukan oleh oneshot worker terpisah.

### 22.1 Worker execution contract

Command lokal/runtime:

```text
npm run telegram:deliver
```

Satu invocation:

```text
recover stale processing
→ claim due batch dengan FOR UPDATE SKIP LOCKED
→ status processing + worker lock
→ buat attempt audit sebelum dispatch
→ Telegram sendMessage
→ complete attempt audit
→ sent / retry / failed
→ exit
```

Batch awal dikunci pada 20 delivery per invocation. Worker tidak menjalankan loop daemon permanen; systemd timer stage 2C.10 akan memanggil oneshot command ini secara berkala.

### 22.2 Concurrency dan locking

Claim hanya memilih:

```text
status IN (pending, retry)
next_attempt_at <= now
attempt_count < max_attempts
```

Rows dikunci memakai:

```text
FOR UPDATE SKIP LOCKED
```

Lalu dalam transaction yang sama diubah menjadi:

```text
status = processing
locked_at = now
locked_by = <worker-id>
```

Dua worker concurrent tidak boleh mengklaim delivery yang sama.

### 22.3 Attempt audit boundary

Sebelum HTTP dispatch, worker membuat row `telegram_delivery_attempts` dengan:

```text
attempt_number = delivery.attempt_count + 1
requested_at = now
completed_at = NULL
```

Setelah hasil request diketahui, row attempt yang sama dilengkapi dengan HTTP/Telegram metadata dan `completed_at`.

Ini membedakan:

```text
processing tanpa incomplete attempt
→ worker mati sebelum dispatch dimulai
→ aman direqueue

processing + incomplete attempt
→ dispatch mungkin sudah mencapai Telegram
→ outcome ambiguous
→ automatic retry DILARANG
→ delivery menjadi failed untuk mencegah duplicate message
```

Telegram Bot API tidak menyediakan idempotency key untuk `sendMessage`, sehingga outcome ambiguous tidak boleh diasumsikan aman untuk auto-retry.

### 22.4 Retry policy

Retryable berasal dari typed client stage 2C.2:

```text
network
request timeout
HTTP / Telegram 408
HTTP / Telegram 429
HTTP / Telegram 5xx
invalid temporary upstream response
```

Non-retryable antara lain:

```text
400 invalid request/chat
401 invalid token
403 forbidden/bot removed
```

Backoff setelah failed attempt:

```text
attempt 1 → +1 menit
attempt 2 → +5 menit
attempt 3 → +15 menit
attempt 4 → +60 menit
attempt 5 → failed jika max_attempts=5
```

Jika Telegram memberikan `retry_after`, worker memakai nilai yang tidak lebih cepat dari policy backoff (`max(policy, retry_after)`).

Worker tidak melakukan immediate retry di dalam satu HTTP call/invocation. Retry selalu kembali melalui outbox `next_attempt_at`, sehingga seluruh attempt tetap auditable.

### 22.5 Stale processing recovery

Default stale threshold:

```text
30 menit
```

Recovery policy:

```text
stale processing + belum ada incomplete attempt
→ retry sekarang
→ lock dilepas

stale processing + incomplete attempt
→ complete attempt sebagai ambiguous
→ failed
→ last_error_code = AMBIGUOUS_STALE_PROCESSING
→ tidak auto retry

stale processing + attempt_count >= max_attempts
→ failed
```

Manual retry untuk failed/ambiguous delivery baru menjadi admin action pada stage 2C.9.

### 22.6 Graceful exit

Runner menangani `SIGINT` dan `SIGTERM`.

Jika signal diterima:

```text
current HTTP request dibiarkan selesai/timeout
claimed row yang belum memulai attempt dilepas ke retry
worker exit setelah state database konsisten
```

Row yang sudah memulai attempt tidak boleh dilepas sebagai safe retry karena outcome dapat ambiguous.

### 22.7 Logging dan secret safety

Structured worker log hanya memuat metadata seperti:

```text
delivery id
destination id
report type
outcome
attempt
HTTP status
Telegram error code
duration
error code
```

Worker log tidak memiliki field untuk:

```text
bot token
chat id
message text
payload snapshot
full tokenized Telegram URL
```

Database tetap menyimpan message text di immutable outbox karena itulah payload delivery, tetapi token tidak pernah masuk database.

### 22.8 Local checks

Commands stage 2C.6:

```powershell
npm run check:telegram-worker
npm run test:telegram-worker:local
```

Disposable PostgreSQL rehearsal menguji:

```text
successful send → sent
429 → retry + backoff + attempt audit
timeout → retry
5xx → retry
403 → failed
max attempts → failed
safe stale lock recovery
ambiguous stale dispatch → failed tanpa resend
graceful release sebelum attempt
concurrent workers + SKIP LOCKED
unexpected internal error → failed
```

Regression sebelum commit tetap mencakup client/outbox/opening/daily checks serta `typecheck`, `lint`, `build`, dan source hygiene.

Stage 2C.6 belum membuat weekly/monthly report, admin UI, atau systemd unit/timer source. Systemd tetap stage 2C.10.

## 23. Stage 2C.7 — Weekly Finance Report

Stage 2C.7 menambahkan event weekly berbasis immutable `finance_closing_snapshots`. Tidak ada query ulang ke master product/cost dan tidak ada HTTP Telegram pada closing path.

### 23.1 Period contract

Weekly selalu memakai business date kalender:

```text
Senin 00:00 → Minggu 23:59
```

Karena source agregasi adalah `finance_closing_snapshots.business_date`, batas minggu tidak bergantung pada tanggal server atau waktu worker mengirim message.

Contoh:

```text
business_date 2026-08-03 (Senin)
→ period 2026-08-03 ... 2026-08-09

business_date 2026-08-09 (Minggu)
→ period yang sama sudah selesai setelah closing

business_date 2026-08-10 (Senin)
→ latest completed period tetap 2026-08-03 ... 2026-08-09
```

Jika outlet tidak buka pada Minggu, report menunggu closing berikutnya dan tetap mengunci period minggu yang sudah selesai. Closing hook 2C.7 hanya mengejar latest completed week. Period lama yang terlewat karena downtime/inaktivitas panjang akan ditangani reconciliation job, bukan dengan mengubah period weekly.

### 23.2 Source of truth

Weekly hanya menjumlahkan:

```text
finance_closing_snapshots
WHERE outlet_id = target
AND business_date BETWEEN period_start AND period_end
```

Field weekly:

```text
gross sales
discount
net sales
cost of goods
gross margin
gross margin rate
cash
bank transfer
EDC debit
EDC credit
Dana Titip opening / in / used / withdrawal / adjustment / closing
total cash variance
transaction count
items sold
```

QRIS dan `other` tetap di luar payment contract Telegram V1.

### 23.3 Cost completeness

Weekly COGS dan gross margin hanya authoritative jika seluruh daily snapshot dalam period mempunyai:

```text
cost_snapshot_complete = true
```

Jika satu daily snapshot saja incomplete:

```text
weekly cost_snapshot_complete = false
cost_of_goods = null
gross_margin = null
gross_margin_rate = null
```

Report menampilkan `Belum tersedia`; partial COGS tidak boleh dianggap sebagai weekly COGS.

### 23.4 Dana Titip weekly

Dana Titip tetap section finansial tersendiri, bukan revenue dan bukan tender biasa.

```text
opening balance = opening balance snapshot pertama dalam period
in / used / withdrawal / adjustment = SUM movement snapshot period
closing balance = closing balance snapshot terakhir dalam period
```

Hari outlet tutup tanpa snapshot tidak mengubah period kalender.

### 23.5 Previous-week comparison

Comparison weekly menggunakan **Net Sales**:

```text
(current_week_net_sales - previous_week_net_sales)
/ previous_week_net_sales
* 100
```

Jika previous week tidak mempunyai finance snapshot atau previous Net Sales = 0, comparison berstatus `Belum tersedia`. Nilai 0 tidak digunakan sebagai denominator palsu.

### 23.6 Event dan idempotency

Event key:

```text
weekly-finance:<outlet-id>:<period-start>
```

Outbox:

```text
report_type = weekly
business_date = NULL
period_start = Monday
period_end = Sunday
```

Unique `(event_key, destination_id)` tetap menjadi duplicate guard.

Weekly event hanya dibuat ketika:

```text
TELEGRAM_INTEGRATION_ENABLED=true
destination active
report settings active
weekly_enabled=true
period sudah selesai
period mempunyai minimal satu finance closing snapshot
```

### 23.7 Closing boundary

Di closing transaction:

```text
close shift
→ finance closing snapshot + daily event
→ check latest completed weekly period
→ weekly outbox event (jika eligible)
→ COMMIT
```

Weekly service tidak memanggil `fetch`, `TelegramClient`, atau `sendMessage`. Pengiriman tetap menjadi tanggung jawab delivery worker 2C.6.

### 23.8 Local checks

```powershell
npm run check:telegram-weekly
npm run test:telegram-weekly:local
```

Database rehearsal menguji:

```text
Monday–Sunday boundary
week crossing month
direct Sunday generation
delayed generation setelah outlet tidak buka Minggu
aggregation dari finance_closing_snapshots
previous-week Net Sales comparison
previous week unavailable/zero guard
cost completeness across daily snapshots
Dana Titip weekly boundary + movements
period_start/period_end outbox
idempotency
weekly_enabled guard
integration disabled guard
no-data period guard
```

Stage 2C.7 belum membuat monthly report, admin UI, reconciliation timer, atau systemd unit.

## 24. Stage 2C.8 — Monthly Finance Report

Stage 2C.8 menambahkan event monthly berbasis immutable `finance_closing_snapshots`. Tidak ada query ulang ke master product/cost dan tidak ada HTTP Telegram pada closing path.

### 24.1 Period contract

Monthly selalu memakai bulan kalender berdasarkan `business_date`:

```text
tanggal 1 → hari terakhir bulan
```

Boundary bulan mengikuti kalender Gregorian, termasuk:

```text
Februari 28 hari
Februari leap year 29 hari
bulan 30 hari
bulan 31 hari
pergantian tahun Desember → Januari
```

Contoh:

```text
business_date 2026-08-31
→ period 2026-08-01 ... 2026-08-31
→ period selesai setelah closing

business_date 2026-09-01
→ latest completed period tetap 2026-08-01 ... 2026-08-31
```

Shift yang dibuka 31 Agustus dan secara wall-clock ditutup 1 September tetap memakai `business_date=2026-08-31`, sehingga seluruh finance snapshot tetap masuk Agustus.

Jika outlet tidak buka pada hari terakhir bulan, report menunggu closing berikutnya dan tetap mengunci bulan kalender yang sudah selesai. Closing hook 2C.8 hanya mengejar latest completed month. Period lama yang terlewat karena downtime/inaktivitas panjang tetap menjadi tanggung jawab reconciliation job.

### 24.2 Source of truth

Monthly hanya menjumlahkan:

```text
finance_closing_snapshots
WHERE outlet_id = target
AND business_date BETWEEN period_start AND period_end
```

Field monthly:

```text
gross sales
discount
net sales
cost of goods
gross margin
gross margin rate
cash
bank transfer
EDC debit
EDC credit
Dana Titip opening / in / used / withdrawal / adjustment / closing
total cash variance
transaction count
items sold
```

QRIS dan `other` tetap di luar payment contract Telegram V1.

### 24.3 Cost completeness

Monthly COGS dan gross margin hanya authoritative jika seluruh daily snapshot dalam bulan mempunyai:

```text
cost_snapshot_complete = true
```

Jika satu daily snapshot saja incomplete:

```text
monthly cost_snapshot_complete = false
cost_of_goods = null
gross_margin = null
gross_margin_rate = null
```

Partial COGS tidak boleh dianggap sebagai COGS bulanan.

### 24.4 Dana Titip monthly

Dana Titip tetap section finansial tersendiri, bukan revenue dan bukan tender biasa.

```text
opening balance = opening balance snapshot pertama dalam bulan
in / used / withdrawal / adjustment = SUM movement snapshot bulan
closing balance = closing balance snapshot terakhir dalam bulan
```

Hari outlet tidak beroperasi tidak mengubah calendar-month boundary.

### 24.5 Previous-month comparison

Comparison monthly menggunakan **Net Sales**:

```text
(current_month_net_sales - previous_month_net_sales)
/ previous_month_net_sales
* 100
```

Jika previous month tidak mempunyai finance snapshot atau previous Net Sales = 0, comparison berstatus `Belum tersedia`.

### 24.6 Event dan idempotency

Event key:

```text
monthly-finance:<outlet-id>:<year-month>
```

Contoh:

```text
monthly-finance:<outlet-id>:2026-08
```

Outbox:

```text
report_type = monthly
business_date = NULL
period_start = first day of month
period_end = last day of month
```

Unique `(event_key, destination_id)` tetap menjadi duplicate guard.

Monthly event hanya dibuat ketika:

```text
TELEGRAM_INTEGRATION_ENABLED=true
destination active
report settings active
monthly_enabled=true
period sudah selesai
period mempunyai minimal satu finance closing snapshot
```

### 24.7 Closing boundary

Di closing transaction:

```text
close shift
→ finance closing snapshot + daily event
→ check weekly period
→ check latest completed monthly period
→ monthly outbox event (jika eligible)
→ COMMIT
```

Monthly service tidak memanggil `fetch`, `TelegramClient`, atau `sendMessage`. Pengiriman tetap menjadi tanggung jawab delivery worker 2C.6.

### 24.8 Local checks

```powershell
npm run check:telegram-monthly
npm run test:telegram-monthly:local
```

Database rehearsal menguji:

```text
28-day February
29-day leap-year February
30-day month
31-day month
year boundary
business-date month assignment
direct last-day generation
delayed generation setelah outlet tidak buka akhir bulan
aggregation dari finance_closing_snapshots
previous-month Net Sales comparison
previous month unavailable/zero guard
cost completeness across daily snapshots
Dana Titip monthly boundary + movements
period_start/period_end outbox
idempotency
monthly_enabled guard
integration disabled guard
no-data period guard
```

Stage 2C.8 belum membuat admin UI, reconciliation timer/job, atau systemd unit.
