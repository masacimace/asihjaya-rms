# ASIHJAYA RMS — Roadmap Batch Product Import (Excel + Images + Auto Barcode)

**Dokumen handoff implementasi**  
**Versi:** 1.0  
**Tanggal:** 7 Agustus 2026  
**Project:** ASIHJAYA FINISHING / ASIHJAYA RMS + POS

---

## 1. Tujuan dokumen

Dokumen ini menjadi roadmap lengkap untuk mengimplementasikan fitur **batch product import** pada ASIHJAYA RMS. Dokumen sengaja dibuat agar dapat dikirim ke sesi ChatGPT baru tanpa harus mengulang seluruh diskusi sebelumnya.

Fitur yang disepakati:

> Satu file batch membuat beberapa **Product Master**, dan setiap Product Master dapat menghasilkan banyak **Product Item / produk fisik**.

Input batch bukan hanya Excel biasa. Paket yang direkomendasikan adalah satu file ZIP yang berisi:

- satu workbook XLSX;
- gambar Product Master;
- gambar Product Item opsional;
- metadata versi template.

Output utama fitur:

- Product Master baru;
- Product Item baru;
- SKU, barcode, dan QR value otomatis;
- inventory opening/goods receipt untuk item yang langsung tersedia;
- audit log;
- laporan hasil import;
- fasilitas pencetakan label barcode melalui workflow label project.

Implementasi dilakukan bertahap dari lokal, direview, di-merge ke `main`, lalu dipublish ke VPS menggunakan immutable deployment yang sudah tersedia.

---

## 2. Konteks project yang harus dipahami sesi baru

### Stack utama

- Next.js 16
- React 19
- TypeScript
- PostgreSQL 17
- Drizzle ORM
- Docker Compose
- Caddy + Cloudflare
- Backblaze B2 untuk off-site database backup
- Node.js 24 / npm 11

### Jalur production

```text
Project source : /opt/asihjaya-rms/app
Production env : /etc/asihjaya-rms/production.env
Domain         : https://ajsystem.id
VPS user       : ubuntu
Hostname       : ajsystem-prod
```

### Deployment production yang sudah tersedia

```text
Exact Git commit
→ build immutable app/migrator/operations images
→ PostgreSQL backup lokal
→ upload + verification Backblaze B2
→ guarded database migration
→ candidate smoke test di port 3001
→ activation
→ local + public health check
→ atomic promotion current/previous
```

Command deployment utama:

```bash
ajsystem-deploy <40-character-git-commit>
```

Rollback aplikasi:

```bash
ajsystem-rollback check
ajsystem-rollback execute <release-id>
```

Database **tidak otomatis di-rollback** ketika aplikasi di-rollback. Karena itu semua migration fitur ini harus additive dan kompatibel dengan previous release.

### Aturan source code

- Jangan mengedit source langsung di VPS.
- Semua perubahan dimulai dari lokal.
- Satu branch untuk satu scope pekerjaan.
- Migration lama tidak boleh diedit.
- Selalu buat migration baru.
- Bundle perubahan hanya berisi file baru/berubah bila dibuatkan patch/ZIP.
- Jangan membuat empty commit.

---

## 3. Baseline source yang sudah tersedia

Sesi implementasi baru harus mengaudit ulang branch `main`, tetapi source project saat roadmap ini dibuat sudah mempunyai komponen penting berikut.

### Product Master

```text
src/db/schema/index.ts                         productMasters
src/app/actions/product-masters.ts            create/update manual
src/features/products/product-master-*        contracts dan queries
src/components/products/product-master-form.tsx
```

Field inti yang sudah ada antara lain:

```text
organizationId
categoryId
code
name
brand
material
collection
description
imageKey
attributes
status
```

### Product Item / produk fisik

```text
src/db/schema/index.ts                         productItems
src/app/actions/product-items.ts              create/update manual
src/features/inventory/product-item-*         contracts, queries, identifier
src/components/inventory/product-item-form.tsx
```

Field inti yang sudah ada antara lain:

```text
productMasterId
currentOutletId
sku
barcode
qrValue
serialNumber
weightGram
purityPercent
exchangePurityPercent
size
color
gemstone
costAmount
sellingAmount
pricePerGram
deductionPerGram
availability
condition
locationState
locationCode
imageKey
attributes
internalNotes
isActive
```

### Generator identifier produk fisik

Sudah tersedia:

```text
src/features/inventory/product-item-identifiers.ts
```

Pola saat ini:

```text
SKU     : AJ-ITEM-00000001
Barcode : AJ00000001
QR      : AJ00000001
```

Generator memakai PostgreSQL sequence `product_item_number_seq`. Batch importer harus memakai generator yang sama, bukan membuat pola barcode baru.

### Barcode alias/registry

Sudah tersedia tabel `item_barcodes`. Saat item dibuat, batch importer harus membuat primary barcode dengan:

```text
source    = system_generated
isPrimary = true
isActive  = true
```

### Inventory movement

Sudah tersedia tabel `inventory_movements`. Item yang langsung berstatus `available` dan mempunyai outlet awal harus menghasilkan movement awal yang konsisten dengan flow manual, misalnya `goods_receipt`.

