# ASIHJAYA Retail Management System

ASIHJAYA RMS adalah aplikasi web untuk operasional retail perhiasan yang menggabungkan **Admin Dashboard**, **Point of Sale (POS)**, inventaris per barang fisik, pelanggan, Buyback, laporan, Telegram Reporting, private storage, backup/restore database, dan Local Hardware Hub.

> **Status saat ini:** pengembangan aktif / UAT / preview deployment. Sistem belum dinyatakan final production go-live.
>
> **Alur pengembangan:** **LOCAL FIRST**. Perubahan diimplementasikan, diuji, dan distabilkan di local development terlebih dahulu. Setelah quality gate dan smoke test hijau, source yang sama dideploy ke preview VPS.

## Sumber Kebenaran Project

README ini menjelaskan **kondisi project saat ini**, bukan sejarah seluruh milestone pengembangan.

Aturan dokumentasi:

- implementasi source code dan database migration adalah sumber kebenaran utama untuk perilaku runtime;
- README merangkum arsitektur, modul, workflow, dan kondisi operasional yang masih relevan;
- dokumentasi teknis yang lebih detail berada di `docs/`;
- flow lama yang sudah digantikan tidak boleh diperlakukan sebagai behavior aktif;
- integrasi atau fitur yang tidak digunakan oleh operasional saat ini tidak boleh ditulis sebagai fitur aktif.

## Model Operasional

Baseline operasional yang sedang dituju:

- satu organisasi ASIHJAYA;
- satu outlet aktif pada deployment saat ini;
- manager/admin menggunakan desktop atau mini PC;
- sales/cashier dapat menggunakan desktop maupun mobile;
- authorization dan data tetap menggunakan organization/outlet scope;
- web application dapat berjalan di VPS sementara Hardware Hub berjalan pada Windows mini PC lokal outlet.

Arsitektur tetap mempertahankan scope organization/outlet sehingga perluasan outlet di masa depan tidak membutuhkan perubahan konsep data utama.

## Modul Utama Saat Ini

| Modul | Kemampuan saat ini |
| --- | --- |
| Authentication & Authorization | Session berbasis database, role/permission, organization/outlet scope |
| Admin Dashboard | Ringkasan operasional, laporan, dan entry point manajemen |
| POS | Catalog, scan/search item, cart, pricing, checkout, held cart, riwayat transaksi |
| Harga Jewelry | Harga/Gram global per Kadar Persen + override per transaksi |
| Pembayaran Manual | Cash, EDC, Transfer, payment profile, metadata verifikasi |
| Pelanggan | Customer master, riwayat transaksi, Dana Titip, public receipt history |
| Product Master | Identitas produk, kategori, foto, lifecycle active/draft |
| Inventaris Fisik | SKU, barcode/QR, foto item, berat, kadar, kondisi, lokasi, availability |
| Buyback | Pembelian kembali, Cuci/Rongsok, historical snapshots, penjualan kembali |
| Shift & Cash | Opening, closing, expected cash, controlled reopen, cash movement |
| Riwayat Penjualan | Riwayat POS/Admin, receipt, historical item snapshots |
| Refund / Return | Koreksi finansial dan pengembalian barang fisik |
| Laporan | Laporan sales, inventory, financial, operational, dan export |
| Migrasi Produk Legacy | Direct import XLSX langsung menjadi stok tersedia + sinkronisasi foto legacy |
| Notification Center | Notifikasi operasional di dalam aplikasi |
| Telegram Reporting | Opening/daily/weekly/monthly outbound reporting dan delivery operations |
| Settings Hub | Payment profile, Harga/Gram, konfigurasi Telegram |
| Hardware Hub | Signed agent, job polling, print job protocol, label/document printer adapter |
| Operasi Database | Forward migration, backup, restore, off-site replication |
| Operasi Deployment | Container contract, health check, backup, rollback automation |

## Model Pembayaran POS

Metode pembayaran checkout POS yang aktif:

```text
Cash
EDC
Transfer
```

Terminal EDC dan rekening transfer dikelola melalui Settings Hub sehingga outlet dapat menentukan profile pembayaran manual yang tersedia pada POS.

Dana Titip pelanggan memiliki ledger terpisah dan tidak diperlakukan sebagai payment gateway.

### Batasan payment integration

POS operasional saat ini **tidak menggunakan payment gateway/webhook flow**.

