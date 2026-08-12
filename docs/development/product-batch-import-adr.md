# Product Batch Import — Architecture Decision Record

**Status:** Accepted for implementation
**Roadmap stage:** 2B.0 — Baseline audit dan keputusan contract
**Contract version:** 1
**Decision date:** 10 Agustus 2026
**Last amended:** 12 Agustus 2026 — 2B.10C dual upload ingress

## Tujuan

Dokumen ini mengunci keputusan arsitektur Product Batch Import sebelum implementasi dimulai. Scope hanya untuk fitur batch pembuatan Product Master + Product Item baru. Workflow legacy product migration tetap merupakan domain terpisah dan tidak diubah oleh fitur ini.

Prinsip utama UX adalah operator non-developer hanya mengisi data bisnis yang dipahami sehari-hari. Identifier teknis, barcode, sequence, UUID, dan detail storage tidak diisi manual melalui workbook.

## Baseline source yang menjadi contract implementasi

Audit source pada 10 Agustus 2026 menemukan primitive berikut sudah tersedia dan harus direuse:

- `product_masters`, termasuk unique `(organization_id, code)`, status `draft|active|inactive`, category, image, dan atribut katalog;
- `product_items`, termasuk SKU, barcode, QR, outlet, harga, availability, condition, image, dan unique constraints;
- PostgreSQL sequence `product_item_number_seq` dan `getNextProductItemIdentifiers()`;
- registry `item_barcodes` dengan primary/active barcode;
- `inventory_movements`, termasuk `goods_receipt`;
- `audit_logs`;
- image storage abstraction local/S3 pada `src/lib/storage/image-storage.ts`;
- XLSX security/parser legacy sebagai referensi bounded parsing, bukan sebagai importer yang dicopy;
- duplicate-hash, staging, locking, dan preview pattern dari legacy/settlement imports;
- formula-safe XLSX export helper pada `src/lib/export-files.ts`;
- hardware job `print_label_sato` dan permission `inventory.print_label`;
- UI/POS existing sudah mendukung effective image dengan pola item image lalu fallback ke Product Master image.

Implementation tidak boleh membuat barcode engine, image storage engine, audit system, atau label engine baru bila primitive existing sudah mencukupi.

## Scope fase pertama

### Termasuk

- create-only Product Master;
- create-only Product Item;
- satu ZIP yang berisi satu `products.xlsx` dan gambar;
- preview dan seluruh validation error sebelum commit;
- server-side staging session;
- all-or-nothing commit;
- auto-generated Product Master code;
- auto-generated Product Item SKU/barcode/QR;
- primary `item_barcodes` registry;
- `goods_receipt` untuk item yang langsung `available`;
- audit log;
- duplicate upload guard;
- result/error workbook;
- label print melalui hardware workflow existing;
- cleanup staging dan compensating media cleanup.

### Tidak termasuk

- update/delete/archive Product Master atau Product Item via Excel;
- partial commit per row;
- barcode manual dari Excel;
- penggunaan ulang barcode yang pernah dialokasikan;
- arbitrary/unsupported embedded image Excel di luar contract direct single XLSX;
- image gallery multi-file per entity;
- formula/hyperlink sebagai sumber data bisnis;
- Google Sheets URL;
- asynchronous job queue skala besar;
- automatic rollback terhadap data bisnis yang sudah committed.

## ADR-01 — Product Master code

### Keputusan

Product Master tetap memiliki `code` unik karena schema existing mewajibkannya, tetapi operator tidak mengisi code tersebut di workbook.

Contract:

```text
format        : PM-000001, PM-000002, ...
source        : server only
scope unique  : organization
barcode       : bukan barcode
label         : tidak digunakan untuk label fisik
editable XLSX : tidak
```

`master_key` pada workbook hanya menjadi foreign key internal antar-sheet. Nilai tersebut tidak menjadi Product Master code dan tidak menjadi identifier permanen produk.

### Implementasi yang dipilih

