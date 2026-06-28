# TODO — SATO Label Physical Tuning

Dokumen ini dipakai sebagai pengingat saat printer SATO fisik sudah tersedia di Mini PC outlet.

Status saat ini:

- Hardware Hub agent sudah bisa heartbeat, claim job, retry, recovery, cleanup, dry-run, dan startup task.
- Label SATO sudah bisa diproses lewat `print_label_sato`.
- Dry-run label sudah berhasil membuat output di `hardware-hub/dry-run-output`.
- Testing fisik printer SATO belum dilakukan karena hardware belum tersedia.

## Tujuan testing fisik

Memastikan hasil label dari SATO CG408TT:

- tercetak di posisi yang benar,
- tidak kepotong kiri/kanan/atas/bawah,
- barcode bisa discan,
- ukuran teks terbaca,
- jarak antar baris rapi,
- jumlah copy sesuai,
- nama printer/share Windows sesuai dengan konfigurasi Hardware Hub.

## Konfigurasi yang perlu dicek

File:

```env
hardware-hub/.env
```

Pastikan minimal berisi:

```env
HARDWARE_DRY_RUN=false
LABEL_PRINTER_NAME=SATO-CG408TT
LABEL_PROFILE=jewelry_compact
LABEL_COPIES=1
LABEL_LEFT_OFFSET_DOTS=0
LABEL_TOP_OFFSET_DOTS=0
LABEL_INCLUDE_PRICE=false
```

Catatan:

- `LABEL_PRINTER_NAME` harus mengikuti **share name** printer di Windows, bukan selalu display name.
- Kalau share name berbeda, sesuaikan value `LABEL_PRINTER_NAME`.
- Untuk test awal, gunakan `LABEL_INCLUDE_PRICE=false` dulu.

## Checklist setup Windows printer

- [ ] Driver SATO CG408TT sudah terinstall.
- [ ] Printer bisa print test page dari Windows.
- [ ] Printer sudah di-share.
- [ ] Share name printer sudah dicatat.
- [ ] `LABEL_PRINTER_NAME` di `.env` sama dengan share name printer.
- [ ] Hardware Hub dijalankan oleh Windows user yang sama dengan user yang punya akses printer.
- [ ] `npm run check` di folder `hardware-hub` berhasil.
- [ ] Agent muncul `Online` di `/admin/operasional/hardware`.

## Cara test print label fisik

Dari project root, jalankan web app:

```bash
npm run dev
```

Dari folder `hardware-hub`, jalankan agent:

```bash
npm start
```

Lalu test dari dashboard:

```txt
/admin/operasional/hardware
→ Test Label
```

Setelah itu test dari item inventory:

```txt
/admin/inventaris/item/[itemId]
→ Cetak Label
```

Expected result:

- [ ] Job masuk ke `hardware_jobs`.
- [ ] Agent claim job.
- [ ] Job status menjadi `completed`.
- [ ] Label tercetak di printer SATO.
- [ ] Recent jobs tidak menampilkan error printer.

## Cara tuning offset

Gunakan dua env ini:

```env
LABEL_LEFT_OFFSET_DOTS=0
LABEL_TOP_OFFSET_DOTS=0
```

Panduan:

| Masalah hasil print | Yang diubah |
|---|---|
| Label terlalu ke kiri | Naikkan `LABEL_LEFT_OFFSET_DOTS` |
| Label terlalu ke kanan | Turunkan `LABEL_LEFT_OFFSET_DOTS` |
| Label terlalu ke atas | Naikkan `LABEL_TOP_OFFSET_DOTS` |
| Label terlalu ke bawah | Turunkan `LABEL_TOP_OFFSET_DOTS` |

Mulai dengan perubahan kecil:

```env
LABEL_LEFT_OFFSET_DOTS=10
LABEL_TOP_OFFSET_DOTS=10
```

Lalu naik/turunkan bertahap:

```txt
0 → 10 → 20 → 30
atau
0 → -10 → -20 → -30
```

Setelah mengubah `.env`, restart agent:

```bash
npm start
```

atau kalau memakai startup task:

```powershell
Get-ScheduledTask -TaskName "Asihjaya Hardware Hub Agent" | Stop-ScheduledTask
Get-ScheduledTask -TaskName "Asihjaya Hardware Hub Agent" | Start-ScheduledTask
```

## Checklist hasil akhir

- [ ] Label tidak terpotong.
- [ ] Barcode bisa discan scanner POS.
- [ ] SKU terbaca jelas.
- [ ] Nama produk cukup terbaca.
- [ ] Berat/kadar/kadar tukar terbaca jelas.
- [ ] Label tidak terlalu padat.
- [ ] `LABEL_LEFT_OFFSET_DOTS` final dicatat.
- [ ] `LABEL_TOP_OFFSET_DOTS` final dicatat.
- [ ] `.env` Mini PC outlet sudah memakai value final.
- [ ] Jika perlu harga di label, test ulang dengan `LABEL_INCLUDE_PRICE=true`.

## Value final hasil testing

Isi setelah test fisik selesai:

```env
LABEL_PRINTER_NAME=
LABEL_PROFILE=jewelry_compact
LABEL_COPIES=1
LABEL_LEFT_OFFSET_DOTS=
LABEL_TOP_OFFSET_DOTS=
LABEL_INCLUDE_PRICE=false
```

Tanggal test:

```txt
Belum dites fisik
```

Catatan hasil test:

```txt
Belum ada catatan. Menunggu printer SATO fisik tersedia.
```

## Catatan roadmap

Testing fisik SATO boleh ditunda sementara karena fitur berikut sudah bisa dilanjutkan tanpa hardware fisik:

- Shift closing dan cash reconciliation.
- Laporan penjualan.
- Customer selection di POS.
- Void/refund flow.
- WhatsApp/report automation.

Jangan lupa kembali ke dokumen ini sebelum deployment outlet final.
