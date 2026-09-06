# Migrasi Produk Legacy — Direct Import Current-State

Dokumen ini adalah referensi teknis untuk workflow **Migrasi Produk Legacy yang aktif saat ini**.

Flow lama berbasis stock opname, verification session, manager review, hold, reconciliation, dan cutover sudah dipensiunkan dari UI/operasional aktif.

## 1. Tujuan

Fitur ini digunakan untuk memindahkan export master produk dari sistem lama ke ASIHJAYA RMS dengan workflow sesingkat mungkin:

```text
upload XLSX
   ↓
parse + validasi
   ↓
resolve kategori dan Product Master
   ↓
buat seluruh Product Item
   ↓
langsung available di Inventory + POS
   ↓
sinkronisasi foto legacy berjalan non-blocking
```

Prinsip utama:

```text
Import data tidak boleh menjadi proyek stock opname berlapis.
```

Workbook adalah sumber data migrasi. Warning kualitas data tetap dicatat, tetapi tidak memblokir seluruh operasional.

## 2. Route

Route utama:

```text
/admin/migrasi-produk
```

Detail batch:

```text
/admin/migrasi-produk/[batchId]
```

Permission:

```text
migration.view
migration.import
```

## 3. Input XLSX

Import menerima workbook `.xlsx`.

Source row dinormalisasi dan divalidasi sebelum direct import.

Data legacy yang dipertahankan mencakup informasi seperti:

- barcode legacy;
- nama item;
- Product Master/code legacy;
- kategori;
- berat;
- kadar;
- kadar tukaran bila tersedia;
- warna;
- potongan per gram;
- harga legacy sebagai referensi;
- URL foto legacy.

Leading zero pada barcode harus tetap dipertahankan.

Contoh:

```text
003037
```

tidak boleh berubah menjadi:

```text
3037
```

## 4. Semua Row Tetap Masuk

Current contract:

```text
warning / invalid source data
        ↓
item tetap dibuat
        ↓
needsCleanup = true
```

Warning atau kekurangan data tidak membentuk approval queue baru.

Data cleanup dapat dirapikan setelah item aktif sambil operasional berjalan.

Contoh kondisi yang dapat membuat `needsCleanup`:

- source row memiliki warning/invalid marker;
- legacy barcode tidak dapat dipakai sebagai alias;
- berat tidak valid/tidak tersedia;
- kadar tidak valid/tidak tersedia;
- nama item tidak tersedia;
- legacy master code tidak tersedia.

## 5. Resolusi Kategori

Kategori legacy dinormalisasi ke kategori ASIHJAYA.

Jika kategori yang cocok sudah ada:

```text
reuse kategori existing
```

Jika belum ada:

```text
buat kategori otomatis
→ is_active = true
```

Kategori hasil auto-create diberi jejak bahwa source berasal dari import legacy.

## 6. Resolusi Product Master

Direct import tidak menunggu mapping manual.

Untuk setiap grup Product Master:

```text
legacy master cocok dengan existing
        ↓
reuse existing Product Master

atau

legacy master belum ada / tidak cocok
        ↓
buat Product Master baru otomatis
```

Product Master yang digunakan direct import harus berada pada status aktif.

Metadata legacy tetap disimpan untuk audit dan cleanup.

## 7. Pembuatan Product Item

Setiap source row menghasilkan satu Physical Product Item.

State current setelah import berhasil:

```text
availability = available
condition    = good
location     = outlet
is_active    = true
```

Identifiers internal tetap dibuat oleh sequence sistem:

```text
SKU
barcode internal
QR value
```

Nilai current inventory seperti nama, berat, kadar, warna, dan outlet diisi dari source yang berhasil dinormalisasi.

## 8. Barcode Legacy

Barcode internal sistem selalu tersedia.

Barcode legacy digunakan sebagai alias bila memenuhi contract:

- format legacy yang didukung;
- nilainya unik pada active barcode namespace;
- tidak bentrok dengan barcode internal atau alias aktif lain.

Jika legacy barcode valid dan unik:

