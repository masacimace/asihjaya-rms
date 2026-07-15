# ASIHJAYA RMS — Payment Production Roadmap

> Status: **ON HOLD**
>
> Dokumen ini mencatat tahapan lanjutan setelah P1-C.2 agar development payment system dapat diteruskan tanpa kehilangan konteks.
>
> Terakhir diperbarui: 2026-07-14

---

## Current Baseline

Tahapan yang sudah diselesaikan sebelum roadmap ini:

- P0-A — Database Safety
- P0-B — Transaction Service
- P0-C — Authorization
- P0-D — Checkout Recovery & Idempotency
- P1-A — Manual Payment Verification
- P1-A.1 — Fast Manual Payment UX
- P1-B — Refund & Return Inspection Workflow
- P1-B.1 — Transaction Correction UX & Eligibility
- P1-C.1 — Manual Payment Reconciliation
- P1-C.2 — Import Settlement & Auto-Matching

Fondasi yang sudah tersedia:

- Checkout idempotent dan dapat dipulihkan setelah timeout atau refresh.
- Manual payment memiliki profile, structured verification, duplicate detection, evidence, dan co-verification.
- Void dan refund memiliki transaction service atomik.
- Refund tidak langsung mengembalikan barang menjadi available.
- Return inspection memiliki workflow penerimaan, pemeriksaan, restock, repair, damaged, dan rejected.
- Reconciliation manual dan import settlement CSV sudah tersedia.
- Permission dan audit trail untuk workflow finansial sudah tersedia.

---

# P1-D — Automated Payment & Concurrency Tests

## Objective

Membuktikan bahwa seluruh lifecycle pembayaran tetap konsisten ketika terjadi:

- Double-submit
- Network timeout
- Retry
- Concurrent request
- Approval race
- Refund race
- Settlement race
- Database rollback
- Browser refresh
- User berbeda mengakses resource yang sama

Tahap ini wajib diselesaikan sebelum integrasi payment gateway production.

---

## P1-D.1 — Isolated Test Database & Test Infrastructure

### Scope

- Menambahkan database test terisolasi.
- Menambahkan `TEST_DATABASE_URL`.
- Menjalankan migration pada database test.
- Menambahkan seed minimum khusus integration test.
- Menambahkan helper reset database.
- Memastikan test tidak pernah menyentuh database development atau production.
- Menambahkan command test yang aman untuk local dan CI.

### Rekomendasi command

```bash
npm run test:db:prepare
npm run test:integration
npm run test:concurrency
npm run test:e2e
```

### Exit criteria

- Database test dapat dibuat dan di-reset otomatis.
- Seluruh migration dapat dijalankan dari database kosong.
- Test gagal cepat jika `TEST_DATABASE_URL` menunjuk database development/production.
- Test dapat dijalankan berulang tanpa meninggalkan state.

---

## P1-D.2 — Checkout & Idempotency Tests

### Test cases

- Dua sales mencoba menjual item yang sama.
- Double-click checkout menghasilkan satu sale.
- Retry dengan idempotency key sama mengembalikan sale yang sama.
- Idempotency key sama dengan payload berbeda ditolak.
- Response hilang setelah commit lalu invoice dapat dipulihkan.
- Browser refresh tidak menciptakan transaksi baru.
- Attempt stale dapat di-reclaim tanpa duplicate sale.
- Payment, inventory movement, cash movement, audit log, dan print job tidak terbuat ganda.

### Exit criteria

- Semua test deterministik.
- Tidak ada duplicate financial row.
- Tidak ada item terjual dua kali.
- Tidak ada checkout yang berakhir dalam state ambigu tanpa recovery path.

---

## P1-D.3 — Manual Payment Verification Tests

### Test cases

- QRIS tanpa profile aktif ditolak.
- EDC tanpa approval/reference ditolak.
- Transfer tanpa reference ditolak.
- Duplicate reference memerlukan co-verification.
- Nominal tinggi memerlukan approval.
- Evidence outlet lain ditolak.
- Evidence cashier lain ditolak.
- Profile dinonaktifkan saat checkout menyebabkan rollback.
- Cashier tidak dapat approve request sendiri.
- Permission finance, manager, cashier, dan stock admin tetap sesuai policy.

### Exit criteria

- Seluruh verification invariant diuji otomatis.
- Manipulasi payload browser tidak dapat melewati backend validation.
- Tidak ada payment manual berstatus paid tanpa verification metadata yang diwajibkan.

---

## P1-D.4 — Void, Refund & Approval Concurrency Tests

### Test cases

- Refund vs refund.
- Void vs void.
- Refund vs void.
- Approve vs reject.
- Execute approval dua kali.
- Shift ditutup ketika refund berjalan.
- Cash refund tanpa shift aktif ditolak.
- Payment refund ledger tidak terbuat ganda.
- Inventory reversal tidak terbuat ganda.
- Approval execution state tetap konsisten ketika terjadi error.

### Exit criteria

