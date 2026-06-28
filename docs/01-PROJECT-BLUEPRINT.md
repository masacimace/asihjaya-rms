# Project Blueprint v0.1

## 1. Tujuan

Membangun ulang sistem retail jewelry Asihjaya sebagai aplikasi production-critical yang menjadi sumber utama untuk transaksi, inventaris, shift kas, dokumen jaminan, dan laporan operasional.

Prinsip produk:

> Sederhana untuk staff, ketat dan aman di belakang sistem.

## 2. Kondisi awal

- Satu outlet.
- Satu mini PC sebagai register utama.
- Tiga staff dalam satu shift.
- Sekitar 1–10 customer per hari.
- Staff juga memakai HP saat mendampingi customer.
- Sistem lama tetap menjadi sumber data migrasi dan referensi workflow, tetapi tidak disalin mentah.

## 3. Stack

- Next.js App Router + TypeScript.
- Tailwind CSS + shadcn/ui.
- PostgreSQL + Drizzle ORM.
- Docker Compose.
- Ubuntu 24.04 LTS untuk production VPS.
- Responsive POS/PWA untuk mini PC, tablet, dan HP.

## 4. Application shells

### Dashboard Admin

Untuk monitoring, administrasi, inventaris, laporan, konfigurasi, user, role, dan audit.

### POS

Untuk open shift, scan/cari item, cart, customer, pembayaran, cetak Surat Jaminan & Bukti Transaksi, dan close shift.

Kedua shell memakai design system yang sama tetapi layout berbeda.

## 5. Scope inti sebelum go-live

1. Login, session, role, permission, dan outlet assignment.
2. Master Produk, Varian opsional, dan Item Produk serialized.
3. Penerimaan barang dan inventory ledger.
4. Label barcode/QR.
5. Shift dan cash movement.
6. POS desktop/mobile dengan draft cart bersama.
7. Pembayaran manual: cash, debit, credit card, transfer, QRIS, split payment.
8. Checkout transactional, row locking, dan idempotency.
9. Surat Jaminan & Bukti Transaksi A5 landscape.
10. Void, refund, approval, dan reversal.
11. Stock opname.
12. Laporan sales, stock, dan finance operasional.
13. Audit log append-only.
14. Backup, monitoring, restore drill, dan data migration.

## 6. Bukan scope fase pertama

- Accounting lengkap/general ledger.
- Native Android/iOS app.
- Full offline checkout.
- Microservices atau Kubernetes.
- Semua metode payment gateway sekaligus.
- Loyalty, marketing campaign, atau advanced analytics.

## 7. Aturan non-negotiable

- Tidak ada hard delete untuk data transaksi dan inventory history.
- Setiap item fisik memiliki barcode/SKU unik dan quantity selalu satu.
- Checkout hanya berhasil dalam satu database transaction.
- Payment status dipisahkan dari sale status.
- Dokumen lama memakai snapshot transaksi, bukan data master terbaru.
- Checkout dan mutasi stok wajib online pada versi pertama.
- Semua tindakan sensitif diperiksa di server dan dicatat di audit log.
- Interface seluruh aplikasi menggunakan Bahasa Indonesia.

## 8. Infrastruktur awal

### VPS

- Caddy/Nginx.
- Next.js application.
- Background worker.
- PostgreSQL.
- Backup job.
- Monitoring agent.

### External services

- Object storage.
- Off-site encrypted backup.
- Error tracking.
- External uptime monitoring.
- WhatsApp provider ketika modul laporan diaktifkan.

## 9. Hardware

- SATO CG408TT untuk label item.
- Printer A4 warna untuk Surat Jaminan & Bukti Transaksi.
- Barcode scanner USB HID pada mini PC.
- Camera-based barcode/QR scanning pada mobile/tablet.
- Cash drawer dikontrol melalui hardware hub/register, bukan langsung dari HP.
