# Asihjaya Hardware Hub Agent

Hardware Hub Agent berjalan pada Mini PC Windows outlet. Agent melakukan heartbeat, mengambil hardware job dari cloud, mencatat execution attempt ke SQLite, lalu menjalankan printer atau cash drawer lokal.

Protocol v2 dirancang agar restart agent atau putus internet setelah printer menerima command tidak menyebabkan automatic reprint.

## Runtime

Protocol v2 memakai built-in `node:sqlite` dan membutuhkan:

```text
Node.js >= 22.5 dan < 25
```

Cek runtime:

```powershell
node -v
npm -v
```

## Setup Windows

### 1. Siapkan folder

```powershell
cd C:\Asihjaya\hardware-hub
npm install --omit=dev
copy .env.example .env
```

Isi `ASIHJAYA_API_URL`, `HARDWARE_AGENT_ID`, dan `HARDWARE_AGENT_SECRET`. Credential agent dibuat dari root web app:

```powershell
npm run hardware:agent:create
```

### 2. Pilih mode protocol

```env
HARDWARE_PROTOCOL_MODE=v2-preferred
```

Pilihan:

- `v2-preferred`: recovery dan claim v2 terlebih dahulu, lalu fallback ke queue v1 ketika queue v2 kosong.
- `v2-only`: hanya memproses Protocol v2.
- `v1-only`: compatibility mode tanpa SQLite journal.

Gunakan `v2-preferred` selama rollout bertahap. Ubah ke `v2-only` setelah semua job producer dan outlet sudah memakai Protocol v2.

### 3. Execution journal

```env
HARDWARE_JOURNAL_PATH=./data/hardware-executions.sqlite
HARDWARE_JOURNAL_KEY_PATH=./data/hardware-journal.key
HARDWARE_TEMP_DIR=./data/temp
LEASE_RENEW_INTERVAL_MS=20000
```

Pada Windows, lease token di database dilindungi memakai DPAPI `CurrentUser`. Agent harus selalu dijalankan oleh Windows account yang sama. Mengganti account dapat membuat lease token attempt lama tidak dapat dibuka.

Jangan menghapus database journal ketika masih ada attempt aktif. Journal menyimpan bukti bahwa command mungkin sudah dikirim ke printer.

File runtime berikut tidak boleh masuk Git:

```text
hardware-hub/data/
hardware-hub/dry-run-output/
hardware-hub/logs/
```

### 4. Cek konfigurasi dan recovery test

```powershell
npm run check
npm run check:v2
```

Dari root repository:

```powershell
npm run check:hardware:v2-agent
```

`check:v2` menguji skenario berikut dengan fake printer:

- HTTP response hilang setelah server menyimpan event `submitted`.
- Agent restart setelah `dispatch_started_at`.
- Payload hash mismatch.
- Recovery tidak menjalankan physical dispatch untuk kedua kalinya.

### 5. Test manual

Mulai dengan dry-run:

```env
HARDWARE_DRY_RUN=true
```

```powershell
npm start
```

Buka Admin → Operasional → Hardware Hub. Agent harus terlihat online. File hasil dry-run tersedia di `dry-run-output`.

### 6. Startup task

```powershell
npm run install:startup
```

Task berjalan pada Windows user logon agar printer yang terpasang pada user tersebut tetap terlihat. Gunakan account Windows khusus outlet dan jangan menjalankan task bergantian melalui user berbeda karena DPAPI journal terikat pada user.

Buka log:

```powershell
npm run logs
```

Hapus startup task:

```powershell
npm run uninstall:startup
```

## Crash-safe lifecycle

Alur normal Protocol v2:

```text
claim
→ journal: claimed
→ server: processing
→ prepare file/command
→ server: dispatching
→ journal: dispatch_started_at
→ physical command
→ journal: submitted
→ server: submitted
→ server: acknowledged/completed
→ journal: acknowledged
```

Recovery rules:

- `claimed` atau `processing` tanpa dispatch marker dapat dilanjutkan selama lease aktif.
- `dispatching` tanpa dispatch marker dapat disiapkan ulang dan dijalankan.
- `dispatch_started_at` tanpa `submitted` menjadi `unknown_after_dispatch`; agent tidak mencetak ulang.
- `submitted` tanpa HTTP ACK dikirim ulang sebagai event yang sama; printer tidak dijalankan lagi.
- Lease expired sebelum dispatch ditinggalkan untuk direqueue oleh cloud.

`completed` berarti agent dan cloud menyelesaikan acknowledgement bahwa command diterima runner/spooler. Status tersebut bukan jaminan bahwa kertas fisik sudah keluar sempurna.

## Label SATO

Konfigurasi:

```env
LABEL_PRINTER_NAME=SATO CG408TT
LABEL_PROFILE=jewelry_compact
LABEL_COPIES=1
LABEL_LEFT_OFFSET_DOTS=0
LABEL_TOP_OFFSET_DOTS=0
LABEL_INCLUDE_PRICE=false
```

Raw print saat ini memakai Windows printer share:

```text
\\localhost\NAMA_SHARE_PRINTER
```

Gunakan share name dari Printer Properties → Sharing.

## Document printer

Konfigurasi baru yang disarankan menggunakan executable dan argument array, bukan satu shell command:

```env
DOCUMENT_PRINTER_NAME=EPSON L3250 Series
PDF_PRINT_EXECUTABLE=C:\Program Files\SumatraPDF\SumatraPDF.exe
PDF_PRINT_ARGS_JSON=["-print-to","{printer}","-silent","{file}"]
```

Token berikut diganti agent:

```text
{printer}
{file}
```

`PDF_PRINT_COMMAND` masih didukung untuk kompatibilitas, tetapi menghasilkan warning dan sebaiknya dimigrasikan.

Protocol tidak mengunci ukuran kertas. Receipt A5 saat ini dan layout A4 berikutnya dipilih melalui `printProfileId`; penyesuaian A4 dilakukan pada tahap document-printer validation.

## Cash drawer

Konfigurasi awal:

```env
CASH_DRAWER_PRINTER_NAME=NAMA_SHARE_PRINTER_TRIGGER
```

Agent mengirim pulse ESC/POS melalui printer share. Fitur ini belum dianggap final sampai interface cash drawer fisik dipilih dan divalidasi.

## Troubleshooting journal

Lihat file:

```text
hardware-hub\data\hardware-executions.sqlite
hardware-hub\data\hardware-executions.sqlite-wal
hardware-hub\data\hardware-executions.sqlite-shm
```

Jangan mengedit file tersebut saat agent berjalan. Sebelum memindahkan Mini PC atau Windows account:

1. Stop agent.
2. Pastikan tidak ada job `submitted`, `dispatching`, atau pending event.
3. Simpan backup folder `data` untuk audit.
4. Lakukan perpindahan credential/journal melalui prosedur operasional, bukan dengan menghapus database secara langsung.