Gunakan PostgreSQL sequence khusus Product Master pada additive migration tahap 2B.2, misalnya `product_master_number_seq`. Formatter memakai prefix `PM-` dengan minimum enam digit. Sequence tetap concurrency-safe dan gap setelah rollback diperbolehkan.

Karena Product Master existing/manual dapat saja sudah memakai code yang kebetulan cocok dengan pola `PM-......`, generator server harus memeriksa candidate terhadap `(organization_id, code)` dan mengambil sequence berikutnya bila candidate sudah terpakai. Unique constraint database tetap menjadi pertahanan terakhir terhadap race. Prefix ini tidak boleh diasumsikan eksklusif untuk batch import tanpa perubahan contract terpisah pada manual create.

Dilarang memakai `MAX(code) + 1`, client-side generator, timestamp, category, brand, outlet, atau nama sebagai pembentuk code.

## ADR-02 — Product Item identifier dan legacy barcode

Product Item baru dari Batch Import selalu memakai generator existing:

```text
SKU     : AJ-ITEM-00000001
Barcode : AJ00000001
QR      : AJ00000001
sequence: product_item_number_seq
```

Identifier final baru dialokasikan pada **commit**, bukan saat upload atau preview.

Setiap item baru membuat registry barcode:

```text
source    = system_generated
isPrimary = true
isActive  = true
```

Batch Import **tidak menerima barcode manual** dari workbook.

Legacy barcode tidak masuk contract Batch Import. Produk fisik lama yang sudah mempunyai label/barcode di display tetap memakai workflow Legacy Product Migration. Workflow legacy boleh mempertahankan barcode fisik lama sebagai alias primary sesuai contract existing sehingga barang tidak perlu di-relabel. Batch Import tidak mengubah atau mengambil alih behavior tersebut.

## ADR-03 — Product Master status

Kolom `status` di template bersifat opsional dengan nilai yang diizinkan:

```text
draft
active
```

Jika kosong, default adalah:

```text
active
```

`inactive` tidak boleh dipakai untuk create-only import v1.

Product Master `active` hanya valid jika seluruh field wajib, category aktif, dan primary image valid. Karena primary image wajib pada scope v1, row yang meminta `active` tetapi gagal memenuhi contract dinyatakan invalid dan tidak diturunkan otomatis menjadi `draft`.

Jika operator sengaja memilih `draft`, seluruh child item harus `draft`; child `available` terhadap master `draft` adalah validation error.

## ADR-04 — Product Item availability

Kolom `initial_availability` hanya menerima:

```text
draft
available
```

Jika kosong, default adalah `draft`.

Item `available` harus memenuhi contract bisnis existing yang diselaraskan menjadi:

- parent Product Master `active`;
- outlet awal valid, aktif, organization-scoped, dan berada dalam outlet access operator;
- `weight_gram > 0`;
- `selling_amount > 0`;
- `condition = good`;
- effective image tersedia;
- permission harga dan inventory sesuai ADR-06.

Commit item `available` membuat `inventory_movements` dengan `movement_type = goods_receipt`, konsisten dengan manual create flow.

Item `draft` boleh tidak mempunyai outlet, berat, selling price, atau physical image selama field yang diisi tetap valid.

## ADR-05 — Effective image

Primary image Product Master wajib untuk scope v1. Physical image Product Item opsional.

Effective image didefinisikan sebagai:

```text
physical item image
OR
Product Master primary image
```

Item `available` wajib mempunyai effective image. Karena master image wajib pada batch v1, item tanpa physical image boleh langsung `available` bila requirement lain terpenuhi dan UI menggunakan master image fallback.

Contract ini harus diselaraskan ke manual Product Item create/update ketika tahap implementasi menyentuh business validation. Existing UI/POS yang sudah melakukan fallback tidak perlu dibuat ulang.

## ADR-06 — Authorization dan permission

Permission baru:

```text
products.batch_import
```

Default system roles yang menerima permission ini:

- `system_admin`;
- `owner`;
- `manager`;
- `stock_admin`.

`cashier` dan `finance` tidak menerima permission tersebut secara default.

Authorization commit tetap compositional:

- akses/import batch memerlukan `products.batch_import`;
- pembuatan master memerlukan capability `products.manage`;
- batch yang membuat item memerlukan `inventory.receive` **atau** `inventory.manage`;
- bila satu saja field finansial (`cost_amount`, `selling_amount`, `price_per_gram`, `deduction_per_gram`) diisi, operator memerlukan `pricing.manage`;
- print/reprint label memerlukan `inventory.print_label`.

Validation permission dilakukan di server saat upload/validation dan diulang pada commit untuk mencegah stale authorization.

## ADR-07 — Upload architecture dan limits

Source saat ini memakai global Server Action body size limit `20mb`. Nilai global tersebut **tidak dinaikkan** untuk Product Batch Import.

ZIP diunggah melalui dedicated Node Route Handler/API endpoint khusus batch import. Endpoint ini menerapkan streaming/bounded read dan hard limits milik fitur.

Limits v1:

```text
ZIP compressed upload    : 100 MB
Workbook XLSX            : 5 MB
Product Master rows      : 250
Product Item rows        : 500
Individual image         : 5 MB
Archive entries          : 2,000
Total uncompressed ZIP   : 250 MB
```

Limits harus didefinisikan sebagai contract constants dan tidak tersebar sebagai magic numbers.

Jika volume operasi riil kemudian membutuhkan perubahan, perubahan limits adalah contract revision dan harus disertai security/performance checks.

## ADR-08 — Archive dan image policy

**Amendment pre-production 11 Agustus 2026:** sebelum 2B.6, struktur image v1 disederhanakan dari `images/masters` + `images/physical` menjadi `masters/` + `physical/` langsung di root ZIP. Layout lama tidak menjadi compatibility contract karena fitur belum production.

**Amendment pre-production 12 Agustus 2026 (2B.10C):** ingress Product Batch Import mendukung dua metode tanpa membuat downstream business pipeline kedua:

1. `zip` — outer ZIP existing: `products.xlsx` + `masters/` + optional `physical/`;
2. `xlsx_embedded` — satu XLSX langsung, dengan local Picture in Cell (`_localImage`) atau standard DrawingML picture yang dipetakan tepat pada `primary_image` / `physical_image` row.

Kedua metode dinormalisasi menjadi `ParsedProductBatchWorkbook + ProductBatchImageManifest`, lalu memakai validation, staging, preview, atomic commit, identifier, movement, result, label, audit, cleanup, dan retention yang sama. Tidak ada migration/schema baru. Direct XLSX menerima local Picture in Cell dan DrawingML picture over cells; linked image, `IMAGE()`/`_webimage`, rich-data non-local-image, chart/shape/object, macro, ActiveX/OLE, atau external relationship tetap ditolak.

Struktur root v1:

```text
products.xlsx
masters/*
physical/*
```

Aturan utama:

- tepat satu `products.xlsx` di root;
- path traversal, absolute path, symlink, executable, macro workbook, dan unsupported path ditolak;
- duplicate archive entry ditolak;
- filename image dibandingkan secara Unicode-normalized dan case-insensitive;
- dua filename yang menjadi sama setelah normalization adalah fatal duplicate;
- image hanya JPG/JPEG, PNG, atau WebP;
- content harus diverifikasi dari bytes/decoder, bukan extension atau declared MIME saja;
- image dire-encode melalui image storage abstraction existing;
- embedded media/rich-data di `products.xlsx` pada metode ZIP ditolak; embedded image hanya diterima pada direct single XLSX;
- image tidak direferensikan tetapi berada di folder image yang valid menghasilkan **warning**, bukan fatal error;
- file non-image ekstra atau file di path yang tidak diizinkan adalah fatal error.

## ADR-09 — Workbook security

Importer Batch Product tidak menjalankan formula bisnis.

Contract:

