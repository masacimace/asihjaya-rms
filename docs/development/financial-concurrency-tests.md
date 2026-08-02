# Financial dan Concurrency Integration Tests

Suite ini menguji invariant finansial Asihjaya RMS terhadap PostgreSQL 17 nyata. Test tidak memakai mock database karena advisory lock, conditional update, transaction rollback, unique constraint, dan concurrent commit hanya dapat divalidasi secara benar oleh PostgreSQL.

## Batas keselamatan

Runner membutuhkan `TEST_DATABASE_URL` dan akan menolak eksekusi bila:

- Protocol bukan PostgreSQL.
- Nama database tidak mengandung token `test` atau `ci`.
- Nama database menyerupai database development/production utama.
- Host bukan localhost/loopback atau service `postgres`, kecuali CI secara eksplisit mengatur `ALLOW_REMOTE_TEST_DATABASE=true`.
- PostgreSQL bukan major version 17.

Suite melakukan `TRUNCATE ... CASCADE` pada seluruh tabel schema `public` sebelum setiap test case. Karena itu, jangan pernah mengarahkannya ke database yang mengandung data nyata.

## Menjalankan otomatis dengan Docker

Command yang direkomendasikan untuk developer Windows, macOS, dan Linux:

```bash
npm run test:financial:local
```

Runner akan:

1. Menghapus container/volume test lama bila ada.
2. Menyalakan `postgres:17-alpine` melalui `compose.financial-test.yaml` pada port lokal `55433`.
3. Menunggu PostgreSQL siap.
4. Menjalankan seluruh Drizzle migration.
5. Menjalankan financial/concurrency suite.
6. Menghapus container dan volume disposable pada blok `finally`, termasuk ketika test gagal.

Database development dari `compose.yaml` tidak digunakan dan file `.env` tidak diubah.

## Menjalankan terhadap database test yang sudah tersedia

Set `TEST_DATABASE_URL` dan `DATABASE_URL` ke database disposable yang sama, jalankan migration, lalu test:

### Windows Command Prompt

```bat
set "TEST_DATABASE_URL=postgresql://asihjaya_test:asihjaya_test_password@127.0.0.1:55433/asihjaya_rms_financial_test"
set "DATABASE_URL=%TEST_DATABASE_URL%"
npm run db:migrate
npm run test:financial
```

### PowerShell

```powershell
$env:TEST_DATABASE_URL = "postgresql://asihjaya_test:asihjaya_test_password@127.0.0.1:55433/asihjaya_rms_financial_test"
$env:DATABASE_URL = $env:TEST_DATABASE_URL
npm run db:migrate
npm run test:financial
```

Alias berikut menjalankan suite yang sama:

```bash
npm run test:concurrency
npm run test:integration
```

## Skenario otomatis

Suite saat ini memeriksa:

1. **Checkout idempotency** — dua claim bersamaan menghasilkan satu owner; replay memakai sale yang sama; perubahan nominal Dana Titip atau approval pembayaran manual dengan key yang sama menjadi conflict.
2. **Checkout retry fencing** — attempt gagal dapat direclaim, attempt processing yang stale dapat diambil alih, dan owner lama tidak dapat menandai attempt baru sebagai completed.
3. **Atomic inventory claim** — hanya satu transaksi dapat menjual item yang sama; tenant lain tidak dapat mengklaim item; partial claim di-rollback penuh.
4. **Dana Titip double spend** — dua debit bersamaan terhadap saldo yang sama tidak dapat membuat saldo negatif.
5. **Manual payment reference race** — advisory lock menyatukan duplicate-reference check dan insertion sehingga reference hanya dipakai satu payment.
6. **Refund replay dan maker-checker** — concurrent execution menghasilkan tepat satu refund, retry menjadi replay, requester tidak boleh menjadi approver, dan tenant lain mendapat not found.
7. **Shift closing** — cash sale/in/out/refund/adjustment direkonsiliasi menjadi expected cash, hanya satu concurrent close yang berhasil, dan selisih kas wajib memiliki catatan.
8. **Settlement import fingerprint** — file hash yang sama hanya dapat diimpor sekali per organization tetapi tetap terisolasi antar-tenant.
9. **Hardware job exactly-once** — satu business intent menghasilkan satu job; retry mengembalikan job yang sama; key yang sama untuk intent berbeda ditolak.
10. **Checkout recovery** — sale yang sudah commit memperbaiki checkout attempt menjadi completed tanpa terlihat oleh tenant lain.

Kontrak tanpa database pada `npm run check:pos-financials` juga memeriksa cash payment, mixed payment, diskon, Dana Titip digunakan, Dana Titip baru, full-deposit checkout, mismatch pembayaran, dan overflow integer.

Setiap test integration membuat fixture organization, outlet, register, user, shift, customer, product, inventory item, dan payment profile sendiri.

## GitHub Actions

Job **Financial & Concurrency Tests** pada `.github/workflows/ci.yml` membuat service PostgreSQL 17 disposable, menjalankan migration, lalu menjalankan:

```bash
npm run test:financial
```

Job terpisah dari migration rehearsal agar failure business/concurrency mudah dibedakan dari failure SQL migration.

## Pemeriksaan manual pelengkap

Automated suite tidak menggantikan smoke test UI/perangkat berikut:

- Loading dan disable state tombol checkout saat request berjalan.
- Pesan yang dilihat kasir ketika item kalah race.
- Recovery UI setelah timeout jaringan.
- Notification Center setelah refund/approval.
- Reprint dan drawer pada Hardware Hub/perangkat fisik.

## Menangani kegagalan

Jangan langsung menambah retry pada test yang gagal. Simpan error dan periksa invariant database terlebih dahulu. Failure concurrency yang intermittent harus dianggap bug sampai terbukti sebagai masalah environment.

Untuk membersihkan resource test manual:

```bash
docker compose -f compose.financial-test.yaml down --volumes --remove-orphans
```

`test:financial:local` sudah menjalankan cleanup tersebut secara otomatis.
