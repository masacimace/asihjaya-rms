# Asihjaya Retail Management System

Asihjaya RMS adalah sistem retail dan point-of-sale berbasis web untuk operasional toko perhiasan. Project ini mencakup **Admin Dashboard**, **POS Web App**, pengelolaan produk dan inventaris, payment verification, approval, refund dan retur, rekonsiliasi settlement, Notification Center, private file storage, serta fondasi local Hardware Hub.

> **Status:** active development dan UAT. Project belum dinyatakan production-ready.

## Target Operasional

Konfigurasi operasional saat ini:

- 1 organisasi
- 1 outlet aktif
- 1 manager menggunakan mini PC
- 4 sales menggunakan perangkat mobile
- Traffic sekitar 1–15 transaksi per hari
- Arsitektur disiapkan untuk multi-outlet

## Status Project

### Sudah tersedia

- Custom authentication dan database-backed session
- Role-based access control per organisasi dan outlet
- Admin Dashboard dan POS
- Product master dan inventory item
- Foto produk dan item
- Barcode dan status lifecycle inventaris
- Shift kasir dan pergerakan kas
- Checkout atomik dengan idempotency dan recovery
- Manual payment verification
- Payment profile per outlet
- Duplicate payment reference detection
- Maker-checker approval
- Void dan refund transaction service
- Refund ledger
- Return receipt dan physical inspection workflow
- Payment reconciliation
- Settlement CSV import dan auto-matching
- Notification Center V1
- Local/S3-compatible private storage abstraction
- Hardware Hub dan print-job foundation

### Sedang direncanakan

- Settings Center
- Pengaturan umum organisasi
- Notification preferences
- Security dan session management
- Cloud Storage
- Backup Destination
- Telegram notification delivery

### Ditahan

- Automated Payment & Concurrency Tests
- Midtrans QRIS Gateway
- Gateway webhook dan payment recovery
- Gateway refund dan reconciliation
- WhatsApp integration
- Email integration
- Production Readiness Review

## Modul Utama

| Modul               | Fungsi                                             | Status      |
| ------------------- | -------------------------------------------------- | ----------- |
| Admin Dashboard     | Ringkasan operasional dan monitoring               | Aktif       |
| POS                 | Checkout, pembayaran, invoice, dan recovery        | Aktif       |
| Produk Master       | Data produk dan foto                               | Aktif       |
| Inventaris          | Item fisik, barcode, availability, dan movement    | Aktif       |
| Penjualan           | Riwayat, detail, dan koreksi transaksi             | Aktif       |
| Approval            | Maker-checker untuk tindakan sensitif              | Aktif       |
| Refund & Return     | Refund finansial dan inspeksi barang fisik         | Aktif       |
| Rekonsiliasi        | Review settlement dan mismatch                     | Aktif       |
| Settlement Import   | CSV import dan auto-matching                       | Aktif       |
| Notification Center | Event, recipient, filter, archive, auto-resolution | Aktif       |
| Hardware Hub        | Device monitoring dan print-job foundation         | Development |
| Settings Center     | Pengaturan terpusat                                | Planned     |
| Midtrans            | QRIS payment gateway                               | On hold     |

## Arsitektur

```text
Browser Admin / POS
        ↓
Next.js App Router
        ↓
Server Actions dan Route Handlers
        ↓
Feature Services / Transaction Services
        ↓
Drizzle ORM
        ↓
PostgreSQL
```

Private file storage:

```text
Storage Provider
├── Local storage — development
└── S3-compatible storage — production target
```

Hardware:

```text
Asihjaya RMS
        ↓
Local Hardware Hub
├── Printer
├── Barcode device
└── Hardware job polling
```

Operasi finansial penting menggunakan database transaction, idempotency, constraint, dan advisory lock sesuai kebutuhan.

## Technology Stack

- Next.js App Router
- React
- TypeScript strict mode
- Tailwind CSS
- PostgreSQL 17
- Drizzle ORM dan Drizzle Kit
- Docker Compose
- Custom database-backed authentication
- Organization dan outlet-scoped authorization
- Server Actions dan Route Handlers
- Local/S3-compatible private file storage
- Playwright foundation
- Local Hardware Hub

## Local Development

