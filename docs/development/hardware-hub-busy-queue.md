# Hardware Hub 0.9.5: ketahanan antrean saat ramai

Perubahan aplikasi RMS dan Hub mengurangi kegagalan akibat rate limit PDF,
server render sibuk, download lambat/terputus, dan printer yang lama merespons.

## Perilaku

- PDF dari Hub terautentikasi mendapat kuota terpisah: default 60 request/menit
  per agent dan 180/menit/IP. Download manual tetap 12/user dan 30/IP per menit.
  Antrean/concurrency renderer tetap dibatasi; kuota ini bukan jaminan throughput.
- HTTP 429/503 diterjemahkan menjadi `DOCUMENT_RATE_LIMITED` /
  `DOCUMENT_SERVER_BUSY`. Hub membaca `Retry-After` dalam detik atau HTTP-date
  (menggunakan header Date server untuk mengurangi pengaruh perbedaan jam).
  Tanpa hint valid, 429 menunggu 60 detik dan 503 menunggu 5 detik.
- Hint maksimum 15 menit. Jadwal retry di server memakai waktu yang lebih lama
  antara backoff biasa dan hint + margin 1 detik; jadwal tersimpan di database.
  Selama ada retry PDF tertunda karena server sibuk pada register tersebut, job
  PDF lain menunggu tanpa menghabiskan attempt. Label/drawer tetap claimable.
- Job nota baru memiliki 5 total attempt, label tetap 2 dan hardware test/drawer
  tetap 1. Job yang sudah ada mempertahankan budget semula. Retry otomatis hanya
  untuk kegagalan yang aman sebelum dispatch dan dibatasi expiry job.
- Deadline download PDF terpisah, default 90 detik: antrean render 15 detik,
  render 45 detik, plus margin koneksi/transfer. Deadline berlaku pada seluruh
  download, termasuk stream yang terus mengirim data kecil. PDF terputus atau
  gagal validasi dibersihkan dan tidak dikirim ke printer.
- Lease diperbarui selama perintah Windows print berjalan, lalu dihentikan saat
  dispatch selesai. Crash/timeout setelah dispatch tetap `unknown_after_dispatch`
  dan tidak dicetak ulang otomatis.
- Bila ACK penjadwalan ulang hilang, event terminal failure yang sama dapat
  diakui ulang setelah attempt dilepas. Kepemilikan agent, token, payload hash,
  sequence, status dan idempotency key tetap diverifikasi. Event baru dari
  attempt lama tetap ditolak dan tidak mengubah attempt berikutnya.
- Route PDF/media yang menerima sesi user memakai autentikasi Hub opsional.
  Request browser tanpa kredensial Hub tidak mengisi bucket kegagalan login
  agent; percobaan autentikasi Hub yang eksplisit tetap dikenai pembatasan.

## Konfigurasi dan rollout

Tidak ada migration database. Deploy RMS terlebih dahulu, lalu upgrade Hub ke
installer 0.9.5 menggunakan Windows account instalasi semula. Pairing, journal,
dan printer dipertahankan; installer mengatur deadline PDF baru otomatis.

Default server baru berlaku tanpa menambah `.env`. Override opsional:

```dotenv
PDF_RATE_LIMIT_HARDWARE_AGENT_REQUESTS=60
PDF_RATE_LIMIT_HARDWARE_IP_REQUESTS=180
```

Pada Hub: `DOCUMENT_DOWNLOAD_TIMEOUT_MS=90000` (valid 5000–300000 ms). Jika batas
render/antrean server diubah, sesuaikan deadline Hub agar mencakup keduanya dan
waktu transfer. Timeout claim/event/heartbeat tetap `REQUEST_TIMEOUT_MS`.

Build melalui workflow **Build Hardware Hub Installer**. `workflow_dispatch`
menghasilkan artifact UAT. Setelah commit sudah masuk `main`, tag
`hardware-hub-v0.9.5` menerbitkan GitHub Release berisi Setup.exe dan SHA-256
melalui workflow yang sudah tersedia. Source ini belum membangun atau menerbitkan
installer tersebut.

## Verifikasi

- `npm run test:financial:local`: handler HTTP bertanda tangan pada PostgreSQL 17
  disposable; burst nota/label, jadwal retry, cooldown PDF, ACK duplikat, fencing
  attempt/token, perpanjangan lease dispatching, serta isolasi kuota dan auth.
- `npm --prefix hardware-hub run check:ci`: journal/crash recovery, delayed ACK,
  lease saat dispatch lambat, simulasi hardware dan stream PDF terputus/lambat,
  HTTP 429/503, validasi PDF, serta upgrade installer.
- Typecheck, lint, hardware/security/environment checks dan kontrak release.

Pengujian tidak mengirim command ke printer fisik. Setelah deploy/upgrade,
smoke test tiga transaksi berdekatan dan batch label di outlet. Gangguan printer,
internet atau server yang berkepanjangan masih dapat menggagalkan job; job lama
yang gagal tidak diulang otomatis tanpa pemeriksaan hasil cetak.
