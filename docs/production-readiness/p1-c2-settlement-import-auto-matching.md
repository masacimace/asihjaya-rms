# P1-C.2 — Settlement Import & Auto-Matching

## Tujuan

Mempercepat rekonsiliasi finance melalui import CSV tanpa mengorbankan kontrol manual. File baru tidak langsung mengubah payment. Sistem melakukan upload, mapping, analisis kandidat, preview, lalu hanya menerapkan exact match setelah konfirmasi user.

## Alur

1. Finance memilih outlet dan payment profile.
2. Upload CSV UTF-8 maksimal 5 MB dan 1.000 baris.
3. Sistem memvalidasi header, formula injection, hash file, serta menyimpan sumber secara privat.
4. Finance memetakan tanggal, reference, gross, fee, pajak, net, settlement reference, dan status provider.
5. Analisis membuat status per baris tanpa mengubah payment.
6. Exact match memerlukan profile, outlet, reference, dan gross amount yang sama.
7. Finance menekan `Import dan rekonsiliasi exact match` untuk commit.
8. Ambiguous, mismatch, duplicate, not found, dan failed tetap berada di review queue.

## Guardrail

- SHA-256 unik per organisasi mencegah file sama diimpor dua kali.
- CSV parser mendukung quoted values dan delimiter koma, titik koma, atau tab.
- File dengan formula spreadsheet ditolak.
- Source CSV tidak memiliki public URL.
- Akses file dibatasi organization, outlet, dan permission import.
- Auto-apply tidak dijalankan untuk kandidat lebih dari satu.
- Payment yang sudah direkonsiliasi tidak dapat diterapkan kembali.
- Advisory lock melindungi batch, row, dan payment dari concurrency.
- Payment reconciliation dan status import row di-commit dalam transaction yang sama.

## UAT minimum

1. Upload CSV valid dan lihat preview tanpa perubahan payment.
2. Upload file sama kembali dan pastikan diarahkan ke batch lama.
3. Mapping tiga kolom wajib dan simpan mapping per profile.
4. Exact reference + amount menghasilkan `matched`.
5. Reference sama tetapi amount berbeda menghasilkan `mismatch`.
6. Dua payment dengan reference sama menghasilkan `ambiguous`.
7. Reference tidak ditemukan menghasilkan `not_found` dan kandidat nominal/tanggal bila ada.
8. Reference duplikat dalam file menghasilkan `duplicate`.
9. Formula spreadsheet dan file non-UTF-8 ditolak.
10. Commit exact match membuat satu reconciliation dan mengubah payment menjadi `reconciled`.
11. Double-submit commit tidak membuat record ganda.
12. Review manual hanya menerima kandidat yang disediakan sistem.
13. Baris yang diabaikan wajib memiliki alasan minimal delapan karakter.
14. User tanpa permission import tidak dapat membuka halaman atau file CSV.
15. File sumber dapat di-download oleh user yang berwenang dengan header private/no-store.