- Windows 10
- Node.js `24.14.0` sesuai `.nvmrc`
- npm `11.9.0` sesuai `packageManager`
- Docker Desktop atau Docker Engine dengan Compose
- Git
- Vscode

## Reproducible Toolchain

Project mengunci baseline development pada Node.js `24.14.0` dan npm `11.9.0`. Verifikasi sebelum install:

```powershell
node --version
npm --version
```

Output yang diharapkan:

```text
v24.14.0
11.9.0
```

`.npmrc` mengaktifkan `engine-strict`, sehingga install akan dihentikan ketika major toolchain tidak sesuai.

SheetJS CE disimpan sebagai archive lokal agar fresh install, CI, dan Docker build tidak bergantung pada CDN. Setelah menerapkan perubahan ini untuk pertama kali, unduh dan verifikasi archive resmi satu kali melalui:

```powershell
npm run vendor:xlsx
npm ci
```

Commit file `vendor/xlsx-0.20.3.tgz`, checksum, `package.json`, dan `package-lock.json` yang dihasilkan. Fresh clone berikutnya cukup menjalankan `npm ci`.

## First-time Local Setup

### Windows PowerShell

```powershell
Copy-Item .env.example .env
npm run env:generate-secrets -- --write .env
npm run env:validate

docker compose up -d db

npm ci
npm run db:migrate
npm run db:seed
npm run dev
```

### Bash

```bash
cp .env.example .env
npm run env:generate-secrets -- --write .env
npm run env:validate

docker compose up -d db

npm ci
npm run db:migrate
npm run db:seed
npm run dev
```

> `npm run db:seed` hanya dijalankan untuk database baru atau reset yang disengaja. Jangan menjalankan seed setiap selesai migration pada database development yang sudah berisi data.

## Memperbarui Database Development yang Sudah Ada

```powershell
npm ci
npm run db:migrate
npm run typecheck
npm run dev
```

Tidak perlu menjalankan `npm run db:seed`, kecuali dokumentasi migration atau fitur secara eksplisit memintanya.

### Aturan Migration

- Jangan mengedit migration yang sudah diterapkan ke database.
- Gunakan migration forward-only untuk repair atau perubahan lanjutan.
- Jalankan preflight fitur sebelum migration jika script tersedia.
- Backup database sebelum migration besar.
- Jangan menjalankan migration utama langsung melalui `psql`, kecuali file tersebut memang dibuat sebagai recovery script.
- Jaga schema PostgreSQL dan `drizzle.__drizzle_migrations` tetap sinkron.
- Tidak perlu membuat database development baru setiap ada perubahan schema.
- Gunakan database disposable terpisah untuk rehearsal dan automated test.

## Quality Gate dan CI

Sebelum perubahan digabungkan atau dideploy, jalankan quality gate lengkap:

```bash
npm ci
npm run check:build-baseline
npm run check:all
```

Kelompok check dapat dijalankan terpisah:

```bash
npm run check:build-baseline
npm run check:quality
npm run check:static
npm run check:security
npm run check:business
npm run check:hardware
npm run build
```

GitHub Actions menjalankan static quality, security/business contracts, rehearsal migration PostgreSQL 17, Hardware Hub checks, dan production container build pada push serta pull request. Dokumentasi lengkap tersedia di `docs/development/quality-gates.md`.

Validasi clean build dan Docker image secara lokal:

```powershell
npm run build:clean
docker build --pull --tag asihjaya-rms:local .
```

## Environment Configuration

Lihat `.env.example` untuk template dan `docs/development/environment-configuration.md` untuk aturan production. Template tidak lagi membawa contoh secret yang dapat dipakai langsung.

Command utama:

```powershell
npm run env:generate-secrets -- --write .env
npm run env:validate
npm run env:validate -- --mode production --env-file .env.production
```

Production server melakukan fail-fast validation sebelum menerima traffic. Secret inti wajib unik, minimal 32 karakter, dan tidak boleh menggunakan placeholder.

Kelompok konfigurasi yang digunakan project:

- Database
- Authentication dan session
- Application URL
- Local/private storage
- S3-compatible storage
- Hardware Hub
- Notification lifecycle
- Notification anti-spam
- Integration credentials

Jangan commit file `.env`, database dump, token, access key, secret key, atau credential production.

