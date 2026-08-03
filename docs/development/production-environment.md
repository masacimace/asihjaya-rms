# Production Environment & Secret Management

Tahap 1D.2 menetapkan satu kontrak environment production yang tervalidasi, tidak masuk Git/image, dan dapat dirotasi secara terencana.

## File dan lokasi

Repository hanya menyimpan template berikut:

```text
.env.production.example
```

File berisi secret sebenarnya harus berada di luar Git. Untuk lokal gunakan `.env.production`. Pada VPS, lokasi yang direkomendasikan:

```text
/etc/asihjaya-rms/production.env
```

Buat file dengan user deployment dan permission terbatas:

```bash
sudo install -d -m 750 -o deploy -g deploy /etc/asihjaya-rms
sudo install -m 600 -o deploy -g deploy /dev/null /etc/asihjaya-rms/production.env
```

User yang menjadi anggota grup `docker` dapat membaca environment container melalui Docker API. Perlakukan akses grup Docker setara dengan akses administrator server.

## Persiapan lokal

Generator membuat file dari template, mengisi placeholder, menyinkronkan password PostgreSQL pada `DATABASE_URL`, dan tidak mencetak nilai secret:

```powershell
npm run env:prepare:production
npm run env:validate:production
```

Command eksplisit yang setara:

```powershell
npm run env:generate-secrets -- --write .env.production --template .env.production.example
npm run env:validate -- --mode production --deployment --env-file .env.production
```

Generator mempertahankan value non-placeholder. Menjalankannya kembali tidak mengganti secret yang sudah ada.

## Kontrak validator

Startup Node.js production selalu menjalankan validator server-side melalui `src/instrumentation.ts`. Startup dihentikan sebelum menerima traffic ketika core environment tidak valid.

Validasi deployment tambahan dijalankan sebelum Compose production melalui `npm run env:validate:production`. Pemeriksaannya mencakup:

- seluruh core secret tersedia, unik, bukan placeholder, dan memiliki entropy yang memadai;
- `APP_URL` menggunakan HTTPS untuk hostname publik;
- `NEXT_PUBLIC_APP_URL` konsisten dengan `APP_URL`;
- `TRUST_PROXY=true` untuk deployment di belakang reverse proxy;
- `DATABASE_URL`, `POSTGRES_DB`, `POSTGRES_USER`, dan `POSTGRES_PASSWORD` konsisten;
- port berada dalam rentang valid;
- aplikasi bind ke loopback dan tidak membuka Next.js langsung ke internet;
- konfigurasi S3 lengkap ketika driver S3 diaktifkan;
- batas timeout, queue, rate limit, retention, dan ukuran berada dalam rentang aman.

Pesan validator hanya menyebut nama variable dan masalahnya. Nilai secret dan URL database lengkap tidak dicetak.

## Secret yang dihasilkan lokal

Generator mengisi:

```text
POSTGRES_PASSWORD
SESSION_SECRET
RECEIPT_VERIFICATION_SECRET
CUSTOMER_HISTORY_SESSION_SECRET
CUSTOMER_HISTORY_PIN_PEPPER
SECURITY_RATE_LIMIT_SECRET
PDF_RENDER_TOKEN_SECRET
HARDWARE_AGENT_CREDENTIAL_ENCRYPTION_KEY
BOOTSTRAP_ADMIN_PASSWORD
HARDWARE_AGENT_SECRET
```

Credential object storage tidak dihasilkan oleh script karena harus berasal dari provider S3-compatible dan mengikuti policy provider tersebut.

## Pencegahan kebocoran

- `.env.production` di-ignore Git.
- Seluruh `.env*` dikeluarkan dari Docker build context.
- Dockerfile tidak menerima secret melalui `ARG` atau `ENV`.
- Jangan memakai `docker compose config` tanpa `--quiet`; output resolved config dapat memuat secret.
- Jangan memakai `set -x`, `Write-Host` terhadap isi environment, atau mengunggah file environment sebagai artifact CI.
- Jangan menempelkan isi `.env.production` ke chat, issue, PR, screenshot, atau support bundle.
- Hindari secret pada command line karena dapat terlihat pada shell history dan process list.

Validasi Compose tanpa menampilkan resolved environment:

```powershell
npm run container:production:config
```

## Rotasi application secret

Rotasi hanya dilakukan satu variable per maintenance window agar dampaknya dapat diamati. Buat backup terenkripsi dan database backup terlebih dahulu.

