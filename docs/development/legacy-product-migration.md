# Legacy Product Migration

## Milestone 1 — XLSX staging foundation

Milestone ini menerima export master produk dari dashboard lama dan menyimpan seluruh baris ke staging terisolasi.

Guardrail utama:

- Tidak membuat `product_items`.
- Tidak mengubah status inventaris.
- Tidak mengubah lookup POS.
- Harga dan potongan lama hanya menjadi referensi.
- Keberadaan stok tetap harus dibuktikan melalui scan barang fisik pada milestone berikutnya.
- File yang sama dicegah masuk dua kali melalui SHA-256 dan advisory lock PostgreSQL.

## Data flow

```text
XLSX legacy
  -> parser dan normalisasi
  -> validasi barcode/data
  -> legacy_product_import_batches
  -> legacy_product_rows
```

Barcode legacy dinormalisasi menjadi string enam digit. Nilai `003037` tidak boleh berubah menjadi `3037`.

## Permissions

- `migration.view`: melihat batch dan baris staging.
- `migration.import`: mengunggah workbook legacy ke staging.

Migration database memberikan kedua permission tersebut kepada system role `system_admin`, `owner`, `manager`, dan `stock_admin`. Role custom dapat diatur melalui halaman role setelah migration diterapkan.

## Pemeriksaan

```bash
npm run check:legacy-product-migration
npm run check:database
npm run routes:check
npm run typecheck
npm run lint
npm run build
```

## Milestone berikutnya

Milestone 2 akan menambahkan review/mapping 54 master legacy, normalisasi kategori, pricing readiness, serta session migrasi per etalase. Belum ada item yang diaktifkan ke POS sampai verifikasi fisik, approval, dan cutover selesai.