## URL Lokal

Setelah `npm run dev`, buka:

- `http://localhost:3000/login`
- `http://localhost:3000/admin`
- `http://localhost:3000/pos`
- `http://localhost:3000/api/health`
- `http://localhost:3000/api/health/database`

## Route Utama

| Route                                 | Fungsi                       |
| ------------------------------------- | ---------------------------- |
| `/login`                              | Login                        |
| `/admin`                              | Admin Dashboard              |
| `/pos`                                | Point of Sale                |
| `/admin/produk`                       | Product master               |
| `/admin/inventaris`                   | Inventory items              |
| `/admin/penjualan`                    | Riwayat transaksi            |
| `/admin/pelanggan`                    | Daftar customer              |
| `/admin/operasional/shift`            | Shift kasir                  |
| `/admin/operasional/approval`         | Riwayat approval             |
| `/admin/operasional/kas`              | Pergerakan kas               |
| `/admin/operasional/hardware`         | Hardware Hub                 |
| `/admin/keuangan/rekonsiliasi`        | Payment reconciliation       |
| `/admin/keuangan/rekonsiliasi/import` | Settlement import            |
| `/admin/notifikasi`                   | Notification Center          |
| `/admin/administrasi`                 | User, role, dan administrasi |
| `/admin/pengaturan`                   | Settings Center              |

Route dan server action tetap dilindungi oleh backend authorization. Visibility menu pada navbar bukan pengganti pemeriksaan permission.

## Authorization Model

Akses menggunakan permission berbasis organisasi dan outlet.

Role bawaan:

- System Administrator
- Owner
- Manager
- Finance
- Stock Admin
- Sales/Cashier

Nama role tidak menjadi authorization bypass. Server tetap memeriksa permission spesifik untuk setiap operasi.

## Financial and Transaction Safety

Guardrail yang sudah tersedia:

- Atomic checkout transaction
- Persistent checkout attempt
- Idempotency key dan payload fingerprint
- Checkout recovery setelah timeout atau refresh
- Duplicate payment reference detection
- Manual payment verification metadata
- Co-verification untuk kondisi tertentu
- Maker-checker approval
- Atomic void dan refund
- Refund ledger
- Return inspection sebelum restock
- One-payment-one-reconciliation guard
- Settlement duplicate-file protection
- Exact dan manual matching
- Advisory lock untuk operasi concurrent
- Audit trail untuk tindakan sensitif

## Notification Center

Notification Center V1 mendukung:

- Event dan recipient state per user
- Organization dan outlet-scoped targeting
- Transaction notifications
- High-value dan split-payment metadata
- Checkout recovery notifications
- Approval result notifications
- Refund, return, reconciliation, shift, cash, dan hardware events
- Read dan unread
- Archive tanpa hard delete
- Expandable Admin Drawer
- Full notification page
- Search, filter, pagination, dan bulk action
- Auto-resolution
- Auto-archive
- Anti-spam aggregation
- Occurrence count dan deduplication

**Approval Drawer tetap terpisah** karena berfungsi sebagai action inbox untuk approve/reject, sedangkan Notification Center berfungsi sebagai awareness dan follow-up center.

## Development Commands

### Application

```powershell
npm run dev
npm run build
npm run start
npm run env:validate
npm run env:generate-secrets -- --write .env
```

### Quality Checks

```powershell
npm run typecheck
npm run lint
npm run routes:check
```

### Database

```powershell
npm run db:generate
npm run db:migrate
npm run db:seed
npm run db:studio
```

### Reset Database Development Lokal

Hentikan `npm run dev` terlebih dahulu. Untuk menghapus volume PostgreSQL lokal,
menjalankan seluruh migration, seed, dan pemeriksaan database live:

```powershell
npm run db:fresh:local -- --confirm=RESET_LOCAL_DATABASE
```

Untuk reset penuh yang sekaligus menghapus file upload development di
`.data/uploads`:

```powershell
npm run db:fresh:local -- --confirm=RESET_LOCAL_DATABASE --purge-local-storage
```

Command ini hanya menerima target PostgreSQL Compose lokal
`asihjaya@localhost:5432/asihjaya_rms`. Target non-local, environment production,
dan storage selain folder `.data` akan ditolak.

