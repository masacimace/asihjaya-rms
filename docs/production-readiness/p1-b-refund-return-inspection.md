# P1-B — Refund & Return Inspection Workflow

## Tujuan

P1-B memisahkan pengembalian dana dari lifecycle fisik barang. Refund tidak lagi membuat item langsung `available`. Setelah refund finansial selesai, sistem membuat return case dan setiap item menunggu penerimaan serta pemeriksaan.

## State utama

### Return case

- `awaiting_receipt`
- `pending_inspection`
- `partially_inspected`
- `completed`
- `rejected`
- `cancelled`

### Return item

- `awaiting_receipt`
- `pending_inspection`
- `restocked`
- `repair`
- `damaged`
- `rejected`

### Inventory

Saat barang diterima, product item berubah dari `sold/customer` menjadi `inspection/returned/outlet`. Item baru kembali `available/good/outlet` setelah keputusan restock.

## Keputusan pemeriksaan

- **Restock**: identitas cocok, kondisi baik, dan selisih berat maksimal 0,010 gram.
- **Repair**: item masuk status reserved/damaged pada lokasi repair.
- **Damaged**: item tetap tertahan dan tidak dapat dijual.
- **Reject**: item dikembalikan ke state sold/customer. Foto wajib.

Foto juga wajib untuk keputusan damaged. Semua perubahan item menggunakan conditional update dan serialized advisory lock per return case.

## Permission

- `returns.view`
- `returns.receive`
- `returns.inspect`

Default role:

- Owner/System Admin/Manager: view, receive, inspect
- Cashier: view, receive
- Stock Admin: view, receive, inspect
- Finance: view

Custom role harus diberi permission secara eksplisit.

## Rollout

1. Backup database.
2. Jalankan `npm run db:preflight:p1b` pada restore/staging.
3. Pastikan semua hasil `[OK]`.
4. Jalankan static checks dan full build.
5. Jalankan migration `0015_p1b_refund_return_inspection.sql`.
6. Logout/login ulang agar permission baru dimuat.
7. Uji refund baru pada staging.

Migration membackfill refund lama sebagai return case `completed/restocked` tanpa mengubah state inventory saat ini. Metadata `legacyBackfill` menandai record tersebut.

## UAT wajib

1. Refund baru membuat satu return case dan item `awaiting_receipt`.
2. Setelah refund, product item tetap `sold/customer` sampai barang diterima.
3. Scan kode salah ditolak tanpa perubahan.
4. Scan kode benar mengubah item menjadi `inspection/returned/outlet`.
5. Double submit penerimaan hanya berhasil sekali.
6. Cashier dapat menerima tetapi tidak dapat memutuskan hasil inspection.
7. Restock dengan identity unchecked ditolak.
8. Restock dengan kondisi tidak baik ditolak.
9. Restock dengan selisih berat lebih dari 0,010 gram ditolak.
10. Damaged/reject tanpa foto ditolak.
11. Repair menghasilkan inventory `reserved/damaged/repair`.
12. Damaged menghasilkan inventory `reserved/damaged/outlet`.
13. Reject mengembalikan inventory ke `sold/good/customer`.
14. Dua inspector yang submit bersamaan hanya menghasilkan satu keputusan.
15. Return case menjadi completed setelah semua item diperiksa.
16. Seluruh item rejected menghasilkan case status rejected.
17. Foto hanya bisa dibuka user dengan `returns.view` dan akses outlet terkait.
18. Item berstatus inspection tidak muncul sebagai barang yang dapat dijual di POS.