Database schema dan sebagian reporting compatibility dapat tetap memiliki enum historis yang lebih luas, tetapi enum tersebut tidak otomatis berarti metode itu aktif pada checkout.

Source of truth untuk metode pembayaran POS aktif berada pada contract manual checkout payment.

## Harga Jewelry Hybrid

Harga jual jewelry menggunakan model hybrid:

```text
Kadar Persen
    ↓
Harga / Gram Aktif
    ↓
harga default transaksi
    ↓
operator dapat menggunakan harga khusus per transaksi
```

Aturan penting:

- Harga/Gram global menjadi default berdasarkan Kadar Persen;
- item dengan kadar sama dapat memakai default rate yang sama;
- operator tetap dapat melakukan manual override pada transaksi tertentu;
- harga transaksi disimpan sebagai snapshot sehingga riwayat tidak berubah ketika global rate diperbarui;
- perubahan Harga/Gram dilakukan melalui Settings Hub.

Route:

```text
/admin/pengaturan/harga-gram
```

## Buyback — Lifecycle Final Saat Ini

Buyback tidak langsung mengembalikan barang menjadi stok jual.

Invariant utama:

```text
Buyback completed != saleable inventory
```

Lifecycle final:

```text
Customer
   ↓
Buyback acquisition
   ↓
availability = processing
   ↓
Cuci / Rongsok
   ↓
processing completion
   ↓
availability = available
condition    = used
location     = outlet
   ↓
dapat dijual di POS
```

### Akuisisi Buyback

Operator mencatat:

- source barang: existing ASIHJAYA item atau barang luar;
- nama/keterangan barang;
- Cuci atau Rongsok;
- kategori;
- warna;
- kadar;
- berat;
- Total Harga final;
- foto kondisi saat diterima.

Tidak ada Product Master mapping wajib pada intake barang luar.

Tidak ada approval/activation tambahan setelah pekerjaan fisik selesai.

### Existing ASIHJAYA item

Jika Buyback berasal dari item ASIHJAYA yang sebelumnya terjual:

- Physical Product Item tetap item yang sama;
- Product Item ID tetap;
- SKU tetap;
- barcode/QR identity tetap;
- setelah Buyback, item masuk `processing`;
- current identity baru diterapkan ketika Cuci/Rongsok selesai;
- cost item setelah processing berasal dari nilai acquisition Buyback;
- item menjadi `used + available + outlet` setelah completion.

### External Buyback

Untuk barang luar:

- Buyback acquisition tidak langsung membuat Product Item saleable;
- `product_item_id` dapat tetap `NULL` selama antrean processing;
- saat completion operator memilih atau membuat Product Master;
- Product Item, SKU, barcode/QR, dan current inventory identity dibuat atomik;
- cost item menggunakan nilai final Buyback;
- hasil langsung menjadi `used + available + outlet`.

### Historical identity

Empat perspektif data harus tetap terpisah:

```text
SALE SNAPSHOT
kondisi barang ketika transaksi Sale terjadi

BUYBACK SNAPSHOT
kondisi barang ketika diterima kembali dari customer

PROCESSING SNAPSHOT
source/before + result/after Cuci atau Rongsok

CURRENT INVENTORY
kondisi physical item saat ini
```

Sale lama tidak boleh berubah identitas atau nilai ekonominya hanya karena item yang sama kemudian di-Buyback dan direkondisi.

Dokumentasi teknis:

```text
docs/development/buyback-lifecycle.md
```

### Route Buyback

| Route | Fungsi |
| --- | --- |
| `/pos/buyback` | acquisition + preview 5 transaksi terbaru |
| `/pos/buyback/pemrosesan` | antrean dan completion Cuci/Rongsok |
| `/pos/buyback/riwayat` | full history, search/filter, pagination 10/page |

### Status implementasi Buyback

```text
B1 Data Model & Lifecycle              DONE
B2 Simplified Acquisition              DONE
B3 Cuci / Rongsok Processing           DONE
UI/UX Refinement                       DONE
B4 POS + Historical Identity Audit     DONE
```

Migration terkait:

```text
0022_buyback_processing_lifecycle
0023_buyback_simplified_acquisition
```

## Product Master dan Inventaris Fisik

Product Master adalah definisi reusable sebuah produk. Product Item mewakili satu barang fisik.

Physical inventory menyimpan data seperti:

