# Rencana percepatan auto print Hardware Hub

Status: ruang lingkup sudah disepakati; implementasi dijadwalkan setelah revisi Nota yang sedang dikerjakan.

Perubahan yang disepakati:

1. Turunkan interval polling dari 2000 ms menjadi 1000 ms.
2. Optimalkan pembuatan/download PDF dan pengiriman cetak berdasarkan pengukuran waktu tiap tahap. Foto, font, layout, dan ukuran kertas tetap harus lengkap saat PDF dicetak.
3. Saat ada antrean, ambil job berikutnya segera setelah job sebelumnya selesai, tanpa menunggu interval polling berikutnya. Eksekusi printer tetap berurutan dengan mekanisme journal, lease, recovery, dan ACK yang ada.

Setelah perubahan selesai dan tervalidasi, buat installer Hardware Hub versi baru untuk distribusi. Upgrade harus mempertahankan credential/pairing serta konfigurasi printer yang sudah ada.

Perubahan warna teks ongkos pada Nota merupakan pekerjaan terpisah. Pencatatan rencana ini belum mengubah runtime, konfigurasi polling, atau installer Hardware Hub.