- format harus XLSX non-macro;
- template version harus supported;
- hanya worksheet contract yang diizinkan;
- hidden/extra worksheet ditolak;
- headers harus exact sesuai template version;
- worksheet/row/column/cell bounds diterapkan sebelum data digunakan;
- formula pada sheet data adalah fatal error;
- hyperlink pada sheet data adalah fatal error;
- text dinormalisasi dan dibatasi panjangnya;
- `master_key` dan `row_key` harus unik setelah normalization;
- archive, workbook, image, dan row fingerprint memakai SHA-256;
- string output result/error workbook harus memakai existing formula-injection protection.

Legacy XLSX parser boleh direuse sebagai referensi keamanan, tetapi tidak boleh menjadi business parser langsung karena policy legacy berbeda.

## ADR-10 — Staging, duplicate guard, dan idempotency

Upload valid membuat Product Batch Import session dan staging rows. Preview membaca snapshot staging; workbook tidak diparse ulang untuk setiap page refresh.

Duplicate upload guard minimum menggunakan:

```text
organization_id + file_sha256
```

Session yang active/ready/completed harus mencegah file identik membuat data bisnis ganda. Retry terhadap upload/commit harus memiliki status guard yang eksplisit.

Commit menggunakan row lock `FOR UPDATE` atau advisory transaction lock pada session dan hanya menerima transition dari `ready` ke `committing` sekali.

Second commit attempt harus ditolak/idempotent dan tidak membuat Master/Item tambahan.

## ADR-11 — Atomic database commit dan media compensation

Database write untuk satu batch bersifat all-or-nothing.

Commit sequence konseptual:

```text
lock session
→ revalidate status/authorization/hash
→ preallocate UUID entity
→ prepare/promote media + cleanup journal
→ DB transaction
   → create Product Masters
   → allocate Product Item identifiers
   → create Product Items
   → create item_barcodes
   → create goods_receipt movements jika available
   → create audit records
   → mark staging rows committed
   → mark session completed
→ cleanup staging
```

Filesystem/S3 tidak ikut rollback database. Karena itu setiap final media write harus dicatat dalam cleanup journal. Jika commit gagal, DB rollback dan final media yang sudah ditulis harus dihapus menggunakan storage abstraction existing.

Sequence gap setelah rollback diperbolehkan dan identifier yang sudah terambil tidak digunakan ulang.

## ADR-12 — Label behavior

Batch Import tidak membuat label subsystem baru. Gunakan hardware contract existing `print_label_sato`.

Label item minimal tetap memakai identity Product Item seperti barcode/SKU dan data label bisnis existing.

Behavior:

- print selected dan print all hanya membuat hardware jobs untuk item yang eligible;
- reprint menggunakan hardware workflow existing;
- permission `inventory.print_label` tetap wajib;
- draft item tanpa outlet belum eligible untuk hardware print karena destination Hardware Hub/outlet belum dapat ditentukan;
- sistem tidak boleh memilih outlet default secara implisit;
- generated Product Master code tidak dicetak sebagai barcode fisik.

## ADR-13 — User experience

Target operator adalah manager/admin non-developer.

Operator workbook tidak perlu mengisi:

- database UUID;
- Product Master code;
- Product Item SKU;
- barcode;
- QR value;
- storage key;
- sequence number.

Preview harus menampilkan semua error sebelum Commit Import. Commit disabled bila ada fatal error. Warning tidak memblokir commit.

Validation message harus menyebut sheet, row Excel, field, dan penyebab yang dapat diperbaiki operator.

## ADR-14 — Migration dan deployment safety

Database change baru dilakukan pada stage 2B.2 dan harus additive.

Rules:

- migration lama tidak boleh diedit;
- nomor migration diambil dari Drizzle journal terbaru saat stage 2B.2 dimulai;
- previous application release harus tetap dapat berjalan dengan schema baru;
- tidak ada rename/drop existing column dalam feature ini;
- source dikembangkan lokal, bukan diedit langsung pada VPS;
- deployment production menggunakan exact 40-character Git commit dan `ajsystem-deploy`;
- database tidak otomatis di-rollback ketika application rollback;
- Product Master/Product Item yang sudah committed diperlakukan sebagai data bisnis nyata dan tidak dihapus otomatis oleh rollback aplikasi.

## ADR-15 — Cleanup, retention, dan observability

