# ASIHJAYA Retail Management System

ASIHJAYA RMS adalah web application untuk operasional retail perhiasan yang menggabungkan **Admin Dashboard**, **Point of Sale**, inventory per physical item, customer management, Buyback, reporting, Telegram reporting, private storage, database backup/restore, dan Local Hardware Hub.

> **Current status:** active development / UAT dan preview deployment. Sistem belum dinyatakan final production go-live.
>
> **Development workflow:** LOCAL FIRST. Perubahan diimplementasikan, diuji, dan distabilkan di local development terlebih dahulu. Setelah quality gate dan smoke test hijau, source yang sama dideploy ke preview VPS.

## Source of Truth

README ini menjelaskan **state project saat ini**, bukan sejarah seluruh milestone pengembangan.

Aturan dokumentasi:

- Implementasi source code dan database migration adalah sumber kebenaran utama untuk behavior runtime.
- README merangkum arsitektur, module, workflow, dan operational posture yang masih relevan.
- Dokumentasi detail berada di `docs/`.
- Milestone lama yang sudah superseded tidak boleh diperlakukan sebagai behavior aktif.
- Jangan menambahkan roadmap atau integration yang tidak benar-benar digunakan oleh operational flow saat ini.

## Operational Model

Baseline operasional yang sedang dituju:

- satu organisasi ASIHJAYA;
- satu outlet aktif pada deployment saat ini;
- manager/admin menggunakan desktop atau mini PC;
- sales/cashier dapat menggunakan desktop maupun mobile;
- arsitektur authorization dan data tetap organization/outlet scoped;
- web app dapat berjalan di VPS sementara Hardware Hub berjalan pada Windows mini PC lokal outlet.

Arsitektur tetap memungkinkan perluasan multi-outlet tanpa menjadikan multi-outlet sebagai requirement deployment saat ini.

## Current Core Modules

| Module                         | Current capability                                                                 |
| ------------------------------ | ---------------------------------------------------------------------------------- |
| Authentication & Authorization | Database-backed session, role/permission, organization/outlet scope                |
| Admin Dashboard                | Operational overview, reports, management entry points                             |
| POS                            | Catalog, scan/search item, cart, pricing, checkout, held cart, transaction history |
| Jewelry Pricing                | Global Harga/Gram per Kadar Persen + manual per-transaction override               |
| Manual Payment                 | Cash, EDC, Transfer, payment profile, verification metadata                        |
| Customer                       | Customer master, transaction history, Dana Titip, public receipt history           |
| Product Master                 | Product identity, category, image, active/draft lifecycle                          |
| Physical Inventory             | SKU, barcode/QR, item image, weight, purity, condition, location, availability     |
| Buyback                        | Acquisition, Cuci/Rongsok processing, historical snapshots, resale                 |
| Shift & Cash                   | Opening, closing, expected cash, controlled reopen, cash movement                  |
| Sales History                  | POS/Admin history, receipt, historical item snapshots                              |
| Refund / Return                | Financial correction and physical return workflow                                  |
| Reporting                      | Sales, inventory, financial and operational reporting/export                       |
| Legacy Product Migration       | XLSX staging, physical verification, reconciliation, cutover                       |
| Notification Center            | In-app operational notifications and lifecycle                                     |
| Telegram Reporting             | Outbound opening/daily/weekly/monthly reporting and delivery operations            |
| Settings Hub                   | Manual payment profile, Harga/Gram, Telegram configuration                         |
| Hardware Hub                   | Signed agent, job polling, print job protocol, label/document printer adapters     |
| Database Operations            | Forward migrations, backup, restore, off-site replication                          |
| Deployment Operations          | Production container contract, health checks, rollback automation                  |

## Active POS Payment Model

Active checkout payment methods are intentionally simple:

```text
Cash
EDC
Transfer
```

EDC terminal dan rekening transfer dikelola melalui Settings Hub sehingga outlet dapat menentukan profile pembayaran manual yang tersedia di POS.

Dana Titip customer memiliki ledger terpisah dan dapat menjadi bagian dari financial workflow customer.

### Important payment scope

Operational POS saat ini **tidak menggunakan payment gateway/webhook flow**.

Database schema dan beberapa reporting labels dapat tetap memiliki enum legacy untuk backward compatibility, tetapi itu tidak berarti method tersebut aktif pada checkout. Source of truth untuk method pembayaran POS aktif berada pada manual checkout payment contract.

