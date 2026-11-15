# Pengaturan link installer Hardware Hub

Admin dengan izin `admin.access` dan `hardware.agents.manage` dapat membuka **Hardware Hub → Ubah Link Installer**, menempelkan URL release langsung ke `ASIHJAYA-Hardware-Hub-Setup.exe`, lalu memilih **Simpan Link**.

Link disimpan per organisasi dan langsung dipakai tombol download pada dashboard maupun dialog setup Mini PC. Semua outlet dalam organisasi menggunakan link yang sama. Tidak perlu restart VPS, edit environment, atau build installer untuk mengganti tautan berikutnya. Setiap perubahan tercatat di audit log.

Migration `0032_hardware_installer_download_url.sql` menambahkan satu kolom nullable pada `organizations`. Jalankan deployment/migration sebelum menggunakan versi aplikasi ini. Data lama tetap memakai `HARDWARE_HUB_INSTALLER_DOWNLOAD_URL` sebagai fallback sampai link pertama disimpan dari web. Deployment baru dapat membiarkan fallback kosong, lalu mengatur link melalui web. Nilai fallback yang diisi tetap divalidasi.

URL harus HTTPS, maksimal 2048 karakter, menunjuk nama file installer langsung, tanpa credential, query atau fragment. URL localhost/loopback dan GitHub Actions artifact ditolak. Validasi ini memeriksa format URL, bukan keberadaan file pada remote server; publish asset release sebelum menyimpan tautannya.

Read dan write dibatasi organisasi dari session; form tidak menerima organization ID dari browser. Update link dan audit dilakukan dalam satu transaksi. API download tetap memerlukan izin Hardware Hub dan memakai redirect `302` dengan `Cache-Control: no-store`.

Verifikasi: integration suite menguji persistensi, fallback, prioritas link web, pemisahan organisasi, audit dan URL yang ditolak; `verify-hardware-installer-release.ts` memeriksa policy URL serta permission action; smoke test browser menguji dialog dan tampilan mobile.
