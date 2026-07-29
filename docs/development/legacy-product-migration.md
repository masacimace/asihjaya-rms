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

## Milestone 2 — Master Mapping dan Session Management

- Satu mapping berlaku untuk seluruh item dengan `legacy_master_code` yang sama.
- Tombol auto-draft membuat Product Master berstatus `draft`, bukan `active`.
- Alias kategori legacy: Cincin, Gelang, Kalung, Liontin, Anting/Giwang, dan Logam Mulia dinormalisasi ke kategori sistem baru.
- Manager dapat memetakan ke Product Master existing, mengabaikan master dengan alasan, atau mereset mapping ke pending.
- Sesi migrasi dibagi per etalase/lokasi dan memiliki operator serta satu Migration Lead opsional.
- Status sesi: `draft`, `active`, `locked`, `completed`, dan `cancelled`. Milestone 2 belum menyediakan scan sehingga status `completed` belum ditransisikan dari UI.
- Tidak ada item yang dibuat atau diaktifkan pada milestone ini.

## Milestone berikutnya

Milestone 3 akan menambahkan mobile scanner untuk operator, pencarian barcode staging, provisional item untuk barcode fisik yang tidak ada di export, verifikasi data fisik, serta submit ke antrean manager. Item belum aktif di POS sampai approval dan cutover.