- SKU;
- barcode dan QR;
- Product Master;
- nama item saat ini;
- outlet saat ini;
- berat;
- kadar;
- warna/ukuran/batu;
- foto;
- acquisition cost;
- condition;
- availability;
- location state.

State availability yang digunakan sistem antara lain:

```text
draft
processing
available
reserved
inspection
sold
```

Enum historis seperti `migration_hold` dapat tetap ada untuk backward compatibility database, tetapi **bukan bagian dari workflow Migrasi Produk Legacy yang aktif saat ini**.

POS hanya menerima item yang memenuhi sale gate, termasuk:

```text
availability = available
condition    = good | used
location     = outlet
item active
Product Master active
category active
outlet sesuai
tidak sedang dikunci held cart aktif
```

## Migrasi Produk Legacy — Direct Import

Migrasi produk legacy sekarang menggunakan **direct import sederhana**, bukan flow verifikasi berlapis.

Route utama:

```text
/admin/migrasi-produk
```

Flow aktif:

```text
XLSX dari sistem lama
        ↓
parse + normalisasi + validasi
        ↓
kategori di-resolve / dibuat otomatis
        ↓
Product Master di-resolve / dibuat otomatis
        ↓
Product Item dibuat
        ↓
availability = available
condition    = good
location     = outlet
is_active    = true
        ↓
inventory movement = migration_opening
        ↓
langsung tersedia di Inventory + POS
```

Aturan penting:

- seluruh row workbook tetap diimport;
- warning/invalid tidak memblokir item masuk;
- data yang perlu dirapikan ditandai sebagai cleanup sambil operasional berjalan;
- Product Master existing digunakan kembali bila cocok;
- Product Master dan kategori baru dapat dibuat otomatis;
- sistem selalu membuat SKU/barcode/QR internal;
- barcode legacy dipertahankan sebagai alias bila unik dan memenuhi contract;
- konflik barcode legacy tidak menggagalkan import item;
- Harga/Gram aktif berdasarkan Kadar Persen tetap menjadi pricing source POS;
- nilai harga legacy disimpan sebagai referensi, bukan sebagai pricing source aktif POS;
- direct import bersifat transactional sehingga kegagalan tidak boleh menghasilkan aktivasi item parsial;
- retry dilindungi agar tidak membuat duplikasi Product Item untuk source row yang sama.

### Sinkronisasi foto legacy

Foto tidak menjadi blocker inventory.

Setelah direct import berhasil:

```text
item sudah available
        ↓
legacy image URL
        ↓
download bertahap
        ↓
private/internal storage
        ↓
product_items.imageKey
```

Sinkronisasi foto dimulai otomatis pada halaman detail batch selama masih ada foto pending.

Jika download foto gagal:

- item tetap available;
- POS tetap dapat menggunakan item;
- kegagalan dicatat;
- sinkronisasi dapat dilanjutkan;
- foto dapat dilengkapi manual bila diperlukan.

Dokumentasi teknis current-state:

```text
docs/development/legacy-product-migration.md
```

## Pelanggan dan Riwayat Penjualan

Customer dapat memiliki:

- customer code;
- phone/email/address;
- transaction history;
- Dana Titip ledger;
- public receipt history access.

Historical Sale menggunakan prinsip **snapshot-first**.

Artinya history Sale, customer history, Admin Sale detail, receipt, refund expected weight, dan reporting tidak boleh memakai current Product Item sebagai kebenaran historis utama setelah barang berubah di kemudian hari.

## Shift dan Kas

POS menggunakan shift sebagai konteks transaksi finansial.

Flow utama:

```text
Open shift
   ↓
POS operations
   ↓
cash movement / transaction
   ↓
Close shift + reconciliation
```

Controlled shift reopen tersedia untuk koreksi operasional yang memang diizinkan, dengan authorization dan audit guard.

Dokumentasi:

```text
docs/development/controlled-shift-reopen.md
```

## Settings Hub

Route:

```text
/admin/pengaturan
```

### Pembayaran

```text
/admin/pengaturan/pembayaran/manual-edc
```

Mengelola terminal EDC dan rekening transfer yang tersedia pada POS.

### Harga Jewelry

```text
/admin/pengaturan/harga-gram
```

Mengelola Harga/Gram aktif berdasarkan Kadar Persen.

### Telegram Reporting

```text
/admin/pengaturan/integrasi/telegram
```

