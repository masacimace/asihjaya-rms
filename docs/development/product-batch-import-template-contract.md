# Product Batch Import — Template Contract v1

**Status:** Accepted for implementation
**Template version:** `1`
**Import type:** `master_and_physical_create`
**Roadmap stage:** 2B.0 contract; generator mulai dibuat pada 2B.1

## Tujuan

Contract ini mendefinisikan format paket yang dapat diisi staff non-developer untuk membuat beberapa Product Master dan banyak Product Item dalam satu batch.

Workbook hanya berisi data input bisnis. Identifier teknis final dibuat server saat commit.

## Prinsip operator

Operator **tidak mengisi**:

- Product Master database ID;
- Product Master code (`PM-......`);
- Product Item database ID;
- SKU;
- barcode;
- QR value;
- storage key;
- sequence number.

`master_key` dan `row_key` hanya identifier lokal di workbook agar row mudah dihubungkan dan error mudah ditemukan.

## Paket ZIP v1

Nama ZIP bebas dan hanya digunakan sebagai metadata upload, contoh:

```text
asihjaya-product-batch-2026-08.zip
```

Struktur yang diterima:

```text
products.xlsx
images/
├── masters/
│   ├── MASTER-001.jpg
│   └── MASTER-002.webp
└── physical/
    ├── ITEM-001.jpg
    ├── ITEM-002.jpg
    └── ITEM-003.png
```

### Path policy

Allowed files:

```text
/products.xlsx
/images/masters/<image-file>
/images/physical/<image-file>
```

Folder boleh tidak mempunyai image physical bila seluruh item menggunakan master fallback.

Fatal error:

- `products.xlsx` tidak ada atau lebih dari satu;
- workbook tidak berada di root;
- path `../` atau equivalent traversal;
- absolute path;
- symlink;
- unsupported folder/file;
- executable;
- macro workbook;
- duplicate archive entry;
- duplicate filename image setelah normalization;
- image type/bytes invalid.

Image valid tetapi tidak pernah direferensikan row menghasilkan warning `UNUSED_IMAGE`; batch tetap dapat di-commit bila tidak ada error lain.

## Limits v1

```text
ZIP compressed upload    : max 100 MB
products.xlsx             : max 5 MB
PRODUCT_MASTERS rows      : max 250 data rows
PHYSICAL_PRODUCTS rows    : max 500 data rows
individual image          : max 5 MB
archive entries           : max 2,000
archive uncompressed      : max 250 MB
```

Empty trailing rows tidak dihitung sebagai data row.

## Filename normalization

Image lookup harus:

1. normalize separator ke `/`;
2. normalize Unicode ke bentuk yang dipilih parser secara konsisten;
3. trim whitespace yang tidak valid dari reference cell sesuai text normalization contract;
4. compare filename secara case-insensitive.

Contoh berikut dianggap duplicate dan merupakan fatal error bila keduanya ada:

```text
images/masters/MASTER-001.JPG
images/masters/master-001.jpg
```

Reference workbook hanya menyimpan **basename** image, bukan full path.

Contoh:

```text
primary_image  = MASTER-001.jpg
physical_image = ITEM-001.jpg
```

Tidak diterima:

```text
../MASTER-001.jpg
C:\foto\MASTER-001.jpg
images/masters/MASTER-001.jpg
https://example.com/MASTER-001.jpg
```

Importer menentukan folder berdasarkan nama kolom/entity.

## Workbook v1

Workbook harus berupa XLSX non-macro dan mempunyai tepat empat sheet berikut:

```text
METADATA
PRODUCT_MASTERS
PHYSICAL_PRODUCTS
INSTRUCTIONS
```

Nama sheet bersifat exact dan case-sensitive untuk template v1.

Extra sheet, hidden surprise sheet, atau missing required sheet adalah fatal error.

`INSTRUCTIONS` bersifat dokumentasi untuk operator dan tidak menjadi sumber data bisnis.

Formula/hyperlink pada `PRODUCT_MASTERS` atau `PHYSICAL_PRODUCTS` adalah fatal error. Importer tidak mengevaluasi formula sebagai nilai bisnis.

## Sheet `METADATA`

Header exact:

| `key` | `value` |
|---|---|

Required keys:

| key | required value | Catatan |
|---|---|---|
| `template_version` | `1` | exact supported version |
| `import_type` | `master_and_physical_create` | create-only v1 |

Optional key:

| key | value | Catatan |
|---|---|---|
| `generated_at` | tanggal generator | metadata informasional, bukan business time |

Duplicate metadata key adalah fatal error. Unknown metadata key menghasilkan warning untuk forward-compatibility, kecuali key tersebut kemudian ditetapkan sebagai reserved/fatal oleh version contract baru.

## Sheet `PRODUCT_MASTERS`

Satu data row membuat satu Product Master.

### Header exact dan urutan v1

```text
master_key
name
category_code
brand
material
collection
description
primary_image
status
```

Tidak ada kolom `master_code` pada input v1. Product Master code dibuat server saat commit.

### Column contract

| Column | Required | Contract |
|---|---:|---|
| `master_key` | Ya | unique di workbook; text 1–80 chars; relational key only |
| `name` | Ya | 2–200 chars |
| `category_code` | Ya | exact resolve ke category aktif di organization; max 48 chars |
| `brand` | Tidak | max 120 chars |
| `material` | Tidak | max 80 chars |
| `collection` | Tidak | max 120 chars |
| `description` | Tidak | max 4.000 chars |
| `primary_image` | Ya | basename image pada `images/masters`; JPG/JPEG/PNG/WebP |
| `status` | Tidak | `draft` atau `active`; blank = `active` |

### `master_key`

Contoh yang disarankan:

```text
MASTER-001
MASTER-002
MASTER-003
```

Tidak perlu mengikuti Product Master code database. Setelah commit, contoh mapping dapat menjadi:

```text
MASTER-001 → PM-000001
```

Uniqueness dicek setelah text normalization.

### `category_code`

Category harus:

- berada pada organization yang sama;
- exact resolve terhadap code category;
- berstatus aktif.

Template v1 akan menyediakan guidance/dropdown bila aman, tetapi server tetap menjadi source of truth.

### `status`

Accepted:

```text
active
draft
```

Blank menjadi `active`.

`inactive` ditolak untuk create-only import.

Master `active` wajib lolos seluruh row validation dan mempunyai primary image valid. Importer tidak silently downgrade row invalid menjadi `draft`.

Jika master `draft`, seluruh child `PHYSICAL_PRODUCTS.initial_availability` harus `draft` atau blank.

## Sheet `PHYSICAL_PRODUCTS`

Satu data row membuat satu Product Item. Banyak row boleh menunjuk `master_key` yang sama.

### Header exact dan urutan v1

```text
row_key
master_key
display_name
outlet_code
weight_gram
purity_percent
exchange_purity_percent
size
color
gemstone
cost_amount
selling_amount
price_per_gram
deduction_per_gram
condition
location_code
physical_image
internal_notes
initial_availability
```

Tidak ada kolom SKU, barcode, atau QR final.

### Column contract

| Column | Required | Contract |
|---|---:|---|
| `row_key` | Ya | unique di workbook; text 1–80 chars |
| `master_key` | Ya | harus resolve ke `PRODUCT_MASTERS.master_key` |
| `display_name` | Tidak | max 220 chars |
| `outlet_code` | Kondisional | max 24; wajib untuk `available`; active + org-scoped + user access |
| `weight_gram` | Kondisional | decimal > 0, max 3 decimal; wajib untuk `available` |
| `purity_percent` | Tidak | > 0 dan <= 100, max 3 decimal |
| `exchange_purity_percent` | Tidak | > 0 dan <= 100, max 3 decimal |
| `size` | Tidak | max 64 chars |
| `color` | Tidak | max 64 chars |
| `gemstone` | Tidak | max 160 chars |
| `cost_amount` | Tidak | integer Rupiah 0..18 digit; membutuhkan `pricing.manage` bila diisi |
| `selling_amount` | Kondisional | integer Rupiah > 0; wajib untuk `available`; membutuhkan `pricing.manage` |
| `price_per_gram` | Tidak | integer Rupiah >= 0; membutuhkan `pricing.manage` bila diisi |
| `deduction_per_gram` | Tidak | integer Rupiah >= 0; membutuhkan `pricing.manage` bila diisi |
| `condition` | Tidak | `good` atau `damaged`; blank = `good`; `available` wajib `good` |
| `location_code` | Tidak | max 80 chars |
| `physical_image` | Tidak | basename image pada `images/physical`; JPG/JPEG/PNG/WebP |
| `internal_notes` | Tidak | max 4.000 chars |
| `initial_availability` | Tidak | `draft` atau `available`; blank = `draft` |

