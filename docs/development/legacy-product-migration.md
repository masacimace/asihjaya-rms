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

## Milestone 3 — Mobile Physical Verification

Milestone 3 menambahkan scanner mobile pada area POS tanpa mengaktifkan inventory.

Alur:

```text
Sesi aktif + assignment operator/lead
  -> scan kamera atau input manual
  -> lookup barcode pada batch staging
  -> prefill data legacy atau physical unmatched
  -> verifikasi data fisik dan foto
  -> submit ke legacy_migration_verifications
  -> antrean manager
```

Guardrail:

- Hanya sesi `active` yang menerima lookup dan submit.
- Operator/lead wajib ditugaskan pada sesi; manager dengan `migration.session.manage` dapat melakukan override.
- Barcode dinormalisasi memakai panjang barcode batch, termasuk leading zero.
- Satu barcode hanya memiliki satu verification pada seluruh organization, sehingga tidak dapat didaftarkan ulang di outlet lain.
- Advisory transaction lock dan unique index melindungi concurrent submit.
- Retry dengan fingerprint sama bersifat idempotent.
- Barcode yang tidak ada pada export memakai source `physical_unmatched`, wajib foto aktual, dan selalu `needs_review`.
- Perubahan master, nama, berat, kadar, warna, kondisi rusak, atau warning legacy menghasilkan review flags.
- Setiap verifikasi wajib memiliki tepat satu sumber foto: foto legacy atau foto aktual; keduanya tidak boleh dipilih bersamaan.
- Milestone ini tidak melakukan insert ke `product_items` atau `item_barcodes`.
- Milestone ini tidak mengubah item menjadi `available` dan tidak mengubah lookup checkout POS.

Permission:

- `migration.scan`
- `migration.verification.submit`

System role `cashier`, `manager`, `stock_admin`, `owner`, dan `system_admin` memperoleh permission tersebut melalui migration. Assignment sesi tetap menjadi pembatas operasional tambahan.

Route:

```text
/pos/migrasi-barang
/pos/migrasi-barang/[sessionId]
```

### Remote smoke test

1. Buat sesi dan assign akun operator/lead.
2. Ubah sesi menjadi Aktif.
3. Login akun staff pada smartphone atau browser profile terpisah.
4. Uji barcode clean, leading zero, warning, unmatched, duplicate, dan sesi locked.
5. Untuk smartphone camera gunakan origin HTTPS sementara; input manual tetap tersedia untuk localhost.
6. Pastikan jumlah `product_items` dan `item_barcodes` tidak berubah.

### Onsite acceptance yang tetap diperlukan

- Label pudar atau terlipat.
- Pantulan lampu/plastik etalase.
- Kamera smartphone staff.
- Koneksi outlet saat beberapa staff scan bersamaan.
- Pilot satu etalase sebelum migrasi massal.

## Milestone berikutnya

Milestone 4 akan menambahkan antrean review manager, bulk approval clean item, review individual unmatched/conflict, pembuatan `product_items` dengan status hold/draft, dan pembuatan barcode alias legacy tanpa mengaktifkannya untuk checkout.
