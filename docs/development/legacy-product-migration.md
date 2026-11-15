# Sinkronisasi Produk Legacy

Workflow aktif: pilih outlet, upload XLSX, klik **Sinkronkan Produk**. Sistem langsung memproses baris yang aman dan menunda pengecualian. Tidak ada mapping atau persetujuan per produk.

## Hasil otomatis

- Produk lama dikenali lintas batch/file; identitas internal, foto, harga aktif, dan transaksi RMS dipertahankan.
- Produk baru ditambahkan mengikuti status stok Excel.
- Barcode ganda, identitas berbeda, atau status tidak dikenal ditunda tanpa memblokir baris lainnya.
- Hasil menampilkan produk baru, produk sudah ada, status stok diperbarui, dan baris ditunda.
- Filter **Ditunda** di detail batch menampilkan alasan. Perbaiki sumber Excel dan upload file yang sudah diperbaiki.

Route tetap `/admin/migrasi-produk` dan `/admin/migrasi-produk/[batchId]`. Permission tetap `migration.view` dan `migration.import`.

## Input

Format XLSX tetap memakai kolom legacy: barcode, kategori, kode/nama master, nama SKU, kadar, kadar tukaran, harga per gram, potongan per gram, berat, warna, dan URL foto. Barcode numerik dinormalisasi menjadi enam digit, termasuk nol di depan.

Kolom status opsional dikenali melalui `Status Stok Legacy`, `Status Stok`, atau `Status`:

| Nilai | Perlakuan |
| --- | --- |
| Stok Tersedia / Tersedia / Available | Stok tersedia |
| Stok Habis / Terjual, Stok Habis, Habis, Terjual, Sold | Habis/terjual |
| Kolom tidak ada | Kompatibilitas export lama: dianggap tersedia |
| Kolom ada tetapi kosong/tidak dikenal, atau beberapa kolom bertentangan | Ditunda |

Batas tetap 10 MB, 50.000 baris, 100 kolom, dan 5 worksheet. Parser memakai worksheet pertama. URL foto mengikuti kebijakan download legacy yang sudah ada.

## Pencocokan lintas import

Semua barcode internal, alias (termasuk yang sudah nonaktif), legacy ID, dan source barcode dalam organisasi diperiksa. Identitas asal dicocokkan dari `legacy_product_rows` melalui metadata import, bukan label/harga POS yang dapat diubah staff.

Identitas mencakup kategori, kode dan nama master, nama SKU, kadar, berat, dan warna. Harga legacy, potongan, kadar tukaran, dan URL foto tidak menjadi kunci identitas karena dapat berubah. Perubahan identitas ditunda untuk mencegah salah menggabungkan dua produk berbeda.

Pencocokan harus menghasilkan tepat satu kandidat dengan outlet asal dan outlet saat ini sesuai tujuan. Kandidat dari outlet lain, beberapa kandidat, produk tanpa sumber legacy yang dapat diverifikasi, serta barcode ganda dalam satu workbook ditunda. Tidak ada pemilihan otomatis atas salah satu baris barcode ganda.

Master yang berbagi kode legacy tetapi berbeda kategori/nama dibedakan. Kategori dan master untuk produk baru tetap dibuat/digunakan otomatis. Baris yang sudah ada/ditunda tidak membuat master/item tambahan.

## Status stok dan transaksi

- Produk baru tersedia: `availability=available`, `location_state=outlet`, dengan movement `migration_opening`.
- Produk baru habis/terjual: `availability=sold`, `location_state=customer`; tidak membuat stok awal tersedia, sale, pembayaran, atau pendapatan.
- Produk lama yang masih tersedia hanya dapat berubah menjadi sold jika merupakan hasil import pada outlet yang sama, masih aktif/kondisi baik/berada di outlet, dan belum memiliki aktivitas operasional.
- Aktivitas operasional mencakup movement selain migration opening, sale, retur, held cart, dan referensi import produk operasional.
- Perubahan tersedia menjadi sold dicatat sebagai adjustment `legacy_stock_sync` dalam transaksi database yang sama. Ini bukan penjualan RMS.
- Excel tidak pernah mengaktifkan kembali item RMS yang sudah sold/reserved/nonaktif atau menimpa transaksi baru. Konflik perubahan menuju sold ditunda; status RMS tetap dipertahankan.

Harga legacy tetap referensi historis. Harga POS produk baru mengikuti Harga/Gram aktif berdasarkan Kadar Persen. Data produk lama tidak ditimpa otomatis.

## Atomisitas dan retry

Sinkronisasi memakai advisory lock per organisasi untuk menserialisasi upload berbeda, serta lock batch yang sudah ada. Pemeriksaan dan conditional UPDATE stok berbagi penguncian item dengan checkout POS. Hanya satu pihak dapat mengklaim item yang masih tersedia.

Produk, alias, movement, hasil per baris, summary, dan audit tersimpan atomik. Jika salah satu operasi gagal, seluruh transaksi dibatalkan, termasuk perubahan status stok lama.

Summary `validation_summary.directImport` memakai `syncVersion=1`, mencatat jumlah dan `rowOutcomes` (created/existing/stock_updated/deferred), source row ID, target item ID, status sumber, dan alasan. Retry memverifikasi hasil serta item yang sudah dibuat; batch dengan nol produk baru juga idempotent. Batch dari versi sebelumnya tetap memakai recovery guard source row yang sudah ada. File dengan hash sama pada outlet sama tetap diarahkan ke batch sebelumnya.

**Tidak membutuhkan migration database baru:** status sumber dibaca dari raw data yang sudah tersimpan; hasil disimpan dalam summary JSON yang sudah tersedia. Metadata `legacyImport.batchId/rowId` asal tidak ditimpa saat status disinkronkan.

## Foto

Item yang sengaja diarsipkan di RMS tetap dikenali tanpa diaktifkan kembali. SKU baru pada master yang diarsipkan ditunda dengan alasan `master_archived`; pemulihan dilakukan melalui detail master sebelum file diunggah kembali.

Produk baru menyimpan URL sumber dan foto disalin setelah commit. Gagal download tidak menggagalkan sinkronisasi. Produk lama mempertahankan foto RMS, dan baris ditunda tidak menjalankan download.

## Validasi

- `npm run check:legacy-product-migration`
- `npm run check:xlsx-security`
- `npm run test:migration:sync:local` memakai PostgreSQL 17 disposable dan membersihkan volume uji setelah selesai.
- `npm run test:migration:sync` memakai `TEST_DATABASE_URL` yang dijaga runner. Suite mencakup status, import berulang, nol item baru, barcode ganda, isolasi organisasi/outlet, aktivitas operasional, concurrency checkout/upload, pemisahan master, dan rollback.
- GitHub CI menjalankan suite sinkronisasi setelah financial/concurrency test.
