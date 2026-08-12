# Product Batch Import — Local Acceptance Rehearsal 2B.10 + 2B.10C

Status: final local acceptance gate sebelum 2B.11 Deployment VPS dan production acceptance.

Dokumen ini hanya berlaku untuk Product Batch Import. Jalankan seluruh rehearsal di workstation lokal. Jangan menjalankan reset/failure rehearsal terhadap VPS atau database production.

## Prinsip

2B.10 membuktikan feature bekerja pada dua kondisi database:

1. **existing local DB** — database development yang telah melewati migration bertahap dan berisi data smoke-test sebelumnya;
2. **fresh local DB** — database + local image storage di-reset, seluruh migration dijalankan dari nol, lalu seed diterapkan.

Urutan yang direkomendasikan adalah **existing terlebih dahulu, fresh terakhir**, karena fresh rehearsal bersifat destruktif terhadap data development lokal.

`npm install` tetap dijalankan manual sebelum technical runner. Script route project yang benar adalah `routes:check`, bukan `check:routes`.

---

## Phase A — Existing local DB

### A1. Persiapan

Pastikan Docker Desktop/PostgreSQL lokal yang digunakan project aktif dan `.env` menunjuk ke database localhost.

```powershell
cd C:\Users\Misifiksi\Desktop\asihjaya-rms

node --version
npm --version
npm install

git status --short
git diff --check
```

Expected toolchain project:

```text
Node 24.x
npm 11.x
```

### A2. Technical acceptance existing DB

```powershell
npm run test:product-batch-acceptance:existing
```

Runner menjalankan baseline roadmap dan proof tambahan yang sudah kita bangun:

```text
typecheck
lint
routes:check
build
check:database-deployment
check:xlsx-security
check:inventory-label
check:product-batch-import
check:legacy-product-migration
check:pos-stage-1c
check:database:live
test:product-batch:local
check:product-batch-regression
```

Tidak ada reset database pada phase ini.

### A3. Manual acceptance

Lanjutkan checklist manual di bawah menggunakan existing DB.

---

## Manual acceptance — valid batch

Gunakan batch acceptance kecil yang unik, misalnya:

```text
2 Product Masters
3–5 Product Items per master
master image lengkap
minimal 1 physical image
minimal 1 master-image fallback
minimal 1 draft item
minimal 1 available item
```

Gunakan `category_code` dan `outlet_code` nyata pada database yang sedang diuji.

Checklist:

```text
[ ] /admin/produk/import dapat dibuka oleh manager/admin yang sesuai
[ ] Download template v1 berhasil
[ ] Upload ZIP canonical: products.xlsx + masters/ + physical/
[ ] Session menjadi ready
[ ] Summary count tepat
[ ] Refresh browser tidak kehilangan session
[ ] Master → child item expandable bekerja
[ ] Physical image thumbnail benar
[ ] Master fallback thumbnail + indicator benar
[ ] Commit confirmation menunjukkan master/item/available/draft count tepat
[ ] Commit berhasil sekali saja
[ ] Session menjadi completed
[ ] Product Master code PM-* tersedia
[ ] SKU/barcode/QR Product Item tersedia
[ ] Result XLSX dapat dibuka
[ ] IMPORT_SUMMARY / CREATED_MASTERS / CREATED_ITEMS / WARNINGS tersedia
[ ] Link Product Master dapat dibuka
[ ] Link Product Item dapat dibuka
[ ] Item available dapat dicari/discan di POS
[ ] Item available dapat masuk cart
[ ] Print selected membuat print_label_sato
[ ] Print all eligible membuat job untuk item eligible
[ ] Hardware Agent/fake adapter claim job
[ ] Reprint membuat job baru
[ ] History completed session dapat dibuka ulang
```

Copy `sessionId` completed lalu jalankan live evidence:

```powershell
npm run check:product-batch-commit:live -- --session-id=UUID_SESSION_COMPLETED

npm run check:product-batch-results:live -- `
  --session-id=UUID_SESSION_COMPLETED `
  --require-label-jobs
```

Expected identifier staging sama dengan Product Item database dan label job session-scoped memakai `print_label_sato`.

Lakukan maintenance dry-run setelah completed session:

```powershell
npm run check:product-batch-maintenance:live
npm run product-batch:maintenance -- --dry-run
```

Completed business data/final images tidak boleh menjadi cleanup candidate.

---

## Duplicate, invalid, dan cancel

### Duplicate upload

Upload ZIP completed/active yang sama persis.

```text
[ ] DUPLICATE_FILE terdeteksi
[ ] Existing session dapat dibuka dari UI
[ ] Tidak ada Product Master/Product Item duplicate
```

### Invalid upload

