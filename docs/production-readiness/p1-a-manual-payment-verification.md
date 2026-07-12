# P1-A — Manual Payment Verification

## Tujuan

P1-A memperketat pembayaran manual non-tunai sebelum Midtrans ditambahkan. Metode yang masuk scope:

- QRIS manual
- Debit EDC
- Credit EDC
- Bank transfer

Cash tidak memakai workflow verifikasi ini.

## Perubahan lifecycle

Payment manual non-tunai tidak lagi cukup dengan nominal dan reference. Checkout sekarang mewajibkan:

- provider/bank/acquirer;
- reference atau approval code;
- sumber verifikasi;
- waktu pembayaran dari provider;
- detail spesifik metode;
- bukti gambar ketika nominal melewati threshold;
- co-verification manager/finance ketika nominal melewati threshold atau reference terdeteksi pernah dipakai.

Checkout yang membutuhkan co-verification berhenti **sebelum sale dibuat dan sebelum inventory berubah**. Setelah approval disetujui, kasir memproses ulang checkout menggunakan idempotency key P0-D yang sama.

## Data wajib per metode

### QRIS manual

- Provider/PJP
- Reference transaksi
- Sumber: aplikasi merchant atau aplikasi bank
- Waktu transaksi provider
- Merchant ID/akun QRIS

### Debit/Credit EDC

- Bank/acquirer
- Approval code pada field reference
- Sumber: terminal EDC
- Waktu transaksi provider
- Terminal ID
- Trace/STAN
- Batch number
- Jaringan kartu
- Last four kartu opsional

Sistem tidak menyediakan field untuk PIN, CVV, track data, atau nomor kartu penuh.

### Bank transfer

- Bank/provider
- Reference transfer
- Sumber: aplikasi bank atau mutasi bank
- Waktu transaksi provider
- Rekening tujuan toko
- Nama pengirim

## Policy default

Migration membuat `manual_payment_policies` untuk setiap organisasi:

| Metode | Co-verification | Bukti wajib | Duplicate lookback |
|---|---:|---:|---:|
| QRIS manual | Rp5.000.000 | Rp5.000.000 | 90 hari |
| Debit EDC | Rp10.000.000 | Rp10.000.000 | 7 hari |
| Credit EDC | Rp10.000.000 | Rp10.000.000 | 7 hari |
| Bank transfer | Rp10.000.000 | Rp10.000.000 | 180 hari |

Policy dapat diedit langsung di database sampai halaman `/settings` dikembangkan pada tahap akhir.

## Duplicate protection

Reference dinormalisasi menjadi huruf kapital alfanumerik. Duplicate scan menggunakan kombinasi:

- organization;
- outlet;
- metode;
- provider yang dinormalisasi;
- reference yang dinormalisasi;
- periode lookback policy.

Checkout juga menolak:

- provider/reference yang sama dua kali di payload yang sama;
- satu bukti gambar yang dipakai untuk dua payment line;
- evidence yang sudah dipakai sale lain;
- evidence kedaluwarsa;
- evidence milik cashier/outlet/organization lain.

Di dalam database transaction, duplicate reference diperiksa kembali setelah memperoleh PostgreSQL advisory lock. Ini menutup race ketika dua cashier memproses reference yang sama bersamaan.

## Evidence lifecycle

Upload disimpan sebagai WebP privat dan dicatat di `payment_evidence_uploads`.

- Evidence sementara kedaluwarsa setelah 7 hari.
- Evidence menjadi attached saat sale berhasil commit.
- Evidence attached tidak memiliki expiry.
- Route media memeriksa organization, outlet, permission, uploader, dan status expiry/attachment.
- Browser menerima `Cache-Control: private, no-store`.

Jalankan cleanup evidence sementara secara periodik:

```bash
npm run payment:evidence:cleanup
```

Rekomendasi production: sekali sehari dari scheduler server.

## Permission

Permission baru:

```text
payments.verify.manual
```

Default diberikan kepada:

- system_admin
- owner
- manager
- finance

Cashier hanya membuat request melalui checkout dan tidak dapat menyetujui request miliknya sendiri. Maker-checker dari P0-C tetap berlaku.

## Payment audit fields

Payment menyimpan:

- `normalized_reference`
- `verification_status`
- `verification_source`
- `provider_paid_at`
- `verification_approval_id`
- `co_verified_by`
- `co_verified_at`
- `evidence_key`
- `settlement_status`
- detail metode pada metadata