Mengelola:

- private outlet group;
- opening report;
- daily report;
- weekly report;
- monthly report;
- test message;
- delivery history;
- manual retry.

Telegram adalah **outbound reporting**, bukan conversational bot untuk customer.

## Notification Center

Notification Center menangani awareness dan follow-up operasional seperti transaction event, shift, correction, hardware, serta event administratif yang relevan.

Notification Center bukan pengganti backend authorization dan bukan pengganti transactional guard.

## Local Hardware Hub

Web application dapat berkomunikasi dengan Hardware Hub yang berjalan pada Windows mini PC outlet.

Arsitektur:

```text
ASIHJAYA RMS di VPS
        ↓ HTTPS signed protocol
Hardware Hub di Windows mini PC lokal
        ↓
device adapters
├── Label printer
└── Document / receipt printer
```

Kemampuan utama:

- hardware agent registration/provisioning;
- credential lifecycle;
- signed request;
- job claim/lease;
- retry/recovery contract;
- print payload protocol;
- label print pipeline;
- document print pipeline;
- status Hardware Hub pada web application.

Real hardware tetap harus divalidasi per device/profile sebelum final production go-live.

Dokumentasi:

```text
docs/hardware-hub/windows-setup-guide.md
docs/hardware-hub/windows-production-operations.md
docs/hardware-hub/hardware-job-protocol-v2.md
docs/hardware-hub/sato-cg408-profile.md
docs/hardware-hub/receipt-a4-epson-profile.md
```

## Arsitektur Aplikasi

```text
Desktop / Mobile Browser
          ↓
Next.js App Router
          ↓
Server Components / Server Actions / Route Handlers
          ↓
Feature Services & Transaction Services
          ↓
Drizzle ORM
          ↓
PostgreSQL
```

Sistem pendamping:

```text
                         ┌─ Private image/file storage
Next.js application  ────┼─ Telegram outbound delivery
                         ├─ Hardware job queue → Local Hardware Hub
                         └─ PostgreSQL backup → local retention → Backblaze B2
```

Operasi inventory dan financial yang kritis menggunakan proteksi seperti:

- database transaction;
- row/advisory lock bila diperlukan;
- idempotency;
- unique constraint;
- audit log;
- immutable transaction snapshot.

## Technology Stack

Baseline saat ini:

- Next.js App Router;
- React 19;
- TypeScript strict mode;
- Tailwind CSS;
- PostgreSQL 17;
- Drizzle ORM / Drizzle Kit;
- Node.js `>=24.14.0 <25`;
- npm `>=11.9.0 <12`;
- Docker Compose;
- Playwright untuk PDF/contract flow;
- local + S3-compatible private storage abstraction;
- Windows Hardware Hub.

## Struktur Repository

```text
src/
├── app/                    route Next.js, action, route handler
├── components/             UI Admin/POS/shared
├── db/                     schema, seed, integrasi DB
├── features/               query/service/contract domain
├── lib/                    shared infrastructure
└── server/                 server integrations

hardware-hub/               runtime hardware lokal Windows

drizzle/                    forward-only database migration
scripts/                    checker, test, deployment/backup tooling
ops/                        asset operasional VPS
docs/
├── development/
├── hardware-hub/
└── production-readiness/
```

## Local Development

### Toolchain

Periksa:

```powershell
node --version
npm --version
```

Versi yang didukung:

```text
Node >=24.14.0 <25
npm  >=11.9.0 <12
```

### Setup pertama

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

`db:seed` hanya digunakan untuk database baru atau reset yang memang disengaja.

Jangan menjalankan seed setiap selesai migration pada database development yang sudah memiliki data.

### Development database yang sudah ada

```powershell
npm ci
npm run db:migrate
npm run check:database
npm run check:database:live
npm run typecheck
npm run dev
```

### Reset local yang disengaja

```powershell
npm run db:fresh:local -- --confirm=RESET_LOCAL_DATABASE
```

Dengan purge local upload:

```powershell
npm run db:fresh:local -- --confirm=RESET_LOCAL_DATABASE --purge-local-storage
```

## Aturan Database Migration

Migration bersifat forward-only.

Aturan:

- jangan mengedit migration yang sudah pernah diterapkan;
- perubahan schema baru dibuat melalui migration berikutnya;
- backup sebelum migration besar;
- schema dan `drizzle.__drizzle_migrations` harus sinkron;
- gunakan database disposable untuk migration rehearsal/integration test;
- `db:seed` bukan langkah otomatis setelah setiap migration.

