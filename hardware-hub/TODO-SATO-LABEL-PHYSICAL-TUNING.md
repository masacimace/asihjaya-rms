# TODO — SATO Label Physical Tuning

Dokumen ini dipakai sebagai pengingat saat printer SATO fisik sudah tersedia di Mini PC outlet.

Status saat ini:

- Hardware Hub agent sudah bisa heartbeat, claim job, retry, recovery, cleanup, dry-run, dan startup task.
- Label SATO sudah memakai deterministic generator, profile registry, dan golden tests.
- Fake adapter label menghasilkan `label.sbpl` dan metadata profile di `hardware-hub/data/fake-output`.
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
HARDWARE_ADAPTER_MODE=real
LABEL_PRINTER_ADAPTER=real
LABEL_PRINTER_NAME=SATO-CG408TT
LABEL_TEMPLATE_ID=jewelry_compact_v1
SATO_PRINTER_PROFILE=sato_cg408tt_jewelry_v1
SATO_COPIES=1
SATO_HORIZONTAL_OFFSET_DOTS=0
SATO_VERTICAL_OFFSET_DOTS=0
SATO_INCLUDE_PRICE=false
```

Catatan:

- `LABEL_PRINTER_NAME` harus mengikuti **share name** printer di Windows, bukan selalu display name.
- Kalau share name berbeda, sesuaikan value `LABEL_PRINTER_NAME`.
- Untuk test awal, gunakan `SATO_INCLUDE_PRICE=false` dulu.

## Checklist setup Windows printer

- [ ] Driver SATO CG408TT sudah terinstall.
- [ ] Printer bisa print test page dari Windows.
- [ ] Printer sudah di-share.
- [ ] Share name printer sudah dicatat.
- [ ] `LABEL_PRINTER_NAME` di `.env` sama dengan share name printer.
- [ ] Hardware Hub dijalankan oleh Windows user yang sama dengan user yang punya akses printer.
- [ ] `npm run check` dan `npm run check:sato` di folder `hardware-hub` berhasil.
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
SATO_HORIZONTAL_OFFSET_DOTS=0
SATO_VERTICAL_OFFSET_DOTS=0
```

Panduan:

| Masalah hasil print | Yang diubah |
|---|---|
| Label terlalu ke kiri | Naikkan `SATO_HORIZONTAL_OFFSET_DOTS` |
| Label terlalu ke kanan | Turunkan `SATO_HORIZONTAL_OFFSET_DOTS` |
| Label terlalu ke atas | Naikkan `SATO_VERTICAL_OFFSET_DOTS` |
| Label terlalu ke bawah | Turunkan `SATO_VERTICAL_OFFSET_DOTS` |

Mulai dengan perubahan kecil:

```env
SATO_HORIZONTAL_OFFSET_DOTS=10
SATO_VERTICAL_OFFSET_DOTS=10
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
- [ ] `SATO_HORIZONTAL_OFFSET_DOTS` final dicatat.
- [ ] `SATO_VERTICAL_OFFSET_DOTS` final dicatat.
- [ ] `.env` Mini PC outlet sudah memakai value final.
- [ ] Jika perlu harga di label, test ulang dengan `SATO_INCLUDE_PRICE=true`.

## Value final hasil testing

Isi setelah test fisik selesai:

```env
LABEL_PRINTER_NAME=
LABEL_TEMPLATE_ID=jewelry_compact_v1
SATO_PRINTER_PROFILE=sato_cg408tt_jewelry_v1
SATO_COPIES=1
SATO_HORIZONTAL_OFFSET_DOTS=
SATO_VERTICAL_OFFSET_DOTS=
SATO_INCLUDE_PRICE=false
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