```text
legacy barcode
→ item_barcodes
→ source = legacy_import
→ active
→ primary
```

Jika barcode legacy bentrok/tidak dapat dipakai:

```text
item tetap diimport
→ memakai barcode internal
→ needsCleanup dapat ditandai
```

Konflik barcode legacy **tidak boleh menggagalkan Product Item**.

## 9. Harga dan Kadar

Harga legacy bukan source harga jual aktif POS.

Flow pricing:

```text
Kadar Persen item
    ↓
Harga/Gram aktif ASIHJAYA
    ↓
base selling price
```

Nilai harga legacy disimpan sebagai referensi metadata migrasi.

Jika kadar dapat dinormalisasi dan ada active rate untuk kadar tersebut, base price current dapat dihitung dari Harga/Gram aktif.

Manual pricing override pada POS tetap mengikuti contract POS yang berlaku.

## 10. Inventory Opening Movement

Direct import merepresentasikan masuknya stok awal ke ASIHJAYA RMS.

Setiap item membuat inventory movement:

```text
movement_type  = migration_opening
from_outlet    = null
to_outlet      = outlet tujuan import
reference_type = legacy_product_import_batch
reference_id   = batch id
```

Movement dan Product Item dibuat dalam transaction import yang sama.

## 11. Transaction Safety

Direct import harus atomik.

Flow sederhananya:

```text
BEGIN TRANSACTION
→ resolve/create kategori
→ resolve/create Product Master
→ allocate identifiers
→ build Product Item
→ build barcode aliases
→ build migration_opening movements
→ insert Product Items
→ insert aliases
→ insert movements
→ update batch ready
→ audit direct commit
COMMIT
```

Jika operation gagal sebelum commit:

```text
ROLLBACK
```

Tidak boleh ada sebagian Product Item aktif dari batch yang gagal.

## 12. Retry dan Duplicate Guard

Retry batch tidak boleh membuat Product Item kedua untuk source row yang sama.

Ketika ditemukan Product Item existing dari batch:

- jumlah item dibandingkan dengan jumlah source row;
- metadata `rowId` diverifikasi;
- duplicate row identity diperiksa;
- missing source row diperiksa;
- unknown metadata diperiksa.

Jika satu Product Item committed ditemukan untuk setiap source row secara konsisten, batch dapat dipulihkan menjadi `ready` tanpa membuat item baru.

Jika struktur existing tidak konsisten, retry dihentikan dengan error agar tidak menghasilkan duplikasi.

## 13. Batch Status

Status operasional utama direct import:

```text
processing
ready
failed
```

Pada UI:

```text
ready      → Selesai
processing → Mengimport
failed     → Gagal
```

Ketika `ready`, item hasil import sudah aktif pada Inventory dan POS.

## 14. Sinkronisasi Foto Legacy

Foto legacy menggunakan workflow non-blocking.

Setelah direct import selesai:

```text
Product Item sudah available
        ↓
legacy_url tersedia
        ↓
image status = pending
        ↓
download
        ↓
private/internal storage
        ↓
product_items.imageKey
        ↓
image status = synced
```

Jika source tidak memiliki URL foto:

```text
image status = missing
```

Jika download gagal:

```text
image status = failed
```

Kegagalan foto tidak mengubah availability item.

## 15. Auto Image Sync

Halaman detail batch menjalankan `LegacyImageSyncRunner`.

Jika:

```text
batch ready
+ permission migration.import
+ pending image > 0
```

runner mulai memproses foto secara otomatis.

Pemrosesan dilakukan bertahap:

```text
batch size = 36
concurrency = 6
```

Sinkronisasi dapat dilanjutkan dengan tombol **Lanjutkan sinkronisasi** jika masih ada pending item.

## 16. Image Storage Contract

Foto legacy tidak dipakai langsung sebagai hotlink permanen.

Service:

```text
importLegacyImageToPrivateStorage(...)
```

menyalin source image ke storage internal/private project.

Setelah berhasil:

```text
product_items.imageKey = imported image key
```

Metadata import menyimpan status dan informasi sync untuk audit.