### Image storage

Sudah tersedia:

```text
src/lib/storage/image-storage.ts
src/lib/storage/image-validation.ts
```

Storage mendukung entity:

```text
products
items
```

Gambar diproses ke WebP dan dapat memakai storage driver lokal atau S3-compatible sesuai environment. Batch importer harus menggunakan abstraction ini, bukan menulis file secara langsung ke folder production.

### XLSX parser dan keamanan

Sudah tersedia parser XLSX legacy:

```text
src/features/legacy-migration/xlsx-parser.ts
scripts/check-legacy-product-xlsx-security.ts
```

Source tersebut dapat menjadi referensi untuk:

- signature validation;
- worksheet/row/column limits;
- formula dan hyperlink limits;
- cell normalization;
- duplicate detection;
- SHA-256 file fingerprint;
- keamanan workbook.

Jangan menyalin keseluruhan legacy migration tanpa audit. Buat domain baru khusus batch product creation.

### Import workflow lain yang dapat dijadikan referensi

```text
src/app/actions/settlement-import.ts
src/features/reconciliation/import-*.ts
src/app/(admin)/admin/keuangan/rekonsiliasi/import/*
```

Referensi yang dapat dipakai:

- upload → preview → commit;
- duplicate file guard;
- import batch history;
- error/review presentation;
- storage lifecycle.

---

## 4. Keputusan scope yang sudah disepakati

### Masuk fase pertama

- Create-only import.
- Membuat Product Master baru.
- Membuat banyak Product Item di bawah setiap master.
- Satu workbook dengan dua sheet utama.
- Upload sebagai satu ZIP yang berisi XLSX dan folder gambar.
- Satu primary image Product Master.
- Gambar Product Item opsional.
- Jika gambar item kosong, UI menggunakan gambar master sebagai fallback.
- Barcode, SKU, dan QR dibuat otomatis saat commit.
- Preview sebelum commit.
- Semua error ditampilkan sebelum commit.
- Commit bersifat all-or-nothing.
- Duplicate file guard.
- Audit log.
- Download result workbook.
- Integrasi dengan label barcode yang sudah dimiliki project.
- Permission khusus manager/admin.

### Tidak masuk fase pertama

- Update Product Master existing melalui Excel.
- Update Product Item existing melalui Excel.
- Delete/archive melalui Excel.
- Partial commit per baris.
- Barcode manual dari Excel.
- Reuse barcode yang pernah dialokasikan.
- Embedded image di cell Excel.
- Multiple gallery images per entity.
- Formula Excel sebagai sumber nilai bisnis.
- Import dari Google Sheets URL.
- Import asynchronous queue skala sangat besar.

---

## 5. Keputusan produk yang masih harus dikonfirmasi sebelum coding

Tahap pertama implementasi harus membuat ADR atau dokumen keputusan untuk poin berikut.

### 5.1 Product Master code

Pilih satu:

1. **Auto-generated oleh sistem** — rekomendasi utama agar konsisten dan bebas duplikat.
2. Diisi di Excel dan wajib unik.
3. Excel boleh mengisi; kosong berarti auto-generated.

`master_key` tetap diperlukan sebagai relasi internal antar-sheet dan tidak harus menjadi code database.

### 5.2 Status awal Product Master

Pilih default:

- `draft`; atau
- `active` jika seluruh data valid.

Rekomendasi awal: `active` hanya jika minimal category, name, dan primary image valid; selain itu batch ditolak atau master dibuat `draft` sesuai keputusan bisnis.

### 5.3 Availability Product Item

Pilih salah satu:

- semua item dibuat `draft`;
- item dengan outlet, weight, selling price, condition, dan effective image lengkap dibuat `available`;
- kolom `initial_availability` di Excel dengan validasi ketat.

Rekomendasi: sediakan kolom `initial_availability` bernilai `draft` atau `available`, tetapi default aman adalah `draft`.

### 5.4 Image rule untuk item available

Flow manual saat ini mengharuskan foto item untuk item yang langsung tersedia. Scope yang disepakati mengizinkan gambar item kosong dan menggunakan gambar master sebagai fallback.

Sesi implementasi harus menyelaraskan rule menjadi:

```text
Item available wajib mempunyai effective image:
physical image tersedia
ATAU
master primary image tersedia
```

Rule ini harus berlaku konsisten pada batch import dan manual product item creation.

### 5.5 Batas batch awal

Proposal awal yang harus diuji dengan contoh file client:

```text
ZIP upload            : maksimal 100 MB
Workbook XLSX         : maksimal 5 MB
Product Master        : maksimal 250 per batch
Product Item          : maksimal 500 per batch
Individual image      : maksimal 5 MB
Archive entries       : maksimal 2.000
Uncompressed archive  : maksimal 250 MB
```

Nilai final harus dikonfirmasi setelah melihat volume operasional nyata.

---

## 6. Format paket upload

### Struktur ZIP

```text
asihjaya-product-batch-2026-08.zip
├── products.xlsx
└── images/
    ├── masters/
    │   ├── MASTER-001.jpg
    │   └── MASTER-002.webp
    └── physical/
        ├── ITEM-001.jpg
        ├── ITEM-002.jpg
        └── ITEM-003.png
```