- Hanya satu state transition valid yang berhasil.
- Tidak ada double cash refund.
- Tidak ada duplicate refund ledger.
- Tidak ada sale berstatus voided dan refunded sekaligus.
- Seluruh rollback menjaga database konsisten.

---

## P1-D.5 — Return Inspection Tests

### Test cases

- Item tidak dapat diterima dua kali.
- Barcode/serial salah ditolak.
- Item yang belum diterima tidak dapat diperiksa.
- Dua inspector tidak dapat memberi keputusan berbeda.
- Restock dengan identity mismatch ditolak.
- Restock dengan selisih berat di atas tolerance ditolak.
- Damaged/rejected tanpa evidence yang diwajibkan ditolak.
- Item inspection tidak dapat dijual di POS.
- Return case selesai hanya setelah semua item diproses.

### Exit criteria

- Setiap return item memiliki satu lifecycle akhir.
- Inventory tidak pernah menjadi available sebelum inspection selesai.
- Audit trail penerimaan dan inspection lengkap.

---

## P1-D.6 — Reconciliation Tests

### Test cases

- Satu payment hanya memiliki satu reconciliation.
- Gross sama menghasilkan reconciled.
- Gross berbeda menghasilkan mismatch.
- Fee dan tax menghasilkan net settlement yang benar.
- `not_found` dan `waived` wajib mempunyai alasan.
- Dua finance user tidak dapat memproses payment sama secara bersamaan.
- Omzet tidak berubah akibat reconciliation.
- Settlement evidence tidak dapat diakses lintas organization/outlet.

### Exit criteria

- Formula settlement tervalidasi di application dan database.
- Reconciliation tidak mengubah sale amount.
- Mismatch dan exception memiliki audit trail yang lengkap.

---

## P1-D.7 — Settlement Import Tests

### Test cases

- File CSV identik tidak membuat batch kedua.
- Formula injection ditolak.
- Header duplikat atau kosong ditolak.
- Exact reference dan amount menghasilkan matched.
- Reference ambigu tidak otomatis diterapkan.
- Gross berbeda menghasilkan mismatch.
- Payment outlet lain tidak menjadi kandidat.
- Double-submit commit tidak membuat reconciliation ganda.
- Candidate manual hanya dapat memakai kandidat dari backend.
- File source privat tidak dapat dibuka tanpa permission.

### Exit criteria

- Import bersifat idempotent.
- Batch dapat di-retry tanpa duplicate reconciliation.
- Auto-match tidak pernah memilih kandidat ambigu.
- Review queue memiliki audit trail yang lengkap.

---

## P1-D.8 — CI Quality Gate

### Required pipeline

```bash
npm ci
npm run typecheck
npm run lint
npm run routes:check
npm run test:integration
npm run test:concurrency
npm run test:e2e
npm run build
```

### Exit criteria

- Deploy diblokir jika satu test finansial gagal.
- Test report tersimpan sebagai artifact CI.
- Database test selalu dibersihkan.
- Flaky test tidak diterima sebagai kondisi normal.

---

# P2-A — Midtrans QRIS Gateway Foundation

## Objective

Menambahkan QRIS dinamis melalui Midtrans tanpa mengunci business logic ke satu provider.

## Scope

- Membuat `PaymentGatewayProvider` abstraction.
- Implementasi awal `MidtransPaymentGatewayProvider`.
- Konfigurasi merchant account per organization/outlet.
- Penyimpanan credential melalui environment variable atau secret manager.
- Membuat pending sale.
- Reserve inventory.
- Membuat payment berstatus pending.
- Request QRIS dinamis ke Midtrans.
- Menampilkan QR pada POS.
- Menyimpan provider reference, external order ID, QR payload, dan expiry.
- Menjaga secret key hanya di server.

## Recommended lifecycle

```text
create pending sale
→ reserve item
→ create payment pending
→ call Midtrans
→ show QR
→ wait for webhook/status inquiry
```

## Exit criteria

- QRIS dapat dibuat di sandbox.
- Item tidak menjadi sold sebelum payment confirmed.
- Provider timeout tidak menciptakan duplicate sale.
- Retry menggunakan external order ID yang sama.
- QR expired tidak dapat digunakan kembali.

---

# P2-B — Webhook, Expiry & Payment Recovery

## Objective

Membuat lifecycle gateway tahan terhadap webhook duplicate, webhook terlambat, timeout, dan process crash.

## Scope

- Endpoint webhook Midtrans.
- Signature verification.
- Raw payload storage.
- Webhook event idempotency.
- Status mapping provider ke internal status.
- Payment finalization atomik.
- Expiry worker.
- Status inquiry fallback.
- Recovery untuk webhook yang hilang.
- POS polling ke backend.
- Unknown-outcome UI.
- Release inventory setelah expiry yang sudah diverifikasi.

## Exit criteria

