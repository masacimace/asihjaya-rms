# Hardware Hub: job v2 terambil melalui endpoint v1

## Gejala dan penyebab

Pesan dashboard: `Protocol v2 job lama terdeteksi claimed tanpa current attempt...`
dengan kode `ORPHANED_V2_CLAIM`. Berlaku untuk nota dan label SATO.

Mode `v2-preferred` memeriksa antrean v2 terlebih dahulu, lalu antrean v1 bila
tidak ada job v2. Sebelum perbaikan, endpoint `/api/hardware-jobs/claim` tidak
memfilter `protocolVersion`. Jika job v2 baru masuk setelah respons claim v2
kosong, endpoint v1 dapat mengambilnya tanpa membuat attempt. PATCH v1 ke
`printing` kemudian ditolak constraint status v2. Job tertinggal sebagai
`claimed` tanpa `currentAttemptId`; maintenance akhirnya menandainya gagal.

Urutan ini berhasil direproduksi pada PostgreSQL 17 disposable melalui handler
HTTP asli dengan autentikasi agent bertanda tangan. Ini bergantung pada waktu
kedatangan job, bukan batas tiga transaksi.

## Perbaikan

- Claim v1 hanya memilih dan memperbarui job protocol 1 tanpa current attempt.
- Claim v1 memakai row lock `FOR UPDATE SKIP LOCKED`, sehingga request bersamaan
  bisa mengambil job berbeda tanpa berebut kandidat pertama.
- PATCH v1 juga dibatasi ke protocol 1 tanpa attempt, sehingga status job v2
  tetap wajib melewati validasi lease, urutan event dan idempotensi API v2.
- Mode kompatibilitas `v2-preferred`, polling satu detik, serial drain dan
  perlindungan ACK tetap berlaku.

Perubahan berada di aplikasi RMS/server. Deploy aplikasi untuk melindungi Hub
0.9.4 yang sudah terpasang; tidak perlu installer baru, perubahan `.env`, atau
migration database untuk perbaikan ini.

## Verifikasi

`npm run test:financial:local` mencakup reproduksi job nota/label yang masuk
di antara dua claim, penolakan PATCH v1 terhadap v2, tiga batch job campuran
yang selesai melalui event v2 sampai ACK, isolasi organisasi, serta claim v1
bersamaan. Suite yang sama dijalankan oleh CI financial/concurrency.

Tidak ada pengiriman ke printer fisik dalam pengujian ini. Untuk smoke test
outlet setelah deploy, buat tiga transaksi berdekatan dan batch label, lalu
pastikan setiap job v2 memiliki attempt dan selesai melalui v2. Kecepatan cetak
fisik masih bergantung pada printer dan Windows spooler.

Job lama yang telanjur gagal tidak diulang otomatis. Periksa kertas/hasil cetak
sebelum Retry manual dari dashboard, untuk mencegah nota atau label ganda.
