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

Secret protector menjalankan protect–unprotect self-test **sebelum heartbeat dan claim pertama**. Jika DPAPI tidak sehat, agent keluar dengan code `78` dan tidak mengambil job dari cloud. Ini mencegah job terlanjur `claimed` sebelum lease token dapat disimpan secara aman.

Default executable:

```env
HARDWARE_POWERSHELL_EXECUTABLE=powershell.exe
```

Ubah hanya bila instalasi Windows menggunakan executable PowerShell pada path lain.

Jangan menghapus database journal ketika masih ada attempt aktif. Journal menyimpan bukti bahwa command mungkin sudah dikirim ke printer.

File runtime berikut tidak boleh masuk Git:

```text
hardware-hub/data/
hardware-hub/dry-run-output/
hardware-hub/logs/
```

### 4. Cek DPAPI, konfigurasi, dan recovery test

Jalankan DPAPI check menggunakan Windows user yang sama dengan Scheduled Task agent:

```powershell
npm run check:dpapi
```

Hasil yang diharapkan:

```text
Round-trip test    : OK
OK: Windows DPAPI siap dipakai Hardware Hub Protocol v2.
```

Lanjutkan dengan:

```powershell
npm run check
npm run check:v2
```

`npm run check` juga menjalankan secret protector startup self-test. Apabila check ini gagal, jangan start agent dan jangan klik test hardware terlebih dahulu.

Dari root repository:

```powershell
npm run check:hardware:v2-agent
```

`check:v2` menguji skenario berikut dengan fake printer:

- HTTP response hilang setelah server menyimpan event `submitted`.
- Agent restart setelah `dispatch_started_at`.
- Payload hash mismatch.
- Recovery tidak menjalankan physical dispatch untuk kedua kalinya.

### 5. Development tanpa hardware fisik

Gunakan fake adapter, bukan printer Windows:

```env
HARDWARE_ADAPTER_MODE=fake
LABEL_PRINTER_ADAPTER=fake
DOCUMENT_PRINTER_ADAPTER=fake
CASH_DRAWER_ADAPTER=fake
FAKE_HARDWARE_SCENARIO=success
FAKE_HARDWARE_OUTPUT_DIR=./data/fake-output
```

Fake adapter tetap menjalankan claim, lease, payload hash, SQLite journal, download PDF, dispatch marker, submitted, dan acknowledgement. Perbedaannya hanya tindakan fisik diganti dengan artifact:

```text
data/fake-output/
├── label_printer/{jobId}/{attemptId}/label.sbpl
├── document_printer/{jobId}/{attemptId}/document.pdf
└── cash_drawer/{jobId}/{attemptId}/drawer.json
```

Setiap artifact dibuat secara eksklusif. Apabila attempt yang sama melakukan dispatch kedua kali, agent menghasilkan `FAKE_DUPLICATE_DISPATCH_DETECTED` sehingga duplicate execution tidak tersembunyi.

Jalankan harness otomatis:

```powershell
npm run check:simulation
```

Simpan hasil simulasi untuk diperiksa:

```powershell
npm run simulate:v2
```

Output tersimpan pada `data/simulation-<timestamp>/` dan mencakup report JSON serta artifact tiap skenario.

Skenario yang didukung:

```text
success
fail_before_dispatch
timeout_before_dispatch
printer_not_found
slow_execution
unknown_after_dispatch
crash_after_dispatch
success_then_ack_lost
```

Skenario global dapat diganti melalui `FAKE_HARDWARE_SCENARIO`. Override per perangkat tersedia melalui:

```env
FAKE_LABEL_SCENARIO=
FAKE_DOCUMENT_SCENARIO=
FAKE_CASH_DRAWER_SCENARIO=
FAKE_HARDWARE_DELAY_MS=250
```

Untuk pengaturan per job atau job type, salin `fake-plan.example.json`, lalu isi:

```env
FAKE_HARDWARE_PLAN_PATH=./fake-plan.json
```

File plan dibaca ulang ketika berubah, sehingga skenario dapat diganti tanpa restart agent.

`crash_after_dispatch` secara default melempar simulated crash ke poll loop, lalu recovery berikutnya mengubah job menjadi `unknown_outcome`. Untuk menguji restart process nyata:

```env
FAKE_EXIT_ON_CRASH=true
```