## Hybrid Jewelry Pricing

Harga jual jewelry memakai model hybrid:

```text
Kadar Persen
    ↓
Harga / Gram Aktif
    ↓
default harga transaksi
    ↓
operator dapat menggunakan harga khusus per transaksi
```

Rules penting:

- global Harga/Gram tetap menjadi default berdasarkan Kadar Persen;
- item dengan kadar sama dapat memakai default rate yang sama;
- operator tetap dapat memberikan **manual override** pada transaksi tertentu;
- source harga transaksi disimpan sebagai snapshot sehingga history tidak ikut berubah ketika global rate diperbarui;
- perubahan Harga/Gram dilakukan melalui Settings Hub.

Route:

```text
/admin/pengaturan/harga-gram
```

## Buyback — Current Final Lifecycle

Buyback bukan shortcut untuk mengembalikan barang langsung ke stok jual.

Invariant utama:

```text
Buyback completed != saleable inventory
```

Final lifecycle:

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
Saleable di POS
```

### Buyback acquisition

Operator mencatat:

- source barang: existing ASIHJAYA item atau barang luar;
- nama/keterangan barang;
- Cuci atau Rongsok;
- kategori;
- warna;
- kadar;
- berat;
- Total Harga final;
- foto kondisi ketika diterima.

Tidak ada Product Master mapping wajib pada intake barang luar.

Tidak ada flow approval/activation tambahan setelah pekerjaan fisik selesai.

### Existing ASIHJAYA item

Jika Buyback berasal dari item ASIHJAYA yang sebelumnya terjual:

- Physical Product Item tetap item yang sama;
- Product Item ID tetap;
- SKU tetap;
- barcode/QR identity tetap;
- setelah Buyback item masuk `processing`;
- current identity baru diterapkan ketika Cuci/Rongsok selesai;
- cost item setelah processing berasal dari nilai acquisition Buyback;
- item menjadi `used + available + outlet` setelah completion.

### External Buyback

Untuk barang luar:

- Buyback acquisition tidak langsung membuat Product Item saleable;
- `product_item_id` dapat tetap `NULL` selama antrean processing;
- pada completion operator memilih atau membuat Product Master;
- Product Item, SKU, barcode/QR, dan current inventory identity dibuat secara atomik;
- cost item menggunakan nilai final Buyback;
- hasil langsung masuk sebagai `used + available + outlet`.

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

Contoh: Sale lama tidak boleh berubah nama, berat, kadar, kategori, SKU display, atau economic snapshot hanya karena item yang sama kemudian di-Buyback dan direkondisi.

Detail engineering ada di:

```text
docs/development/buyback-lifecycle.md
```

### Buyback routes

| Route                     | Purpose                                         |
| ------------------------- | ----------------------------------------------- |
| `/pos/buyback`            | acquisition + preview 5 transaksi terbaru       |
| `/pos/buyback/pemrosesan` | queue dan completion Cuci/Rongsok               |
| `/pos/buyback/riwayat`    | full history, search/filter, pagination 10/page |

Responsive UX:

- Buyback list menggunakan responsive layout;
- processing form menggunakan right-side drawer pada desktop;
- processing form menjadi fullscreen pada tablet/mobile;
- history dedicated menggunakan table pada desktop dan transaction card pada mobile.

### Buyback implementation status

```text
B1 Data Model & Lifecycle              DONE
B2 Simplified Acquisition              DONE
B3 Cuci / Rongsok Processing           DONE
UI/UX Refinement                       DONE
B4 POS + Historical Identity Audit     DONE
```

Schema milestones terkait:

```text
0022_buyback_processing_lifecycle
0023_buyback_simplified_acquisition
```

## Product & Inventory Lifecycle

Product Master adalah reusable product definition. Product Item mewakili satu physical item.

Physical inventory menyimpan identity dan state seperti:

- SKU;
- barcode dan QR;
- Product Master;
- item display name;
- current outlet;
- weight;
- purity;
- color/size/gemstone;
- image;
- acquisition cost;
- condition;
- availability;
- location state.

Availability penting yang digunakan antara lain:

```text
draft
migration_hold
processing
available
reserved
inspection
sold
```

POS sale gate hanya menerima item yang memenuhi invariant saleable, termasuk:

```text
availability = available
condition    = good | used
location     = outlet
item active
Product Master active
category active
correct outlet
not held by active held cart
```

## Legacy Product Migration

Legacy migration tetap memakai pendekatan staging dan physical verification, bukan import langsung menjadi stok jual.

High-level flow:

```text
Legacy XLSX
   ↓