Command utama:

```powershell
npm run db:generate
npm run check:database
npm run db:migrate
npm run check:database:live
```

## Backup, Restore, dan Off-site Safety

Project memiliki database operation untuk:

- daily backup;
- weekly backup;
- pre-deployment backup;
- checksum/metadata;
- retention;
- restore;
- verification;
- Backblaze B2 off-site replication.

Tujuan operasional:

```text
Server boleh rusak.
Disk boleh hilang.
VM boleh dihapus.

Source + secrets + database backup tetap tersedia.
        ↓
provision VPS baru
        ↓
restore
        ↓
lanjut operasional
```

Command terkait:

```powershell
npm run db:backup:production
npm run db:backup:weekly
npm run db:backup:pre-deployment:verified
npm run db:backup:offsite
npm run db:backup:offsite:verify
npm run db:restore:production
```

Dokumentasi:

```text
docs/development/database-backup-restore.md
docs/development/database-backup-offsite.md
docs/development/database-deployment.md
docs/development/deployment-rollback-automation.md
```

## Pola Deployment Saat Ini

Workflow:

```text
LOCAL DEVELOPMENT
    ↓
targeted checker
    ↓
typecheck / lint / route check / build / smoke test
    ↓
commit + push
    ↓
PREVIEW VPS
    ↓
preview smoke test
```

Preview VPS bukan satu-satunya copy application state.

Production tooling sudah memiliki container contract, database deployment guard, health check, backup, dan rollback automation.

Dokumentasi:

```text
docs/development/asihjaya-rms-production-handoff.md
docs/production-readiness/logging-monitoring.md
docs/production-readiness/reverse-proxy-cloudflare.md
```

## Environment dan Secrets

Template:

```text
.env.example
.env.production.example
```

Command:

```powershell
npm run env:generate-secrets -- --write .env
npm run env:prepare:production
npm run env:validate
npm run env:validate:production
```

Jangan commit:

- `.env`;
- database dump;
- session secret;
- Telegram token;
- Hardware Hub credential;
- storage key;
- Backblaze application key;
- production access token.

Dokumentasi:

```text
docs/development/environment-configuration.md
```

## Route Utama

### POS

| Route | Fungsi |
| --- | --- |
| `/pos` | workspace POS |
| `/pos/produk` | product/catalog access |
| `/pos/pelanggan` | customer access |
| `/pos/ditahan` | transaksi ditahan |
| `/pos/shift` | operasi shift |
| `/pos/transaksi` | riwayat transaksi POS |
| `/pos/buyback` | acquisition Buyback |
| `/pos/buyback/pemrosesan` | Cuci/Rongsok processing |
| `/pos/buyback/riwayat` | full Buyback history |

### Admin

| Route | Fungsi |
| --- | --- |
| `/admin` | dashboard |
| `/admin/produk` | Product Master |
| `/admin/inventaris` | inventaris fisik |
| `/admin/penjualan` | sales history/admin transaction tools |
| `/admin/pelanggan` | customer administration |
| `/admin/laporan` | reporting |
| `/admin/migrasi-produk` | direct import produk legacy |
| `/admin/operasional/*` | shift/cash/hardware operations |
| `/admin/notifikasi` | Notification Center |
| `/admin/pengaturan` | Settings Hub |
| `/admin/pengaturan/pembayaran/manual-edc` | profile EDC/transfer |
| `/admin/pengaturan/harga-gram` | Harga/Gram |
| `/admin/pengaturan/integrasi/telegram` | Telegram Reporting |

Semua route/action sensitif wajib melakukan backend authorization. Menu visibility bukan authorization boundary.

## Quality Gate

### Gate local cepat

Untuk feature work normal:

```powershell
npm run typecheck
npm run lint
npm run routes:check
npm run build:clean
```

Jalankan targeted checker untuk domain yang disentuh.

### Perubahan database

```powershell
npm run check:database
npm run db:migrate
npm run check:database:live
```

### Gate project lengkap

```powershell
npm run check:all
```

High-risk financial/integration gate:

```powershell
npm run check:critical
```

Financial PostgreSQL disposable test:

```powershell
npm run test:financial:local
```

Legacy direct-import contract:

```powershell
npm run check:legacy-product-migration
```

Buyback historical-identity audit:

```powershell
npx tsx scripts/check-buyback-b4-final-audit.ts
```

Sinkronisasi dokumentasi:

```powershell
npx tsx scripts/check-documentation-current-state.ts
```

Dokumentasi quality:

```text
docs/development/quality-gates.md
docs/development/financial-concurrency-tests.md
```

## Invariant Engineering Penting

### Riwayat transaksi harus tetap benar secara historis

Current Product Item dapat berubah. Representasi transaksi lama tidak boleh ikut berubah.

Gunakan:

```text
Sale event     → sale_items.snapshot
Buyback event  → buyback_items acquisition snapshot
Processing     → source snapshot + result snapshot
Inventory now  → product_items current state
```

### Inventory admission harus eksplisit

POS hanya boleh menjual item yang memenuhi sale gate saat ini.

Buyback completion saja tidak membuat item saleable sebelum processing selesai.

Sebaliknya, **Legacy Product Migration current flow memang merupakan direct inventory admission**: item yang berhasil diimport dibuat langsung `available` dalam transaction import.

### Financial state harus divalidasi server-side

Pricing, payment normalization, shift financials, checkout, refund, Buyback completion, dan sensitive mutation lain harus divalidasi dan dikomit pada server-side transactional boundary.

### Identitas fisik harus konsisten

Existing ASIHJAYA Buyback item mempertahankan physical item identity. Perubahan lifecycle tidak boleh membuat identitas pengganti tanpa alasan bisnis yang valid.

## Indeks Dokumentasi

### Domain dan bisnis

- `docs/development/buyback-lifecycle.md`
- `docs/development/legacy-product-migration.md`
- `docs/development/controlled-shift-reopen.md`
- `docs/development/financial-concurrency-tests.md`

### Infrastructure dan deployment

- `docs/development/environment-configuration.md`
- `docs/development/quality-gates.md`
- `docs/development/database-deployment.md`
- `docs/development/database-backup-restore.md`
- `docs/development/database-backup-offsite.md`
- `docs/development/deployment-rollback-automation.md`
- `docs/development/asihjaya-rms-production-handoff.md`

### Hardware Hub

- `docs/hardware-hub/windows-setup-guide.md`
- `docs/hardware-hub/windows-production-operations.md`
- `docs/hardware-hub/hardware-job-protocol-v2.md`
- `docs/hardware-hub/sato-cg408-profile.md`
- `docs/hardware-hub/sato-label-v3-final.md`
- `docs/hardware-hub/receipt-a4-epson-profile.md`

### Production readiness

- `docs/production-readiness/logging-monitoring.md`
- `docs/production-readiness/reverse-proxy-cloudflare.md`

## Sebelum Commit

Minimum:

```powershell
npm run typecheck
npm run lint
npm run routes:check
npm run build:clean
```

Dokumentasi:

```powershell
npx tsx scripts/check-documentation-current-state.ts
```

Untuk perubahan schema, jalankan juga database checks.

## Status Production

Codebase memiliki banyak production-safety infrastructure, tetapi status project tetap:

```text
ACTIVE DEVELOPMENT / UAT / PREVIEW
```

Jangan menyebut deployment production-ready hanya karena aplikasi dapat start.

Sebelum final real-production cutover, ulangi dan dokumentasikan:

- full store UAT;
- validasi real hardware untuk seluruh production device;
- review production secrets;
- production database backup + restore drill;
- off-site backup verification;
- migration/deployment rehearsal;
- rollback rehearsal;
- monitoring/alert verification;
- final operational handoff.

## Prinsip Kontribusi

Ketika mengubah source:

- pertahankan server-side authorization;
- jangan memindahkan business rule sensitif menjadi client-only;
- migration harus forward-only;
- pertahankan historical snapshot;
- hindari broad refactor pada high-blast-radius transaction file kecuali diperlukan;
- pertahankan audit trail untuk sensitive action;
- jangan log secret atau credential sensitif;
- jalankan targeted checker + quality gate sebelum commit;
- update README/docs ketika operational flow benar-benar berubah.

---

**Kebijakan README ASIHJAYA RMS:** dokumentasikan apa yang sistem lakukan **sekarang**. Ide historis, integration yang dibatalkan, dan flow milestone yang sudah digantikan tidak termasuk current project overview.
