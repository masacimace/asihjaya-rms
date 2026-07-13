# P1-C.1 — Manual Payment Reconciliation

## Tujuan

Memastikan payment non-tunai yang dicatat oleh POS dapat dicocokkan dengan mutasi bank, laporan merchant QRIS, atau batch EDC tanpa mengubah nilai omzet penjualan.

- `payment.amount` tetap menjadi gross sales/payment.
- MDR dan pajak biaya dicatat terpisah.
- Net settlement dihitung sebagai `gross - fee - tax`.
- Cash tetap direkonsiliasi melalui closing shift dan tidak masuk workflow ini.

## Status

- `unreconciled`: belum diperiksa finance.
- `pending_settlement`: payment ditemukan, dana belum settle.
- `reconciled`: gross settlement sama dengan payment POS.
- `mismatch`: gross settlement berbeda dengan payment POS.
- `not_found`: payment tidak ditemukan pada sumber settlement.
- `waived`: mismatch ditutup sebagai pengecualian oleh resolver.

Migration memetakan status legacy:

- `matched` → `pending_settlement`
- `settled` → `reconciled`

## Permission

- `payments.reconciliation.view`
- `payments.reconciliation.manage`
- `payments.reconciliation.resolve`

Default diberikan kepada System Admin, Owner, Manager, dan Finance. Custom role harus diberikan secara eksplisit.

## Rollout

1. Backup database.
2. Jalankan preflight:

```bash
npm run db:preflight:p1c1
```

3. Semua hasil harus `[OK]`.
4. Periksa schema:

```bash
npm run db:generate
```

Hasil yang diharapkan: `No schema changes, nothing to migrate`.

5. Terapkan migration:

```bash
npm run db:migrate
```

6. Logout dan login ulang agar permission baru masuk ke session.
7. Jalankan validasi:

```bash
npm run typecheck
npm run lint
npm run routes:check
npm run check:p0d
npm run check:p1a
npm run check:p1a1
npm run check:p1b
npm run check:p1b1
npm run check:p1c1
npm run build
```

## Guardrail

- Payment dikunci menggunakan PostgreSQL advisory transaction lock.
- Satu payment hanya memiliki satu reconciliation record aktif.
- Status payment dan reconciliation diperbarui dalam transaction yang sama.
- `reconciled` wajib memiliki gross yang sama dengan payment, tanggal, reference, dan net settlement.
- `mismatch` wajib memiliki selisih nominal dan catatan.
- `not_found` dan `waived` wajib memiliki catatan minimal delapan karakter.
- Penyelesaian mismatch/not-found/waived membutuhkan permission resolve.
- Bukti settlement disimpan privat dan dibatasi berdasarkan organization/outlet.
- Data kartu penuh, CVV, PIN, dan track data tidak boleh diunggah atau dicatat.

## UAT minimum

1. Payment non-tunai baru muncul sebagai `unreconciled`.
2. Cash tidak muncul di halaman rekonsiliasi.
3. Filter outlet, metode, profile, status, periode, dan pencarian bekerja.
4. Gross sama dengan payment, fee valid, dan reference/tanggal lengkap dapat menjadi `reconciled`.
5. Gross berbeda tidak dapat disimpan sebagai `reconciled`.
6. Gross berbeda dapat disimpan sebagai `mismatch` dengan catatan.
7. Gross sama tidak dapat disimpan sebagai `mismatch`.
8. Fee + tax melebihi gross ditolak.
9. `not_found` tanpa catatan ditolak.
10. User tanpa resolve tidak dapat menutup mismatch sebagai `waived`.
11. Dua user menyimpan payment yang sama bersamaan; hasil akhir satu record tanpa duplikasi.
12. Bukti settlement dapat dibuka user berpermission dan outlet yang benar.
13. Bukti tidak dapat dibuka user tanpa permission atau akses outlet.
14. Mengganti bukti menghapus referensi bukti lama setelah commit.
15. Audit log menyimpan before/after rekonsiliasi.
16. Detail transaksi menampilkan status baru dan link menuju rekonsiliasi.
17. Dashboard menampilkan warning payment belum direkonsiliasi atau mismatch.
18. Status legacy `matched/settled` terpetakan setelah migration.

## Catatan scope

P1-C.1 adalah pencocokan manual per payment. Import CSV/XLSX, auto-matching, dan settlement batch massal masuk P1-C.2 setelah workflow manual stabil.