staging
   ↓
Product Master mapping
   ↓
physical verification
   ↓
manager review
   ↓
migration_hold
   ↓
final reconciliation
   ↓
transactional cutover
   ↓
available inventory
```

Fitur yang sudah tersedia mencakup:

- preserve legacy barcode sebagai string;
- mapping master;
- session/assignment per area kerja;
- physical verification;
- unmatched barcode handling;
- sold-during-migration exclusion;
- legacy image migration ke private storage;
- final reconciliation;
- transactional cutover;
- barcode alias support.

Detail:

```text
docs/development/legacy-product-migration.md
```

## Customer & Historical Sales

Customer dapat memiliki:

- customer code;
- phone/email/address;
- transaction history;
- Dana Titip ledger;
- public receipt history access.

Historical Sale read path bersifat **snapshot-first**.

Artinya history Sale, customer history, Admin Sale detail, receipt, refund expected weight, dan reporting tidak boleh mengambil current item state sebagai primary historical truth setelah physical item berubah di kemudian hari.

## Shift & Cash

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

Controlled shift reopen tersedia untuk kondisi operasional yang memang memerlukan koreksi, dengan authorization dan audit guard.

## Settings Hub

Route:

```text
/admin/pengaturan
```

Current settings groups:

### Pembayaran

```text
/admin/pengaturan/pembayaran/manual-edc
```

Mengelola terminal EDC dan rekening transfer yang tersedia pada POS.

### Harga Jewelry

```text
/admin/pengaturan/harga-gram
```

Mengelola global Harga/Gram aktif berdasarkan Kadar Persen.

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

Telegram integration bersifat **outbound reporting**, bukan conversational bot untuk customer.

## Notification Center

In-app Notification Center menangani awareness/follow-up operasional seperti transaction event, shift, correction, hardware, dan event administratif yang relevan.

Notification Center bukan pengganti backend authorization dan bukan pengganti transactional guard.

## Local Hardware Hub

Web application dapat berkomunikasi dengan Hardware Hub yang berjalan pada Windows mini PC outlet.

High-level architecture:

```text
ASIHJAYA RMS on VPS
        ↓ HTTPS signed protocol
Hardware Hub on local Windows mini PC
        ↓
device adapters
├── Label printer
└── Document / receipt printer
```

Capability yang tersedia:

- hardware agent registration/provisioning;
- credential lifecycle;
- signed request;
- job claim/lease;
- retry/recovery contract;
- print payload protocol;
- label print pipeline;
- document print pipeline;
- Hardware Hub status di web application.

Real hardware tetap harus divalidasi per device/profile sebelum final production go-live.

Dokumentasi:

```text
docs/hardware-hub/windows-setup-guide.md
docs/hardware-hub/windows-production-operations.md
docs/hardware-hub/hardware-job-protocol-v2.md
docs/hardware-hub/sato-cg408-profile.md
docs/hardware-hub/receipt-a4-epson-profile.md
```

## Architecture

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

Side systems:

```text
                         ┌─ Private image/file storage
Next.js application  ────┼─ Telegram outbound delivery
                         ├─ Hardware job queue → Local Hardware Hub
                         └─ PostgreSQL backup → local retention → Backblaze B2
```

Critical financial and inventory operations use transaction-level protections such as:

- database transaction;
- row/advisory locks where required;
- idempotency;
- unique constraints;
- audit log;
- immutable transaction snapshots.

## Technology Stack

Current baseline:

- Next.js App Router;
- React 19;
- TypeScript strict mode;
- Tailwind CSS;
- PostgreSQL 17;
- Drizzle ORM / Drizzle Kit;
- Node.js `>=24.14.0 <25`;
- npm `>=11.9.0 <12`;
- Docker Compose;
- Playwright for PDF/contract flows;
- local + S3-compatible private storage abstraction;
- Windows Hardware Hub.

## Repository Layout

```text
src/
├── app/                    Next.js routes, actions, route handlers
├── components/             Admin/POS/shared UI
├── db/                     schema, seed, DB integration
├── features/               domain queries/services/contracts
├── lib/                    shared infrastructure
└── server/                 server integrations