Agent akan keluar dengan exit code `86` setelah fake dispatch. Scheduled Task atau developer dapat menjalankan ulang agent untuk memverifikasi startup recovery.

`HARDWARE_DRY_RUN=true` masih didukung sebagai compatibility mode, tetapi konfigurasi adapter fake di atas lebih eksplisit dan disarankan.

Buka Admin → Operasional → Hardware Hub. Agent harus terlihat online dan capability fake tetap tersedia seperti perangkat production.

### 6. Troubleshooting DPAPI

Apabila muncul error seperti:

```text
Unable to find type [Security.Cryptography.ProtectedData]
```

Pastikan file hotfix sudah diterapkan, lalu jalankan:

```powershell
npm run check:dpapi
npm run check
```

Hotfix memuat assembly `System.Security.Cryptography.ProtectedData` dengan fallback ke `System.Security`, lalu menggunakan fully-qualified type name.

Jika self-test masih gagal:

1. Pastikan command dijalankan pada Windows, bukan WSL.
2. Pastikan `powershell.exe` dapat dijalankan oleh account tersebut.
3. Pastikan Scheduled Task dan command manual memakai Windows user yang sama.
4. Jangan menghapus SQLite journal untuk memaksa recovery.
5. Setelah self-test sukses, restart agent; attempt yang sebelumnya diklaim akan diproses oleh lease recovery cloud/local sesuai state-nya.

### 7. Startup task

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

Receipt baru menggunakan layout A4 landscape tanpa mengubah identitas desain A5 lama. Canvas desain 210 × 148 mm dipertahankan lalu diskalakan secara proporsional ke halaman A4 297 × 210 mm.

Konfigurasi Windows yang disarankan:

```env
DOCUMENT_PRINTER_NAME=EPSON L3250 Series
PDF_PRINT_EXECUTABLE=C:\Program Files\SumatraPDF\SumatraPDF.exe
PDF_PRINT_ARGS_JSON=
PDF_PRINT_COMMAND=
```

Protocol v2 hanya mengirim ID profile yang sudah diizinkan. Agent membentuk command SumatraPDF sendiri dengan `spawn(..., { shell: false })` dan setting deterministik.

Profile aktif:

```text
receipt_a5_v1          -> receipt_a5_landscape_v1  (legacy)
receipt_a4_v1          -> receipt_a4_landscape_v1  (compatibility)
epson_l3251_a4_v1      -> receipt_a4_landscape_v1  (default job baru)
```

Setting Epson A4 awal:

```text
paper=A4,fit,color,simplex,ignore-pdf-print-settings
```

`PDF_PRINT_ARGS_JSON` dan `PDF_PRINT_COMMAND` hanya dipertahankan untuk compatibility job lama. Payload v2 tidak dapat menentukan executable, raw command, atau raw print settings.

Validasi sebelum dispatch mencakup header `%PDF`, jumlah halaman, ukuran file, serta `/MediaBox` A4/A5 sesuai profile. Physical margin, scaling driver, dan hasil warna tetap harus divalidasi di outlet.

Panduan lengkap:

```text
docs/hardware-hub/receipt-a4-epson-profile.md
```

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

## Production Windows operations

PR 7 adds production operational tooling:

```powershell
npm run setup:production
npm run status
npm run health
npm run support:bundle
```

The agent now uses:

- structured rotating JSONL logs;
- a process lock preventing duplicate agent instances;
- an atomic local health-state file;
- loopback `/health` and `/ready` endpoints;
- a redacted support-bundle exporter;
- a Scheduled Task action pinned to the absolute `node.exe` path.

Operational configuration:

```env
HARDWARE_LOG_DIR=./logs
HARDWARE_LOG_LEVEL=info
HARDWARE_LOG_RETENTION_DAYS=30
HARDWARE_LOG_MAX_FILE_MB=20
HARDWARE_LOG_MAX_FILES=90
HARDWARE_LOCK_PATH=./data/agent.lock
HARDWARE_HEALTH_STATE_PATH=./data/health-state.json
HARDWARE_HEALTH_SERVER_ENABLED=true
HARDWARE_HEALTH_SERVER_HOST=127.0.0.1
HARDWARE_HEALTH_SERVER_PORT=3210
```

The health server must remain loopback-only. Full operating procedures are documented in:

```text
docs/hardware-hub/windows-production-operations.md
```