Payment manual non-tunai baru dimulai dengan:

```text
status = paid
settlement_status = unreconciled
verification_status = self_verified | co_verified
```

Rekonsiliasi settlement akan dikembangkan pada P1-C.

## Legacy backfill

Migration menandai payment manual lama sebagai:

```text
verification_status = self_verified
settlement_status = unreconciled
```

`verification_source` diturunkan berdasarkan metode, dan metadata diberi:

```json
{
  "manualVerificationMigration": "p1a_legacy_backfill",
  "legacyVerificationAssumption": true
}
```

Ini bukan bukti bahwa transaksi lama sudah diverifikasi dengan SOP baru. Data tersebut harus dianggap legacy sampai direkonsiliasi.

## Rollout

### 1. Backup dan staging restore

Jangan menjalankan migration pertama kali pada production.

### 2. Preflight

```bash
DATABASE_URL='postgresql://...' npm run db:preflight:p1a
```

Preflight memblokir payment legacy yang memiliki:

- provider kosong;
- provider placeholder `manual`;
- reference kosong;
- reference yang setelah normalisasi kurang dari empat karakter.

Duplicate legacy ditampilkan sebagai informasi, bukan blocker.

### 3. Static validation

```bash
npm ci
npm run typecheck
npm run lint
npm run routes:check
npm run check:p0d
npm run check:p1a
```

### 4. Drizzle consistency

```bash
DATABASE_URL='postgresql://...' npm run db:generate
```

Expected:

```text
No schema changes, nothing to migrate
```

### 5. Migration

```bash
DATABASE_URL='postgresql://...' npm run db:migrate
```

Migration:

```text
drizzle/0013_p1a_manual_payment_verification.sql
```

### 6. Login ulang

Logout dan login ulang akun manager/finance agar permission baru dimuat ke session.

### 7. Build

```bash
npm run build
```

## UAT wajib

1. QRIS manual tanpa provider ditolak.
2. QRIS manual tanpa Merchant ID ditolak.
3. QRIS Rp5 juta tanpa evidence ditolak.
4. QRIS Rp5 juta dengan evidence membuat approval sebelum sale dibuat.
5. Cashier tidak dapat approve request miliknya sendiri.
6. Manager/finance dapat membuka evidence privat dan approve.
7. Setelah approve, retry memakai idempotency key yang sama dan membuat satu sale.
8. EDC tanpa Terminal ID, STAN, batch, atau jaringan kartu ditolak.
9. Last four selain tepat empat digit ditolak.
10. Request yang mencoba mengirim nomor kartu penuh ditolak.
11. Transfer tanpa rekening tujuan atau nama pengirim ditolak.
12. Reference yang sama dalam satu payload ditolak.
13. Reference yang sama dengan sale lama membuat co-verification.
14. Dua cashier mengirim reference sama bersamaan: maksimal satu dapat commit tanpa approval duplicate.
15. Satu evidence key tidak dapat digunakan pada dua payment line.
16. Evidence cashier A tidak dapat dipakai cashier B.
17. Evidence outlet A tidak dapat dipakai outlet B.
18. Evidence sementara yang expired tidak dapat dibuka atau dipakai checkout.
19. Evidence attached tetap dapat dibuka dari detail sale.
20. Detail sale menampilkan source, provider time, co-verifier, settlement, dan evidence.
21. Payment non-tunai baru berstatus `unreconciled`.
22. Cash payment tetap `not_applicable` dan tidak memiliki field evidence/verifikasi manual.
23. Timeout/retry P0-D tetap menghasilkan satu invoice dan satu evidence attachment.
24. Jalankan cleanup dan pastikan hanya evidence expired yang belum attached yang dihapus.

## Query verifikasi pascamigrasi

```sql
select method, verification_status, settlement_status, count(*)
from payments
group by method, verification_status, settlement_status
order by method, verification_status, settlement_status;
```

```sql
select organization_id, method, co_verification_threshold,
       evidence_threshold, duplicate_lookback_days, is_enabled
from manual_payment_policies
order by organization_id, method;
```

```sql
select sale_id, count(*)
from payment_evidence_uploads
where sale_id is not null
group by sale_id
order by count(*) desc;
```

## Batas P1-A

P1-A belum melakukan pencocokan payment dengan settlement bank/PJP. Semua non-tunai baru tetap `unreconciled` sampai P1-C. P1-A juga belum mengintegrasikan Midtrans; QRIS pada tahap ini masih diverifikasi manual.
