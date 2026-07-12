# P0-A — Database Safety

Tahap ini menambahkan guardrail database sebelum refactor transaction service pada P0-B.
Perubahan ini tidak mengalihkan flow refund/void lama ke ledger baru; tabel baru disiapkan agar transisi P0-B dapat dilakukan tanpa migrasi data struktural tambahan.

## Perubahan

- Satu register hanya dapat memiliki satu shift berstatus `open` atau `closing`.
- Duplicate cash movement dicegah berdasarkan tipe dan source reference.
- Duplicate inventory movement/reversal dicegah per item dan source reference.
- Nilai serta formula utama pada `sales`, `sale_items`, `payments`, `cash_movements`, dan `shifts` dijaga dengan database check constraints.
- Approval memiliki kolom lifecycle eksekusi dan idempotency key yang typed.
- Approval void/refund lama yang sudah dieksekusi dibackfill dari `request_data`.
- Tabel `payment_refunds` disiapkan sebagai refund ledger per payment.
- Script preflight read-only tersedia untuk mendeteksi data lama yang akan menolak migration.

## Urutan rollout

Jangan menjalankan migration pertama kali langsung pada database production.

1. Buat backup database dan lakukan restore test ke database staging/disposable.
2. Hentikan sementara write traffic saat migration production dijalankan.
3. Jalankan dependency install sesuai lockfile:

   ```bash
   npm ci
   ```

4. Jalankan pemeriksaan data read-only:

   ```bash
   npm run db:preflight:p0a
   ```

5. Jangan lanjut apabila ada output `[BLOCKER]`. Periksa dan rapikan record yang disebutkan secara manual dengan audit trail.
6. Jalankan migration:

   ```bash
   npm run db:migrate
   ```

7. Jalankan smoke check:

   ```bash
   npm run typecheck
   npm run lint
   npm run routes:check
   ```

## Catatan rollback

Migration ini menambah enum, tabel, foreign key, unique index, dan check constraint. Setelah aplikasi mulai menulis ke `payment_refunds` atau kolom execution baru, rollback dengan sekadar menghapus migration tidak aman.

Rollback production harus menggunakan salah satu dari berikut:

- Restore backup yang sudah diuji, apabila migration gagal sebelum traffic dibuka kembali.
- Migration rollback khusus yang disusun berdasarkan kondisi data aktual, apabila sistem sudah menerima write setelah deployment.

## Batas tahap P0-A

Constraint database mengurangi risiko duplicate posting, tetapi belum menyelesaikan seluruh race condition void-vs-refund dan belum mengubah cash refund agar memakai shift aktif saat refund dilakukan. Hal tersebut masuk P0-B — Transaction Service.