Buat ZIP baru dengan satu kesalahan nyata, misalnya `category_code` yang tidak ada.

```text
[ ] Session invalid tersimpan
[ ] Error row + field + code terlihat di preview
[ ] Commit disabled
[ ] Error workbook dapat didownload
[ ] Product tables tidak bertambah dari invalid session
```

### Cancel

Buat ZIP valid lain dengan isi/hash unik, upload sampai `ready`, lalu cancel dari UI.

```text
[ ] status menjadi cancelled
[ ] staging storage dibersihkan
[ ] Product tables tidak disentuh
[ ] file yang sama dapat di-upload ulang setelah cancelled
```

---

## Failure dan orphan-media rehearsal

Gunakan **session test unik** yang statusnya `ready`. Jangan gunakan batch yang ingin dipertahankan.

```powershell
npm run test:product-batch-commit-failure:local -- `
  --session-id=UUID_SESSION_FAILURE_TEST `
  --confirm=FAIL_PRODUCT_BATCH_COMMIT_TEST
```

Expected:

```text
[ ] failure dipicu setelah identifier allocation
[ ] session menjadi failed
[ ] tidak ada partial Product Master
[ ] tidak ada partial Product Item
[ ] tidak ada partial item_barcodes
[ ] sequence gap diperbolehkan
[ ] final media yang sempat dipromosikan dibersihkan
[ ] staging/evidence failure tetap dapat didiagnosis
```

Kemudian:

```powershell
npm run check:product-batch-maintenance:live
npm run product-batch:maintenance -- --dry-run
```

Jika ingin menguji terminal cleanup pada session test tersebut:

```powershell
npm run test:product-batch-maintenance:local -- `
  --session-id=UUID_SESSION_FAILURE_TEST `
  --confirm=PRODUCT_BATCH_MAINTENANCE_LOCAL_TEST
```

Setelah rehearsal, cek kembali minimal satu session `completed`: Product Master, Product Item, final image, result XLSX, barcode, dan history harus tetap utuh.

---

## Manual regression flow existing

Product Batch Import tidak boleh merusak workflow lama. Lakukan smoke test singkat:

```text
[ ] Manual Product Master create tetap berhasil
[ ] Manual Product Master update tetap berhasil
[ ] Manual Product Item create tetap berhasil
[ ] Manual Product Item update tetap berhasil
[ ] Item available tanpa physical image valid bila Product Master mempunyai primary image
[ ] Item available tanpa effective image tetap ditolak
[ ] Product listing/detail normal
[ ] Inventory movement normal
[ ] Legacy Product Migration masih dapat mempertahankan barcode legacy
[ ] POS scanner existing tetap normal
[ ] Hardware Test Label Printer tetap dapat di-claim
[ ] Manual inventory label tetap dapat di-claim
[ ] Settlement import regression checker tetap lulus
```

Barcode legacy tidak boleh dimasukkan melalui Product Batch Import.

---


## Amendment 2B.10C — Dual upload acceptance

2B.10C menambah ingress kedua tanpa mengubah schema atau downstream commit contract:

```text
Metode A: .zip → products.xlsx + masters/ + physical/
Metode B: .xlsx → local Picture in Cell atau DrawingML picture over cells pada image cell
                    ↓
             validation / preview / commit yang sama
```

Fresh DB rehearsal 2B.10 yang sudah lulus **tidak perlu di-reset ulang hanya karena amendment ini**. Jalankan automated disposable integration suite dan smoke test browser kedua metode pada local DB aktif.

Checklist single XLSX:

```text
[ ] template resmi v1 tetap dapat digunakan
[ ] primary_image text dikosongkan lalu satu Picture in Cell ditempatkan pada cell image row master (recommended)
[ ] minimal satu physical_image embedded terbaca sebagai physical
[ ] minimal satu physical_image kosong memakai master fallback
[ ] upload .xlsx langsung tanpa ZIP menjadi ready
[ ] preview thumbnail master/physical/fallback benar
[ ] commit completed dan generated identifier/barcode tetap normal
[ ] barcode item available ditemukan POS
[ ] result XLSX dan label flow tidak berubah
[ ] nama file text + embedded picture ditolak
[ ] picture pada kolom/row yang salah ditolak
[ ] ZIP canonical existing tetap bekerja tanpa regression
```

Local `Picture in Cell` sekarang didukung dan direkomendasikan; standard picture over cells tetap kompatibel. Tetap jangan memakai formula `IMAGE()`/web image, linked image, chart, shape, rich-data non-local-image, macro, ActiveX/OLE, atau external relationship. Smoke test wajib mencakup file hasil Google Sheets `Insert image in cell` dan, bila tersedia, Microsoft Excel `Place in Cell`, selain regression metode ZIP.

