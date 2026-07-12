# P1-A.1 — Fast Manual Payment UX

## Tujuan

Tahap ini mempertahankan guardrail P1-A, tetapi mengurangi input cashier pada transaksi normal.
Data berulang seperti provider, Merchant ID, Terminal ID, rekening tujuan, dan sumber verifikasi dipindahkan ke **payment profile** yang dikelola per outlet.

Pada fast lane, cashier cukup:

1. memilih profile pembayaran (otomatis terpilih jika hanya ada satu),
2. memasukkan reference/approval code,
3. mengonfirmasi bahwa status berhasil terlihat pada perangkat atau rekening toko.

Field tambahan hanya dibuka ketika diperlukan untuk risiko tinggi, duplicate reference, atau kebutuhan rekonsiliasi.

## Perubahan database

Migration:

```text
drizzle/0014_p1a1_fast_manual_payment_ux.sql
```

Migration menambahkan:

- tabel `manual_payment_profiles`,
- `payments.manual_payment_profile_id`,
- index dan constraint profile,
- penyesuaian threshold default P1-A yang belum pernah dikustomisasi.

Migration tidak mengubah payment historis. Payment lama tetap memiliki snapshot provider/reference yang sudah tersimpan.

## Default threshold baru

| Metode | Evidence wajib | Co-verification |
|---|---:|---:|
| QRIS manual | Rp7.500.000 | Rp9.000.000 |
| Debit EDC | Rp20.000.000 | Rp30.000.000 |
| Credit EDC | Rp20.000.000 | Rp30.000.000 |
| Bank transfer | Rp25.000.000 | Rp40.000.000 |

Migration hanya menaikkan policy yang masih sama persis dengan default P1-A lama. Policy yang pernah diubah manual tidak ditimpa.

Duplicate reference tetap selalu memerlukan co-verification, terlepas dari nominal.

## Payment profile

Profile dikelola melalui:

```text
Admin → Pengaturan → Pembayaran Manual
```

### QRIS profile

Menyimpan:

- nama profile,
- provider/PJP,
- Merchant ID,
- sumber verifikasi,
- outlet,
- register opsional.

### EDC profile

Menyimpan:

- nama terminal,
- acquirer/provider,
- Terminal ID,
- outlet,
- register opsional.

Satu EDC profile dapat digunakan untuk debit dan credit.

### Bank account profile

Menyimpan:

- nama rekening,
- bank/provider,
- rekening tujuan yang ditampilkan ke cashier,
- sumber verifikasi,
- outlet,
- register opsional.

Profile yang dipetakan ke register hanya tersedia pada register tersebut. Profile tanpa register tersedia untuk seluruh register pada outlet yang sama.

## Guardrail server-side

Frontend tidak dipercaya untuk menentukan provider atau identitas terminal/rekening.
Saat checkout, backend:

1. mengambil profile dari database,
2. memastikan organization dan outlet sesuai,
3. memastikan profile aktif,
4. memastikan profile mendukung metode pembayaran,
5. memastikan mapping register sesuai,
6. menyalin provider dan identifier profile ke payment metadata,
7. menyimpan `manual_payment_profile_id` pada payment.

Profile diperiksa kembali di dalam transaction checkout. Profile yang dinonaktifkan atau dipindahkan saat checkout berlangsung akan menyebabkan checkout ditolak dan rollback.

## Fast lane per metode

### QRIS manual

Wajib saat transaksi normal:

- profile QRIS,
- reference,
- konfirmasi pembayaran berhasil.

Merchant ID, provider, sumber verifikasi, dan waktu default diambil otomatis.

### Debit/Credit EDC

Wajib saat transaksi normal:

- profile EDC,
- approval code/reference,
- konfirmasi terminal berhasil.

Terminal ID dan acquirer berasal dari profile. STAN, batch, network, last-four, dan evidence berada di panel detail tambahan.

### Bank transfer

Wajib saat transaksi normal:

- profile rekening tujuan,
- reference transfer,
- konfirmasi dana terlihat masuk.

Nama pengirim diwajibkan ketika nominal mencapai co-verification threshold. Evidence tetap mengikuti evidence threshold.

## Checkout recovery compatibility

Format checkout attempt browser dinaikkan ke versi 2.
Attempt session P1-A lama otomatis dibuang agar tidak diretry menggunakan payload tanpa payment profile.

Sebelum rollout, preflight juga memastikan tidak ada:

- checkout attempt database yang masih `processing`,
- approval manual payment lama yang masih `pending`.

## Rollout staging

### 1. Backup

Buat backup database dan uji restore sebelum migration.

### 2. Preflight

```bash
DATABASE_URL='postgresql://user:pass@host:5432/database' \
  npm run db:preflight:p1a1
```

Semua pemeriksaan harus `[OK]`.

### 3. Static checks

```bash
npm ci
npm run typecheck
npm run lint
npm run routes:check
npm run check:p0d
npm run check:p1a
npm run check:p1a1
```

### 4. Schema check

```bash
DATABASE_URL='postgresql://user:pass@host:5432/database' \
  npm run db:generate
```

Hasil yang diharapkan:

```text
No schema changes, nothing to migrate
```

### 5. Migration

```bash
DATABASE_URL='postgresql://user:pass@host:5432/database' \
  npm run db:migrate
```

### 6. Konfigurasi wajib sebelum POS noncash digunakan

Buat minimal satu profile aktif untuk setiap metode yang dipakai outlet:

- QRIS account,
- EDC terminal,
- rekening bank tujuan.

Tanpa profile yang sesuai, POS akan menolak penambahan payment noncash.

### 7. Build

```bash
npm run build
```

### 8. Session rollout

Minta user POS refresh atau login ulang. Checkout attempt session lama akan dibuang otomatis.

## UAT wajib

1. QRIS dengan satu profile otomatis memilih profile tersebut.
2. QRIS normal dapat ditambahkan hanya dengan reference dan confirmation.
3. QRIS tanpa confirmation ditolak.
4. QRIS di atas evidence threshold tetap meminta evidence.
5. QRIS mendekati batas co-verification membuat approval.
6. Debit/credit normal tidak meminta STAN, batch, atau network.
7. Detail EDC tambahan dapat dibuka dan disimpan saat diperlukan.
8. EDC profile yang terikat Register A tidak tampil di Register B.
9. Transfer normal tidak mewajibkan nama pengirim.
10. Transfer di atas co-verification threshold mewajibkan nama pengirim.
11. Profile nonaktif tidak dapat dipakai walaupun halaman POS belum direfresh.
12. Profile outlet lain tidak dapat dikirim melalui payload yang dimodifikasi.
13. Profile register lain tidak dapat dipakai melalui payload yang dimodifikasi.
14. Duplicate reference tetap membuat approval meskipun nominal rendah.
15. Retry checkout memakai profile dan idempotency key yang sama.
16. Session checkout attempt format lama dibuang tanpa membuat sale.
17. Payment yang berhasil menyimpan `manual_payment_profile_id` dan snapshot profile di metadata.
18. Custom threshold lama tidak berubah setelah migration.

## Operasional

Setelah satu bulan, evaluasi:

- persentase transaksi yang masuk co-verification,
- waktu rata-rata payment entry,
- jumlah duplicate reference,
- jumlah mismatch saat reconciliation,
- jumlah evidence yang diunggah,
- profile yang paling sering dipilih per register.

Target awal: hanya sekitar 5–10% transaksi berisiko tertinggi yang masuk co-verification, sementara transaksi normal dapat dicatat dalam beberapa detik setelah status berhasil terlihat pada perangkat toko.
