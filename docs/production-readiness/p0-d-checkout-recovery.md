# P0-D — Checkout Recovery & Idempotency

## Tujuan

Mencegah transaksi ganda dan kondisi "server sudah commit tetapi HP sales tidak menerima response" pada POS manual checkout.

## Perubahan database

Migration `drizzle/0012_p0d_checkout_recovery.sql` menambahkan:

- enum `pos_checkout_attempt_status` (`processing`, `completed`, `failed`),
- tabel `pos_checkout_attempts`,
- kolom nullable `sales.checkout_fingerprint`.

`pos_checkout_attempts.idempotency_key` bersifat unik. Setiap attempt menyimpan organization, outlet, register, shift, cashier, request fingerprint, jumlah retry, error terakhir, dan sale hasil checkout.

## Lifecycle

```text
processing -> completed
processing -> failed
failed -> processing (retry payload yang sama)
processing stale -> processing (reclaim setelah 5 menit)
```

Satu idempotency key tidak boleh digunakan untuk payload berbeda. Fingerprint mencakup:

- organization, outlet, register, shift, dan cashier,
- daftar item,
- payment dan nominal,
- customer,
- catatan,
- approval serta nominal diskon.

## Recovery browser

Browser menyimpan checkout attempt di `sessionStorage` sebelum memanggil server. State tersebut berisi payload, payment draft, dan approval diskon.

Apabila request timeout, tab di-refresh, atau response hilang:

1. POS memanggil `GET /api/pos/checkout-attempts/{idempotencyKey}`.
2. Jika sale ditemukan, layar success dipulihkan dengan invoice yang sama.
3. Jika masih `processing`, POS melakukan polling terbatas.
4. Jika `failed` atau belum tercatat, tombol checkout dapat ditekan ulang dengan idempotency key yang sama.
5. Jika payload berubah, attempt lama dibuang dan key baru dibuat.

## Rollout

Jalankan pada staging atau hasil restore database terlebih dahulu:

```bash
npm ci
npm run typecheck
npm run lint
npm run routes:check

DATABASE_URL='postgresql://user:pass@host:5432/database' npm run db:generate
npm run db:migrate
npm run build
```

`db:generate` setelah patch diterapkan harus menghasilkan `No schema changes, nothing to migrate`.

## UAT wajib

### 1. Double tap

- Gunakan cart dan payment yang valid.
- Tekan tombol checkout dua kali dengan cepat.
- Pastikan hanya satu row `sales`, satu cash movement, satu set inventory movement, dan satu invoice tercipta.

### 2. Response hilang setelah commit

- Putuskan koneksi browser tepat setelah request dikirim atau gunakan proxy untuk menggagalkan response.
- Pastikan database sudah memiliki sale.
- Sambungkan kembali jaringan.
- Pastikan POS memulihkan invoice yang sama dan tidak membuat sale kedua.

### 3. Refresh saat processing

- Mulai checkout lalu refresh tab sebelum response selesai.
- Pastikan cart/payment dipulihkan dan POS memeriksa status attempt.
- Jika server sudah commit, layar success harus muncul.

### 4. Retry system error

- Simulasikan error sementara sebelum transaction commit.
- Pastikan attempt berubah menjadi `failed`.
- Tekan checkout lagi tanpa mengubah payload.
- Pastikan attempt count bertambah dan key tetap sama.

### 5. Payload conflict

- Buat attempt lalu gunakan key yang sama untuk nominal, customer, item, payment reference, shift, atau diskon berbeda.
- Pastikan server mengembalikan `idempotency_conflict`.
- Pastikan tidak ada sale atau movement tambahan.
- Pastikan audit `pos.checkout.idempotency_conflict` tercatat.

### 6. Shift berubah

- Buat attempt pada shift A.
- Tutup shift A sebelum retry yang gagal sebelumnya.
- Pastikan retry tidak dipindahkan diam-diam ke shift B dan ditolak dengan pesan shift checkout tidak aktif.

### 7. Concurrent request

- Kirim dua request dengan key dan payload identik secara paralel.
- Satu request boleh memproses; request lain harus menerima `processing` atau sale hasil replay.
- Setelah selesai, keduanya harus mengarah ke invoice yang sama.

### 8. Recovery access scope

- Coba query attempt milik cashier, outlet, atau organization lain.
- Endpoint harus menjawab `not_found` tanpa membocorkan detail transaksi.

## Query pemeriksaan

```sql
select
  idempotency_key,
  status,
  attempt_count,
  sale_id,
  last_error_code,
  started_at,
  completed_at,
  failed_at
from pos_checkout_attempts
order by created_at desc
limit 50;
```

Duplicate sale seharusnya tidak ada:

```sql
select idempotency_key, count(*)
from sales
group by idempotency_key
having count(*) > 1;
```

## Catatan

- Jangan menghapus row attempt secara agresif. Simpan minimal selama periode audit transaksi yang disepakati.
- `sales.checkout_fingerprint` nullable untuk kompatibilitas transaksi lama.
- Attempt lama yang `processing` dapat direclaim setelah lima menit. Update `completed`/`failed` juga membawa `attempt_count` sebagai generation guard, sehingga worker lama tidak dapat menimpa retry yang lebih baru. Unique sale key dan conditional inventory update tetap menjadi lapisan pertahanan terakhir.
