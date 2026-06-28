# Development Roadmap

## Milestone 0 — Blueprint dan foundation

- [x] Blueprint awal.
- [x] Domain model awal.
- [x] Permission matrix awal.
- [x] Next.js/TypeScript/Tailwind/Drizzle scaffold.
- [x] Docker Compose PostgreSQL lokal.
- [ ] Repository Git remote dan branch protection.
- [ ] CI lint, typecheck, build.

## Milestone 1 — Identity dan administration

- Authentication dan session.
- Organization/outlet/register.
- Staff & pengguna.
- Role dan permission.
- Audit log dasar.
- Admin shell production-grade.

## Milestone 2 — Catalog dan inventory

- Kategori dan atribut.
- Master Produk.
- Varian Produk opsional.
- Item Produk serialized.
- Penerimaan barang.
- Inventory movement.
- Label printing dan SATO test.

## Milestone 3 — Shift dan POS core

- Open/close shift.
- Cash movement.
- POS desktop.
- POS mobile/tablet.
- Camera barcode scanning.
- Draft/held sale lintas perangkat.
- Customer.

## Milestone 4 — Checkout dan payment manual

- Cash, EDC, transfer, QRIS manual.
- Split payment.
- Idempotency.
- Row locking.
- Sale/payment status machine.
- Reconciliation dasar.

## Milestone 5 — Dokumen dan hardware

- Surat Jaminan & Bukti Transaksi.
- Snapshot dokumen.
- Print log dan reprint.
- Local print agent/hardware hub.
- Cash drawer policy.

## Milestone 6 — Control dan reporting

- Diskon/approval.
- Void/refund/reversal.
- Stock opname.
- Sales/stock/finance reports.
- WhatsApp report worker.

## Milestone 7 — Migration dan production readiness

- Mapping sistem lama.
- Rehearsal import.
- UAT dengan tiga staff.
- Security review.
- Backup/PITR dan restore drill.
- Monitoring dan alert.
- Staging dan production deployment.
- Cutover serta periode rekonsiliasi.
