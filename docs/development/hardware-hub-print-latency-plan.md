# Rencana percepatan auto print Hardware Hub

Status: implementasi source v0.9.4 dan verifikasi lokal; build installer Windows, smoke test perangkat, serta publikasi release dilakukan melalui GitHub CI.

Perubahan yang disepakati:

1. Turunkan interval polling dari 2000 ms menjadi 1000 ms.
2. Optimalkan pembuatan/download PDF dan pengiriman cetak berdasarkan pengukuran waktu tiap tahap. Foto, font, layout, dan ukuran kertas tetap harus lengkap saat PDF dicetak.
3. Saat ada antrean, ambil job berikutnya segera setelah job sebelumnya selesai, tanpa menunggu interval polling berikutnya. Eksekusi printer tetap berurutan dengan mekanisme journal, lease, recovery, dan ACK yang ada.

Implementasi:

- Default agent, template konfigurasi, validator, dan upgrade installer memakai polling 1000 ms. Installer membackup konfigurasi sebelum memperbarui nilai polling lama.
- Satu drain memproses job berurutan sampai antrean kosong. Recovery/ACK tetap diperiksa sebelum setiap claim. Error, recovery tertunda, dan shutdown menghentikan drain tanpa busy loop.
- PDF memakai media print sejak navigasi, menunggu event load lalu decode foto/QR dan kesiapan font. Penantian network-idle 500 ms dihilangkan; media/font rusak menggagalkan render sebelum cetak.
- Pengiriman Sumatra tetap memakai silent dispatch dan menunggu proses selesai agar hasil dispatch, journal, dan cleanup tetap konsisten. Tidak ada penundaan tetap tambahan pada pengiriman printer.
- Log mencatat tahap browser/navigasi/asset/PDF di server dan download/preparation/dispatch di Hub untuk membedakan waktu jaringan, render, dan printer.
- Token lease didekripsi sekali per execution aktif dan referensinya dilepas di finally. Empat event tidak lagi memanggil PowerShell/DPAPI berulang; journal tetap terenkripsi. Benchmark Windows lokal dengan token non-secret: 4 decrypt 3941 ms, 1 decrypt 968 ms (selisih 2973 ms). Ini pengukuran overhead DPAPI, bukan janji waktu cetak fisik.
- Installer v0.9.4 mempertahankan credential/pairing, journal, dan pilihan printer. Upgrade tetap memakai Windows account yang sama.

Benchmark lokal Windows (14 November 2026), satu sampel sebelum/sesudah per kasus:

| Kasus | Sebelum | Sesudah |
| --- | ---: | ---: |
| Runner dengan SQLite + DPAPI asli, dispatch simulasi tanpa jaringan/printer | 4826 ms | 1925 ms |
| PDF A5 full design, template/foto/QR/logo/font asli di server lokal | 1229 ms | 764 ms |
| PDF A5 overlay, fixture yang sama | 780 ms | 276 ms |

Runner mengeksekusi satu dispatch dan tidak menyisakan recovery di kedua versi; jumlah decrypt turun dari empat menjadi satu. Ukuran PDF sebelum/sesudah identik pada masing-masing mode. Benchmark PDF mencakup navigasi, kesiapan asset, dan pembuatan PDF, tidak mencakup startup Chromium atau printer. Angka ini merupakan bukti pengurangan overhead pada fixture lokal, bukan SLA kecepatan outlet.

Verifikasi: `npm --prefix hardware-hub run check:ci`, `npm run check:hardware-app`, `npm run check:receipt-pdf`, `npm run check:pdf-render-security`, `npx tsx scripts/verify-hardware-installer-release.ts`, typecheck dan lint.

Release: jalankan workflow **Build Hardware Hub Installer** secara manual untuk artifact UAT. Setelah pengujian fisik dan source terintegrasi ke main, push tag `hardware-hub-v0.9.4`; workflow Windows membangun Setup.exe dan job release mengunggah installer + SHA-256. Build manual tidak menerbitkan production release.

Deployment aplikasi RMS juga diperlukan untuk optimasi PDF. Setelah release terbit, simpan link asset versi baru melalui **Hardware Hub → Ubah Link Installer** agar tombol download RMS mengunduh v0.9.4. Pengaturan web ini memerlukan migration `0032_hardware_installer_download_url`; perubahan percepatan Hub sendiri tidak memerlukan migration. Environment URL tetap menjadi fallback sebelum link disimpan dari web.

Polling 1 detik adalah interval pencarian saat idle; durasi keseluruhan tetap dipengaruhi koneksi cloud, foto, spooler, driver, dan mekanik printer. Hasil simulasi tidak menggantikan pengukuran cetak fisik di outlet.