`legacyUrl` tetap dipertahankan sebagai jejak source.

## 17. Failure Foto Tidak Memblokir POS

Invariant:

```text
foto pending / failed != item unavailable
```

Item sudah aktif sebelum image sync.

Jika foto gagal:

- item tetap dapat muncul di Inventory/POS;
- error code/message dicatat;
- sync dapat dicoba kembali;
- foto manual dapat ditambahkan kemudian.

## 18. Audit Trail

Direct import mencatat audit event untuk commit import.

Informasi penting meliputi:

- batch;
- imported item count;
- Product Master created/reused;
- kategori created;
- cleanup item count;
- legacy alias count;
- system-only barcode count;
- image pending/missing count;
- actor;
- outlet;
- timestamp/request metadata yang diizinkan.

Retry recovery juga memiliki audit trail tersendiri.

## 19. Data Cleanup Setelah Import

Cleanup tidak memblokir operasional.

Halaman detail batch menyediakan visibility terhadap:

- row bersih;
- row warning;
- row invalid/perlu dirapikan;
- Product Master created/reused;
- legacy barcode alias;
- item yang hanya memakai barcode internal;
- URL foto;
- foto tersalin/pending/gagal/missing.

Source row tetap dipertahankan agar operator/admin dapat menelusuri asal data.

## 20. Contract yang Tidak Boleh Kembali

Workflow aktif tidak boleh kembali bergantung pada flow lama seperti:

```text
mapping manual berlapis
verification session
mobile stock-opname scanner
manager approval queue
hold sebelum aktivasi
final reconciliation
manual cutover
sold-during-migration workflow
```

Jika kebutuhan bisnis berubah di masa depan, perubahan tersebut harus diperlakukan sebagai feature baru dan didokumentasikan secara eksplisit.

## 21. Regression Checker

Targeted checker:

```powershell
npm run check:legacy-product-migration
```

Contract penting yang dikunci:

```text
availability: "available"
condition: "good"
movementType: "migration_opening"
source: "legacy_import"
status: "ready"
legacyPricePerGram
needsCleanup
DIRECT_IMPORT_EXISTING_ITEMS_INCONSISTENT
completeCommittedImport
```

UI checker juga memastikan flow route lama tidak direferensikan kembali.

## 22. Smoke Test Minimal

### Direct import

1. buka `/admin/migrasi-produk`;
2. pilih outlet;
3. upload XLSX valid;
4. pastikan batch selesai;
5. pastikan seluruh row menghasilkan item;
6. pastikan item langsung terlihat di Inventory;
7. pastikan item saleable dapat ditemukan POS;
8. cek Product Master/category auto-create/reuse;
9. cek barcode legacy unik dapat dipindai;
10. cek conflict barcode tetap menghasilkan item dengan barcode internal.

### Cleanup

1. import row warning/invalid;
2. pastikan item tetap masuk;
3. pastikan row/item ditandai perlu dirapikan;
4. pastikan cleanup marker tidak memblokir POS.

### Foto

1. gunakan row dengan URL foto valid;
2. buka detail batch;
3. pastikan runner mulai otomatis;
4. pastikan image masuk ke internal storage;
5. pastikan `imageKey` terisi;
6. uji URL gagal;
7. pastikan item tetap available.

### Retry

1. simulasikan retry batch setelah commit sukses;
2. pastikan Product Item tidak terduplikasi;
3. pastikan batch dapat direcover bila source-row identity lengkap;
4. pastikan inconsistency menghasilkan guard error.

## 23. Quality Gate

Setelah perubahan pada domain ini:

```powershell
npm run check:legacy-product-migration
npm run typecheck
npm run lint
npm run routes:check
npm run build:clean
```

Jika perubahan menyentuh schema/database:

```powershell
npm run check:database
npm run check:database:live
```

## 24. Kebijakan Dokumentasi

Dokumen ini menjelaskan **workflow direct import yang aktif sekarang**.

Sejarah milestone migrasi lama tetap tersedia melalui Git history dan tidak perlu dipertahankan sebagai current operational documentation.
