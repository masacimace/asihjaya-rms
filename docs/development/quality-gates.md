# Quality Gates dan Continuous Integration

Dokumen ini menetapkan pemeriksaan minimum sebelum perubahan Asihjaya RMS digabungkan atau dideploy.

## Prinsip

- Toolchain development dikunci pada Node.js `24.14.0` dan npm `11.9.0`.
- Dependency selalu dipasang dengan `npm ci` agar mengikuti `package-lock.json`.
- SheetJS CE dipasang dari archive `vendor/`, bukan diambil dari CDN pada setiap build.
- Command lokal dan GitHub Actions menggunakan npm script yang sama.
- Database CI selalu disposable dan tidak pernah memakai database development atau production.
- Secret CI hanya nilai dummy dengan entropy/panjang yang memenuhi validator aplikasi.
- Setiap check harus menguji perilaku atau kontrak aktif; check milestone berbasis pencarian teks dipensiunkan.

## Command lokal

Pemeriksaan lengkap tanpa mengubah database:

```bash
npm ci
npm run check:build-baseline
npm run check:production-container
npm run check:production-environment
npm run check:environment
npm run check:all
```

Kelompok pemeriksaan:

```bash
npm run check:build-baseline
npm run check:production-container
npm run check:production-environment
npm run check:quality
npm run check:static
npm run check:security
npm run check:environment
npm run check:pos-stage-1c
npm run check:transactions
npm run check:business
npm run check:hardware
npm run build
```

Financial/concurrency integration test menggunakan PostgreSQL disposable dan dijalankan terpisah:

```bash
npm run test:financial:local
```

Untuk database test yang sudah dimigrasikan, gunakan `npm run test:financial`. Dokumentasi lengkap tersedia di `docs/development/financial-concurrency-tests.md`.

`check:quality` mencakup konfigurasi quality gate, reproducible build baseline, production container, source hygiene, dan metadata migration. `check:static` mencakup ESLint, TypeScript, serta route contract. `check:security` mencakup kontrak environment server, template deployment production, generator secret non-leaking, dan pemisahan secret. `check:pos-stage-1c` menggabungkan seluruh kontrak hasil modularisasi checkout, payment, scanner, cart, customer, held cart, katalog, dialog, result/shift, dan workspace composition. `check:transactions` menambahkan fingerprint/recovery checkout, rekonsiliasi nominal cash/mixed payment/Dana Titip, manual payment, sale correction, reconciliation, dan settlement import.

Clean build menghapus output lama sebelum membuat production bundle:

```bash
npm run build:clean
```

Production image harus dapat dibangun dari fresh Docker context:

```bash
docker build --pull --tag asihjaya-rms:local .
```

Kontrak dan smoke test production container:

```bash
npm run check:production-container
npm run test:container:production:local
```

Compose production, batas resource, volume, health/readiness, dan troubleshooting didokumentasikan di `docs/development/production-container.md`.

Template production, validator deployment, permission file, dan secret rotation didokumentasikan di `docs/development/production-environment.md`.

```bash
npm run env:prepare:production
npm run env:validate:production
```

## Finalisasi POS Stage 1C

Gunakan runner berikut untuk gate final refactor POS:

```bash
npm run verify:pos-stage-1c
```

Untuk validasi lokal lengkap dengan PostgreSQL disposable dan financial/concurrency suite:

```bash
npm run verify:pos-stage-1c:local
```

Checklist smoke test, review, merge, dan rollback tersedia di `docs/development/pos-stage-1c-stabilization.md`.

## Rehearsal migration PostgreSQL 17

Gunakan database kosong/disposable. Jangan arahkan command ini ke database production.

```bash
npm run check:database
npm run db:migrate
npm run db:migrate
npm run check:database:live
```

Pemanggilan migration kedua harus menjadi no-op. Pemeriksaan live memvalidasi:

- PostgreSQL major version 17.
- Jumlah migration sesuai Drizzle journal.
- Tabel security, customer history, deposit, sales, dan Hardware Hub tersedia.
- Kolom kritis dari migration terbaru tersedia.

## Klasifikasi check script

Semua `scripts/check-*` harus tercatat pada `scripts/check-suite-manifest.json`.

- `blocking`: kontrak aktif yang wajib lulus pada pull request.
- `infrastructure`: pemeriksaan CI, source hygiene, dan migration.
- `manual`: kontrak aktif yang memerlukan runtime khusus, misalnya Chromium untuk rendering PDF.

Check lama berbasis milestone atau pencarian potongan source harus diganti dengan assertion perilaku, dipindahkan ke suite aktif, atau dipensiunkan secara eksplisit.

## Source hygiene

`npm run check:source-hygiene` memeriksa file yang dilacak Git dan menolak antara lain:

