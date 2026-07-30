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

## Milestone 4 — Manager Review dan Inventory Hold

Milestone 4 menambahkan antrean review manager pada:

```text
/admin/migrasi-produk/[batchId]/review
```

Aturan utama:

- `submitted` tanpa review flag dan kondisi `good` dapat diproses melalui bulk approval.
- `needs_review` dan item `physical_unmatched` wajib dibuka satu per satu.
- Manager dapat mengembalikan verification ke staff dengan alasan wajib.
- Staff dapat scan barcode yang sama dan mengirim ulang verification yang berstatus `returned` selama sesi masih aktif dan assignment masih berlaku.
- Penolakan tidak membuat Product Item ataupun barcode alias.
- Approval membuat Product Item dengan `availability = migration_hold`.
- Approval membuat satu alias barcode aktif dan primary pada `item_barcodes`.
- Barcode hasil sequence sistem tetap disimpan pada `product_items.barcode` sebagai identitas internal; barcode lama menjadi alias fisik utama.
- Approval tidak membuat `inventory_movements` dan tidak pernah mengubah item menjadi `available`.
- Verification ditautkan ke Product Item melalui `product_item_id` untuk idempotency dan audit.

### Flow approval

```text
verification submitted / needs_review
  -> manager review
  -> transaction lock verification + barcode
  -> generate SKU dan internal barcode
  -> insert product_items (migration_hold)
  -> insert item_barcodes (legacy primary alias)
  -> update verification approved + product_item_id
```

Seluruh langkah berada dalam satu transaction. Kegagalan pada salah satu langkah melakukan rollback penuh.

### Return dan resubmit

```text
manager return + reason
  -> status returned
  -> operator scan barcode yang sama
  -> form terisi data sebelumnya + catatan manager
  -> operator memperbaiki
  -> resubmit meningkatkan revision
  -> kembali ke submitted / needs_review
```

Milestone 4 belum mencakup cutover, aktivasi massal menjadi `available`, pencatatan barang yang terjual di sistem lama, atau lookup alias barcode pada checkout POS. Bagian tersebut masuk Milestone 5.

## Milestone 5A — Sold during migration

Flow operasional dibuat satu langkah: manager membuka halaman **Terjual di Sistem Lama**, menempel satu barcode atau satu kolom barcode dari Excel, memilih tanggal penjualan, lalu menyimpan. Referensi transaksi dan catatan bersifat opsional.

Guardrail:

- barcode staging dapat ditandai meskipun belum pernah discan;
- barcode dengan sold record aktif ditolak oleh scanner, resubmit, return/reject, dan approval;
- semua jalur memakai advisory lock `legacy-barcode:<organization>:<barcode>`;
- verification yang sudah ada berubah menjadi `sold_during_migration`;
- Product Item `migration_hold` berubah menjadi `sold`, `is_active=false`, dan alias legacy dinonaktifkan;
- tidak ada inventory movement dan tidak ada item yang menjadi `available`;
- pembatalan mengembalikan status verification, Product Item, dan alias barcode dalam satu transaction;
- permission pengelolaan adalah `migration.sold.manage`.

Tabel `legacy_migration_sold_records` diperlukan agar barang yang terjual sebelum scan tetap tercatat dan dapat dikecualikan dari cutover. Hanya satu record aktif yang diizinkan per organization dan barcode; record lama tetap tersimpan sebagai audit history setelah dibatalkan.

## Milestone 5B — Final reconciliation dan migrasi foto legacy

Route manager:

```text
/admin/migrasi-produk/[batchId]/rekonsiliasi
```

Flow sengaja dibuat ringkas:

```text
lihat blocker live
  -> perbaiki hanya blocker
  -> salin foto legacy per batch maksimal 100
  -> ulangi foto gagal bila diperlukan
  -> lanjut ke preflight cutover Milestone 5C
```

Readiness tidak disimpan sebagai workflow baru. Query menghitung keadaan live dari sesi migrasi, verification, sold record aktif, Product Item `migration_hold`, Product Master, dan alias barcode legacy.

Blocker yang ditampilkan:

- belum ada sesi migrasi;
- sesi masih `draft` atau `active`;
- verification masih `submitted`, `needs_review`, atau `returned`;
- jumlah barang fisik terproses masih di bawah total target sesi yang diisi;
- verification approved kehilangan Product Item;
- Product Item approved tidak lagi `migration_hold`/aktif;
- Product Master belum `active`;
- alias barcode legacy hilang, nonaktif, atau bukan primary.

Target sesi yang tidak diisi hanya menjadi warning operasional. Staging XLSX berisi data historis sehingga seluruh 11.394 baris tidak pernah dianggap sebagai stok aktif yang wajib discan.

### Migrasi foto

Hanya verification `approved` yang memilih foto legacy dan masih memiliki Product Item `migration_hold` yang diproses. Foto aktual hasil upload sudah berada di private storage sehingga tidak disalin ulang.

Download guard:

- HTTPS wajib;
- host dan seluruh redirect harus berada pada `LEGACY_IMAGE_ALLOWED_HOSTS`;
- hostname IP/localhost, credential URL, dan port non-443 ditolak;
- timeout dan batas byte diterapkan sebelum Sharp memproses gambar;
- content type wajib JPG, PNG, atau WebP;
- output selalu WebP melalui pipeline `image-storage` yang sama dengan upload normal;
- update Product Item dan audit log dilakukan setelah validasi status ulang dengan advisory lock per item;
- file hasil download dihapus bila item berubah atau proses database tidak dapat memakai file tersebut.

Metadata hasil copy disimpan pada `product_items.attributes.legacyPhotoMigration`, tanpa tabel tambahan. Link asli pada `legacy_url` tetap dipertahankan sebagai jejak sumber.

Urutan fallback tampilan tetap:

```text
Product Item imageKey internal
  -> Product Master imageKey
  -> placeholder sistem
```

Foto pending/gagal bukan blocker cutover. Item diberi warning dan dapat dilengkapi foto aktual setelah cutover. Item `physical_unmatched` tetap menggunakan foto aktual yang diwajibkan sejak Milestone 3.

Environment opsional:

```env
LEGACY_IMAGE_ALLOWED_HOSTS=asihjaya.com
LEGACY_IMAGE_DOWNLOAD_TIMEOUT_MS=12000
LEGACY_IMAGE_DOWNLOAD_MAX_MB=8
```

Milestone 5B tidak membuat `inventory_movements`, tidak mengubah `migration_hold` menjadi `available`, dan tidak mengubah lookup checkout POS.