Aturan archive:

- hanya satu `products.xlsx` di root;
- hanya path yang diizinkan;
- tidak boleh ada `../`, absolute path, symlink, executable, macro workbook, atau file tersembunyi berbahaya;
- nama file dibandingkan secara case-normalized sesuai policy yang dipilih;
- nama file harus unik;
- file yang tidak direferensikan diberi warning atau ditolak sesuai contract;
- image harus divalidasi berdasarkan bytes/MIME, bukan extension saja.

### Sheet `METADATA`

Disarankan agar template dapat berkembang tanpa merusak importer.

| key              | value                      |
| ---------------- | -------------------------- |
| template_version | 1                          |
| import_type      | master_and_physical_create |
| generated_at     | 2026-08-07                 |

### Sheet `PRODUCT_MASTERS`

Satu baris mewakili satu Product Master.

| Column          |             Required | Keterangan                             |
| --------------- | -------------------: | -------------------------------------- |
| `master_key`    |                   Ya | Relasi internal workbook, unik di file |
| `master_code`   | Tergantung keputusan | Code bisnis atau `AUTO`                |
| `name`          |                   Ya | Nama master produk                     |
| `category_code` |                   Ya | Harus resolve ke kategori aktif        |
| `brand`         |                Tidak | Brand                                  |
| `material`      |                Tidak | Material                               |
| `collection`    |                Tidak | Koleksi                                |
| `description`   |                Tidak | Deskripsi                              |
| `primary_image` |  Ya untuk scope awal | Nama file dalam `images/masters`       |
| `status`        |             Opsional | `draft`/`active` jika diizinkan        |

Contoh:

```text
MASTER-001 | AUTO | Gelang Rantai Nori | GELANG | Vancleef | Emas | Nori | ... | MASTER-001.jpg | active
```

### Sheet `PHYSICAL_PRODUCTS`

Satu baris mewakili satu produk fisik. Banyak baris dapat memakai `master_key` yang sama.

| Column                    |                     Required | Keterangan                        |
| ------------------------- | ---------------------------: | --------------------------------- |
| `row_key`                 |                           Ya | Identifier unik di file           |
| `master_key`              |                           Ya | Harus ditemukan di sheet master   |
| `display_name`            |                        Tidak | Nama unit khusus                  |
| `outlet_code`             |                  Kondisional | Wajib jika langsung available     |
| `weight_gram`             |                  Kondisional | Wajib jika available              |
| `purity_percent`          |                        Tidak | 0–100                             |
| `exchange_purity_percent` |                        Tidak | 0–100                             |
| `size`                    |                        Tidak | Ukuran                            |
| `color`                   |                        Tidak | Warna                             |
| `gemstone`                |                        Tidak | Batu                              |
| `cost_amount`             | Tergantung permission/policy | Rupiah integer                    |
| `selling_amount`          |                  Kondisional | Wajib jika available              |
| `price_per_gram`          |                        Tidak | Rupiah integer                    |
| `deduction_per_gram`      |                        Tidak | Rupiah integer                    |
| `condition`               |                   Ya/default | `good` atau policy valid lain     |
| `location_code`           |                        Tidak | Lokasi rak/display                |
| `physical_image`          |                        Tidak | Nama file dalam `images/physical` |
| `internal_notes`          |                        Tidak | Catatan internal                  |
| `initial_availability`    |                     Opsional | `draft` atau `available`          |

Tidak ada kolom barcode yang dapat dipercaya sebagai barcode final. Template boleh menampilkan kolom informasional `barcode_mode=AUTO`, tetapi server tetap menjadi satu-satunya generator.

---

## 7. Workflow pengguna

```text
1. Manager membuka /admin/produk/import
2. Download template + petunjuk
3. Mengisi products.xlsx
4. Memasukkan gambar ke folder ZIP
5. Upload ZIP
6. Server memvalidasi archive dan workbook
7. Server membuat import session
8. UI menampilkan preview
9. Manager melihat master, item, gambar, dan semua error
10. Jika invalid, manager download error report dan memperbaiki file
11. Jika valid, manager menekan Commit Import
12. Server mengunci session
13. Server membuat master dan item dalam transaction
14. SKU/barcode/QR dialokasikan dari sequence
15. Item barcode registry dibuat
16. Inventory movement dibuat untuk item available
17. Audit dibuat
18. Gambar dipromosikan ke storage final
19. Session ditandai completed
20. Manager download result workbook dan mencetak label
```

---

## 8. Data model baru yang direkomendasikan

Nama migration harus mengikuti nomor migration terbaru pada branch `main` saat implementasi. Jangan mengasumsikan nomor tertentu tanpa memeriksa journal Drizzle.

### 8.1 `product_batch_import_sessions`

Field minimum:

```text
id
organization_id
created_by_user_id
file_name
file_sha256
template_version
status
storage_key / temporary_location
total_master_rows
total_item_rows
valid_master_rows
valid_item_rows
invalid_rows
warning_count
committed_master_count
committed_item_count
failure_code
failure_message
created_at
validated_at
committed_at
cancelled_at
expires_at
```

