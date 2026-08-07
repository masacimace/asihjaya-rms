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
