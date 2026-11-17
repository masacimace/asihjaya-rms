# Label pudar dan sulit dipindai kamera web

## Temuan

Kasus uji: `AJ00011160`, kamera web, teks nama/gram ikut pudar.
Renderer menghasilkan BMP monokrom untuk teks dan barcode native Code128 Set B
melalui RAW Winspool. Sebelum 0.9.6, Hub tidak menetapkan kepekatan atau kecepatan
cetak, sehingga memakai kondisi/pengaturan printer yang sedang aktif.

Panel depan pada config saat ini selebar 182 dot. Untuk 10 karakter Set B,
barcode membutuhkan 145 modul. Dengan quiet zone 10 modul/sisi, totalnya 165 dot
pada modul 1 dot. Pada 2 dot totalnya menjadi 330 dot, sehingga tidak muat.
Perbaikan menangani kepekatan cetak dan tangkapan kamera sambil mempertahankan
ukuran serta isi label. Nomor tidak disingkat, celah barcode tidak ditutup lewat
penebalan bitmap, dan tidak ada refreeze penerimaan fisik baru.

## Perubahan 0.9.6

- Baseline CG408: darkness 4/5 dan speed 2 ips (sekitar 50 mm/detik).
- Perintah SBPL `CS` dan `#E` masing-masing berada di frame `A...Z` tersendiri,
  sebelum label asli dalam satu RAW dispatch. Frame konfigurasi tidak berisi `Q`.
- Hanya label pertama yang berhasil dikirim pada tiap sesi/printer yang memasang
  baseline tersebut. Persiapan tanpa dispatch tidak mengubah printer atau cache.
  Pengiriman berikutnya memakai byte renderer asli tanpa menulis konfigurasi
  persisten lagi. Pengaman journal/ACK dan unknown outcome tetap berlaku.
- Konfigurasi V3 dan hash geometrinya tidak berubah. Metadata print quality
  secara terpisah berstatus `pending_outlet_test`; penerimaan fisik baru belum
  dinyatakan lulus oleh software.
- Web meminta resolusi ideal 1920×1080 dan continuous autofocus jika didukung.
  Jika fitur fokus ditolak/tidak tersedia, stream tetap berjalan. Kamera yang
  hanya mendukung resolusi lebih rendah boleh memilih resolusi yang tersedia.

## Rollout dan pengujian outlet

1. Deploy RMS terbaru untuk perbaikan kamera.
2. Build installer Hub dengan tag `hardware-hub-v0.9.6` setelah commit masuk
   `main`, lalu upgrade memakai Windows account semula.
3. Cetak ulang satu label `AJ00011160`. Baseline berlaku sebelum label pertama
   dikirim; tidak ada migration atau import ulang produk.
4. Periksa teks dan garis utuh/pekat, lalu pindai dengan webcam hingga hasil
   pencarian menunjuk item yang sama. Dekatkan label hingga memenuhi bingkai,
   tahan stabil dan hindari pantulan cahaya.
5. Jika seluruh label tetap pudar, cek kecocokan dan pemasangan ribbon/media
   serta bersihkan printhead/platen sesuai panduan SATO. Matikan dan cabut daya
   printer serta tunggu head dingin sebelum membersihkan. Software tidak dapat
   memperbaiki ribbon yang tidak sesuai atau printhead yang bermasalah.

Override di `.env` Hub (kemudian restart Hub):

```dotenv
SATO_PRINT_DARKNESS=4
SATO_PRINT_SPEED_IPS=2
```

Darkness valid 0–5; speed valid 0, 2, 3, 4. Nilai 0 berarti tidak mengirim
perubahan untuk field tersebut, bukan reset ke nilai sebelumnya/pabrik.
Perintah konfigurasi bersifat persisten di printer. Installer menjaga nilai
custom yang sudah tersimpan; pengaturan dapat ditinjau melalui diagnostics.

## Referensi dan verifikasi

- [SATO E/Pro Programming Reference, model CG408/412, bagian CS dan #E](https://www.satoamerica.com/content/dam/sato/sales/content/us/en/support-downloads/printers/industrial-printers/m84pro-series/operator---technical-manuals/E-Pro-Programming-Reference.pdf.coredownload.inline.pdf)
- [SATO CG4 Operator Manual, bagian 5.5 Adjusting Print Quality](https://www.satoeurope.com/pdf/products/printers/sato-cg4-manual.pdf)
- [SATO CG4 — Bad Print Quality](https://sato-globalhelp.zendesk.com/hc/en-001/articles/40649131358361-CG4-Bad-Print-Quality)

`npm --prefix hardware-hub run check:ci` memeriksa konfigurasi, byte RAW tetap
utuh, penerapan baseline sekali per sesi, fallback printer-managed, pengamanan
dispatch dan upgrade installer. `npm run check:camera-scanner` memeriksa jalur
autofocus didukung/tidak didukung/ditolak. Tes ini tidak mencetak ke printer fisik.
