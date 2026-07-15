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

| Modul | Fungsi | Status |
|---|---|---|
| Admin Dashboard | Ringkasan operasional dan monitoring | Aktif |
| POS | Checkout, pembayaran, invoice, dan recovery | Aktif |
| Produk Master | Data produk dan foto | Aktif |
| Inventaris | Item fisik, barcode, availability, dan movement | Aktif |
| Penjualan | Riwayat, detail, dan koreksi transaksi | Aktif |
| Approval | Maker-checker untuk tindakan sensitif | Aktif |
| Refund & Return | Refund finansial dan inspeksi barang fisik | Aktif |
| Rekonsiliasi | Review settlement dan mismatch | Aktif |
| Settlement Import | CSV import dan auto-matching | Aktif |
| Notification Center | Event, recipient, filter, archive, auto-resolution | Aktif |
| Hardware Hub | Device monitoring dan print-job foundation | Development |
| Settings Center | Pengaturan terpusat | Planned |
| Midtrans | QRIS payment gateway | On hold |

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

## Persyaratan Development

- Windows 10/11, macOS, atau Linux
- Node.js 22 atau 24 LTS
- npm
- Docker Desktop atau Docker Engine dengan Compose
- Git

## First-time Local Setup

### Windows PowerShell

```powershell
Copy-Item .env.example .env

docker compose up -d db

npm ci
npm run db:migrate
npm run db:seed
npm run dev
```

### Bash

```bash
cp .env.example .env

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

## Environment Configuration

Lihat `.env.example` untuk daftar konfigurasi lengkap.

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

| Route | Fungsi |
|---|---|
| `/login` | Login |
| `/admin` | Admin Dashboard |
| `/pos` | Point of Sale |
| `/admin/produk` | Product master |
| `/admin/inventaris` | Inventory items |
| `/admin/penjualan` | Riwayat transaksi |
| `/admin/pelanggan` | Daftar customer |
| `/admin/operasional/shift` | Shift kasir |
| `/admin/operasional/approval` | Riwayat approval |
| `/admin/operasional/kas` | Pergerakan kas |
| `/admin/operasional/hardware` | Hardware Hub |
| `/admin/keuangan/rekonsiliasi` | Payment reconciliation |
| `/admin/keuangan/rekonsiliasi/import` | Settlement import |
| `/admin/notifikasi` | Notification Center |
| `/admin/administrasi` | User, role, dan administrasi |
| `/admin/pengaturan` | Settings Center |

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

### Payment dan Production-readiness Checks

```powershell
npm run check:p0d
npm run check:p1a
npm run check:p1a1
npm run check:p1b
npm run check:p1b1
npm run check:p1c1
npm run check:p1c2
```

### Notification Center Checks

```powershell
npm run check:notifications:v1a
npm run check:notifications:v1b
npm run check:notifications:v1c
npm run check:notifications:v1d
npm run check:notifications:v1e
npm run check:notifications:v1f
```

### Database Preflight

Feature tertentu memiliki command preflight, misalnya:

```powershell
npm run db:preflight:p1c2
npm run db:preflight:notifications:v1a
```

Periksa `package.json` dan dokumentasi fitur untuk command preflight yang tersedia.

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
npm run db:preflight:<feature>
npm run db:migrate
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

## Dokumentasi

### Roadmap

- `docs/roadmap/payment-production-roadmap.md`
- `docs/roadmap/settings-center-roadmap.md`

### Production-readiness Notes

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

## Saat Ini Ditahan

Tahapan berikut sengaja belum dilanjutkan:

- P1-D — Automated Payment & Concurrency Tests
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

- Automated financial integration tests
- Concurrency tests
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
