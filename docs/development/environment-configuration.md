# Environment Configuration dan Secret Policy

Dokumen ini merangkum aturan environment untuk development dan mengarahkan konfigurasi production ke runbook khusus.

## Local development

Salin template dan generate value lokal yang unik:

```powershell
Copy-Item .env.example .env
npm run env:generate-secrets -- --write .env --template .env.example
npm run env:validate
```

Generator hanya mengisi placeholder atau value kosong. Value existing tidak ditimpa dan nilai secret tidak dicetak ke terminal.

## Production

Gunakan template terpisah:

```powershell
npm run env:prepare:production
npm run env:validate:production
```

Aplikasi juga menjalankan validasi core environment saat Node.js production server dimulai. Runtime dihentikan sebelum menerima traffic apabila konfigurasi wajib tidak valid.

Runbook lengkap, lokasi file VPS, permission, pencegahan kebocoran, dan prosedur rotasi tersedia di:

```text
docs/development/production-environment.md
```

## Core application secrets

Setiap variable berikut harus memakai value acak yang berbeda:

```text
SESSION_SECRET
RECEIPT_VERIFICATION_SECRET
CUSTOMER_HISTORY_SESSION_SECRET
CUSTOMER_HISTORY_PIN_PEPPER
SECURITY_RATE_LIMIT_SECRET
PDF_RENDER_TOKEN_SECRET
HARDWARE_AGENT_CREDENTIAL_ENCRYPTION_KEY
```

Jangan menempelkan isi environment ke chat, issue, pull request, screenshot, log CI, atau support bundle.

## Bootstrap seed

Variable `BOOTSTRAP_*` hanya dipakai oleh `npm run db:seed`. Seed menolak password pendek dan placeholder.

```powershell
npm run env:validate:production
npm run db:seed
```

Setelah bootstrap berhasil, simpan credential administrator di password manager.

## Reverse proxy target

Untuk jalur berikut:

```text
Browser → Cloudflare → reverse proxy VPS → Next.js
```

gunakan `APP_URL=https://ajsystem.id`, `TRUST_PROXY=true`, dan `TRUST_PROXY_HOPS=2`. `INTERNAL_RENDER_ORIGIN` tetap menunjuk service internal terpercaya.