### Decimal contract

Untuk `weight_gram`, `purity_percent`, dan `exchange_purity_percent`, parser menerima decimal separator `.` atau `,`, lalu normalize ke decimal database string.

Scientific notation dan formula tidak diterima.

Contoh valid:

```text
3.125
3,125
75
75.5
```

### Money contract

Input uang adalah nominal Rupiah integer. Untuk memudahkan operator, parser boleh normalize format manual existing seperti prefix `Rp`, titik ribuan, dan whitespace selama hasil akhirnya integer maksimal 18 digit.

Contoh yang normalize ke nilai sama:

```text
1500000
1.500.000
Rp 1.500.000
```

`selling_amount` harus > 0 bila diisi. `cost_amount`, `price_per_gram`, dan `deduction_per_gram` boleh `0`.

Formula Excel tidak diterima walaupun hasil tampilannya berupa angka.

### `initial_availability`

Accepted:

```text
draft
available
```

Blank menjadi `draft`.

Untuk `available`, server wajib memvalidasi:

```text
parent master status = active
outlet_code valid + active + accessible
weight_gram > 0
selling_amount > 0
condition = good
effective image exists
```

Jika satu requirement gagal, row invalid dan seluruh batch belum dapat di-commit.

## Effective image contract

Effective image Product Item:

```text
physical_image bila tersedia
ELSE Product Master primary_image
```

Karena `primary_image` Product Master wajib pada scope v1, physical image boleh kosong.

Preview/result harus menyatakan image source:

```text
physical
master_fallback
```

Missing/invalid physical image yang direferensikan tetap error; fallback hanya berlaku bila `physical_image` cell memang kosong.

## Identifier generation saat commit

### Product Master

Server membuat code:

```text
PM-000001
PM-000002
...
```

Code tidak dialokasikan saat preview.

### Product Item

Server menggunakan generator existing `getNextProductItemIdentifiers()` yang mengambil nomor dari PostgreSQL sequence `product_item_number_seq`:

```text
SKU     AJ-ITEM-00000001
Barcode AJ00000001
QR      AJ00000001
```

Barcode tidak boleh berasal dari workbook.

Setiap item membuat primary active `item_barcodes` dengan source `system_generated`.

### Legacy barcode

Barcode lama pada produk yang sudah ada secara fisik di toko **tidak diproses melalui template ini**. Gunakan Legacy Product Migration agar barcode lama/alias fisik dapat dipertahankan tanpa relabel.

## Permission contract

Feature access memerlukan:

```text
products.batch_import
```

Default role:

```text
system_admin ✅
owner        ✅
manager      ✅
stock_admin  ✅
cashier      ❌
finance      ❌
```

Commit juga memerlukan:

- `products.manage` untuk Product Master;
- `inventory.receive` atau `inventory.manage` untuk Product Item;
- `pricing.manage` bila satu field finansial diisi.

Printing terpisah dan memerlukan `inventory.print_label`.

## Validation severity

### Fatal error

Fatal error memblokir Commit Import.

Contoh:

- corrupt/unsupported ZIP/XLSX;
- wrong template version/import type;
- missing/extra/hidden worksheet;
- wrong header;
- limit terlampaui;
- formula/hyperlink pada data sheet;
- duplicate `master_key`/`row_key`;
- unknown parent `master_key`;
- invalid/inactive category;
- invalid/inaccessible outlet;
- invalid money/decimal/percentage;
- unsupported status/condition/availability;
- referenced image missing/invalid;
- master image missing;
- `available` requirements tidak lengkap;
- permission tidak cukup;
- dangerous archive entry;
- duplicate normalized image filename.

### Warning

Warning tidak memblokir commit.

Contract warning v1 minimal:

- valid image berada pada allowed folder tetapi tidak direferensikan (`UNUSED_IMAGE`);
- Product Item tidak memiliki physical image sehingga memakai master fallback (`MASTER_IMAGE_FALLBACK`).

Warning tidak boleh dipakai untuk menyamarkan data invalid yang seharusnya fatal.

## Duplicate/fingerprint contract

Importer menghitung SHA-256 untuk:

- original ZIP;
- workbook;
- image entries;
- normalized row payload/fingerprint.

Duplicate file guard organization-scoped menggunakan archive SHA-256 dan session state untuk mencegah accidental double import.

Duplicate row di dalam workbook harus dideteksi melalui key dan normalized fingerprint sesuai validator stage 2B.3/2B.4.

## Preview contract

Preview harus menampilkan minimum:

- total master rows;
- total physical rows;
- valid/invalid counts;
- warnings;
- item estimated `draft`/`available`;
- image found/missing;
- row number Excel;
- field-level errors;
- effective image source;
- parent-child relationship;
- confirmation counts sebelum commit.

Preview **tidak** mengalokasikan Product Master code, SKU, barcode, atau QR final.

## Commit/result contract

Commit hanya aktif jika session `ready` dan tidak ada fatal error.

Setelah berhasil, result dapat menampilkan generated values.

### Result sheet `IMPORT_SUMMARY`

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

### Result sheet `CREATED_MASTERS`

```text
master_key
product_master_id
product_master_code
name
status
image_status
```

### Result sheet `CREATED_ITEMS`

```text
row_key
master_key
product_item_id
sku
barcode
qr_value
outlet_code
availability
image_source
status
```

### Result sheet `WARNINGS`

Semua nonfatal warning yang relevan untuk audit/operator.

Result/error workbook harus menggunakan formula-injection protection existing sehingga text yang diawali `=`, `+`, `-`, atau `@` tidak dieksekusi sebagai formula saat dibuka.

## Label eligibility

Item yang sudah mempunyai outlet dan permission yang sesuai dapat masuk workflow label existing `print_label_sato`.

Draft item tanpa outlet:

```text
identifier generated : ya
hardware label job   : belum eligible
```

Sistem tidak memilih outlet/printer otomatis untuk draft item tersebut.

## Sample minimal v1

### `PRODUCT_MASTERS`

```text
master_key | name                | category_code | brand     | material | collection | description | primary_image  | status
MASTER-001 | Gelang Rantai Nori  | BRACELET      | Vancleef  | Emas     | Nori       |             | MASTER-001.jpg | active
MASTER-002 | Cincin Polos Aster  | RING          |            | Emas     | Aster      |             | MASTER-002.jpg |
```

Row `MASTER-002` menjadi `active` karena status kosong.

### `PHYSICAL_PRODUCTS`

```text
row_key | master_key | outlet_code | weight_gram | selling_amount | condition | physical_image | initial_availability
ITEM-001| MASTER-001 | OUTLET-01   | 3.125       | 2500000        | good      | ITEM-001.jpg   | available
ITEM-002| MASTER-001 | OUTLET-01   | 3.080       | 2450000        | good      |                | available
ITEM-003| MASTER-002 |             |             |                | good      |                | draft
```

`ITEM-002` memakai master fallback image. `ITEM-003` tetap valid sebagai draft tanpa outlet/berat/harga selama field lain valid.

## Template generator requirements untuk 2B.1

Generator template v1 harus:

- menghasilkan empat sheet exact;
- menulis metadata `template_version=1` dan `import_type=master_and_physical_create`;
- menggunakan header/urutan exact contract ini;
- mempunyai sheet `INSTRUCTIONS` berbahasa operasional, bukan teknis;
- boleh memberi dropdown untuk `status`, `condition`, dan `initial_availability`;
- tidak memakai formula bisnis;
- sample row harus dapat dihapus tanpa merusak template;
- tidak menyediakan input master code/SKU/barcode/QR;
- membuka normal di Microsoft Excel;
- lulus checker template yang dibuat pada 2B.1.

## Change control

Perubahan header, semantics, default, required field, atau parser behavior yang membuat file lama dapat berubah arti wajib menaikkan `template_version`.

Perubahan tampilan `INSTRUCTIONS` yang tidak mengubah semantics boleh tetap pada template version yang sama.
