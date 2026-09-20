# ASIHJAYA RMS — LAN Training Mode

Dokumen ini digunakan ketika ASIHJAYA RMS development lokal ingin dipakai sebagai playground/training staff dari beberapa device dalam Wi-Fi/LAN yang sama.

Mode ini **tidak memakai VPS** dan **tidak mengubah `.env` secara permanen**. Semua device training memakai aplikasi Next.js dan database development lokal yang sama pada komputer host.

## Quick Start

Pastikan komputer host sudah terhubung ke Wi-Fi/LAN toko, lalu dari root project jalankan:

```powershell
npm run dev:lan:check
```

Command tersebut hanya mendeteksi interface/IP yang akan dipakai dan tidak menjalankan server.

Jika IP yang tampil sudah benar, jalankan:

```powershell
npm run dev:lan
```

Terminal akan menampilkan URL seperti:

```text
Training  : http://192.168.1.50:3000
```

Buka URL **yang dicetak oleh terminal** pada komputer host dan semua laptop/HP/tablet staff yang berada di Wi-Fi/LAN yang sama.

## Apa yang dilakukan `dev:lan`

LAN Training Mode otomatis:

1. mendeteksi IPv4 private aktif pada Wi-Fi/Ethernet;
2. menjalankan Next.js development server pada `0.0.0.0`;
3. mengatur `APP_URL` hanya untuk proses tersebut ke URL LAN;
4. mengatur `NEXT_PUBLIC_APP_URL` hanya untuk proses tersebut ke URL LAN;
5. mempertahankan `INTERNAL_RENDER_ORIGIN` pada `127.0.0.1` untuk render internal;
6. menambahkan host LAN tersebut ke `allowedDevOrigins` selama development;
7. tetap menggunakan database development lokal yang sudah ada.

Tidak ada perubahan permanen terhadap `.env`, database, atau konfigurasi VPS.

## Jika IP otomatis salah

Lihat IPv4 Wi-Fi/Ethernet Windows:

```powershell
ipconfig
```

Kemudian tentukan IP secara eksplisit:

```powershell
npm run dev:lan -- --host 192.168.1.50
```

Ganti `192.168.1.50` dengan IPv4 komputer host yang sebenarnya.

## Menggunakan port lain

Default port adalah `3000`.

Jika port tersebut sedang dipakai:

```powershell
npm run dev:lan -- --port 3001
```

Atau sekaligus menentukan host dan port:

```powershell
npm run dev:lan -- --host 192.168.1.50 --port 3001
```

## Windows Firewall

Saat pertama kali membuka server ke LAN, Windows dapat meminta izin untuk Node.js.

Izinkan akses pada **Private networks**.

Jika server bisa dibuka pada komputer host tetapi tidak bisa dibuka dari device staff, periksa:

- seluruh device berada di Wi-Fi/LAN yang sama;
- Windows Firewall tidak memblokir Node.js/port training;
- router/access point tidak mengaktifkan AP Isolation / Client Isolation;
- URL yang dibuka staff sama persis dengan URL `Training` pada terminal.

Tidak perlu membuka port router ke internet.

## Data training

Semua device mengakses backend dan database lokal yang sama.

Artinya transaksi, produk, shift, Buyback, dan perubahan data training dari satu device dapat terlihat oleh device training lainnya.

Data tersebut adalah **data development lokal**, bukan data VPS.

LAN Training Mode tidak melakukan reset database saat start atau stop.

## Camera scanner

Basic LAN Training Mode memakai HTTP.

Sebagian browser membatasi `getUserMedia`/camera pada origin HTTP yang bukan `localhost`. Karena itu fitur camera scanner pada HP/tablet dapat tidak tersedia walaupun fitur aplikasi lain berjalan normal.

Jika training membutuhkan camera scanner browser, siapkan HTTPS LAN/trusted local certificate sebagai tahap terpisah. Jangan menganggap masalah camera pada HTTP LAN sebagai kegagalan POS/backend training.

## Mengakhiri training

Pada terminal yang menjalankan server:

```text
Ctrl+C
```

Setelah server dihentikan, aplikasi tidak lagi tersedia pada device LAN.

## Workflow besok di toko

```text
1. Hubungkan komputer host + device staff ke Wi-Fi yang sama
2. npm run dev:lan:check
3. Pastikan IP LAN benar
4. npm run dev:lan
5. Buka URL Training yang dicetak terminal
6. Login dari device staff
7. Lakukan training transaksi / produk / shift / Buyback
8. Ctrl+C setelah training selesai
```