Status yang direkomendasikan:

```text
uploaded
validating
invalid
ready
committing
completed
failed
cancelled
expired
```

Constraint penting:

- organization-scoped duplicate hash guard untuk completed/active sessions;
- status check;
- counts nonnegative;
- only one commit transition;
- indexes organization/status/created_at.

### 8.2 `product_batch_import_master_rows`

Field minimum:

```text
id
session_id
row_number
master_key
raw_payload jsonb
normalized_payload jsonb
validation_status
validation_errors jsonb
validation_warnings jsonb
resolved_category_id
planned_product_master_id
committed_product_master_id
created_at
```

Constraint:

- unique `(session_id, master_key)`;
- unique `(session_id, row_number)`.

### 8.3 `product_batch_import_item_rows`

Field minimum:

```text
id
session_id
row_number
row_key
master_key
raw_payload jsonb
normalized_payload jsonb
validation_status
validation_errors jsonb
validation_warnings jsonb
resolved_outlet_id
planned_product_item_id
committed_product_item_id
generated_sku
generated_barcode
generated_qr_value
created_at
```

Constraint:

- unique `(session_id, row_key)`;
- unique `(session_id, row_number)`;
- FK ke session;
- optional relation ke master staging row.

### 8.4 Media staging metadata

Bisa berupa tabel tersendiri atau manifest JSON yang tervalidasi. Jika memakai tabel:

```text
product_batch_import_media
```

Field minimum:

```text
session_id
archive_path
entity_kind
row_key/master_key
sha256
content_type
byte_size
width
height
staging_key
final_key
status
```

### 8.5 Alasan memakai staging tables

- preview tidak perlu parse ulang file;
- error tersimpan dan dapat diaudit;
- commit dapat memverifikasi snapshot yang sama;
- retry aman;
- user dapat melihat history;
- file hash dan row fingerprint dapat dicek;
- parser dan database writer dipisahkan.

---

## 9. Barcode, SKU, dan concurrency

### Aturan utama

- Barcode dibuat hanya saat commit.
- Preview tidak mengalokasikan sequence final.
- Setiap Product Item mendapat satu sequence value.
- Gunakan `getNextProductItemIdentifiers()` yang sudah ada.
- Jangan menggunakan `MAX(barcode)+1`.
- Jangan menggenerate di browser.
- Unique constraints database tetap menjadi pertahanan terakhir.

### Contoh

```text
Master MASTER-001 menghasilkan 3 item:

AJ-ITEM-00000124 / AJ00000124
AJ-ITEM-00000125 / AJ00000125
AJ-ITEM-00000126 / AJ00000126
```

### Commit concurrency

Saat commit:

- lock row import session (`FOR UPDATE`) atau advisory transaction lock;
- pastikan status masih `ready`;
- pastikan belum committed;
- hash/manifests tidak berubah;
- allocate identifier di transaction;
- insert `product_items` dan `item_barcodes`;
- database unique constraints menangani race yang tersisa.

Sequence gap boleh terjadi jika transaction rollback. Nomor barcode yang sudah terambil tidak perlu digunakan ulang.

---

## 10. Gambar dan atomicity

### Keputusan media

- Embedded image di Excel ditolak.
- Master primary image wajib pada scope awal.
- Physical image opsional.
- Jika physical image kosong, tampilan memakai master image.
- Gambar asli divalidasi dan kemudian diproses melalui `image-storage.ts`.

### Masalah transaction

Database transaction tidak dapat meng-rollback filesystem atau S3 secara otomatis. Karena itu implementasi wajib mempunyai compensating cleanup.

Strategi yang direkomendasikan:

```text
Upload ZIP
→ extract image secara aman ke staging storage
→ validate + transform test
→ tentukan UUID master/item sebelum transaction
→ siapkan daftar final image writes
→ commit service menyimpan media + database secara terkontrol
→ jika salah satu gagal, rollback DB dan delete semua final image yang sudah dibuat
→ jika DB commit sukses, hapus staging archive
```

Semua final image key yang berhasil dibuat harus dicatat dalam in-memory cleanup journal atau tabel media staging sehingga dapat dihapus saat exception.

### Cleanup lifecycle

- invalid upload: hapus staging setelah retention singkat;
- cancelled: hapus staging;
- completed: hapus ZIP dan extracted staging setelah hasil diverifikasi;
- failed commit: cleanup semua final media orphan;
- scheduled maintenance: hapus session expired dan orphan staging.

---

## 11. Validation contract

### Archive validation

- ZIP signature valid;
- anti path traversal;
- anti zip bomb;
- batas jumlah entries;
- batas compressed dan uncompressed size;
- tidak ada symlink;
- whitelist path;
- hanya XLSX dan image formats yang diizinkan;
- duplicate filename detection;
- SHA-256 archive dan file.

### Workbook validation

- workbook XLSX valid, bukan XLS/macro;
- template version didukung;
- sheet wajib ada;
- header wajib tepat;
- row/column/cell limits;
- formula tidak dipakai sebagai nilai bisnis;
- hyperlink tidak diambil sebagai image source;
- no hidden surprise worksheet policy;
- normalized Unicode/text;
- semua row key unik.

