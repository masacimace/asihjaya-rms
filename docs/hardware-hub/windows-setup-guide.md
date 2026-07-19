# Hardware Hub Windows Setup Guide

**Version:** 1.0.0-pr10

Sumber utama panduan ini juga dirender di `/admin/operasional/hardware/setup-guide`.

> Mulai selalu dari fake adapter. Aktifkan hardware real satu perangkat pada satu waktu dan jangan menghapus SQLite execution journal ketika troubleshooting.

## 1. Arsitektur dan aturan dasar

Pahami alur job sebelum memasang software agar Android POS tidak pernah mencoba mengakses printer USB secara langsung.

### Alur integrasi

Android POS dan browser admin membuat hardware job ke RMS. Cloud menyimpan intent, lalu Hardware Hub Agent pada Mini PC melakukan claim, menyimpan attempt ke SQLite, dan menjalankan adapter printer.

Mini PC adalah satu-satunya komponen yang berinteraksi dengan printer USB/Windows spooler. Android tidak perlu driver SATO atau Epson.

```powershell
Android POS → RMS Cloud/API → Hardware Job Queue → Windows Mini PC → SATO / Epson / Cash Drawer
```

> **Effectively-once execution:** Setelah dispatch dimulai, job yang hasilnya tidak pasti tidak boleh dicetak ulang otomatis. Gunakan halaman Unknown Outcome untuk keputusan operator.

### Status kesiapan yang digunakan

Gunakan tiga status terpisah: Implemented, Simulated and automated-test passed, dan Physically validated.

Receipt A4 dan SBPL dapat dinyatakan simulated sebelum diuji secara fisik. Margin Epson, sensor SATO, darkness, speed, dan barcode scan tetap menunggu validasi outlet.

## 2. Persiapan Mini PC Windows 10

Siapkan dedicated Windows user dan konfigurasi daya sebelum menginstal agent.

### Buat dedicated Windows user

Gunakan satu user Windows khusus Hardware Hub dan jalankan instalasi printer, DPAPI check, agent manual, serta Scheduled Task dengan user yang sama.

DPAPI memakai CurrentUser. Mengganti user setelah attempt tersimpan dapat membuat lease token lokal tidak dapat dibuka.

- [ ] User memiliki password dan tidak menggunakan guest account.
- [ ] User dapat login interaktif untuk instalasi driver dan troubleshooting.
- [ ] Folder C:\ASIHJAYA dapat ditulis oleh user tersebut.

### Atur power, waktu, dan jaringan

Matikan sleep dan hibernation selama jam outlet. Pastikan timezone Asia/Jakarta dan Windows Time aktif.

Gunakan koneksi internet stabil. Ethernet lebih disarankan untuk Mini PC; printer Epson dapat tetap USB atau Wi-Fi sesuai hasil UAT.

- [ ] Sleep = Never saat terhubung listrik.
- [ ] Tanggal, waktu, dan timezone benar.
- [ ] Disk kosong minimal 10 GB.
- [ ] Windows Update dan restart selesai sebelum UAT.

## 3. Software yang harus di-install

Gunakan versi runtime yang kompatibel dan hindari aplikasi portable dari sumber yang tidak tepercaya.

### Node.js 22 atau 24

Hardware Hub memerlukan Node.js minimal 22.5 dan kurang dari 25 karena menggunakan built-in node:sqlite.

```powershell
node -v
```

```powershell
npm -v
```

- [ ] Versi Node memenuhi >=22.5 dan <25.

### SumatraPDF

Install SumatraPDF pada path yang tetap. Agent memakai executable ini sebagai Windows PDF print runner dengan argument allowlisted.

```powershell
Test-Path "C:\Program Files\SumatraPDF\SumatraPDF.exe"
```

- [ ] Executable ditemukan.
- [ ] PDF dapat dibuka secara manual.
- [ ] Jangan mengisi raw PDF_PRINT_COMMAND untuk Protocol v2.

### Driver printer resmi

Install driver Windows SATO CG408TT dan Epson EcoTank L3251 dari vendor/reseller resmi. Catat nama printer persis seperti yang tampil di Windows.

```powershell
Get-Printer | Select-Object Name, DriverName, PortName, PrinterStatus
```

## 4. Persiapan hardware fisik

Pastikan perangkat dapat dipakai dari Windows sebelum melibatkan RMS atau agent.

### SATO CG408TT

Pasang media label dan ribbon sesuai spesifikasi. Hubungkan USB, install driver, lalu lakukan test print Windows/vendor terlebih dahulu.

Ukur label fisik dan gap. Nilai development 400×300 dots bukan ukuran final sampai diverifikasi pada media outlet.

- [ ] Printer muncul di Get-Printer.
- [ ] Nama printer dicatat untuk LABEL_PRINTER_NAME.
- [ ] Media dan ribbon terpasang.
- [ ] Calibration/gap sensor vendor selesai.

### Epson EcoTank L3251