hardware-hub/               local Windows hardware runtime

drizzle/                    forward-only database migrations
scripts/                    checkers, tests, deployment/backup tooling
ops/                        VPS/operations assets
docs/
├── development/
├── hardware-hub/
└── production-readiness/
```

## Local Development

### Toolchain

Verify:

```powershell
node --version
npm --version
```

Supported:

```text
Node >=24.14.0 <25
npm  >=11.9.0 <12
```

### First-time setup

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

`db:seed` hanya digunakan untuk database baru/reset yang disengaja.

Jangan menjalankan seed setiap selesai migration pada database development yang sudah memiliki data.

### Existing development database

```powershell
npm ci
npm run db:migrate
npm run check:database
npm run check:database:live
npm run typecheck
npm run dev
```

### Safe local reset

```powershell
npm run db:fresh:local -- --confirm=RESET_LOCAL_DATABASE
```

Dengan local upload purge:

```powershell
npm run db:fresh:local -- --confirm=RESET_LOCAL_DATABASE --purge-local-storage
```

## Database Migration Rules

Migration bersifat forward-only.

Rules:

- jangan mengedit migration yang sudah pernah diterapkan;
- perubahan schema baru harus dibuat melalui migration berikutnya;
- backup sebelum migration besar;
- schema dan `drizzle.__drizzle_migrations` harus sinkron;
- gunakan database disposable untuk migration rehearsal/integration tests;
- `db:seed` bukan langkah otomatis setelah setiap migration.

Core commands:

```powershell
npm run db:generate
npm run check:database
npm run db:migrate
npm run check:database:live
```

## Backup, Restore & Off-site Safety

Project memiliki database operations untuk:

- daily backup;
- weekly backup;
- pre-deployment backup;
- checksum/metadata;
- retention;
- restore;
- verification;
- Backblaze B2 off-site replication.

Operational goal:

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
continue operation
```

Relevant commands:

```powershell
npm run db:backup:production
npm run db:backup:weekly
npm run db:backup:pre-deployment:verified
npm run db:backup:offsite
npm run db:backup:offsite:verify
npm run db:restore:production
```

Detailed docs:

```text
docs/development/database-backup-restore.md
docs/development/database-backup-offsite.md
docs/development/database-deployment.md
docs/development/deployment-rollback-automation.md
```

## Deployment Posture

Current workflow:

```text
LOCAL DEVELOPMENT
    ↓
targeted checker
    ↓
typecheck / build / smoke
    ↓
commit + push
    ↓
PREVIEW VPS
    ↓
preview smoke test
```

The preview VPS is not treated as the only copy of application state.

Production deployment tooling includes container contract, database deployment guard, health checks, backup, and rollback automation.

Useful documentation:

```text
docs/development/asihjaya-rms-production-handoff.md
docs/production-readiness/logging-monitoring.md
docs/production-readiness/reverse-proxy-cloudflare.md
```

## Environment & Secrets

Templates:

```text
.env.example
.env.production.example
```

Useful commands:

```powershell
npm run env:generate-secrets -- --write .env
npm run env:prepare:production
npm run env:validate
npm run env:validate:production
```

Never commit:

- `.env`;
- database dump;
- session secret;
- Telegram token;
- Hardware Hub credential;
- storage key;
- Backblaze application key;
- production access token.

Environment documentation:

```text
docs/development/environment-configuration.md
```

## Main Routes

### POS

| Route                     | Purpose                 |
| ------------------------- | ----------------------- |
| `/pos`                    | POS workspace           |
| `/pos/produk`             | product/catalog access  |
| `/pos/pelanggan`          | customer access         |
| `/pos/ditahan`            | held transactions       |
| `/pos/shift`              | shift operations        |
| `/pos/transaksi`          | POS transaction history |
| `/pos/buyback`            | Buyback acquisition     |
| `/pos/buyback/pemrosesan` | Cuci/Rongsok processing |
| `/pos/buyback/riwayat`    | full Buyback history    |

### Admin

