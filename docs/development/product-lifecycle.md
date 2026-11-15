# Penghapusan, arsip, dan pemulihan produk

Kontrol tersedia di detail item `/admin/inventaris/item/[itemId]` dan detail master `/admin/produk/[productId]`. Dialog menjelaskan tindakan yang dipilih sistem sebelum staff mengonfirmasi.

## Aturan item fisik

- Draft tanpa riwayat atau identitas import dapat dihapus permanen. Alias barcode mengikuti cascade database; audit menyimpan snapshot identitas produk.
- Item tersedia/terjual, atau draft yang memiliki movement, penjualan, retur, buyback, hold, maupun referensi import, diarsipkan dengan `isActive=false`.
- Arsip mempertahankan seluruh identitas, alias barcode, foto, dan histori. Alias tidak dibebaskan untuk dipakai ulang.
- Pemulihan hanya mengubah status aktif. Item sold tetap sold; pemulihan stok available mensyaratkan master dan kategori aktif.
- Reserved, processing, inspection, migration hold, pengiriman/perbaikan, dan hold POS aktif memblokir tindakan sampai proses selesai.
- Arsip/pemulihan item available mencatat movement adjustment; tidak membuat penjualan atau pendapatan.
- Item arsip dapat ditemukan melalui filter **Item diarsipkan**. Daftar item pada detail master memberi label **Diarsipkan**.

## Aturan master

- Master kosong tanpa referensi penggunaan dapat dihapus permanen.
- Master dengan histori/referensi dipertahankan sebagai arsip (`status=inactive` dengan metadata `productLifecycle`).
- Master dengan item operasional aktif selain sold belum dapat diarsipkan. Item tersebut perlu diselesaikan atau diarsipkan terlebih dahulu.
- Pemulihan mengembalikan status master sebelumnya. Pemulihan master aktif memerlukan kategori aktif, dan tidak memulihkan item anak secara otomatis.
- Form edit biasa tidak dapat melewati proses pemulihan master yang diarsipkan.

## Akses dan transaksi

Item memerlukan `inventory.adjust` atau permission kompatibilitas `inventory.manage`, serta akses ke outlet item. Master memerlukan `products.manage`. Organisasi selalu mengikuti sesi terautentikasi.

Server memeriksa ulang state saat konfirmasi, memakai row lock, dan menolak konfirmasi hapus lama jika produk sudah memperoleh histori. Foreign key riwayat tidak dihapus untuk memaksa penghapusan produk. Audit, perubahan aktif, dan movement tersimpan dalam satu transaksi. Native item creation memeriksa/menahan master di dalam transaksi; update item menolak state yang sudah berubah/diarsipkan.

Sinkronisasi legacy mengenali item yang diarsipkan tanpa mengaktifkannya kembali. SKU baru di bawah master arsip ditunda. Product Batch Import juga menolak aktivasi ulang master arsip. Proses ini memakai lock organisasi yang sama dengan lifecycle produk.

Tidak ada migrasi database baru. Status sumber dan metadata memakai kolom yang sudah tersedia. Media tidak dipurge dari storage oleh fitur ini.

## Search bar POS

Query katalog mencari alias barcode aktif dengan `EXISTS`, tanpa menggandakan row atau mengubah pagination. Payload katalog awal, hasil pencarian, dan scan menyertakan `searchBarcodes`; filter lokal memahami alias yang sama.

Pencarian barcode legacy mendukung angka lengkap/sebagian dan mempertahankan nol di depan. Alias nonaktif, item arsip/terjual/di-hold, outlet lain, dan organisasi lain tetap mengikuti pembatasan katalog POS. Karakter wildcard SQL pada input diperlakukan sebagai teks literal.

## Validasi

- `npm run test:migration:legacy-barcode:local`
- `npm run test:products:lifecycle:local`
- `npm run test:migration:sync:local`
- `npm run test:product-batch:local`

Seluruh runner memakai PostgreSQL 17 disposable. Suite mencakup pencarian alias, penghapusan draft, arsip/pemulihan, perlindungan riwayat dan outlet, konfirmasi usang, concurrency checkout, serta perlindungan import setelah arsip. GitHub CI menjalankan suite lifecycle dan katalog legacy.