Install driver resmi, pilih A4, dan lakukan test page dari Windows. Nama driver dapat tampil sebagai EPSON L3250 Series; gunakan nama yang benar-benar muncul pada Mini PC.

- [ ] Printer muncul di Get-Printer.
- [ ] Test page Windows berhasil.
- [ ] Paper A4 tersedia pada driver.
- [ ] Nama printer dicatat untuk DOCUMENT_PRINTER_NAME.

### Cash drawer

Biarkan adapter drawer pada mode fake sampai model dan interface final. Drawer RJ11 biasanya membutuhkan receipt printer/trigger yang kompatibel; Epson L3251 bukan interface drawer kick yang ideal.

> **Jangan aktifkan drawer real dulu:** PR 10 memblokir aktivasi drawer real sebagai default. Tentukan model, trigger, pin, dan pulse timing terlebih dahulu.

## 5. Menempatkan source Hardware Hub

Gunakan folder permanen dan jangan menjalankan agent dari Downloads atau folder sementara.

### Folder yang direkomendasikan

Salin folder hardware-hub dari release/repository ke C:\ASIHJAYA\hardware-hub. Pastikan user Hardware Hub memiliki akses read/write.

```powershell
New-Item -ItemType Directory -Force C:\ASIHJAYA
```

```powershell
cd C:\ASIHJAYA\hardware-hub
```

```powershell
npm install --omit=dev
```

- [ ] Folder data, logs, support-bundles, dan outlet-reports dapat dibuat.
- [ ] node_modules tidak disalin dari komputer/OS lain; jalankan npm install pada Mini PC.

## 6. Register agent pada RMS

Agent harus terikat ke organization, outlet, dan register yang benar.

### Buat atau pilih Hardware Agent

Gunakan tool administrasi project untuk membuat agent, lalu simpan Agent ID dan secret hanya pada Mini PC yang bersangkutan.

```powershell
npm run hardware:agent:create
```

- [ ] Outlet benar.
- [ ] Register benar.
- [ ] Secret minimal 32 karakter.
- [ ] Secret tidak dikirim melalui grup chat umum atau dimasukkan ke Git.

> **Secret hanya untuk satu agent:** Jangan memakai secret yang sama untuk beberapa Mini PC. Rotate atau revoke bila perangkat diganti.

## 7. Membuat file .env agent

Mulai dari fake mode, lalu aktifkan hardware real satu per satu setelah preflight lulus.

### Copy template outlet

Gunakan .env.outlet.example sebagai template. Jangan commit .env hasil konfigurasi.

```powershell
Copy-Item .env.outlet.example .env
```

### Pilih URL RMS yang benar

Local development memakai localhost:3000. Docker validation memakai localhost:3001. Outlet production wajib HTTPS ke domain cloud.

**Local development**

```powershell
ASIHJAYA_API_URL=http://localhost:3000
```

**Docker validation**

```powershell
ASIHJAYA_API_URL=http://localhost:3001
```

**Production**

```powershell
ASIHJAYA_API_URL=https://rms.example.com
```

### Gunakan fake mode sebagai default

Sebelum physical validation, seluruh adapter harus fake. Cash drawer tetap fake sampai perangkat final tersedia.

```powershell
HARDWARE_ADAPTER_MODE=fake
LABEL_PRINTER_ADAPTER=fake
DOCUMENT_PRINTER_ADAPTER=fake
CASH_DRAWER_ADAPTER=fake
```

## 8. Install dependency dan jalankan self-test

Agent tidak boleh claim job bila DPAPI, SQLite journal, atau konfigurasi belum sehat.

### Pemeriksaan wajib

Jalankan seluruh command dengan Windows user yang sama dengan Scheduled Task.

```powershell
npm install --omit=dev
npm run check:dpapi
npm run check
npm run check:v2
npm run check:operations
npm run check:sato
npm run check:print-profiles
npm run outlet:preflight
```

- [ ] DPAPI round-trip OK.
- [ ] Config check tidak memiliki BLOCKED/error.
- [ ] SQLite journal dapat dibuka.
- [ ] Health server loopback valid.

## 9. Integrasi local development

Jalankan database, Next.js, dan agent pada terminal terpisah.

### Tiga terminal

Database tetap di Docker, sedangkan Next.js dan agent dapat berjalan langsung pada Windows untuk proses coding.

**Terminal 1 — database**

```powershell
docker compose up -d db
```

**Terminal 2 — web**

```powershell
npm run dev
```

**Terminal 3 — agent**

```powershell
cd hardware-hub
npm start
```

- [ ] Web dapat dibuka di http://localhost:3000.
- [ ] Agent tampil online pada Hardware Hub.
- [ ] Local health tersedia pada http://127.0.0.1:3210/health.

## 10. Validasi end-to-end dengan fake adapter

Fake mode tetap memakai claim, lease, SQLite journal, download PDF, dan lifecycle Protocol v2.

### Jalankan test dari dashboard

Klik Tes Label, Test Nota PDF, dan Test Drawer. Periksa status job serta artifact yang dibuat.