Contoh rotasi `SESSION_SECRET`:

```powershell
npm run env:generate-secrets -- --write .env.production --rotate SESSION_SECRET
npm run env:validate:production
```

Dampak utama:

| Variable | Dampak rotasi |
| --- | --- |
| `SESSION_SECRET` | Seluruh session pegawai aktif menjadi tidak valid. |
| `RECEIPT_VERIFICATION_SECRET` | Receipt baru memakai key baru; receipt lama memerlukan strategi multi-key sebelum rotasi. |
| `CUSTOMER_HISTORY_SESSION_SECRET` | Session akses histori customer menjadi tidak valid. |
| `CUSTOMER_HISTORY_PIN_PEPPER` | PIN tersimpan tidak dapat diverifikasi tanpa migrasi/reset. |
| `SECURITY_RATE_LIMIT_SECRET` | Bucket rate-limit lama tidak lagi cocok dan akan habis melalui retention. |
| `PDF_RENDER_TOKEN_SECRET` | Capability PDF aktif menjadi tidak valid. |
| `HARDWARE_AGENT_CREDENTIAL_ENCRYPTION_KEY` | Credential agent tersimpan harus dire-encrypt; jangan rotasi tanpa migration khusus. |
| `HARDWARE_AGENT_SECRET` | Agent outlet harus menerima secret baru pada maintenance window yang sama. |

Secret yang memengaruhi data tersimpan tidak boleh dirotasi hanya dengan mengganti file environment.

## Rotasi credential PostgreSQL

`POSTGRES_PASSWORD` sengaja tidak dapat dirotasi melalui opsi `--rotate`. Urutannya harus terkontrol:

1. Buat backup dan verifikasi backup.
2. Generate password baru melalui password manager.
3. Ubah password role PostgreSQL melalui koneksi administrator yang aman.
4. Perbarui `POSTGRES_PASSWORD` dan password pada `DATABASE_URL` secara konsisten.
5. Jalankan `npm run env:validate:production`.
6. Restart aplikasi, lalu periksa database readiness dan login.
7. Cabut credential lama bila menggunakan mekanisme transisi dual-user.

Pada database yang sudah berjalan, perubahan `POSTGRES_PASSWORD` pada Compose tidak otomatis mengubah password role di volume PostgreSQL lama.

## Rotasi credential object storage

Gunakan overlap dua access key bila provider mendukung:

1. Buat access key baru dengan scope bucket minimum.
2. Perbarui environment dan validasi.
3. Restart aplikasi dan uji upload/read/delete objek dummy.
4. Cabut access key lama setelah observasi berhasil.

Jangan menonaktifkan key lama sebelum aplikasi terbukti memakai key baru.

## Pemindahan ke VPS

Salin melalui kanal terenkripsi tanpa mencetak isi file:

```bash
scp .env.production deploy@SERVER:/tmp/asihjaya-production.env
ssh deploy@SERVER 'install -m 600 /tmp/asihjaya-production.env /etc/asihjaya-rms/production.env && rm -f /tmp/asihjaya-production.env'
```

Pada deployment VPS, jalankan Compose dengan file tersebut:

```bash
docker compose \
  --env-file /etc/asihjaya-rms/production.env \
  -f compose.production.yaml \
  config --quiet
```

Set `ASIHJAYA_ENV_FILE=/etc/asihjaya-rms/production.env` di file tersebut agar service aplikasi membaca file yang sama.

## Checklist sebelum production start

- `npm run check:production-environment` lulus.
- `npm run env:validate:production` lulus.
- File production tidak muncul pada `git status`.
- Permission Linux adalah `600`.
- Core secret tidak dipakai ulang.
- `ASIHJAYA_BIND_ADDRESS` tetap loopback.
- Backup dan pemilik credential terdokumentasi.
- Tidak ada output resolved Compose atau environment pada log CI.

## Environment database deployment

Tahap 1D.3 menambahkan konfigurasi migrator image, readiness timeout, advisory-lock timeout, DDL lock timeout, statement timeout, dan destructive migration approval. Nilai default aman tersedia di `.env.production.example`.

`DATABASE_MIGRATION_ALLOW_DESTRUCTIVE` harus tetap `false` pada operasi normal. Pengaktifan sementara wajib disertai `DATABASE_MIGRATION_APPROVAL_REFERENCE` yang dapat diaudit dan hanya dilakukan setelah backup serta review SQL. Detail lengkap tersedia di `docs/development/database-deployment.md`.
