# P0-B — Transaction Service

## Scope

P0-B memindahkan eksekusi void dan refund penuh dari server action yang besar ke transaction service terpusat:

- `src/features/sales/transaction-service.ts`
- `executeApprovedSaleReversal()`

Server action sekarang hanya menangani autentikasi, parsing form, feedback UI, dan revalidation.

## Invariants yang ditegakkan

Satu eksekusi void/refund hanya dapat commit bila seluruh kondisi berikut benar:

1. Sale berada dalam organization dan outlet scope actor.
2. Approval cocok dengan sale, tipe operasi, dan sudah `approved`.
3. Approval berhasil diklaim atomik dari `not_started/failed` menjadi `executing`.
4. Sale berhasil berubah secara kondisional dari `completed` ke `voided/refunded`.
5. Total payment `paid` sama persis dengan total sale.
6. Semua item masih `sold`, berada pada `customer`, dan masih terkait outlet transaksi.
7. Semua payment yang direversal masih berstatus `paid`.
8. Ledger `payment_refunds` terbentuk satu baris untuk setiap payment paid.
9. Bila ada cash, tersedia shift `open` pada register transaksi saat eksekusi.
10. Cash movement dan `expected_cash` diperbarui pada shift aktif tersebut, bukan shift transaksi lama.
11. Approval berhasil difinalisasi dari `executing` menjadi `completed`.
12. Audit log berhasil dibuat.

Jika salah satu langkah gagal, transaction PostgreSQL rollback penuh.

## Concurrency behavior

- Dua request untuk approval yang sama: hanya satu yang dapat claim approval.
- Void dan refund berbeda untuk sale yang sama: hanya satu yang dapat melakukan transition dari `completed`.
- Shift berubah menjadi `closing/closed` saat refund: update shift gagal dan seluruh reversal rollback.
- Payment atau inventory berubah saat eksekusi: affected-row check gagal dan seluruh reversal rollback.
- Retry setelah request pertama sudah commit: service mengembalikan hasil idempotent dari approval yang sudah `completed`, tanpa membuat refund, cash movement, atau inventory movement kedua.

## Cash refund policy

Cash refund menggunakan shift yang saat ini `open` pada **register transaksi asal**.

Contoh:

- Sale dibuat pada POS-01 di shift tanggal 10 Juli.
- Shift tersebut sudah ditutup.
- Refund dilakukan tanggal 12 Juli.
- POS-01 harus mempunyai shift baru yang open.
- `cash_refund` tanggal 12 Juli masuk ke shift baru tersebut.
- Shift 10 Juli tidak dimutasi.

## Payment refund ledger

Setiap payment `paid` menghasilkan satu row `payment_refunds` dengan:

- original sale dan payment
- original shift
- refund shift untuk cash
- approval
- actor request/approval/execution/confirmation
- deterministic idempotency key
- snapshot reference payment asli di metadata

Pada P0-B, eksekusi manual masih dianggap sebagai konfirmasi refund untuk semua metode. Pengisian refund reference/evidence khusus QRIS, transfer, dan EDC tetap masuk P1 — Manual Payment Verification.

## Database migration

P0-B tidak mengubah schema. Tidak ada migration baru setelah P0-A.

Verifikasi:

```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/db npm run db:generate
```

Expected result:

```text
No schema changes, nothing to migrate
```

## Verification commands

```bash
npm ci
npm run typecheck
npm run lint
npm run routes:check
npm run build
```

## Required staging UAT

### Atomic retry

1. Approve refund transaksi.
2. Kirim dua request eksekusi hampir bersamaan.
3. Pastikan hanya satu cash movement, satu inventory movement per item, dan satu refund ledger per payment.
4. Request kedua harus mendapat hasil konflik atau idempotent replay.

### Closed original shift

1. Buat cash sale pada shift A.
2. Tutup shift A.
3. Buka shift B pada register yang sama.
4. Eksekusi refund.
5. Pastikan cash movement berada di shift B dan angka shift A tidak berubah.

### No active shift

1. Tutup seluruh shift pada register transaksi.
2. Eksekusi refund cash.
3. Pastikan operasi ditolak dan sale/payment/inventory tetap unchanged.

### Inventory conflict

1. Ubah salah satu item transaksi dari `sold/customer` melalui database staging.
2. Coba eksekusi reversal.
3. Pastikan seluruh operasi rollback dan tidak ada item lain yang berubah.

### Payment mismatch

1. Buat data staging dengan total payment paid berbeda dari total sale.
2. Coba eksekusi reversal.
3. Pastikan operasi ditolak untuk pemeriksaan manual.
