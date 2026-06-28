# Asihjaya Hardware Hub Agent

Hardware Hub Agent adalah proses lokal yang berjalan di Mini PC outlet. Agent melakukan heartbeat ke Asihjaya RMS, mengambil `hardware_jobs`, lalu menjalankan pekerjaan lokal seperti cetak label SATO, silent print nota/certificate PDF, dan buka cash drawer.

## Cara setup di Mini PC Windows

### 1. Install Node.js

Gunakan Node.js LTS. Setelah install, buka terminal baru dan cek:

```powershell
node -v
npm -v
```

### 2. Siapkan folder agent

Copy folder `hardware-hub` ke Mini PC, misalnya:

```txt
C:\Asihjaya\hardware-hub
```

Lalu buka terminal di folder tersebut:

```powershell
cd C:\Asihjaya\hardware-hub
```

### 3. Install dependency agent

```powershell
npm install --omit=dev
```

### 4. Buat file `.env`

Copy:

```powershell
copy .env.example .env
```

Isi `.env` dengan `ASIHJAYA_API_URL`, `HARDWARE_AGENT_ID`, dan `HARDWARE_AGENT_SECRET` dari root web app:

```powershell
npm run hardware:agent:create
```

Untuk production, pastikan `HARDWARE_DRY_RUN=false` dan isi printer sesuai share name Windows.

### 5. Cek konfigurasi

```powershell
npm run check
```

Kalau masih ada warning printer, cek lagi share name printer Windows dan `PDF_PRINT_COMMAND`.

### 6. Test manual

```powershell
npm start
```

Buka Admin → Operasional → Hardware Hub. Agent harus muncul online. Stop dengan `Ctrl + C` setelah test.

### 7. Install startup task

Agar agent otomatis jalan saat Windows user login:

```powershell
npm run install:startup
```

Task Scheduler akan membuat task bernama:

```txt
Asihjaya Hardware Hub Agent
```

Task ini sengaja berjalan pada user logon, bukan LocalSystem service, supaya printer user Windows tetap terlihat oleh agent.

### 8. Buka log agent

```powershell
npm run logs
```

Log tersimpan di:

```txt
hardware-hub\logs
```

### 9. Uninstall startup task

```powershell
npm run uninstall:startup
```

## Catatan printer

### Label SATO

Agent memakai layout awal `jewelry_compact` untuk label perhiasan. Konfigurasi yang bisa diubah dari `.env`:

```env
LABEL_PROFILE=jewelry_compact
LABEL_COPIES=1
LABEL_LEFT_OFFSET_DOTS=0
LABEL_TOP_OFFSET_DOTS=0
LABEL_INCLUDE_PRICE=false
```

Untuk development tanpa printer, aktifkan `HARDWARE_DRY_RUN=true`, klik **Test Label**, lalu cek file `raw-printer_*.txt` dan metadata `raw-printer_*.txt.json` di folder `dry-run-output`.

Gunakan `LABEL_LEFT_OFFSET_DOTS` dan `LABEL_TOP_OFFSET_DOTS` untuk menggeser posisi label setelah test print di printer fisik. Nilai positif menggeser ke kanan/bawah.

### Printer Windows

Untuk label SATO dan cash drawer, agent memakai raw Windows printer share:

```txt
\\localhost\NAMA_SHARE_PRINTER
```

Jadi nilai `LABEL_PRINTER_NAME`, `DOCUMENT_PRINTER_NAME`, dan `CASH_DRAWER_PRINTER_NAME` sebaiknya mengikuti **Share name** di Windows Printer Properties → Sharing.

Untuk silent print PDF, rekomendasi awal adalah SumatraPDF:

```env
PDF_PRINT_COMMAND="C:\\Program Files\\SumatraPDF\\SumatraPDF.exe" -print-to "{printer}" -silent "{file}"
```

Token `{printer}` dan `{file}` akan diganti otomatis oleh agent.

## Dry-run mode

Untuk development tanpa hardware fisik:

```env
HARDWARE_DRY_RUN=true
DRY_RUN_OUTPUT_DIR=./dry-run-output
```

Saat dry-run aktif, agent tetap claim job dan menandai job completed, tapi output disimpan ke folder `dry-run-output`.
