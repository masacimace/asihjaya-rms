# ASIHJAYA Receipt Print Plan B — A5 kertas polos

## Tujuan

Dua mode cetak **fisik**, per outlet, berbagi satu renderer untuk Sale dan Buyback:

- `preprinted_overlay` — data dinamis pada kertas vendor, A5 landscape `noscale`.
- `full_design_front_only` — desain lengkap pada kertas A5 polos, A5 landscape `fit`.

Keduanya tetap **satu halaman depan per item**. Tiga item = tiga halaman depan = tiga lembar A5 dengan simplex. File digital `full_design` yang memiliki halaman belakang tidak berubah.

## Perubahan operasional

Buka `/admin/operasional/hardware` → **Pengaturan Cetak Nota** → pilih outlet → **Ubah Mode Cetak**. Hanya admin dengan izin `hardware.agents.manage` boleh mengganti. Sistem meminta konfirmasi jenis kertas dan memperlihatkan jumlah job nota aktif.

Pilihan disimpan pada `outlets.receipt_print_mode`. Bila `NULL`, server membaca `RECEIPT_PRINT_MODE`, dan jika env kosong memilih `preprinted_overlay`. Perubahan dashboard membaca database pada **setiap pembuatan job baru**, tidak memerlukan restart Next.js ataupun Hardware Hub. Semua job menyimpan `metadata.renderMode` dan URL PDF yang permanen; mengganti dashboard tidak mengubah job lama.

Perhatikan antrian lama, karena job lama tetap bisa masuk ke printer dengan jenis kertas yang berbeda. Persiapkan kertas sebelum mengganti mode. Pengaturan **tidak** memindahkan kertas secara otomatis.

## A5 Epson / Hardware Hub

Protokol Hardware Job v2 dan Hardware Hub 0.9.3 memakai profil cetak A5 existing `receipt_a5_v1`; agent memilih `epson_l3251_a5_preprinted_v1` (`noscale`) *hanya* saat metadata render mode `preprinted_overlay`. Mode polos otomatis memakai profil A5 standar (`fit`). Tidak perlu update installer jika tes integrasi/print fisik lulus. Printer bersifat simplex; tidak ada duplex otomatis.

## UAT wajib

1. Backup database, apply migration `0030_receipt_print_mode` sebelum menjalankan app baru.
2. `npm run typecheck`, `npm run lint`, `npm run check:receipt-pdf`.
3. `npx tsx scripts/check-hardware-job-payloads.ts`, `npx tsx scripts/check-receipt-print-plan-b.ts`.
4. Dari dashboard ubah mode outlet A ke polos, cek checkout Sale 1/3 item + Buyback 1/3 item dan reprint; periksa halaman, nominal dan QR.
5. Buat job overlay yang belum selesai, ubah dashboard ke polos: job lama harus tetap overlay.
6. Cetak kertas A5 polos dengan Epson L3250 Series; cek frame luar tidak terpotong oleh driver. Kembalikan ke overlay dan periksa foto, QR, pembayaran serta label static vendor.
7. Uji outlet B tidak ikut berubah, serta akses user tanpa `hardware.agents.manage` tidak bisa menulis konfigurasi.

## Rollback

Pilih kembali `preprinted_overlay` di dashboard. Ini berlaku bagi job *baru*; telaah/selesaikan job lama sebelum mengganti kertas. Migration hanya menambah kolom nullable sehingga versi server lama tidak membaca field tersebut.

## Catatan pemasangan paket

Paket ZIP berisi `apply-receipt-print-plan-b.mjs` karena file existing pada PC mungkin berbeda dari GitHub. Script menjalankan penggantian source dengan anchor yang diverifikasi **tanpa** menjalankan migrasi atau mengubah Git/production. Jalankan sekali dari root. Jika ada anchor berbeda, script berhenti tanpa menulis source; lakukan review manual. Jangan melakukan push sebelum pengujian.