Staging Product Batch Import tidak boleh menjadi storage permanen. Session yang belum committed memakai TTL 48 jam dan maintenance dijalankan secara idempotent setiap jam setelah deployment production diaktifkan.

Retention rules:

- session `completed` mempertahankan evidence database (session, staging rows, generated identifiers, audit/result history); hanya ZIP/media staging yang dibersihkan;
- session `cancelled`, `failed`, dan `expired` mempertahankan evidence database tetapi staging storage dibersihkan;
- object staging tanpa session database baru boleh dianggap orphan setelah grace period 2 jam agar maintenance tidak berlomba dengan upload yang sedang membuat storage sebelum transaction session tercatat;
- final Product Master/Product Item image dari session `completed` tidak pernah dihapus maintenance;
- final image candidate dari session terminal yang tidak committed hanya boleh dihapus setelah planned entity tidak ada dan exact image key tidak direferensikan oleh Product Master/Product Item mana pun;
- session `committing` yang melewati 30 menit hanya dilaporkan sebagai stale/anomaly dan **tidak** di-auto-clean agar maintenance tidak merusak commit aktif;
- completed evidence count mismatch hanya dilaporkan dan tidak memicu destructive cleanup.

Observability minimum:

- upload dan commit mengeluarkan structured JSON log dengan session/organization, counts, duration, outcome/error code;
- maintenance mengeluarkan structured summary untuk expired sessions, staging cleanup, orphan cleanup, stale committing, evidence anomalies, staging bytes/object count, dan disk usage (untuk local storage);
- staging warning threshold awal 512 MB, critical 1 GB; local disk warning 80% dan critical 90%;
- local maupun S3-compatible image storage harus mempunyai bounded staging scan;
- production maintenance menggunakan immutable operations image release yang sama dengan release aktif dan volume `app_uploads` yang sama ketika storage driver `local`.

Systemd timer bersifat source-managed tetapi tidak otomatis di-enable saat installer dijalankan. Aktivasi production dilakukan pada stage deployment/acceptance setelah manual dry-run dan service run lulus.

## Konsekuensi keputusan

### Positif

- operator tidak perlu memahami identifier internal;
- race condition code/barcode tidak bergantung pada input manusia;
- legacy item yang sudah berlabel tetap aman dan tidak perlu relabel;
- global upload limit aplikasi tidak diperbesar;
- batch import reuse business/storage/hardware primitives existing;
- validation batch dan manual flow dapat dibuat konsisten;
- rollback release tetap kompatibel karena schema additive.

### Trade-off

- dibutuhkan sequence baru untuk Product Master code;
- dedicated upload endpoint menambah surface area yang harus diuji security;
- media atomicity membutuhkan compensating cleanup;
- draft tanpa outlet tidak dapat langsung diprint ke Hardware Hub;
- default master `active` berarti validation master harus ketat dan tidak boleh silently downgrade.

## Stage boundary setelah ADR

Stage 2B.0 hanya menghasilkan documentation contract. Tidak ada schema, migration, action, route, package dependency, atau UI yang diubah pada stage ini.

Urutan berikutnya tetap:

```text
2B.1 Template generator dan download
2B.2 Additive database migration
2B.3 Secure ZIP/XLSX parser
2B.4 Upload session dan validation staging
2B.5 Preview dan review UI
2B.6 Atomic commit service
2B.7 Results, export, dan labels
2B.8 Cleanup, retention, dan observability
2B.9 Testing lengkap
2B.10 Local acceptance rehearsal
2B.11 VPS deployment dan production acceptance
```

## Exit criteria 2B.0

2B.0 dianggap selesai bila:

- ADR ini dan template contract direview;
- Product Master code policy dikunci;
- master status/default dikunci;
- Product Item availability dikunci;
- effective-image rule dikunci;
- permission model dikunci;
- upload architecture + limits dikunci;
- unused image policy dikunci;
- label behavior draft tanpa outlet dikunci;
- barcode legacy secara eksplisit tetap di domain Legacy Product Migration;
- documentation-only quality checks lulus.