### Product Master validation

- `master_key` unik;
- name tidak kosong dan sesuai batas;
- category code resolve ke kategori aktif dalam organization;
- code policy valid;
- code tidak duplikat dalam file/database;
- image file ditemukan dan valid;
- status valid;
- attributes aman dan bounded.

### Product Item validation

- `row_key` unik;
- `master_key` ditemukan;
- outlet code resolve ke outlet aktif dan dapat diakses organization;
- angka valid dan bounds sesuai contract manual;
- weight > 0 bila diisi;
- selling amount > 0 bila diisi;
- cost dan deductions nonnegative;
- percentage > 0 dan <= 100;
- condition valid;
- availability valid;
- item available memenuhi outlet, price, weight, condition, effective image;
- image reference ditemukan jika diisi;
- duplicate rows/fingerprints dideteksi.

### Permission validation

Minimum permission yang perlu diputuskan:

```text
products.manage
inventory.receive / inventory.manage
pricing.manage jika mengimport harga
```

Sebaiknya dibuat permission khusus seperti:

```text
products.batch_import
```

Manager/admin mendapat permission; staff POS tidak mendapatkannya.

---

## 12. UI/UX yang direkomendasikan

### Route

```text
/admin/produk/import
/admin/produk/import/[sessionId]
```

### Halaman upload

- Download template.
- Panduan struktur ZIP.
- Dropzone ZIP.
- Batas file dan jumlah row.
- Checklist sebelum upload.
- Recent imports.

### Halaman preview

Header summary:

```text
Masters total
Physical items total
Valid rows
Invalid rows
Warnings
New categories referenced
Images found/missing
Estimated available/draft items
```

Tab/section:

- Product Masters
- Physical Products
- Images
- Errors
- Warnings

Fitur preview:

- filter valid/error;
- search master key/row key;
- expand master untuk melihat child items;
- thumbnail master dan physical image;
- effective image indicator;
- row number Excel;
- field-level error;
- download error workbook;
- cancel session;
- commit confirmation.

### Commit confirmation

Modal harus menjelaskan:

- jumlah master yang akan dibuat;
- jumlah item fisik;
- jumlah item available/draft;
- jumlah barcode yang akan dialokasikan;
- perubahan tidak dapat dibatalkan melalui import;
- rollback aplikasi tidak menghapus data yang sudah diimport.

Untuk batch besar, user harus mengetik confirmation phrase atau melakukan explicit checkbox.

### Result page

- status completed;
- generated identifiers;
- counts;
- warning summary;
- link ke Product Master;
- download result XLSX;
- print labels;
- audit/operator/timestamp;
- file hash.

### Mobile behavior

Manager memakai laptop sebagai device utama, tetapi halaman tetap harus responsive:

- card/grid `min-w-0`;
- tabel scroll hanya di container;
- no page horizontal overflow;
- sticky action bar jika perlu;
- preview images tidak memaksa width;
- commit button tetap jelas.

---

## 13. Result workbook

Result XLSX disarankan mempunyai sheet:

### `IMPORT_SUMMARY`

```text
session_id
file_sha256
operator
committed_at
master_count
item_count
available_count
draft_count
```

### `CREATED_MASTERS`

```text
master_key
product_master_id
product_master_code
name
status
image_status
```

### `CREATED_ITEMS`

```text
row_key
master_key
product_item_id
sku
barcode
qr_value
outlet_code
availability
image_source (physical/master-fallback)
status
```

### `WARNINGS`

Informasi nonfatal, misalnya physical image kosong dan memakai master image.

Result file harus aman dari formula injection. Cell text yang diawali karakter formula harus di-escape.

---

## 14. Label barcode

Project sudah mempunyai hardware job contract `print_label_sato`. Implementasi harus mengaudit flow label existing dan memilih salah satu:

1. Tombol **Print all labels** membuat hardware jobs secara batch.
2. Download label payload/file untuk diproses Hardware Hub.
3. PDF label sebagai fallback tambahan bila benar-benar dibutuhkan client.

Jangan membuat sistem label baru jika hardware workflow existing sudah cukup.

Label minimal:

```text
barcode
SKU
nama produk
berat
kadar
harga
```

Harus ada pilihan:

- print semua;
- print selected;
- reprint;
- status job.

---

## 15. Roadmap implementasi bertahap

## 2B.0 — Baseline audit dan keputusan contract

### Pekerjaan

- Pull `main` terbaru.
- Audit schema, migration journal, permissions, product actions, image storage, barcode generator, inventory movement, hardware labels.
- Audit semua hotfix terbaru sudah masuk `main`.
- Minta contoh workbook nyata client.
- Kunci keputusan di bagian 5.
- Buat ADR batch import.

### Deliverables

```text
docs/development/product-batch-import-adr.md
docs/development/product-batch-import-template-contract.md
```

### Exit criteria

- kolom template disepakati;
- master code policy disepakati;
- availability policy disepakati;
- limits disepakati;
- permission disepakati;
- label output disepakati.

