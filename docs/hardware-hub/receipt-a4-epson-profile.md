# Receipt A4 dan Epson EcoTank L3251 Print Profile

**Status:** implemented dan simulation-tested; physical validation pending  
**Document profile default:** `receipt_a4_landscape_v1`  
**Print profile default:** `epson_l3251_a4_v1`

## Tujuan

PR 8 mengubah receipt baru dari A5 landscape menjadi A4 landscape tanpa mendesain ulang nota. Struktur, warna, border, tipografi, dan hierarki visual lama dipertahankan.

Canvas desain lama tetap berukuran:

```text
210 × 148 mm
```

Untuk profile A4, canvas tersebut diskalakan secara proporsional ke:

```text
297 × 210 mm
```

A4 dan A5 mengikuti rasio ISO 216 yang sama, sehingga komposisi desain tidak mengalami distorsi.

## Pemisahan profile

Document profile mengatur PDF yang dirender server:

```text
receipt_a5_landscape_v1
receipt_a4_landscape_v1
```

Print profile mengatur cara agent menyerahkan PDF ke Windows printer driver:

```text
receipt_a5_v1
receipt_a4_v1
epson_l3251_a4_v1
```

Job baru menggunakan:

```json
{
  "documentProfileId": "receipt_a4_landscape_v1",
  "printProfileId": "epson_l3251_a4_v1",
  "copies": 1
}
```

Job lama tanpa `documentProfileId` dan dengan `receipt_a5_v1` tetap didukung.

## SumatraPDF command

Executable ditentukan oleh konfigurasi lokal:

```env
DOCUMENT_PRINTER_NAME=EPSON L3250 Series
PDF_PRINT_EXECUTABLE=C:\Program Files\SumatraPDF\SumatraPDF.exe
```

Agent membentuk argument secara deterministik:

```text
-print-to <printer>
-print-settings paper=A4,fit,color,simplex,ignore-pdf-print-settings
-silent
<file.pdf>
```

Payload tidak boleh menentukan executable atau raw argument. `PDF_PRINT_ARGS_JSON` dan `PDF_PRINT_COMMAND` hanya tersedia untuk compatibility flow lama dan sebaiknya dikosongkan.

## PDF validation

Sebelum dispatch, agent memeriksa:

- file dimulai dengan `%PDF`;
- file tidak kosong dan berada di bawah batas payload;
- jumlah halaman dapat dibaca;
- setiap page `/MediaBox` sesuai profile A4/A5 dengan toleransi yang aman;
- `documentProfileId` cocok dengan `printProfileId`;
- download tetap same-origin, berada di allowlist path, dan lolos SHA-256 jika hash disediakan.

Server juga menjalankan PDF contract validation setelah Playwright selesai merender.

## Rendering di server

Renderer menggunakan satu Chromium browser yang dipakai ulang, dengan batas concurrency dan timeout:

```env
PDF_RENDER_MAX_CONCURRENCY=2
PDF_RENDER_TIMEOUT_MS=30000
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=
```

Docker runtime menggunakan image Playwright Noble yang menyertakan browser runtime dan font yang konsisten. Versi package Playwright dan base image dipin agar tetap selaras.

## Preview dan automated check

Preview admin menyediakan A4 sebagai default serta tautan A5 legacy.

Jalankan contract check:

```bash
npm run check:hardware:v2-receipt-a4
```

Untuk mempertahankan PDF hasil test:

```bash
npx tsx scripts/check-hardware-receipt-a4.tsx --keep-output
```

Output lokal:

```text
.data/receipt-contract-output/
```

Fake adapter menyimpan PDF serta metadata profile di:

```text
hardware-hub/data/fake-output/document_printer/{jobId}/{attemptId}/
```

## Acceptance sebelum outlet

Development dianggap lulus bila:

1. PDF A4 landscape berhasil dibuat.
2. `/MediaBox` seluruh halaman sesuai A4 landscape.
3. PDF A5 legacy tetap lolos.
4. Profile yang tidak dikenal ditolak.
5. Mismatch document/print profile ditolak.
6. Command SumatraPDF tidak berasal dari raw payload.
7. Fake artifact hanya dibuat satu kali per attempt.
8. ACK-lost dan crash recovery tidak mengulang dispatch.
9. Long receipt tidak mengalami clipping atau overlap pada visual inspection.
10. Docker build dan PDF render berjalan pada staging.

## Physical validation di outlet

Hal berikut belum dapat disahkan tanpa Epson L3251 fisik:

- exact Windows printer name;
- printable margin aktual;
- apakah driver menghormati `paper=A4` dan `fit`;
- orientasi landscape pada driver;
- hasil warna dan ketajaman;
- kecepatan cetak;
- perilaku saat printer offline, kertas habis, atau spooler tersangkut;
- ACK-lost setelah job masuk Windows spooler.

Gunakan satu transaksi pendek dan satu transaksi panjang saat physical acceptance test. Jangan mengubah profile production sebelum hasil keduanya disetujui.
