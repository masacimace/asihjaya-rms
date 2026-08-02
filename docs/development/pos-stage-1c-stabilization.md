# POS Stage 1C — Stabilization dan Pull Request

Dokumen ini menjadi checklist penutupan refactor POS Stage 1C sebelum branch `refactor/pos-stage-1c` digabungkan ke `main`.

## Tujuan

Stage 1C memecah dua file POS terbesar menjadi boundary yang lebih jelas tanpa mengubah kontrak bisnis atau UI/UX:

- checkout server-side dipisahkan ke service dan pure helper;
- payment, scanner, cart, customer, held-cart, discount, serta checkout recovery dipisahkan ke domain module dan hook;
- katalog, cart, payment, dialog, receipt/result, shift, dan mobile shell dipisahkan ke komponen visual;
- `pos-workspace.tsx` menjadi composition/orchestration component.

Baseline refactor menurunkan `pos-workspace.tsx` dari sekitar 5.654 menjadi 974 baris dan `src/app/actions/pos.ts` dari sekitar 5.114 menjadi 4.408 baris. Total baris project tidak dijadikan target karena kode dipindahkan ke modul yang lebih kecil, bertipe jelas, dan dapat diuji.

## Boundary akhir

### Server checkout

```text
src/features/pos/checkout/
src/features/pos/checkout-attempt-service.ts
src/features/pos/checkout-financials.ts
```

### Frontend domain dan orchestration

```text
src/features/pos/payment-*.ts
src/features/pos/cart-*.ts
src/features/pos/customer-state.ts
src/features/pos/held-cart-state.ts
src/features/pos/checkout-client-state.ts
src/features/pos/use-pos-*.ts
src/features/pos/workspace-state.ts
```

### Visual composition

```text
src/components/pos/workspace/
src/components/pos/pos-workspace.tsx
```

`pos-workspace.tsx` tetap menjadi entry component. File tersebut menghubungkan hook, derived state, event handler, dan komponen visual; business rule baru tidak boleh ditambahkan langsung ke blok JSX.

## Gate otomatis

Kontrak khusus hasil Stage 1C dapat dijalankan melalui:

```bash
npm run check:pos-stage-1c
```

Stabilization tanpa PostgreSQL disposable:

```bash
npm run verify:pos-stage-1c
```

Stabilization final lokal, termasuk financial/concurrency integration suite:

```bash
npm run verify:pos-stage-1c:local
```

Runner final menjalankan secara fail-fast:

1. `check:stabilization`;
2. `test:financial:local` pada mode lokal;
3. kontrak Hardware Hub sisi aplikasi;
4. clean production build.

GitHub Actions tetap menjadi sumber status merge untuk static quality, container build, security/business, migration PostgreSQL 17, Hardware Hub, serta financial/concurrency suite.

## Smoke test manual POS

Lakukan pada browser dan outlet/register test, bukan data production.

### Shift

- Buka shift dengan opening cash.
- Pastikan POS tidak dapat checkout tanpa shift aktif.
- Tutup shift dengan nominal seimbang, surplus, dan shortage pada rehearsal terpisah.

### Katalog dan cart

- Search melalui nama, SKU, barcode, QR, dan serial number.
- Scan item melalui modal kamera atau command scanner.
- Tambahkan dan hapus item.
- Pastikan item duplikat dan item tanpa harga ditolak seperti sebelumnya.
- Reload browser dan pastikan active cart dipulihkan.

### Customer dan held cart

- Pilih customer existing.
- Quick-create customer dan jalankan duplicate-customer flow.
- Hold cart, buka daftar held cart, lalu resume.
- Pastikan customer dan item dipulihkan dengan benar.

### Diskon dan payment

- Request approval diskon dan refresh status sampai approved/rejected.
- Uji cash dengan uang pas dan kembalian.
- Uji debit/credit EDC dengan profile, reference, dan evidence yang diwajibkan.
- Uji mixed payment serta Dana Titip masuk/digunakan.
- Pastikan overpayment non-cash tetap ditolak.

### Checkout dan recovery

- Finalisasi checkout normal.
- Klik submit hanya sekali dan pastikan loading/disabled state benar.
- Reload atau putuskan koneksi ketika checkout berstatus processing, lalu pastikan recovery memakai idempotency key yang sama.
- Pastikan cart, payment, discount, dan stored attempt dibersihkan setelah completed.

### Receipt dan Hardware Hub

- Buka PDF A4 dan preview receipt.
- Pastikan status print job dan short job ID tampil.
- Pada environment outlet, validasi antrean Hardware Hub dan print fisik secara terpisah.

## Review pull request

Buat satu pull request:

```text
base: main
compare: refactor/pos-stage-1c
```

Judul yang disarankan:

```text
refactor: modularize POS workspace and checkout flows
```

Reviewer perlu memusatkan perhatian pada:

- dependency array hook dan kemungkinan stale closure;
- transaction/idempotency boundary checkout;
- reset state setelah cart, customer, discount, payment, dan checkout berubah;
- kompatibilitas session-storage recovery;
- kesetaraan class, label, dan urutan visual komponen yang diekstrak;
- tidak adanya migration, dependency, atau environment variable yang tidak disengaja.

Gunakan **Create a merge commit** agar checkpoint refactor per domain tetap terlihat. Setelah seluruh status check hijau dan smoke test selesai, merge satu kali ke `main`.

## Setelah merge

```bash
git switch main
git pull --ff-only origin main
git branch -d refactor/pos-stage-1c
git push origin --delete refactor/pos-stage-1c
```

Rollback paling aman adalah me-revert merge commit Stage 1C secara utuh. Jangan melakukan rollback parsial lintas checkpoint kecuali dependency antarmodul sudah dianalisis.
