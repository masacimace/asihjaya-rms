# Environment Configuration dan Secret Policy

Dokumen ini menetapkan aturan environment untuk local development, CI, staging, dan production Asihjaya RMS.

## Local development

Salin template dan generate value lokal yang unik:

```powershell
Copy-Item .env.example .env
npm run env:generate-secrets -- --write .env
npm run env:validate
```

Generator hanya mengganti value kosong atau `CHANGE_ME`. Value non-placeholder yang sudah ada tidak ditimpa.

## Production validation

Sebelum container production dijalankan, validasi file environment yang akan digunakan:

```powershell
npm run env:validate -- --mode production --env-file .env.production
```

Aplikasi juga menjalankan validasi ketika Node.js production server dimulai. Runtime dihentikan sebelum menerima traffic apabila konfigurasi wajib tidak valid.

Validator production memeriksa antara lain:

- `APP_URL`, `DATABASE_URL`, organization slug, dan seluruh secret inti tersedia.
- Public `APP_URL` menggunakan HTTPS.
- `TRUST_PROXY=true` untuk hostname production non-loopback.
- Secret minimal 32 karakter, bukan placeholder, dan tidak dipakai ulang.
- PostgreSQL URL memiliki database dan credential.
- Konfigurasi S3 lengkap ketika `IMAGE_STORAGE_DRIVER=s3`.
- Hardware Hub tidak memakai `legacy-only` sebagai konfigurasi production normal.
- Nilai boolean, enum, ukuran, timeout, retention, queue, dan rate limit berada dalam batas yang diterima.

Pesan error hanya menyebut nama variable dan masalahnya. Nilai secret tidak dicetak.

## Secret yang wajib dipisahkan

Gunakan value acak yang berbeda untuk setiap variable berikut:

```text
SESSION_SECRET
RECEIPT_VERIFICATION_SECRET
CUSTOMER_HISTORY_SESSION_SECRET
CUSTOMER_HISTORY_PIN_PEPPER
SECURITY_RATE_LIMIT_SECRET
PDF_RENDER_TOKEN_SECRET
HARDWARE_AGENT_CREDENTIAL_ENCRYPTION_KEY
```

Generate satu set baru melalui:

```powershell
npm run env:generate-secrets
```

Untuk menyiapkan file production lokal sebelum dipindahkan ke VPS:

```powershell
Copy-Item .env.example .env.production
npm run env:generate-secrets -- --write .env.production
npm run env:validate -- --mode production --env-file .env.production
```

Output dapat disimpan langsung ke secret manager atau file environment production di VPS. Jangan mengirim output ke chat, issue, pull request, atau log CI.

## Rotation impact

- `SESSION_SECRET`: seluruh session pegawai aktif menjadi tidak valid.
- `RECEIPT_VERIFICATION_SECRET`: QR receipt baru memakai key baru; kebijakan verifikasi receipt lama harus direncanakan sebelum rotasi.
- `CUSTOMER_HISTORY_SESSION_SECRET`: session akses histori pelanggan menjadi tidak valid.
- `CUSTOMER_HISTORY_PIN_PEPPER`: seluruh PIN pelanggan harus direset apabila value hilang atau berubah.
- `SECURITY_RATE_LIMIT_SECRET`: hash bucket rate limit lama tidak lagi cocok dan akan kedaluwarsa melalui retention.
- `PDF_RENDER_TOKEN_SECRET`: capability PDF yang belum kedaluwarsa menjadi tidak valid.
- `HARDWARE_AGENT_CREDENTIAL_ENCRYPTION_KEY`: credential agent tersimpan tidak dapat didekripsi tanpa proses rotasi data yang terencana.

Jangan merotasi secret yang berdampak pada data tersimpan tanpa runbook dan backup.

## Bootstrap seed

Variable `BOOTSTRAP_*` hanya dipakai oleh `npm run db:seed`. Seed menolak password pendek dan placeholder.

```powershell
npm run env:validate -- --mode production
npm run db:seed
```

Setelah bootstrap production berhasil, simpan credential administrator di password manager dan jangan biarkan password default berada di dokumentasi atau shell history.

## Reverse proxy target

Untuk jalur berikut:

```text
Browser → Cloudflare → Nginx/Caddy VPS → Next.js
```

gunakan:

```dotenv
APP_URL=https://ajsystem.id
TRUST_PROXY=true
TRUST_PROXY_HOPS=2
```

`INTERNAL_RENDER_ORIGIN` tetap menunjuk service lokal yang dipercaya, biasanya:

```dotenv
INTERNAL_RENDER_ORIGIN=http://127.0.0.1:3000
```

## File management

- `.env`, `.env.production`, dan file credential tidak boleh dilacak Git.
- `.env.example` hanya berisi placeholder.
- Permission file production sebaiknya `600` dan hanya dapat dibaca user deployment.
- Secret production sebaiknya disediakan melalui Docker Compose `env_file`, Docker secret, atau secret manager; jangan ditulis ke Dockerfile maupun image layer.
