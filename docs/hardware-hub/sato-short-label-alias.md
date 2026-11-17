# Barcode label tebal dengan alias angka

Label baru memakai alias unik 6 digit untuk garis Code128 C dengan narrow bar 2 dot. Teks di bawah garis tetap kode produk lengkap (`fields.barcode`, misalnya AJ00013447); SKU, barcode utama dan barcode legacy di database tidak diganti. Label lama tetap dapat dipindai.

## Pemetaan dan keamanan transaksi

- Migration `0033_inventory_label_alias` menambahkan counter per organisasi. Alias disimpan di `item_barcodes` dengan `barcode_format=code128-c-short-v1`, `source=system_generated`, aktif dan bukan primary.
- Alias dibuat otomatis saat cetak pertama, termasuk cetak batch hasil import. Reprint memakai alias yang sama; tidak perlu mengisi kode tambahan atau import ulang.
- Counter dikunci per organisasi sebelum item dikunci. Alias dan job dibuat pada transaksi database yang sama. Request paralel/idempotent tidak menghasilkan beberapa alias untuk satu item.
- Nilai 000001–999999 dipakai tanpa perulangan. Counter tidak ikut dihapus saat item dihapus, sehingga nomor dari label yang sudah pernah dicetak tidak dialokasikan lagi. 000000 hanya untuk fixture/Test Label.
- Alokasi melewati barcode aktif/nonaktif, SKU, barcode utama, QR value dan serial number yang sudah ada. Constraint namespace barcode menjadi pengaman terakhir terhadap import legacy bersamaan. Alias nonaktif tidak diganti secara diam-diam. Counter yang habis menghasilkan error, tanpa menyingkat angka atau mengubah produk.
- POS, pencarian inventaris, dan pencarian produk buyback memakai pemetaan alias yang sudah ada. Batas outlet/organisasi/status tetap berlaku.

## Kontrak cetak

Payload baru memakai template `jewelry_barbell_alias_v4`, templateVersion 4, printerProfileId `sato_cg408_jewelry_barbell_alias_v4`. `fields.labelBarcode` wajib tepat enam digit string, sehingga leading zero tetap utuh; `fields.barcode` tetap nomor produk yang terlihat.

Hub memakai native SBPL `BG02041>I` di posisi barcode V3 yang sama. Code128 C berisi start + tiga pasangan digit + checksum + stop = 68 modul. Dengan narrow bar 2 dot dan quiet zone 10 modul/sisi, lebarnya 136 + 40 = 176 dot (22 mm), muat pada panel 182 dot (22,75 mm). Tidak ada resize atau pelebaran bitmap yang menutup celah barcode.

Konfigurasi V3 dan hash acceptance fisiknya tidak disentuh. Varian V4 memiliki renderer dan metadata sendiri, dengan `physicalValidation=pending_outlet_test` serta hash geometri dasar V3. Dukungan V3 tetap tersedia untuk antrean lama. Heartbeat mengiklankan `supported_label_templates`; target yang belum mendukung V4 tidak menerima job baru varian ini dari alur cetak produk.

## Rollout

1. Build installer 0.9.7 melalui GitHub CI. Tag release: `hardware-hub-v0.9.7` setelah perubahan masuk `main`.
2. Upgrade Hub dengan account Windows yang sama. Pairing, journal dan pengaturan printer mengikuti mekanisme upgrade existing.
3. Jalankan migration RMS melalui prosedur deployment existing, lalu deploy web terbaru. Hanya counter baru yang dibuat; tidak ada backfill massal atau penggantian barcode produk.
4. Tunggu heartbeat Hub baru, lalu cetak ulang satu produk dan pindai dengan webcam POS. Cocokkan nama, kode dan item yang masuk keranjang. Cetak/scan fisik tetap perlu dilakukan di toko.
5. Label baru membutuhkan reprint agar garisnya berubah. Label yang sudah tercetak tetap dapat dipakai melalui barcode sebelumnya.

## Verifikasi

- `npm run test:inventory:label-alias:local`: database PostgreSQL disposable, alokasi paralel, reprint, benturan identifier, scope, batas nomor, penghapusan item, rollback dan job idempotent.
- `npm run check:inventory-label`: kontrak payload lama/baru, format alias, dan decoding pola digital Code128 C pada ukuran dot yang direncanakan.
- `npm --prefix hardware-hub run check:ci`: adapter mock, journal/recovery, kompatibilitas V3, dan Windows renderer asli yang menghasilkan file SBPL tanpa mengirim ke printer.

Tes software tidak menyatakan hasil cetak fisik sudah lolos.

Referensi: [SATO E/Pro Programming Reference, bagian Code128 BG](https://www.satoamerica.com/content/dam/sato/sales/content/us/en/support-downloads/printers/industrial-printers/m84pro-series/operator---technical-manuals/E-Pro-Programming-Reference.pdf.coredownload.inline.pdf).