### Domain dan Production-readiness Checks

Gunakan kelompok check berdasarkan domain, tanpa command milestone historis:

```powershell
npm run check:transactions
npm run check:security
npm run check:business
npm run check:hardware-app
npm run check:hardware
```

Contract PDF yang memerlukan Chromium dijalankan terpisah:

```powershell
npm run check:manual
```

Untuk pemeriksaan lengkap yang sesuai dengan quality gate CI:

```powershell
npm run check:all
```

Script preflight dan repair sekali pakai sudah dipensiunkan. Validasi schema dilakukan melalui migration metadata checker dan rehearsal PostgreSQL disposable.

## Pemeriksaan Sebelum Commit

Minimal jalankan:

```powershell
npm run typecheck
npm run lint
npm run routes:check
npm run build
```

Jalankan feature-specific check untuk modul yang diubah.

Jika ada perubahan schema:

```powershell
npm run db:generate
npm run check:database
npm run db:migrate
npm run check:database:live
```

Jangan menjalankan `db:seed` pada database yang sudah berisi data hanya karena migration baru diterapkan.

## Backup Database Development

Contoh backup PostgreSQL melalui Docker:

```powershell
New-Item -ItemType Directory -Force ".\.local-backups" | Out-Null

docker compose exec -T db sh -lc 'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --file=/tmp/asihjaya-rms.dump'

docker compose cp db:/tmp/asihjaya-rms.dump ./.local-backups/asihjaya-rms.dump
```

Folder backup lokal harus tetap diabaikan oleh Git.

## Script Operasional

Pembersihan upload bukti pembayaran yang kedaluwarsa:

```powershell
npm run maintenance:payment-evidence-cleanup
```

Regenerasi panduan Hardware Hub dari source terstruktur:

```powershell
npm run docs:hardware:generate
```

## Dokumentasi

### Roadmap

- `docs/roadmap/payment-production-roadmap.md`
- `docs/roadmap/settings-center-roadmap.md`

### Environment and Production-readiness Notes

- `docs/development/environment-configuration.md`

Dokumentasi implementasi detail berada di:

```text
docs/production-readiness/
```

Topik yang tercakup antara lain:

- Checkout recovery dan idempotency
- Manual payment verification
- Refund dan return inspection
- Transaction correction
- Payment reconciliation
- Settlement import
- Notification Center

## Financial dan Concurrency Tests

Invariant finansial kritis diuji otomatis terhadap PostgreSQL 17 disposable:

```powershell
npm run test:financial:local
```

Command tersebut menyalakan database test pada port `55433`, menjalankan migration, mengeksekusi checkout/idempotency/inventory/Dana Titip/refund/settlement/Hardware Job/tenant-isolation tests, lalu menghapus container dan volume sementara.

Untuk database CI/test yang sudah tersedia:

```powershell
npm run test:financial
```

Lihat `docs/development/financial-concurrency-tests.md` untuk batas keselamatan dan daftar skenario.

## Saat Ini Ditahan

Tahapan berikut sengaja belum dilanjutkan:

- P2-A — Midtrans QRIS Gateway Foundation
- P2-B — Webhook, Expiry & Payment Recovery
- P2-C — Gateway Refund & Reconciliation
- Production Readiness Review
- WhatsApp integration
- Email integration

Lihat roadmap terkait sebelum melanjutkan pekerjaan tersebut.

## Production Status

Project belum dinyatakan production-ready.

Sebelum go-live, minimal perlu diselesaikan:

- Cloud storage configuration
- Backup dan restore drill
- Security dan session hardening
- Monitoring dan alerting
- Production migration rehearsal
- Store UAT simulation
- Production Readiness Review

## Kontribusi dan Perubahan Source

Saat membuat perubahan:

- Pertahankan pola feature service dan transaction service yang sudah ada.
- Jangan memindahkan business rule sensitif ke client.
- Selalu lakukan authorization di server.
- Jangan mengubah migration yang sudah pernah diterapkan.
- Jangan menyimpan secret atau data customer sensitif ke log.
- Tambahkan audit trail untuk tindakan administratif dan finansial sensitif.
- Jalankan quality checks sebelum commit.

## Migrasi Produk Legacy

Fondasi staging XLSX tersedia pada:

```text
/admin/migrasi-produk
```