---

## 2B.1 — Template generator dan download

### Pekerjaan

- Buat generator template XLSX versi 1.
- Tambah sheet metadata, masters, physical products, dan instructions.
- Tambahkan data validation/dropdown bila aman.
- Tambahkan sample rows tanpa formula bisnis.
- Buat route/action download template.
- Tambahkan checks untuk template contract.

### Candidate files

```text
src/features/product-batch-import/contracts.ts
src/features/product-batch-import/template.ts
src/app/actions/product-batch-import.ts
src/app/(admin)/admin/produk/import/page.tsx
scripts/check-product-batch-import-template.ts
```

### Exit criteria

- file terbuka di Microsoft Excel;
- header/version stabil;
- sample dapat dihapus tanpa merusak template;
- checker lulus.

---

## 2B.2 — Additive database migration

### Pekerjaan

- Tambah enums/import tables.
- Tambah constraints dan indexes.
- Tambah permission seed jika diperlukan.
- Jangan ubah migration lama.
- Pastikan previous app tetap berjalan dengan tabel baru.

### Exit criteria

- `npm run db:generate` menghasilkan migration baru;
- migration review bersih;
- fresh local DB berhasil;
- migration existing DB berhasil;
- database deployment check lulus;
- schema change additive.

---

## 2B.3 — Secure ZIP/XLSX parser

### Pekerjaan

- Validasi upload ZIP.
- Safe archive inspection/extraction.
- Parse workbook secara bounded.
- Normalize cells.
- Hitung hashes dan row fingerprints.
- Validate image manifests.
- Tolak embedded images/macros/formula source.
- Unit/static security checks.

### Candidate files

```text
src/features/product-batch-import/archive-parser.ts
src/features/product-batch-import/xlsx-parser.ts
src/features/product-batch-import/image-manifest.ts
src/lib/storage/product-batch-import-storage.ts
scripts/check-product-batch-import-security.ts
```

### Exit criteria

Test fixtures berikut harus ditolak:

- corrupt ZIP/XLSX;
- zip slip;
- duplicate entry;
- oversized workbook;
- too many rows;
- formula injection;
- unsupported template;
- missing image;
- invalid image MIME;
- archive bomb simulation.

---

## 2B.4 — Upload session dan validation staging

### Pekerjaan

- Server action upload.
- Permission/organization check.
- Duplicate hash guard.
- Create session and staging rows.
- Resolve category/outlet.
- Validate master/item relationships.
- Persist all errors/warnings.
- Session status transitions.
- Cancel/expire cleanup.

### Exit criteria

- invalid batch tidak menyentuh product tables;
- semua errors tersimpan;
- same file duplicate terdeteksi;
- session organization isolation terbukti;
- upload retry aman.

---

## 2B.5 — Preview dan review UI

### Pekerjaan

- Upload page.
- Session preview page.
- Summary cards.
- Master-item expandable view.
- Thumbnail images.
- Filters/error list.
- Error workbook download.
- Commit/cancel actions.
- Responsive layout.

### Exit criteria

- manager dapat menemukan semua invalid rows;
- tidak ada horizontal page overflow;
- commit disabled bila invalid;
- image fallback terlihat jelas;
- browser refresh tidak kehilangan session.

---

## 2B.6 — Atomic commit service

### Pekerjaan

- Lock session.
- Revalidate status/hash.
- Preallocate UUIDs.
- Store/promote images with cleanup journal.
- Insert Product Master.
- Allocate SKU/barcode/QR using existing sequence.
- Insert Product Item.
- Insert `item_barcodes`.
- Insert inventory movement bila available.
- Insert audit logs.
- Mark staging rows committed.
- Mark session completed.
- Compensating cleanup on failure.

### Candidate file

```text
src/features/product-batch-import/commit-service.ts
```

### Exit criteria

- all-or-nothing database behavior;
- no duplicate barcode under concurrent commit;
- no orphan image after simulated failure;
- second commit attempt rejected;
- result counts exact;
- item searchable/scannable in POS.

---

## 2B.7 — Results, export, dan labels

### Pekerjaan

- Result workbook.
- Formula injection protection.
- Print selected/all labels.
- Hardware job integration.
- Audit/history page.
- Reprint support.

### Exit criteria

- generated barcode cocok DB;
- barcode dapat discan oleh camera scanner POS;
- result workbook dapat dibuka;
- label job memakai item identity yang benar;
- history dapat diakses ulang.

---

## 2B.8 — Cleanup, retention, dan observability

### Pekerjaan

- Cleanup expired staging.
- Cleanup cancelled/failed upload.
- Orphan media detection.
- Log session id, counts, duration, errors.
- Monitor disk use.
- Optional systemd maintenance job bila diperlukan.

### Exit criteria

- staging tidak tumbuh tanpa batas;
- completed evidence tetap tersedia;
- cleanup tidak menghapus product images final;
- failures mudah didiagnosis.

---

## 2B.9 — Testing lengkap

### Static/contract checks baru

Disarankan menambahkan scripts:

```text
check:product-batch-template
check:product-batch-security
check:product-batch-parser
check:product-batch-validation
check:product-batch-commit
check:product-batch-ui
check:product-batch-import
```

Aggregator:

```json
"check:product-batch-import": "npm run check:product-batch-template && npm run check:product-batch-security && npm run check:product-batch-parser && npm run check:product-batch-validation && npm run check:product-batch-commit && npm run check:product-batch-ui"
```

### Integration cases

- 1 master + 1 item;
- 1 master + many items;
- multiple masters;
- item physical image;
- item master fallback image;
- draft items;
- available items;
- invalid category;
- invalid outlet;
- duplicate master key;
- duplicate row key;
- duplicate master code;
- missing image;
- invalid money/weight;
- commit concurrency;
- failure during image store;
- failure after some sequence allocations;
- duplicate upload;
- cross-organization access;
- POS barcode scan after commit.

### Regression

- manual master create tetap bekerja;
- manual item create tetap bekerja;
- product listing/detail tetap bekerja;
- inventory movement tetap benar;
- POS scanner tetap benar;
- hardware labels tetap benar;
- legacy migration tidak rusak;
- settlement import tidak rusak.

---

## 2B.10 — Local acceptance rehearsal

Gunakan database lokal fresh dan database lokal existing.

### Commands baseline

```powershell
npm install
npm run typecheck
npm run lint
npm run routes:check
npm run build
npm run check:database-deployment
npm run check:xlsx-security
npm run check:inventory-label
npm run check:product-batch-import
```

Jalankan checks bisnis yang terpengaruh:

```powershell
npm run check:legacy-product-migration
npm run check:pos-stage-1c
```

Sebelum merge final, jalankan sesuai kemampuan environment:

```powershell
npm run check:stabilization
npm run build:clean
```

Catatan: script project bernama `routes:check`, bukan `check:routes`.

### Manual local test

- upload valid ZIP;
- preview;
- commit;
- inspect DB;
- buka product master;
- buka product item;
- scan barcode di POS;
- print label;
- upload duplicate;
- upload invalid ZIP;
- cancel session;
- simulate failure;
- verify no orphan media.

---

## 2B.11 — Deployment VPS dan production acceptance

### Local Git workflow

```powershell
cd C:\Users\Misifiksi\Desktop\asihjaya-rms

git switch main
git pull --ff-only origin main
git switch -c feature/product-batch-import
```

Kerjakan per sub-stage dengan commit terarah. Contoh:

```powershell
git add -- <file-baru-dan-berubah>
git commit -m "feat(products): add batch import staging contract"
git push -u origin HEAD
```

Setelah seluruh feature branch lulus:

```powershell
git switch main
git pull --ff-only origin main
git merge --no-ff feature/product-batch-import
git push origin main
git rev-parse HEAD
```

Catat exact 40-character commit.

### VPS checkout exact commit

```bash
cd /opt/asihjaya-rms/app

RELEASE_COMMIT='MASUKKAN_HASH_MAIN_40_KARAKTER'

git fetch --prune origin
git cat-file -e "${RELEASE_COMMIT}^{commit}"
git checkout --detach "$RELEASE_COMMIT"

test "$(git rev-parse HEAD)" = "$RELEASE_COMMIT"
test -z "$(git status --porcelain --untracked-files=all)"

ajsystem-deployment-preflight check
```

### Immutable deployment

```bash
set -o pipefail

DEPLOY_LOG="$HOME/ajsystem-product-batch-import-$(date -u +%Y%m%dT%H%M%SZ).log"

ajsystem-deploy "$RELEASE_COMMIT" \
  |& tee "$DEPLOY_LOG"

DEPLOY_EXIT=${PIPESTATUS[0]}

printf 'DEPLOY_LOG=%s\n' "$DEPLOY_LOG"
printf 'DEPLOY_EXIT=%s\n' "$DEPLOY_EXIT"
```

Expected:

```text
backup local verified
backup B2 verified
new migration applied
candidate health passed
production health passed
DEPLOY_EXIT=0
```

### Post-deploy technical verification

```bash
ajsystem-deployment-preflight status
ajsystem-monitor

curl -fsS https://ajsystem.id/api/health
printf '\n'

curl -fsS https://ajsystem.id/api/health/database
printf '\n'
```

### Production acceptance

Gunakan batch kecil yang disiapkan khusus:

```text
2 Product Masters
3–5 Product Items per master
master images lengkap
sebagian physical image kosong untuk fallback
minimal 1 draft item
minimal 1 available item
```

Verifikasi:

- import session completed;
- Product Masters muncul;
- Product Items muncul;
- image benar;
- fallback benar;
- barcode unik;
- scanner smartphone menemukan item;
- available item dapat masuk cart;
- inventory movement ada;
- result workbook benar;
- label dapat dicetak;
- audit log benar;
- duplicate file ditolak.

---

## 16. Rollback plan

### Prinsip

Migration fitur harus hanya menambah tabel/enums/index/permission. Previous app harus tetap dapat berjalan meskipun tabel import baru tetap ada.

Jika release baru gagal sebelum activation, deployment automation mempertahankan app lama.

Jika release baru aktif tetapi fitur bermasalah:

