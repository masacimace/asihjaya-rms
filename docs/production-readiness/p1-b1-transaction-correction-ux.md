# P1-B.1 — Transaction Correction UX & Eligibility

## Tujuan

Menyederhanakan void dan refund menjadi satu pintu masuk **Koreksi Transaksi** tanpa menggabungkan business logic keduanya.

## Klasifikasi sistem

- `void`: transaksi completed, shift masih open, masih pada business date yang sama, belum memiliki return case, dan barang dinyatakan belum diserahkan.
- `refund`: barang sudah diserahkan, kondisi penyerahan tidak pasti, shift tidak lagi open, atau transaksi berasal dari business date sebelumnya.
- Existing return case memblokir pengajuan koreksi baru.

Backend menghitung ulang klasifikasi. Nilai jenis koreksi tidak dipercaya dari browser.

## Wizard

1. Kondisi barang, pembayaran, dan keberadaan customer.
2. Alasan preset sesuai hasil klasifikasi.
3. Review tindakan dan dampaknya sebelum meminta persetujuan.

## UAT minimum

1. Sale completed, shift open, hari sama, barang belum diserahkan menghasilkan void.
2. Kondisi yang sama tetapi barang sudah diserahkan menghasilkan refund.
3. Jawaban tidak yakin selalu menghasilkan refund.
4. Shift closed atau transaksi hari sebelumnya menghasilkan refund walaupun barang dipilih belum diserahkan.
5. Existing return case memblokir koreksi baru.
6. Requester tanpa permission hasil klasifikasi ditolak server.
7. Dua jenis approval aktif untuk sale yang sama tidak dapat dibuat.
8. Alasan `Lainnya` wajib memiliki detail minimal delapan karakter.
9. Approved void menampilkan CTA pembatalan transaksi.
10. Approved refund menampilkan CTA pengembalian dana dan setelah selesai mengarahkan ke workflow retur.