Workbook sistem lama dianalisis tanpa otomatis membuat stok aktif. Barcode enam digit, termasuk leading zero, dipertahankan sebagai string; harga lama hanya menjadi referensi sampai verifikasi fisik dan pricing baru selesai.

```powershell
npm run check:legacy-product-migration
```

Lihat `docs/development/legacy-product-migration.md` untuk scope dan guardrail milestone.

## Legacy Migration Milestone 2

Master legacy dapat dipetakan sekali ke Product Master sistem baru melalui route:

```text
/admin/migrasi-produk/[batchId]/mapping
```

Manager juga dapat membagi pekerjaan per etalase dan menugaskan operator/lead melalui:

```text
/admin/migrasi-produk/[batchId]/sesi
```

Semua Product Master hasil otomatis tetap berstatus `draft`. Milestone ini belum mengaktifkan item, belum mengubah stok, dan belum mengubah lookup POS.

### Legacy physical verification

Staff yang ditugaskan pada sesi aktif dapat membuka `/pos/migrasi-barang`, memindai barcode lama, memverifikasi data fisik, dan mengirim hasil ke antrean manager. Barcode unmatched didukung dengan foto aktual wajib. Tahap ini tetap staging-only: tidak membuat stok aktif dan tidak mengubah checkout POS. Lihat `docs/development/legacy-product-migration.md`.

### Legacy migration Milestone 4

Manager review tersedia pada halaman batch migrasi. Approval bersifat transactional dan hanya membuat Product Item berstatus `migration_hold` beserta alias barcode legacy. Item belum tersedia di POS sampai proses cutover pada milestone berikutnya.

### Legacy product migration Milestone 5A — sold during migration

Manager dapat menandai satu atau banyak barcode yang terjual pada sistem legacy selama proses migrasi melalui `/admin/migrasi-produk/[batchId]/sold`. Barcode aktif langsung dikecualikan dari scanner, manager approval, dan cutover. Barcode staging yang belum pernah discan tetap dapat ditandai. Product Item yang sudah berstatus `migration_hold` akan dipindahkan ke `sold`, dinonaktifkan, dan alias barcode legacy-nya ikut dinonaktifkan tanpa membuat inventory movement. Salah penandaan dapat dibatalkan dengan alasan wajib untuk memulihkan status sebelumnya secara transactional.

### Legacy product migration Milestone 5B — final reconciliation dan foto legacy

Manager membuka `/admin/migrasi-produk/[batchId]/rekonsiliasi` untuk melihat blocker cutover dan memindahkan foto item legacy dari link XLSX ke private image storage. Readiness dihitung langsung dari sesi, verification, sold record, Product Item `migration_hold`, Product Master, dan alias barcode; tidak ada approval tambahan atau tabel workflow baru.

Foto legacy diproses maksimal 100 item per klik dengan concurrency terbatas. Download hanya menerima HTTPS dari host `LEGACY_IMAGE_ALLOWED_HOSTS`, memvalidasi redirect/content type/ukuran, lalu mengubah gambar menjadi WebP melalui pipeline image storage yang sama dengan upload normal. Kegagalan foto menjadi warning dan UI memakai foto Product Master lalu placeholder; kegagalan tersebut tidak menghalangi cutover. Milestone 5B belum membuat inventory movement, belum mengubah item menjadi `available`, dan belum mengaktifkan barcode alias pada checkout POS.

### Legacy product migration Milestone 5C — transactional cutover

Manager membuka `/admin/migrasi-produk/[batchId]/cutover` setelah rekonsiliasi akhir bersih. Aktivasi dilakukan per sesi/etalase dalam satu transaction: cutover run dibuat, opening inventory movement `migration_opening` dicatat untuk setiap item, Product Item berubah dari `migration_hold` menjadi `available`, verification menjadi `activated`, dan sesi menjadi `completed`.

Cutover memakai batch lock, barcode lock yang sama dengan scanner/approval/sold flow, unique run per sesi, serta konfirmasi `AKTIFKAN STOK`. Kegagalan satu item melakukan rollback seluruh sesi. Foto legacy gagal tetap dapat diulang setelah aktivasi. Lookup checkout melalui alias barcode legacy tetap ditahan sampai Milestone 5D.