- Duplicate webhook hanya diproses sekali.
- Paid payment hanya difinalisasi sekali.
- Expired payment melepaskan reservation dengan aman.
- Payment yang sukses tetapi webhook terlambat dapat dipulihkan melalui inquiry.
- Browser tidak pernah menjadi source of truth payment status.

---

# P2-C — Gateway Refund & Reconciliation

## Objective

Menghubungkan refund dan settlement gateway dengan ledger internal.

## Scope

- Full refund Midtrans.
- Partial refund jika provider/channel mendukung.
- Refund request dan approval.
- Refund webhook/status inquiry.
- Gateway fee, tax, dan net settlement.
- Import settlement Midtrans.
- Auto-match berdasarkan provider reference.
- Gateway reconciliation dashboard.
- Mismatch dan delayed settlement alerts.
- Gateway refund ledger terhubung dengan `payment_refunds`.
- Return inspection tetap terpisah dari refund finansial.

## Exit criteria

- Refund internal dan provider selalu dapat direkonsiliasi.
- Tidak ada payment ditandai refunded sebelum provider mengonfirmasi.
- Settlement gateway dapat dicocokkan dengan payment internal.
- MDR tidak mengurangi omzet.
- Partial refund tidak melebihi paid amount.
- Audit trail mencakup request, provider response, webhook, dan final status.

---

# Production Readiness Review

## Objective

Menentukan apakah RMS/POS aman untuk digunakan sebagai sistem operasional utama toko.

---

## 1. Database & Migration

- Seluruh migration berhasil dari database kosong.
- Backup dan restore drill berhasil.
- Migration preflight terdokumentasi.
- Tidak ada migration drift.
- Financial constraints aktif.
- Partial unique indexes aktif.
- Semua production migration forward-only.

## 2. Payment Lifecycle

- Checkout manual lulus test.
- QRIS gateway lulus sandbox dan production simulation.
- Retry dan recovery teruji.
- Refund dan void atomik.
- Return inspection teruji.
- Reconciliation teruji.
- Settlement import teruji.
- Unknown-outcome dapat dipulihkan.

## 3. Authorization

- Least privilege diterapkan.
- Maker-checker aktif.
- Cashier tidak dapat approve request sendiri.
- Finance hanya mengakses fitur finance.
- Stock admin tidak dapat melakukan tindakan payment sensitif.
- Custom role sudah direview.

## 4. Security

- Tidak ada `.env` di repository.
- Credential production sudah dirotasi.
- Secret tidak dikirim ke browser.
- Upload privat dan tervalidasi.
- Audit log tidak menyimpan data kartu sensitif.
- Dependency audit sudah ditangani.
- Rate limit dan CSRF/server-action protections ditinjau.
- Webhook signature verification aktif.

## 5. Operations

- Error monitoring aktif.
- Structured logs aktif.
- Alert payment failure aktif.
- Alert reconciliation mismatch aktif.
- Alert shift variance aktif.
- Scheduler dan worker memiliki health check.
- Hardware Hub recovery diuji.
- SOP offline/network failure tersedia.

## 6. UAT Store Simulation

Simulasikan:

- Satu manager pada mini PC.
- Empat sales menggunakan HP.
- Concurrent checkout.
- Shift opening dan closing.
- Cash, QRIS manual, EDC, transfer.
- Refund dan void.
- Return inspection.
- Settlement reconciliation.
- Printer/hardware failure.
- Internet putus dan tersambung kembali.

## 7. Production Deployment

- Database production kosong dan tervalidasi.
- Migration production berhasil.
- Seed production minimum.
- Owner dan manager account diverifikasi.
- Payment profiles production dibuat.
- Midtrans production credential tervalidasi.
- Backup otomatis aktif.
- Rollback plan tersedia.
- Maintenance window disepakati.
- Go-live checklist ditandatangani.

---

# Recommended Execution Order

```text
P1-D.1 Test Infrastructure
→ P1-D.2 Checkout Tests
→ P1-D.3 Manual Payment Tests
→ P1-D.4 Void/Refund Concurrency Tests
→ P1-D.5 Return Inspection Tests
→ P1-D.6 Reconciliation Tests
→ P1-D.7 Settlement Import Tests
→ P1-D.8 CI Quality Gate
→ P2-A Midtrans Foundation
→ P2-B Webhook & Recovery
→ P2-C Gateway Refund & Reconciliation
→ Production Readiness Review
```

---

# Resume Checklist

Saat roadmap ini dilanjutkan:

1. Pastikan branch terbaru tidak memiliki migration drift.
2. Jalankan seluruh existing checks.
3. Backup database development.
4. Buat database test terpisah.
5. Mulai dari P1-D.1.
6. Jangan mulai Midtrans sebelum test infrastructure dan concurrency tests selesai.
7. Jangan menyatakan production-ready sebelum seluruh exit criteria Production Readiness Review terpenuhi.

---

# Suggested Git Commit When This Roadmap Is Added

```bash
git add -- "docs/roadmap/payment-production-roadmap.md"

git commit -m "docs(roadmap): add payment production readiness plan"

git push origin HEAD
```