| Route                                     | Purpose                                        |
| ----------------------------------------- | ---------------------------------------------- |
| `/admin`                                  | dashboard                                      |
| `/admin/produk`                           | Product Master                                 |
| `/admin/inventaris`                       | physical inventory                             |
| `/admin/penjualan`                        | sales history/admin transaction tools          |
| `/admin/pelanggan`                        | customer administration                        |
| `/admin/laporan`                          | reporting                                      |
| `/admin/migrasi-produk`                   | legacy product migration                       |
| `/admin/operasional/*`                    | shift/cash/hardware operational administration |
| `/admin/notifikasi`                       | Notification Center                            |
| `/admin/pengaturan`                       | Settings Hub                                   |
| `/admin/pengaturan/pembayaran/manual-edc` | EDC/bank transfer profiles                     |
| `/admin/pengaturan/harga-gram`            | Harga/Gram                                     |
| `/admin/pengaturan/integrasi/telegram`    | Telegram Reporting                             |

All sensitive routes/actions must perform backend authorization. Menu visibility alone is never an authorization boundary.

## Quality Gates

### Fast local gate

For normal feature work:

```powershell
npm run typecheck
npm run lint
npm run routes:check
npm run build:clean
```

Run feature-specific checker for touched domains.

### Database changes

```powershell
npm run check:database
npm run db:migrate
npm run check:database:live
```

### Full project gate

```powershell
npm run check:all
```

High-risk financial/integration gate:

```powershell
npm run check:critical
```

Financial PostgreSQL disposable tests:

```powershell
npm run test:financial:local
```

Buyback final historical-identity audit:

```powershell
npx tsx scripts/check-buyback-b4-final-audit.ts
```

Quality documentation:

```text
docs/development/quality-gates.md
docs/development/financial-concurrency-tests.md
```

## Important Engineering Invariants

### Transaction history is immutable in meaning

Current Product Item may change later. Historical transaction representation may not.

Use:

```text
Sale event     → sale_items.snapshot
Buyback event  → buyback_items snapshot/acquisition fields
Processing     → source snapshot + result snapshot
Inventory now  → product_items current state
```

### Inventory admission is explicit

A physical item may be sold only after it satisfies current sale gate. Completing a Buyback transaction alone is not inventory admission.

### Financial state stays server-side

Pricing, payment normalization, shift financials, checkout, refund, Buyback completion, and other sensitive mutations must be validated and committed on server-side transactional boundaries.

### Physical identity must survive lifecycle transitions

Existing ASIHJAYA Buyback items preserve physical item identity. Business-state transitions should not manufacture a replacement identity merely to represent a new lifecycle state.

## Documentation Index

### Current business/domain docs

- `docs/development/buyback-lifecycle.md`
- `docs/development/legacy-product-migration.md`
- `docs/development/controlled-shift-reopen.md`
- `docs/development/financial-concurrency-tests.md`

### Infrastructure & deployment

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

### Production-readiness references

- `docs/production-readiness/logging-monitoring.md`
- `docs/production-readiness/reverse-proxy-cloudflare.md`

## Before Commit

Minimum:

```powershell
npm run typecheck
npm run lint
npm run routes:check
npm run build:clean
```

Documentation sync:

```powershell
npx tsx scripts/check-documentation-current-state.ts
```

For schema changes also run database checks.

## Production Status

The codebase already contains substantial production-safety infrastructure, but project status remains:

```text
ACTIVE DEVELOPMENT / UAT / PREVIEW
```

Do not call a deployment production-ready merely because the application starts successfully.

Before final real-production cutover, repeat and document:

- full store UAT;
- real hardware validation for every production device;
- production secrets review;
- production database backup + restore drill;
- off-site backup verification;
- migration/deployment rehearsal;
- rollback rehearsal;
- monitoring/alert verification;
- final operational handoff.

## Contribution Principles

When changing source:

- preserve server-side authorization;
- do not move sensitive business rules into client-only code;
- keep migrations forward-only;
- preserve historical snapshots;
- avoid broad refactors in high-blast-radius transaction files unless required;
- add or maintain audit trails for sensitive actions;
- never log secrets or sensitive customer credentials;
- run targeted checker + quality gate before commit;
- update README/docs when the actual operational flow changes.

---

**ASIHJAYA RMS README policy:** describe what the system does **today**. Historical ideas, abandoned integrations, and superseded milestone behavior do not belong in the current project overview.