```powershell
Get-ChildItem .\data\fake-output -Recurse
```

- [ ] label.sbpl dan artifact.json tersedia.
- [ ] document.pdf dan artifact.json tersedia.
- [ ] drawer.json tersedia.
- [ ] Job mencapai completed.

### Generate calibration fixtures

Fixture tidak memakai data transaksi. Gunakan untuk inspeksi SBPL dan PDF A4 sebelum real mode.

```powershell
npm run outlet:fixtures
```

## 11. Beralih ke real hardware secara bertahap

Aktifkan hanya satu device setelah preflight dan fake test lulus.

### Aktifkan SATO terlebih dahulu

Script membuat backup .env, menolak perubahan bila masih ada local active attempt, memvalidasi printer name, lalu menjalankan config check.

```powershell
npm run outlet:enable-real-label
```

- [ ] Document printer tetap fake.
- [ ] Cash drawer tetap fake.
- [ ] Satu test label berhasil sebelum batch test.

### Aktifkan Epson setelah SATO stabil

Pastikan SumatraPDF dan printer Epson tersedia. Profile default adalah epson_l3251_a4_v1 dan receipt A4 landscape.

```powershell
npm run outlet:enable-real-document
```

- [ ] A4 tidak terpotong.
- [ ] Orientasi landscape benar.
- [ ] Scaling fit tidak merusak design.

### Rollback bila ada masalah

Rollback tidak menghapus SQLite journal, job cloud, atau evidence attempt.

```powershell
npm run outlet:rollback-to-fake
npm run support:bundle
```

> **Jangan hapus journal:** Jangan menghapus hardware-executions.sqlite untuk memperbaiki job. Resolve unknown outcome dari dashboard dan simpan support bundle.

## 12. Setup operasional production Windows

Gunakan Scheduled Task dengan absolute path Node dan dedicated user yang sama.

### Install production task

Jalankan setelah manual test dan preflight lulus. Script memasang dependency, memeriksa runtime, lalu membuat Scheduled Task.

```powershell
npm run setup:production
npm run status
npm run health
```

- [ ] Task menggunakan Windows user yang sama.
- [ ] Agent kembali online setelah restart Windows.
- [ ] Agent kedua ditolak oleh process lock.

## 13. Physical hardware acceptance test

Uji happy path dan kegagalan nyata. Jangan hanya mengandalkan satu test print.

### SATO CG408TT

Ukur media, tune offset, scan barcode menggunakan semua tipe Android sales, lalu uji kegagalan perangkat.

- [ ] 1 label, 10 label, dan 100 label berurutan.
- [ ] Barcode dapat dipindai semua Android POS.
- [ ] Printer offline sebelum job.
- [ ] USB dicabut saat testing.
- [ ] Media/ribbon habis.
- [ ] Internet putus setelah dispatch tidak membuat duplicate print.

### Epson L3251

Validasi A4 landscape, printable margin, fit scaling, warna, multi-page, dan Windows spooler behavior.

- [ ] Receipt pendek dan panjang.
- [ ] Printer offline.
- [ ] Kertas habis.
- [ ] USB/Wi-Fi putus.
- [ ] Restart agent setelah submission.
- [ ] Internet putus setelah print tidak memicu duplicate.

## 14. Troubleshooting dan support bundle

Kumpulkan evidence sebelum restart, retry, atau mengubah konfigurasi.

### Error yang sering ditemui

DPAPI error: jalankan npm run check:dpapi dengan user yang sama.

Agent degraded/offline: periksa npm run health, npm run status, dan koneksi API.

Printer not found: bandingkan LABEL_PRINTER_NAME/DOCUMENT_PRINTER_NAME dengan Get-Printer.

PDF mismatch: periksa documentProfileId, printProfileId, dan artifact metadata.

SATO barcode invalid: periksa barcode canonical database; agent tidak mengubah barcode diam-diam.

Unknown outcome: jangan retry biasa; gunakan halaman detail job dan konfirmasi risiko duplikat.

```powershell
npm run health
npm run status
npm run support:bundle
```

### Buat outlet report

Report menyimpan hasil preflight, konfigurasi yang sudah disanitasi, daftar printer, dan checklist acceptance. Foto hasil fisik ditambahkan manual.

```powershell
npm run outlet:report
```

## Final outlet checklist

- [ ] Dedicated Windows user tersedia dan digunakan konsisten.
- [ ] Node.js, PowerShell, DPAPI, dan node:sqlite lulus self-test.
- [ ] Agent terikat ke outlet/register yang benar.
- [ ] Fake label, document, dan drawer test lulus.
- [ ] SATO terdeteksi dan barcode berhasil dipindai.
- [ ] Epson menghasilkan receipt A4 tanpa clipping.
- [ ] Scheduled Task menghidupkan kembali agent setelah restart.
- [ ] Failure scenarios dan unknown-outcome workflow diuji.
- [ ] Support bundle dan outlet report berhasil dibuat.
- [ ] Cash drawer tetap fake sampai perangkat/interface final tervalidasi.