```bash
ajsystem-rollback check
ajsystem-rollback execute <previous-release-id>
```

### Hal penting

- Rollback aplikasi tidak menghapus batch yang sudah committed.
- Product Master/Product Item yang sudah dibuat adalah data bisnis nyata.
- Jangan membuat automatic destructive rollback untuk data import.
- Sediakan admin procedure untuk membatalkan batch hanya sebagai fitur terpisah dan sangat terkontrol; bukan scope fase pertama.
- Session upload yang belum committed aman untuk di-cancel/expire.

### Schema compatibility

Previous release harus mengabaikan tabel import baru. Jangan mengubah kolom existing menjadi required tanpa default. Jangan menghapus atau rename kolom existing dalam release ini.

---

## 17. Definition of Done

Fitur dianggap selesai jika seluruh kondisi berikut terpenuhi:

### Contract

- template versioned;
- sample client berhasil dipetakan;
- create-only jelas;
- image/barcode policies terdokumentasi.

### Security

- ZIP/XLSX bounded;
- zip slip dan zip bomb guard;
- file MIME validation;
- formula injection guard;
- permission + organization isolation;
- duplicate file guard.

### Data integrity

- all-or-nothing commit;
- barcode/SKU unique;
- item barcode registry lengkap;
- inventory movement benar;
- audit lengkap;
- no orphan media;
- commit idempotent.

### UX

- upload, preview, error, commit, result, history;
- thumbnails dan image fallback;
- responsive;
- error workbook;
- result workbook;
- labels.

### Quality

- feature checks lulus;
- typecheck/lint/routes/build lulus;
- database migration checks lulus;
- POS regression lulus;
- production acceptance lulus;
- monitor sehat.

### Operations

- immutable deployment sukses;
- backup lokal+B2 sebelum migration sukses;
- current/previous release tersedia;
- rollback check aman;
- cleanup staging tersedia;
- documentation updated.

---

## 18. Risiko utama dan mitigasi

| Risiko                              | Dampak                    | Mitigasi                                                |
| ----------------------------------- | ------------------------- | ------------------------------------------------------- |
| ZIP berbahaya / bomb                | resource exhaustion       | strict limits, streaming inspection, bounded extraction |
| Gambar orphan                       | storage bocor             | cleanup journal + scheduled orphan cleanup              |
| Duplicate commit                    | produk ganda              | session lock, status guard, idempotency                 |
| Barcode race                        | scan salah/duplikat       | PostgreSQL sequence + unique constraints                |
| File yang sama diupload ulang       | data ganda                | archive hash + business uniqueness                      |
| Item available tanpa data lengkap   | inventory invalid         | effective image/outlet/weight/price rules               |
| Partial insert                      | master/item tidak lengkap | single DB transaction                                   |
| DB rollback tidak membersihkan file | orphan media              | compensating delete                                     |
| Previous app tidak kompatibel       | rollback gagal            | additive migration only                                 |
| Batch terlalu besar                 | timeout/memory            | configurable limits, initial bounded MVP                |
| Harga diimport oleh user tanpa hak  | financial exposure        | `pricing.manage` validation                             |
| Wrong category/outlet mapping       | inventory salah           | code-based exact resolve + preview                      |

---

## 19. Struktur commit yang disarankan

Jangan menunggu seluruh fitur selesai untuk satu commit besar. Contoh urutan:

```text
docs(products): define batch import contract
feat(products): add batch import database staging
feat(products): generate product batch workbook template
feat(products): parse secure product batch archives
feat(products): validate product batch sessions
feat(products): add batch import preview workflow
feat(products): commit product batches atomically
feat(products): export batch results and label jobs
feat(ops): clean expired product batch staging
```

Setiap commit harus lulus check yang relevan sebelum lanjut.

---

## 20. Prompt pembuka untuk sesi ChatGPT baru

Salin prompt berikut dan lampirkan dokumen ini:

```text
Saya ingin melanjutkan project ASIHJAYA RMS + POS dengan mengimplementasikan fitur Product Batch Import berdasarkan roadmap Markdown yang saya lampirkan.

Tolong baca seluruh roadmap terlebih dahulu dan jadikan itu sebagai source of truth. Jangan langsung membuat semua fitur sekaligus.

Mulai dari tahap 2B.0 — Baseline audit dan keputusan contract. Audit source project terbaru yang saya upload, cocokkan dengan roadmap, lalu jelaskan:
1. kondisi source saat ini;
2. file dan schema existing yang dapat direuse;
3. gap antara roadmap dan source terbaru;
4. keputusan yang masih perlu saya konfirmasi;
5. rencana perubahan file untuk sub-stage pertama.

Aturan kerja:
- Implementasi bertahap dari lokal ke VPS.
- Jangan edit source langsung di VPS.
- Migration lama tidak boleh diedit.
- Setiap bundle hanya berisi file baru/berubah.
- Setiap tahap harus disertai quality checks.
- Sebelum deployment gunakan exact Git commit dan ajsystem-deploy.
- Jangan membuat asumsi barcode/image/business rule tanpa menunjukkan contract-nya.
```

---