- `.env` dan credential lokal.
- `node_modules`, `.next`, report, dan test output.
- SQLite journal, key, log, serta artefak simulasi Hardware Hub.
- Database dump dan backup.
- Private key atau pola token berisiko tinggi.

`.env.example`, `.env.production.example`, dan template Hardware Hub tetap diperbolehkan karena hanya berisi placeholder atau value non-secret.

## GitHub Actions

Workflow `.github/workflows/ci.yml` berjalan pada push, pull request, dan manual dispatch. Workflow membatalkan run lama ketika commit baru masuk pada ref yang sama.

Status check utama:

1. **Static Quality** — install, lint, typecheck, route check, dan clean production build.
2. **Container Build** — membangun production Docker image dari context bersih.
3. **Security & Business Checks** — quality config, source hygiene, migration metadata, security contracts, business contracts, dan kontrak hardware sisi aplikasi.
4. **Database Migration** — PostgreSQL 17 disposable, migration dua kali, lalu schema verification.
5. **Hardware Hub Checks** — request signing, DPAPI mock, Protocol v2, failure injection, operations, PDF profile, dan SATO golden files.
6. **Financial & Concurrency Tests** — PostgreSQL 17 disposable, checkout race/retry fencing, inventory race, Dana Titip, duplicate payment reference, refund replay, shift closing, settlement deduplication, hardware exactly-once, dan tenant isolation.

CI tidak melakukan print fisik, tidak mengakses perangkat outlet, dan tidak memakai credential production.

## Pemeriksaan manual sebelum release

Jalankan kontrak otomatis yang memerlukan Chromium melalui:

```bash
npm run check:manual
```

Pemeriksaan berikut tetap manual sampai workflow browser/hardware khusus tersedia:

- Kamera scanner pada browser target.
- PDF Playwright menggunakan Chromium production image dan hasil visualnya.
- Print Epson A4 pada kertas nyata.
- Alignment label SATO CG408TT.
- Startup task dan DPAPI nyata pada Windows outlet.
- End-to-end Hardware Hub dengan perangkat fisik.

## Branch protection yang disarankan

Setelah workflow stabil pada beberapa pull request, lindungi branch utama dan wajibkan status:

- Static Quality
- Container Build
- Security & Business Checks
- Database Migration
- Hardware Hub Checks
- Financial & Concurrency Tests

Nonaktifkan force push dan direct push ke branch production, lalu gunakan pull request untuk perubahan aplikasi.

## Troubleshooting

### CI lulus tetapi lokal gagal

Pastikan Node dan npm mengikuti `.nvmrc` serta `packageManager`, jalankan `npm run clean`, lalu ulangi `npm ci`.

### Migration rehearsal gagal

Periksa bahwa database benar-benar kosong, PostgreSQL versi 17, `DATABASE_URL` benar, dan file migration telah masuk ke `drizzle/meta/_journal.json`.

### Source hygiene gagal

Hapus file sensitif dari Git tracking, bukan hanya dari filesystem:

```bash
git rm --cached <file>
```

Kemudian pastikan pola yang sesuai sudah ada di `.gitignore`.

## Database deployment safety

Jalur migration production diverifikasi melalui:

```bash
npm run check:database-deployment
npm run test:database-deployment:local
```

Static check memvalidasi journal/hash, destructive-operation guard, advisory lock, migrator image, dan dependency ordering Compose. Rehearsal lokal memakai PostgreSQL 17 disposable untuk membuktikan concurrency lock, idempotent no-op, history drift rejection, serta destructive migration approval boundary.

CI dan runbook production wajib memakai `npm run db:deploy`. `npm run db:migrate` adalah primitive internal dan tidak boleh dipanggil langsung oleh deployment production.

## Backup dan restore PostgreSQL

Kontrak static:

```bash
npm run check:database-backup
```

Disposable rehearsal dengan PostgreSQL 17 dan Docker:

```bash
npm run test:database-backup:local
```

Check static memvalidasi custom-format archive, metadata, SHA-256, disk guard, retention, guarded production restore, package scripts, environment template, dan dokumentasi. Rehearsal membuktikan archive dapat dipulihkan, transaksi dummy tetap terbaca, backup rusak ditolak, serta retention tidak menghapus backup terbaru, manual, atau protected.

GitHub Actions menjalankan job **Database Backup & Restore Rehearsal** secara terpisah.

## Automated off-site backup

Kontrak Backblaze B2:

```bash
npm run check:database-backup-offsite
```

Rehearsal tanpa credential production memakai object store in-memory:

```bash
npm run test:database-backup-offsite:local
```

Rehearsal membuktikan upload empat-object, idempotency, Object Lock boundary, full SHA-256 verification, corruption rejection, download, dan remote retention. GitHub Actions menjalankannya pada job **Database Backup & Restore Rehearsal** tanpa mengakses bucket production.