Automated delta gate:

```powershell
npm run check:product-batch-parser
npm run check:product-batch-security
npm run check:product-batch-import
npm run test:product-batch:local
npm run check:product-batch-regression
npm run typecheck
npm run lint
npm run routes:check
npm run build:clean
```

---

## Phase B — Fresh local DB

**PERINGATAN: command berikut menghapus database development lokal beserta local image storage di bawah `.data`.**

Selesaikan Phase A terlebih dahulu dan amankan data development yang ingin dipertahankan.

Fresh rehearsal hanya bisa dijalankan dengan confirmation eksplisit:

```powershell
npm run test:product-batch-acceptance:fresh -- --confirm=RESET_LOCAL_DATABASE
```

Runner melakukan:

```text
db:fresh:local
  → Docker local DB volume reset
  → local image storage purge
  → migration 0000..latest
  → seed
  → check:database:live

kemudian technical acceptance profile=fresh
```

Setelah runner lulus, **ulang minimal Manual acceptance — valid batch** pada fresh DB.

Untuk fresh DB, pastikan workbook memakai category/outlet code dari seed lokal yang aktif. Jangan memakai code lama yang tidak ada setelah reset.

Checklist fresh DB:

```text
[ ] seluruh migration fresh berhasil
[ ] seed berhasil
[ ] products.batch_import permission tersedia
[ ] upload valid batch ready
[ ] preview refresh persistent
[ ] commit completed
[ ] generated Product Master code unik
[ ] generated SKU/barcode/QR unik
[ ] available item punya goods_receipt
[ ] POS scan menemukan item
[ ] result XLSX benar
[ ] label job memakai Hardware Hub/Agent yang benar bila Agent local acceptance tersedia
[ ] maintenance dry-run tidak menyentuh completed final media
```

Jika Hardware Agent lokal belum diregistrasikan kembali setelah fresh reset, label physical/manual acceptance boleh dipersiapkan ulang menggunakan workflow Hardware Agent local project; jangan menurunkan assertion label hanya agar test terlihat hijau.

---

## Pre-merge final gate

Setelah **existing DB + fresh DB** diterima dan manual checklist selesai, jalankan gate roadmap yang paling luas sesuai kemampuan workstation:

```powershell
npm run test:product-batch-acceptance:premerge
```

Command tersebut setara dengan:

```powershell
npm run check:stabilization
npm run build:clean
```

Kemudian:

```powershell
git diff --check
git status --short
```

Working tree harus hanya berisi perubahan 2B.10 yang memang belum di-commit.

---

## Acceptance evidence yang perlu dicatat

Sebelum menutup 2B.10, catat minimum:

```text
Date/time:
Git branch:
Git HEAD:
Node/npm:

Existing DB technical gate: PASS/FAIL
Existing DB manual acceptance: PASS/FAIL
Completed session ID:
Sample generated barcode:
Label job ID/status:

Fresh DB reset/migration: PASS/FAIL
Fresh DB technical gate: PASS/FAIL
Fresh DB manual acceptance: PASS/FAIL
Fresh completed session ID:

Failure rehearsal: PASS/FAIL
Orphan media verification: PASS/FAIL
check:stabilization: PASS/FAIL
build:clean: PASS/FAIL
```

Tidak perlu menyimpan password, token Hardware Agent, secret, atau environment file dalam evidence.

---

## Exit criteria 2B.10

2B.10 dianggap selesai hanya bila:

```text
[ ] npm install selesai pada toolchain project
[ ] existing local DB technical acceptance lulus
[ ] existing local DB manual acceptance lulus
[ ] fresh local DB reset/migrate/seed/live check lulus
[ ] fresh local DB technical acceptance lulus
[ ] fresh local DB manual acceptance lulus
[ ] upload → preview → commit → result end-to-end terbukti
[ ] Product Master/Product Item database evidence benar
[ ] POS scan barcode hasil import terbukti
[ ] print selected/all + reprint terbukti
[ ] duplicate file guard terbukti
[ ] invalid batch tidak menyentuh product tables
[ ] cancel/retry terbukti
[ ] simulated failure tidak meninggalkan partial business data/orphan final media
[ ] manual Product Master/Product Item flow tidak regression
[ ] legacy barcode migration tidak regression
[ ] check:stabilization lulus sesuai kemampuan environment
[ ] build:clean lulus
[ ] tidak ada migration/schema baru hanya untuk acceptance
[ ] source belum dideploy/edit langsung di VPS
```

Setelah semua kondisi tersebut terpenuhi, feature branch siap menuju **2B.11 — Deployment VPS dan Production Acceptance** menggunakan exact Git commit dan `ajsystem-deploy`.
